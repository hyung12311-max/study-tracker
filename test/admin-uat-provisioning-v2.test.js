const assert = require("node:assert/strict");
const test = require("node:test");

const utils = require("../server/api/admin/_utils");
const handler = require("../server/api/admin/uat/provision-family-v2");
const familyUtils = require("../server/api/family/_utils");
const membersHandler = require("../server/api/family/members");
const childLoginHandler = require("../server/api/family/child-login");
const verifyPinHandler = require("../server/api/family/verify-pin");

const ADMIN_SECRET = "local-test-admin-secret-32-characters-minimum";
const REQUEST_ID = "10000000-0000-4000-8000-000000000021";
const IDS = Object.freeze({
  family: "20000000-0000-4000-8000-000000000021",
  parent: "20000000-0000-4000-8000-000000000022",
  child1: "20000000-0000-4000-8000-000000000023",
  child2: "20000000-0000-4000-8000-000000000024",
  familyB: "30000000-0000-4000-8000-000000000021",
  parentB: "30000000-0000-4000-8000-000000000022",
  childB: "30000000-0000-4000-8000-000000000023",
});

function responseCapture() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    getHeader(name) { return this.headers[name]; },
    end(value) { this.body = JSON.parse(value); },
  };
}

function cookieContract(response) {
  const value = String(response.headers["Set-Cookie"] || "");
  return {
    present: value.startsWith(`${familyUtils.BOOTSTRAP_COOKIE}=`),
    httpOnly: /(?:^|; )HttpOnly(?:;|$)/.test(value),
    sameSiteStrict: /(?:^|; )SameSite=Strict(?:;|$)/.test(value),
    rootPath: /(?:^|; )Path=\/(?:;|$)/.test(value),
    eightHours: /(?:^|; )Max-Age=28800(?:;|$)/.test(value),
    secure: /(?:^|; )Secure(?:;|$)/.test(value),
  };
}

function cookieRequestHeader(response) {
  return String(response.headers["Set-Cookie"] || "").split(";", 1)[0];
}

function replaceFamilyUtils(overrides) {
  const originals = {};
  for (const [key, value] of Object.entries(overrides)) {
    originals[key] = familyUtils[key];
    familyUtils[key] = value;
  }
  return () => Object.assign(familyUtils, originals);
}

function payload(overrides = {}) {
  return {
    requestId: REQUEST_ID,
    purpose: "uat",
    familyLabel: "uat-b6-family-a",
    parent: { displayName: "UAT Parent A", pin: "5827" },
    children: [
      { displayName: "UAT Child A1", pin: "6941" },
      { displayName: "UAT Child A2", pin: "7385" },
    ],
    ...overrides,
  };
}

function request(body = payload(), headers = {}) {
  return {
    method: "POST",
    url: "/api/admin/uat/provision-family-v2",
    headers: {
      host: "study.example",
      origin: "https://study.example",
      "x-forwarded-proto": "https",
      "content-type": "application/json",
      "x-study-csrf": "1",
      authorization: `Bearer ${ADMIN_SECRET}`,
      ...headers,
    },
    testBody: body,
  };
}

function success(children = [
  { id: IDS.child1, member_key: "child1" },
  { id: IDS.child2, member_key: "child2" },
]) {
  return [{ family_id: IDS.family, parent_member_id: IDS.parent, children, created: true }];
}

async function call({ body = payload(), headers, method = "POST", fetchResult = success(), fetchError, inspectRpc, familyAuthConfigured = true } = {}) {
  const originalSecret = process.env.UAT_PROVISIONING_SECRET;
  const originalFamilySecret = process.env.FAMILY_AUTH_SECRET;
  const originalReadJson = utils.push.readJson;
  const originalFetch = utils.push.supabaseFetch;
  let calls = 0;
  process.env.UAT_PROVISIONING_SECRET = ADMIN_SECRET;
  if (familyAuthConfigured) process.env.FAMILY_AUTH_SECRET = "f".repeat(48);
  else delete process.env.FAMILY_AUTH_SECRET;
  utils.push.readJson = async (req) => req.testBody;
  utils.push.supabaseFetch = async (path, options) => {
    calls += 1;
    assert.equal(path, "rpc/provision_uat_family_v2");
    assert.equal(options.method, "POST");
    if (inspectRpc) inspectRpc(JSON.parse(options.body));
    if (fetchError) throw fetchError;
    return fetchResult;
  };
  try {
    const req = request(body, headers);
    req.method = method;
    const response = responseCapture();
    await handler(req, response);
    return { response, calls };
  } finally {
    utils.push.readJson = originalReadJson;
    utils.push.supabaseFetch = originalFetch;
    if (originalSecret === undefined) delete process.env.UAT_PROVISIONING_SECRET;
    else process.env.UAT_PROVISIONING_SECRET = originalSecret;
    if (originalFamilySecret === undefined) delete process.env.FAMILY_AUTH_SECRET;
    else process.env.FAMILY_AUTH_SECRET = originalFamilySecret;
  }
}

test("v2 requires the dedicated admin mutation boundary", async () => {
  for (const item of [
    { method: "GET", expected: 405 },
    { headers: { authorization: "" }, expected: 401 },
    { headers: { authorization: "Bearer parent-session" }, expected: 403 },
    { headers: { "content-type": "text/plain" }, expected: 415 },
    { headers: { "x-study-csrf": "" }, expected: 403 },
    { headers: { origin: "https://evil.example" }, expected: 403 },
  ]) {
    const { response, calls } = await call(item);
    assert.equal(response.statusCode, item.expected);
    assert.equal(calls, 0);
    assert.equal(cookieContract(response).present, false);
  }
});

test("v2 provisions one Parent and two server-keyed Children through one RPC", async () => {
  const { response, calls } = await call({
    inspectRpc: (rpc) => {
      assert.equal(rpc.p_parent_member_key, "parent");
      assert.deepEqual(rpc.p_children.map((child) => child.member_key), ["child1", "child2"]);
      assert.equal(rpc.p_request_digest.length, 64);
      assert.equal(Object.hasOwn(rpc, "p_family_id"), false);
      assert.equal(Object.hasOwn(rpc.p_children[0], "id"), false);
    },
  });
  assert.equal(calls, 1);
  assert.equal(response.statusCode, 201);
  assert.deepEqual(cookieContract(response), {
    present: true,
    httpOnly: true,
    sameSiteStrict: true,
    rootPath: true,
    eightHours: true,
    secure: true,
  });
  assert.deepEqual(response.body.family, { id: IDS.family, key: "uat-b6-family-a" });
  assert.deepEqual(response.body.children.map(({ memberKey }) => memberKey), ["child1", "child2"]);
  assert.doesNotMatch(JSON.stringify(response.body), /5827|6941|7385|pin|credential|token|hash/i);
});

test("v2 fails safely before RPC when family authentication is not configured", async () => {
  const { response, calls } = await call({ familyAuthConfigured: false });
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.code, "FAMILY_AUTH_NOT_CONFIGURED");
  assert.equal(calls, 0);
  assert.deepEqual(cookieContract(response), {
    present: false,
    httpOnly: false,
    sameSiteStrict: false,
    rootPath: false,
    eightHours: false,
    secure: false,
  });
  assert.doesNotMatch(JSON.stringify(response.body), /FAMILY_AUTH_SECRET|environment|secret/i);
});

test("v2 supports the minimum one-child topology", async () => {
  const body = payload({ children: [{ displayName: "UAT Only Child", pin: "6941" }] });
  const { response, calls } = await call({
    body,
    fetchResult: success([{ id: IDS.child1, member_key: "child1" }]),
    inspectRpc: (rpc) => assert.deepEqual(rpc.p_children.map((child) => child.member_key), ["child1"]),
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.children.length, 1);
  assert.equal(calls, 1);
});

test("v2 rejects zero or excessive children before database access", async () => {
  for (const children of [[], Array.from({ length: 6 }, (_, index) => ({ displayName: `UAT Child ${index + 1}`, pin: `7${index + 1}8${index + 2}` }))]) {
    const { response, calls } = await call({ body: payload({ children }) });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "INVALID_CHILD_COUNT");
    assert.equal(calls, 0);
  }
});

test("v2 rejects invalid or reused bootstrap PINs before database access", async () => {
  for (const children of [
    [{ displayName: "UAT Child A1", pin: "1234" }],
    [{ displayName: "UAT Child A1", pin: "5827" }],
    [{ displayName: "UAT Child A1", pin: "6941" }, { displayName: "UAT Child A2", pin: "6941" }],
  ]) {
    const { response, calls } = await call({ body: payload({ children }) });
    assert.equal(response.statusCode, 400);
    assert.equal(calls, 0);
  }
});

test("v2 rejects client ownership, member-key, and identifier overrides", async () => {
  const invalid = [
    { ...payload(), family_id: IDS.family },
    payload({ parent: { displayName: "UAT Parent A", pin: "5827", memberKey: "other-parent" } }),
    payload({ children: [{ displayName: "UAT Child A1", pin: "6941", memberKey: "child9" }] }),
    payload({ children: [{ displayName: "UAT Child A1", pin: "6941", id: IDS.child1 }] }),
  ];
  for (const body of invalid) {
    const { response, calls } = await call({ body });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "FIELD_NOT_ALLOWED");
    assert.equal(calls, 0);
  }
});

test("v2 maps request and family collisions without private database details", async () => {
  for (const [message, code] of [
    ["UAT_REQUEST_CONFLICT private request", "UAT_REQUEST_CONFLICT"],
    ["UAT_FAMILY_CONFLICT private family", "UAT_FAMILY_CONFLICT"],
  ]) {
    const error = new Error("database conflict");
    error.supabaseCode = "55000";
    error.supabaseMessage = message;
    const { response, calls } = await call({ fetchError: error });
    assert.equal(response.statusCode, 409);
    assert.equal(response.body.code, code);
    assert.equal(calls, 1);
    assert.doesNotMatch(JSON.stringify(response.body), /private/);
  }
});

test("v2 rejects malformed database results without exposing identifiers or internals", async () => {
  for (const fetchResult of [
    [],
    [{ created: false }],
    [{ created: true, children: [] }],
    [{ family_id: "not-an-id", parent_member_id: IDS.parent, children: success()[0].children, created: true }],
    [{ family_id: IDS.family, parent_member_id: IDS.parent, children: [{ id: IDS.child1, member_key: "child2" }, { id: IDS.child2, member_key: "child1" }], created: true }],
  ]) {
    const { response } = await call({ fetchResult });
    assert.equal(response.statusCode, 500);
    assert.equal(response.body.code, "PROVISIONING_FAILED");
    assert.equal(cookieContract(response).present, false);
    assert.doesNotMatch(JSON.stringify(response.body), /database|family_id|member_id/i);
  }
});

test("v2 bootstrap cookies keep two provisioned families isolated through member and login flows", async () => {
  const previousSecret = process.env.FAMILY_AUTH_SECRET;
  process.env.FAMILY_AUTH_SECRET = "f".repeat(48);
  const familyA = await call();
  const familyB = await call({
    body: payload({
      familyLabel: "uat-b6-family-b",
      requestId: "10000000-0000-4000-8000-000000000031",
      parent: { displayName: "UAT Parent B", pin: "4816" },
      children: [{ displayName: "UAT Child B1", pin: "6259" }],
    }),
    fetchResult: success([{ id: IDS.childB, member_key: "child1" }]).map((row) => ({
      ...row,
      family_id: IDS.familyB,
      parent_member_id: IDS.parentB,
    })),
  });
  const jarA = cookieRequestHeader(familyA.response);
  const jarB = cookieRequestHeader(familyB.response);
  const observed = [];
  const restore = replaceFamilyUtils({
    readJson: async (req) => req.testBody,
    supabaseFetch: async (path, options = {}) => {
      observed.push({ path, body: options.body ? JSON.parse(options.body) : null });
      if (path === "rpc/verify_family_parent_pin") {
        const rpc = JSON.parse(options.body);
        if (rpc.p_family_id === IDS.family && rpc.p_member_id === IDS.parent) {
          return [{ member_id: IDS.parent, family_id: IDS.family, member_key: "parent", display_name: "UAT Parent A", role: "parent", verified: true }];
        }
        return [{ verified: false }];
      }
      if (path.includes(`family_id=eq.${IDS.familyB}`) && path.includes(`id=eq.${IDS.childB}`)) {
        return [{ id: IDS.childB, family_id: IDS.familyB, member_key: "child1", display_name: "UAT Child B1", role: "child", avatar_emoji: null, is_active: true }];
      }
      if (path.startsWith("family_members?select=id,display_name")) {
        const familyId = path.includes(IDS.familyB) ? IDS.familyB : IDS.family;
        return [{ id: familyId === IDS.familyB ? IDS.childB : IDS.child1, display_name: "UAT Child", role: "child", avatar_emoji: null, is_active: true }];
      }
      return [];
    },
    signToken: () => "local-test-session",
    signRealtimeToken: () => "local-test-realtime",
    revokeDeviceSession: async () => false,
    clearDeviceCookie: () => {},
  });
  try {
    const scopeA = await familyUtils.trustedFamilyScope({ headers: { cookie: jarA } }, responseCapture());
    const scopeB = await familyUtils.trustedFamilyScope({ headers: { cookie: jarB } }, responseCapture());
    assert.deepEqual({ a: scopeA.familyId, b: scopeB.familyId, distinct: scopeA.familyId !== scopeB.familyId }, {
      a: IDS.family,
      b: IDS.familyB,
      distinct: true,
    });

    for (const cookie of [jarA, jarB]) {
      const response = responseCapture();
      await membersHandler({ method: "GET", headers: { cookie } }, response);
      assert.equal(response.statusCode, 200);
      assert.equal(response.body.members.length, 1);
    }

    const parentResponse = responseCapture();
    await verifyPinHandler({ method: "POST", headers: { cookie: jarA }, testBody: { memberId: IDS.parent, pin: "5827", rememberDevice: false } }, parentResponse);
    assert.equal(parentResponse.statusCode, 200);
    assert.equal(parentResponse.body.member.family_id, IDS.family);

    const childResponse = responseCapture();
    await childLoginHandler({ method: "POST", headers: { cookie: jarB }, testBody: { memberId: IDS.childB, rememberDevice: false } }, childResponse);
    assert.equal(childResponse.statusCode, 200);
    assert.equal(childResponse.body.member.family_id, IDS.familyB);

    const crossParentResponse = responseCapture();
    await verifyPinHandler({ method: "POST", headers: { cookie: jarA }, testBody: { memberId: IDS.parentB, pin: "4816", rememberDevice: false } }, crossParentResponse);
    assert.equal(crossParentResponse.statusCode, 401);

    const crossChildResponse = responseCapture();
    await childLoginHandler({ method: "POST", headers: { cookie: jarA }, testBody: { memberId: IDS.childB, rememberDevice: false } }, crossChildResponse);
    assert.equal(crossChildResponse.statusCode, 404);
    assert.equal(observed.some(({ path, body }) => path === "rpc/verify_family_parent_pin" && body.p_family_id === IDS.family && body.p_member_id === IDS.parentB), true);
    assert.equal(observed.some(({ path }) => path.includes(`id=eq.${IDS.childB}`) && path.includes(`family_id=eq.${IDS.family}`)), true);
  } finally {
    restore();
    if (previousSecret === undefined) delete process.env.FAMILY_AUTH_SECRET;
    else process.env.FAMILY_AUTH_SECRET = previousSecret;
  }
});
