const assert = require("node:assert/strict");
const test = require("node:test");

const utils = require("../server/api/family/_utils");
const membersHandler = require("../server/api/family/members");
const childLoginHandler = require("../server/api/family/child-login");
const verifyPinHandler = require("../server/api/family/verify-pin");

const FAMILY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FAMILY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MEMBER_A = "aaaaaaaa-0000-4000-8000-000000000001";
const MEMBER_B = "bbbbbbbb-0000-4000-8000-000000000001";

function responseCapture() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    getHeader(name) { return this.headers[name]; },
    end(value) { this.body = JSON.parse(value); },
  };
}

function replaceUtils(overrides) {
  const originals = {};
  for (const [key, value] of Object.entries(overrides)) {
    originals[key] = utils[key];
    utils[key] = value;
  }
  return () => Object.assign(utils, originals);
}

test("unauthenticated member bootstrap resolves only the fixed default family", async () => {
  const previousSecret = process.env.FAMILY_AUTH_SECRET;
  const previousUrl = process.env.SUPABASE_URL;
  const previousServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousFetch = global.fetch;
  process.env.FAMILY_AUTH_SECRET = "phase-0a-test-secret-at-least-32-characters";
  process.env.SUPABASE_URL = "https://phase0a.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  const calls = [];
  global.fetch = async (url) => {
    calls.push(url);
    return { ok: true, status: 200, text: async () => JSON.stringify([{ id: FAMILY_A }]) };
  };
  try {
    const response = responseCapture();
    const scope = await utils.trustedFamilyScope({ headers: {} }, response, { allowLegacyDefault: true });
    assert.equal(scope.familyId, FAMILY_A);
    assert.equal(calls.length, 1);
    assert.match(calls[0], /families\?select=id&family_key=eq\.default&limit=1$/);
    assert.match(String(response.headers["Set-Cookie"]), /study_tracker_family_bootstrap=/);
    assert.match(String(response.headers["Set-Cookie"]), /HttpOnly/);
    assert.match(String(response.headers["Set-Cookie"]), /SameSite=Strict/);
  } finally {
    global.fetch = previousFetch;
    if (previousSecret === undefined) delete process.env.FAMILY_AUTH_SECRET;
    else process.env.FAMILY_AUTH_SECRET = previousSecret;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceKey;
  }
});

test("a tampered bootstrap cookie is rejected without default-family fallback", async () => {
  const previousSecret = process.env.FAMILY_AUTH_SECRET;
  process.env.FAMILY_AUTH_SECRET = "phase-0a-test-secret-at-least-32-characters";
  let queried = false;
  const restore = replaceUtils({ supabaseFetch: async () => { queried = true; return [{ id: FAMILY_A }]; } });
  try {
    await assert.rejects(
      utils.trustedFamilyScope({ headers: { cookie: `${utils.BOOTSTRAP_COOKIE}=tampered.value` } }, responseCapture(), { allowLegacyDefault: true }),
      (error) => error.statusCode === 401 && error.code === "FAMILY_CONTEXT_INVALID"
    );
    assert.equal(queried, false);
  } finally {
    restore();
    if (previousSecret === undefined) delete process.env.FAMILY_AUTH_SECRET;
    else process.env.FAMILY_AUTH_SECRET = previousSecret;
  }
});

test("member listing is family scoped and omits family and member keys", async () => {
  const calls = [];
  const restore = replaceUtils({
    trustedFamilyScope: async () => ({ familyId: FAMILY_A, claims: null, source: "bootstrap" }),
    supabaseFetch: async (path) => {
      calls.push(path);
      return [{ id: MEMBER_A, display_name: "A child", role: "child", avatar_emoji: "A", is_active: true, login_method: "card" }];
    },
  });
  try {
    const response = responseCapture();
    await membersHandler({ method: "GET", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.members.length, 1);
    assert.equal("family_id" in response.body.members[0], false);
    assert.equal("member_key" in response.body.members[0], false);
    assert.match(calls[0], new RegExp(`family_id=eq\\.${FAMILY_A}`));
  } finally { restore(); }
});

test("child member ID from another family cannot create a session", async () => {
  let sessionCreated = false;
  let query = "";
  const restore = replaceUtils({
    trustedFamilyScope: async () => ({ familyId: FAMILY_A, claims: null }),
    readJson: async () => ({ memberId: MEMBER_B }),
    supabaseFetch: async (path) => { query = path; return []; },
    createDeviceSession: async () => { sessionCreated = true; },
  });
  try {
    const response = responseCapture();
    await childLoginHandler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 404);
    assert.match(query, new RegExp(`id=eq\\.${MEMBER_B}`));
    assert.match(query, new RegExp(`family_id=eq\\.${FAMILY_A}`));
    assert.equal(sessionCreated, false);
  } finally { restore(); }
});

test("parent PIN verification calls only the family-and-member scoped RPC", async () => {
  let rpc;
  const restore = replaceUtils({
    trustedFamilyScope: async () => ({ familyId: FAMILY_A, claims: null }),
    readJson: async () => ({ memberId: MEMBER_A, pin: "2468", rememberDevice: false }),
    supabaseFetch: async (path, options = {}) => {
      if (path.startsWith("rpc/")) {
        rpc = { path, body: JSON.parse(options.body) };
        return [{ member_id: MEMBER_A, family_id: FAMILY_A, member_key: "mother", display_name: "A parent", role: "parent", verified: true }];
      }
      return [];
    },
    signToken: () => "token",
    signRealtimeToken: () => "realtime",
    revokeDeviceSession: async () => false,
    clearDeviceCookie: () => {},
  });
  try {
    const response = responseCapture();
    await verifyPinHandler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(rpc, { path: "rpc/verify_family_parent_pin", body: { p_family_id: FAMILY_A, p_member_id: MEMBER_A, p_pin: "2468" } });
  } finally { restore(); }
});
