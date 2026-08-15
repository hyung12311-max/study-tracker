const assert = require("node:assert/strict");
const test = require("node:test");

const utils = require("../server/api/admin/_utils");
const handler = require("../server/api/admin/uat/provision-family-v2");

const ADMIN_SECRET = "local-test-admin-secret-32-characters-minimum";
const REQUEST_ID = "10000000-0000-4000-8000-000000000021";
const IDS = Object.freeze({
  family: "20000000-0000-4000-8000-000000000021",
  parent: "20000000-0000-4000-8000-000000000022",
  child1: "20000000-0000-4000-8000-000000000023",
  child2: "20000000-0000-4000-8000-000000000024",
});

function responseCapture() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
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

async function call({ body = payload(), headers, method = "POST", fetchResult = success(), fetchError, inspectRpc } = {}) {
  const originalSecret = process.env.UAT_PROVISIONING_SECRET;
  const originalReadJson = utils.push.readJson;
  const originalFetch = utils.push.supabaseFetch;
  let calls = 0;
  process.env.UAT_PROVISIONING_SECRET = ADMIN_SECRET;
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
  assert.deepEqual(response.body.family, { id: IDS.family, key: "uat-b6-family-a" });
  assert.deepEqual(response.body.children.map(({ memberKey }) => memberKey), ["child1", "child2"]);
  assert.doesNotMatch(JSON.stringify(response.body), /5827|6941|7385|pin|credential|token|hash/i);
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
    assert.doesNotMatch(JSON.stringify(response.body), /database|family_id|member_id/i);
  }
});
