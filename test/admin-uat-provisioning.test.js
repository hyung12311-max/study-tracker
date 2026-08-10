const assert = require("node:assert/strict");
const test = require("node:test");

const utils = require("../server/api/admin/_utils");
const handler = require("../server/api/admin/uat/provision-family");

const ADMIN_SECRET = "local-test-admin-secret-32-characters-minimum";
const REQUEST_ID = "10000000-0000-4000-8000-000000000001";

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
    familyLabel: "uat-final-one",
    parent: { displayName: "UAT Parent", pin: "5827" },
    child: { displayName: "UAT Child", pin: "6941" },
    ...overrides,
  };
}

function request(body = payload(), headers = {}) {
  return {
    method: "POST",
    url: "/api/admin/uat/provision-family",
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

async function call({ body = payload(), headers, method = "POST", fetchResult = [{ created: true }], fetchError } = {}) {
  const originalSecret = process.env.UAT_PROVISIONING_SECRET;
  const originalReadJson = utils.push.readJson;
  const originalFetch = utils.push.supabaseFetch;
  let calls = 0;
  process.env.UAT_PROVISIONING_SECRET = ADMIN_SECRET;
  utils.push.readJson = async (req) => req.testBody;
  utils.push.supabaseFetch = async (path, options) => {
    calls += 1;
    if (fetchError) throw fetchError;
    assert.equal(path, "rpc/provision_uat_family");
    assert.equal(options.method, "POST");
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

test("UAT provisioning requires the dedicated admin bearer and rejects a normal parent token", async () => {
  for (const authorization of [undefined, "Bearer parent-family-session-token"]) {
    const headers = {};
    if (authorization === undefined) headers.authorization = "";
    else headers.authorization = authorization;
    const { response, calls } = await call({ headers });
    assert.equal(response.statusCode, authorization === undefined ? 401 : 403);
    assert.equal(calls, 0);
  }
});

test("mutation guard enforces POST JSON CSRF and same origin before provisioning", async () => {
  const cases = [
    { method: "GET", expected: 405 },
    { headers: { "content-type": "text/plain" }, expected: 415 },
    { headers: { "x-study-csrf": "" }, expected: 403 },
    { headers: { origin: "https://evil.example" }, expected: 403 },
  ];
  for (const item of cases) {
    const { response, calls } = await call(item);
    assert.equal(response.statusCode, item.expected);
    assert.equal(calls, 0);
  }
});

test("strict validation permits only explicit UAT family, actors, and non-shared bootstrap PINs", async () => {
  const invalid = [
    payload({ purpose: "customer" }),
    payload({ familyLabel: "family-one" }),
    payload({ parent: { displayName: "Parent", pin: "5827" } }),
    payload({ child: { displayName: "UAT Child", pin: "1234" } }),
    payload({ child: { displayName: "UAT Child", pin: "5827" } }),
    { ...payload(), unexpected: true },
  ];
  for (const body of invalid) {
    const { response, calls } = await call({ body });
    assert.equal(response.statusCode, 400);
    assert.equal(calls, 0);
  }
});

test("valid provisioning calls one atomic RPC and returns no UUID or credential", async () => {
  let rpcBody;
  const originalFetch = utils.push.supabaseFetch;
  utils.push.supabaseFetch = async (_path, options) => {
    rpcBody = JSON.parse(options.body);
    return [{
      family_id: "20000000-0000-4000-8000-000000000001",
      parent_member_id: "20000000-0000-4000-8000-000000000002",
      child_member_id: "20000000-0000-4000-8000-000000000003",
      created: true,
    }];
  };
  const originalSecret = process.env.UAT_PROVISIONING_SECRET;
  const originalReadJson = utils.push.readJson;
  process.env.UAT_PROVISIONING_SECRET = ADMIN_SECRET;
  utils.push.readJson = async (req) => req.testBody;
  try {
    const response = responseCapture();
    await handler(request(), response);
    assert.equal(response.statusCode, 201);
    assert.equal(response.body.created, true);
    assert.equal(rpcBody.p_family_key, "uat-final-one");
    assert.equal(rpcBody.p_parent_member_key, "uat-final-one-parent");
    assert.equal(rpcBody.p_child_member_key, "uat-final-one-child");
    assert.equal(rpcBody.p_request_digest.length, 64);
    const publicResponse = JSON.stringify(response.body);
    assert.doesNotMatch(publicResponse, /5827|6941|20000000-0000-4000-8000-/);
    assert.doesNotMatch(publicResponse, /pin|credential/i);
  } finally {
    utils.push.supabaseFetch = originalFetch;
    utils.push.readJson = originalReadJson;
    if (originalSecret === undefined) delete process.env.UAT_PROVISIONING_SECRET;
    else process.env.UAT_PROVISIONING_SECRET = originalSecret;
  }
});

test("same request response is idempotent and does not expose database identifiers", async () => {
  const { response, calls } = await call({ fetchResult: [{
    family_id: "20000000-0000-4000-8000-000000000001",
    parent_member_id: "20000000-0000-4000-8000-000000000002",
    child_member_id: "20000000-0000-4000-8000-000000000003",
    created: false,
  }] });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.created, false);
  assert.equal(calls, 1);
  assert.deepEqual(Object.keys(response.body.family), ["key"]);
});

test("database conflicts are stable and unexpected internals are generalized", async () => {
  const conflict = new Error("database rejected request");
  conflict.supabaseCode = "55000";
  conflict.supabaseMessage = "IDEMPOTENCY_CONFLICT private detail";
  let result = await call({ fetchError: conflict });
  assert.equal(result.response.statusCode, 409);
  assert.equal(result.response.body.code, "IDEMPOTENCY_CONFLICT");
  assert.doesNotMatch(JSON.stringify(result.response.body), /private detail/);

  const unexpected = new Error("sensitive database details");
  result = await call({ fetchError: unexpected });
  assert.equal(result.response.statusCode, 500);
  assert.equal(result.response.body.code, "PROVISIONING_FAILED");
  assert.doesNotMatch(JSON.stringify(result.response.body), /sensitive database details/);
});
