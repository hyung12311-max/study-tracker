const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const crypto = require("node:crypto");
const utils = require("../server/api/family/_utils");
const createChild = require("../server/api/family/children");
const REQUEST_ID = "10000000-0000-4000-8000-000000000001";
const CHILD_ID = "20000000-0000-4000-8000-000000000002";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function invokeChild(t, overrides = {}, requestOverrides = {}) {
  const events = [], calls = [];
  let uuidCalls = 0;
  const randomUUID = crypto.randomUUID;
  t.mock.method(crypto, "randomUUID", () => { uuidCalls++; return randomUUID(); });
  t.mock.method(console, "error", event => events.push(event));
  const mocks = {
    authenticateActiveMember: async () => ({ familyId: "private-family", memberId: "private-member" }),
    readJson: async () => ({ clientRequestId: REQUEST_ID, displayName: "  Ａlice  " }),
    env: () => "test-secret-".repeat(4),
    supabaseFetch: async (route, options) => {
      calls.push({ route, options });
      return [{ child_member_id: CHILD_ID, canonical_status: "complete", created: true, display_name: "Alice", avatar_emoji: "🧒" }];
    },
    ...overrides,
  };
  for (const [key, value] of Object.entries(mocks)) t.mock.method(utils, key, value);
  const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = JSON.parse(value); } };
  try {
    await createChild({ method: "POST", headers: { authorization: "Bearer private-session" }, ...requestOverrides }, response);
    return { response, events, calls, uuidCalls };
  } finally { t.mock.restoreAll(); }
}

const mappings = [
  ["55000", "IDEMPOTENCY_CONFLICT", 409],
  ["22023", "CHILD_VALIDATION_FAILED", 400],
  ["42501", "PARENT_REQUIRED", 403],
  ["55000", "CHILD_CREATION_RATE_LIMITED", 429],
  ["55000", "FAMILY_MEMBER_LIMIT_REACHED", 409],
];
for (const [supabaseCode, supabaseMessage, status] of mappings) {
  test(`Child RPC maps ${supabaseCode}/${supabaseMessage} to ${status}`, async t => {
    const { response, events, uuidCalls } = await invokeChild(t, {
      supabaseFetch: async () => { throw Object.assign(new Error("private raw error"), { supabaseCode, supabaseMessage }); },
    });
    assert.equal(response.statusCode, status);
    assert.equal(response.body.code, supabaseMessage);
    assert.equal(response.body.ok, false);
    assert.deepEqual(Object.keys(response.body).sort(), ["code", "error", "ok"]);
    assert.doesNotMatch(JSON.stringify(response.body), /private raw error/);
    assert.deepEqual(events, []);
    assert.equal(uuidCalls, 1);
  });
}

for (const [supabaseCode, supabaseMessage] of [
  ...mappings.map(([, message]) => ["XX000", message]),
  [undefined, "IDEMPOTENCY_CONFLICT"],
  ["55000", "prefix IDEMPOTENCY_CONFLICT"],
  ["PGRST202", "Unknown RPC failure"],
]) {
  test(`Child RPC keeps unexpected ${supabaseCode}/${supabaseMessage} private`, async t => {
    const { response, events, uuidCalls } = await invokeChild(t, {
      supabaseFetch: async () => { throw Object.assign(new Error("private raw error"), { supabaseCode, supabaseMessage, supabaseDetails: "private-details", supabaseHint: "private-hint" }); },
    });
    assert.equal(response.statusCode, 500);
    assert.match(response.body.correlationId, UUID_V4);
    assert.deepEqual(response.body, { ok: false, error: "Child creation could not be completed.", code: "CHILD_CREATION_FAILED", correlationId: response.body.correlationId });
    const safeMessage = mappings.some(([, marker]) => marker === supabaseMessage) ? supabaseMessage : null;
    assert.deepEqual(events, [{ route: "/api/family/children", method: "POST", stage: "rpc-create-child", correlationId: response.body.correlationId, supabaseCode: supabaseCode || null, supabaseMessage: safeMessage, httpStatus: 500 }]);
    assert.equal(uuidCalls, 1);
  });
}

test("Child diagnostics drop free-form messages, controls and hint fallbacks", async t => {
  for (const [message, hint, expected] of [
    ["safe\n\r\t\u0000\u202e\u200b" + "x".repeat(600), "private-hint", null],
    ["private-hint", "private-hint", null],
    ["IDEMPOTENCY_CONFLICT\n", "private-hint", null],
    ["IDEMPOTENCY_CONFLICT", "IDEMPOTENCY_CONFLICT", null],
  ]) {
    const { events } = await invokeChild(t, { supabaseFetch: async () => { throw { supabaseCode: "XX000", supabaseMessage: message, supabaseHint: hint, supabaseDetails: "private-details", pin_hash: "private-pin", request_digest: "private-digest" }; } });
    assert.equal(events[0].supabaseMessage, expected);
    assert.doesNotMatch(JSON.stringify(events), /private-/);
  }
});

test("Child diagnostics never disclose sensitive values embedded in upstream messages", async t => {
  const message = "displayName=민수 token=abc123 digest=deadbeef";
  const { response, events } = await invokeChild(t, {
    supabaseFetch: async () => { throw Object.assign(new Error(message), {
      supabaseCode: "XX000", supabaseMessage: message,
      supabaseDetails: "private-details", supabaseHint: "private-hint",
      body: "private-body", authorization: "private-auth", cookie: "private-cookie",
      pin_hash: "private-pin", familyId: "private-family", memberId: "private-member",
    }); },
  });
  assert.equal(response.statusCode, 500);
  assert.match(response.body.correlationId, UUID_V4);
  assert.deepEqual(response.body, { ok: false, error: "Child creation could not be completed.", code: "CHILD_CREATION_FAILED", correlationId: response.body.correlationId });
  assert.deepEqual(events, [{ route: "/api/family/children", method: "POST", stage: "rpc-create-child", correlationId: response.body.correlationId, supabaseCode: "XX000", supabaseMessage: null, httpStatus: 500 }]);
  assert.doesNotMatch(JSON.stringify({ events, body: response.body }), /민수|abc123|deadbeef|displayName=|private-/);
});

for (const [stage, overrides] of [
  ["auth-context", { authenticateActiveMember: async () => { throw new Error("private-auth"); } }],
  ["request-parse", { readJson: async () => { throw new Error("private-body"); } }],
  ["request-validation", { readJson: async () => ({ get clientRequestId() { throw new Error("private-validation"); } }) }],
  ["digest-generation", { env: () => "short" }],
  ["rpc-create-child", { supabaseFetch: async () => { throw new Error("private-network"); } }],
  ["rpc-response-validation", { supabaseFetch: async () => [] }],
]) {
  test(`Child unexpected failure reports ${stage}`, async t => {
    const { response, events } = await invokeChild(t, overrides);
    assert.equal(response.statusCode, 500);
    assert.match(response.body.correlationId, UUID_V4);
    assert.deepEqual(events, [{ route: "/api/family/children", method: "POST", stage, correlationId: response.body.correlationId, supabaseCode: null, supabaseMessage: null, httpStatus: 500 }]);
    assert.doesNotMatch(JSON.stringify({ events, body: response.body }), /private-|short/);
  });
}

test("Child known auth and local validation failures remain quiet", async t => {
  for (const [code, status] of [["AUTH_SESSION_INVALID", 401], ["AUTH_ROLE_REQUIRED", 403], ["CHILD_VALIDATION_FAILED", 400]]) {
    const overrides = code === "CHILD_VALIDATION_FAILED" ? { readJson: async () => ({}) } : { authenticateActiveMember: async () => { throw Object.assign(new Error("private-auth"), { code }); } };
    const { response, events } = await invokeChild(t, overrides);
    assert.equal(response.statusCode, status);
    assert.equal(response.body.code, code);
    assert.equal(response.body.correlationId, undefined);
    assert.deepEqual(events, []);
  }
});

test("Child create preserves normalized RPC parameters, digest, default avatar and DTO", async t => {
  const { response, calls, events, uuidCalls } = await invokeChild(t);
  assert.equal(response.statusCode, 201);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.deepEqual(response.body, { ok: true, created: true, child: { id: CHILD_ID, displayName: "Alice", role: "child", avatarEmoji: "🧒", isActive: true }, onboardingState: "LEARNING_SETUP_OPTIONAL" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].route, "rpc/create_product_family_child");
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), { p_family_id: "private-family", p_parent_member_id: "private-member", p_client_request_id: REQUEST_ID, p_request_digest: crypto.createHmac("sha256", "test-secret-".repeat(4)).update('{"displayName":"Alice","avatarEmoji":"🧒"}').digest("hex"), p_display_name: "Alice", p_avatar_emoji: "🧒" });
  assert.deepEqual(events, []);
  assert.equal(uuidCalls, 1);
});

test("Child replay preserves HTTP 200 and created=false", async t => {
  const { response, events } = await invokeChild(t, { supabaseFetch: async () => ({ child_member_id: CHILD_ID, canonical_status: "complete", created: false, display_name: "Alice", avatar_emoji: "🧒" }) });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { ok: true, created: false, child: { id: CHILD_ID, displayName: "Alice", role: "child", avatarEmoji: "🧒", isActive: true }, onboardingState: "LEARNING_SETUP_OPTIONAL" });
  assert.deepEqual(events, []);
});

test("Child correlation IDs are unique and non-POST requests still return 405", async t => {
  const overrides = { supabaseFetch: async () => null };
  const first = await invokeChild(t, overrides), second = await invokeChild(t, overrides);
  assert.notEqual(first.response.body.correlationId, second.response.body.correlationId);
  const { response, events, uuidCalls } = await invokeChild(t, {}, { method: "GET" });
  assert.equal(response.statusCode, 405);
  assert.equal(uuidCalls, 0);
  assert.deepEqual(events, []);
});

test("Child creation route is registered and uses a strict public request contract", () => {
  const router = read("api/[...path].js");
  const source = read("server/api/family/children.js");
  assert.match(router, /family\/children/);
  assert.match(source, /clientRequestId/);
  assert.match(source, /displayName/);
  assert.match(source, /avatarEmoji/);
  for (const field of ["family_id", "familyId", "role", "is_active", "isActive", "member_key", "memberKey", "pin", "pin_hash", "parentId"]) {
    assert.match(source, new RegExp(`ALLOWED_FIELDS[\\s\\S]*${field}`));
  }
});

test("Child creation requires an authenticated active Parent and derives ownership from auth", () => {
  const source = read("server/api/family/children.js");
  assert.match(source, /authenticateActiveMember[\s\S]*requiredRole:\s*["']parent["']/);
  assert.match(source, /context\.familyId/);
  assert.match(source, /context\.memberId/);
  assert.doesNotMatch(source, /body\.(?:family_id|familyId|role|is_active|member_key|parentId)/);
});

test("Child RPC is atomic, idempotent, capped, rate limited and creates no PIN", () => {
  const sql = read("supabase/migrations/202608170002_product_family_child_registration.sql");
  assert.match(sql, /create table public\.product_child_creation_requests/i);
  assert.match(sql, /create function public\.create_product_family_child/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /IDEMPOTENCY_CONFLICT/);
  assert.match(sql, /CHILD_CREATION_RATE_LIMITED/);
  assert.match(sql, /FAMILY_MEMBER_LIMIT_REACHED/);
  assert.match(sql, /role[\s\S]*'child'/i);
  assert.match(sql, /pin_hash[\s\S]*null/i);
  assert.match(sql, /is_active[\s\S]*true/i);
});

test("Child response is a safe DTO and database errors are mapped", () => {
  const source = read("server/api/family/children.js");
  for (const code of ["IDEMPOTENCY_CONFLICT", "CHILD_CREATION_RATE_LIMITED", "FAMILY_MEMBER_LIMIT_REACHED"]) assert.match(source, new RegExp(code));
  assert.match(source, /onboardingState:\s*["']LEARNING_SETUP_OPTIONAL["']/);
  assert.doesNotMatch(source, /child:\s*\{[\s\S]{0,400}(?:family_id|member_key|pin_hash|failed_attempts|locked_until)/);
});

test("Child form has no PIN, role, active or Family ownership controls", () => {
  const html = read("index.html");
  assert.match(html, /id="onboardingChildForm"/);
  assert.match(html, /id="onboardingChildName"/);
  assert.match(html, /name="avatarEmoji"[\s\S]*type="radio"|type="radio"[\s\S]*name="avatarEmoji"/);
  const form = html.match(/<form id="onboardingChildForm"[\s\S]*?<\/form>/)?.[0] || "";
  assert.doesNotMatch(form, /name="(?:pin|familyId|family_id|role|isActive|is_active)"/i);
});

test("Child UI prevents duplicate submission, retains request ID and refreshes canonical members", () => {
  const source = read("js/onboarding.js");
  const family = read("js/family-chat.js");
  assert.match(source, /if\s*\(childSubmitting\)\s*return/);
  assert.match(source, /clientRequestId/);
  assert.match(source, /\/api\/family\/children/);
  assert.match(source, /aria-busy/);
  assert.match(family, /refreshMembers/);
  assert.match(source, /LEARNING_SETUP_OPTIONAL/);
});

test("Child registration exposes safe mobile and accessible interaction", () => {
  const html = read("index.html");
  const css = read("css/styles.css");
  assert.match(html, /onboardingChildError[\s\S]*role="alert"/);
  assert.match(html, /fieldset[\s\S]*legend/);
  assert.match(css, /onboarding-avatar-option/);
  assert.match(css, /min-height:\s*44px/);
});

test("Legacy member management exposes PIN changes only for Parent rows", () => {
  const source = read("js/family-chat.js");
  assert.match(source, /if\s*\(m\.role===?["']parent["']\)[\s\S]{0,500}PIN 변경/);
  assert.match(source, /loginChild[\s\S]*child-login/);
});

test("Migration ships matching verification and rollback contracts", () => {
  const verify = read("supabase/verification/202608170002_product_family_child_registration_verify.sql");
  const rollback = read("supabase/rollback/202608170002_product_family_child_registration_rollback.sql");
  assert.match(verify, /product_child_creation_requests/);
  assert.match(verify, /create_product_family_child/);
  assert.match(verify, /pin_hash/i);
  assert.match(rollback, /drop function/i);
  assert.match(rollback, /drop table/i);
});
