const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const utils = require("../server/api/family/_utils");
const push = require("../server/api/push/_utils");
const invites = require("../server/api/family/invites");

const SECRET = "synthetic-invite-auth-test-".repeat(3);
const parent = { id: "20000000-0000-4000-8000-000000000002", family_id: "10000000-0000-4000-8000-000000000001", member_key: "parent", display_name: "Synthetic parent", role: "parent", is_active: true };
const ref = "30000000-0000-4000-8000-000000000003";
const claims = () => ({ sub: parent.id, family: parent.family_id, key: parent.member_key, role: "parent", exp: Math.floor(Date.now() / 1000) + 3600 });
function sign(value) {
  const payload = Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
  return payload + "." + crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}
function capture() { return { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(value) { this.body = JSON.parse(value); } }; }
function setup(t, member = parent) {
  const calls = [], logs = [];
  t.mock.method(push, "env", () => SECRET);
  t.mock.method(utils, "env", () => SECRET);
  // Authentication and token verification remain real; only database transport is isolated.
  t.mock.method(utils, "supabaseFetch", async (route, options) => {
    calls.push({ route, options });
    if (route.startsWith("family_members?")) return member ? [member] : [];
    if (route === "rpc/create_product_family_invite") return [{ safe_ref: ref, expires_at: "2099-01-01T00:00:00Z" }];
    if (route === "rpc/revoke_product_family_invite") return true;
    if (route.startsWith("family_invites?")) return [];
    throw Error("Unexpected database path");
  });
  for (const level of ["log", "info", "warn", "error"]) t.mock.method(console, level, (...args) => logs.push(args));
  return { calls, logs };
}

const failures = [
  { name: "missing Authorization", authorization: () => undefined, status: 401, code: "AUTH_REQUIRED", reads: 0 },
  { name: "empty Bearer", authorization: () => "Bearer ", status: 401, code: "AUTH_REQUIRED", reads: 0 },
  { name: "wrong authorization scheme", authorization: () => "Basic private-token", status: 401, code: "AUTH_REQUIRED", reads: 0 },
  { name: "invalid signature", authorization: () => "Bearer " + sign(claims()) + "x", status: 401, code: "AUTH_SESSION_INVALID", reads: 0 },
  { name: "invalid signed JSON", authorization: () => "Bearer " + sign("not-json"), status: 401, code: "AUTH_SESSION_INVALID", reads: 0 },
  { name: "invalid signed claims", authorization: () => "Bearer " + sign({ ...claims(), role: "unknown" }), status: 401, code: "AUTH_SESSION_INVALID", reads: 0 },
  { name: "expired token", authorization: () => "Bearer " + sign({ ...claims(), exp: 1 }), status: 401, code: "AUTH_SESSION_INVALID", reads: 0 },
  { name: "deleted member", authorization: () => "Bearer " + sign(claims()), member: null, status: 401, code: "AUTH_SESSION_INVALID", reads: 1 },
  { name: "inactive member", authorization: () => "Bearer " + sign(claims()), member: { ...parent, is_active: false }, status: 401, code: "AUTH_SESSION_INVALID", reads: 1 },
  { name: "family identity drift", authorization: () => "Bearer " + sign(claims()), member: { ...parent, family_id: ref }, status: 401, code: "AUTH_SESSION_INVALID", reads: 1 },
  { name: "authenticated child", authorization: () => "Bearer " + sign({ ...claims(), role: "child" }), member: { ...parent, role: "child" }, status: 403, code: "AUTH_ROLE_REQUIRED", reads: 1 },
];
for (const method of ["POST", "GET", "DELETE"]) {
  for (const scenario of failures) {
    test(`Invite ${method}: ${scenario.name} has safe auth response and no invite access`, async t => {
      const { calls, logs } = setup(t, Object.hasOwn(scenario, "member") ? scenario.member : parent);
      const authorization = scenario.authorization(), res = capture();
      await invites({ method, headers: authorization === undefined ? {} : { authorization }, query: { inviteRef: ref } }, res);
      assert.equal(res.statusCode, scenario.status);
      assert.deepEqual(res.body, { ok: false, error: scenario.code === "AUTH_REQUIRED" ? "Authentication is required." : scenario.code === "AUTH_ROLE_REQUIRED" ? "Permission is required for this request." : "Authentication is no longer valid.", code: scenario.code });
      assert.equal(calls.length, scenario.reads);
      assert.ok(calls.every(call => call.route.startsWith("family_members?") && !call.options));
      assert.deepEqual(logs, []);
      assert.equal(res.headers["Cache-Control"], "no-store");
      assert.equal(res.headers["Set-Cookie"], undefined);
      assert.doesNotMatch(JSON.stringify(res.body), /Synthetic|private-token|20000000|10000000/);
      if (authorization) assert.equal(JSON.stringify(res.body).includes(authorization), false);
    });
  }

  test(`Invite ${method}: real active-parent authentication preserves successful contract`, async t => {
    const { calls, logs } = setup(t), res = capture();
    await invites({ method, headers: { authorization: "Bearer " + sign(claims()) }, query: { inviteRef: ref } }, res);
    assert.equal(res.statusCode, method === "POST" ? 201 : 200);
    assert.equal(res.body.ok, true);
    assert.equal(calls.length, 2);
    if (method === "POST") {
      assert.match(res.body.invite.code, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}(?:-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}){3}$/);
      assert.equal(res.body.invite.safeRef, ref);
      assert.equal(res.body.invite.expiresAt, "2099-01-01T00:00:00Z");
      assert.deepEqual(JSON.parse(calls[1].options.body), { p_family_id: parent.family_id, p_parent_member_id: parent.id, p_invite_hash: invites._test.inviteHash(res.body.invite.code.replaceAll("-", "")) });
    } else if (method === "GET") {
      assert.deepEqual(res.body.invites, []);
      assert.ok(calls[1].route.includes(`family_id=eq.${parent.family_id}&creator_parent_id=eq.${parent.id}`));
    } else {
      assert.equal(calls[1].route, "rpc/revoke_product_family_invite");
      assert.deepEqual(JSON.parse(calls[1].options.body), { p_family_id: parent.family_id, p_parent_member_id: parent.id, p_safe_ref: ref });
    }
    assert.deepEqual(logs, []);
  });

  for (const code of [undefined, "SUPABASE_REQUEST_FAILED", "AUTH_FUTURE_ERROR", "FAMILY_AUTH_NOT_CONFIGURED"]) {
    test(`Invite ${method}: unexpected ${code || "unclassified"} failure remains a safe 500`, async t => {
      const { logs } = setup(t);
      t.mock.method(utils, "supabaseFetch", async () => { throw Object.assign(Error("private-token private-family diagnostic"), { statusCode: code === "SUPABASE_REQUEST_FAILED" ? 401 : 500, code }); });
      const res = capture();
      await invites({ method, headers: { authorization: "Bearer " + sign(claims()) }, query: { inviteRef: ref } }, res);
      assert.equal(res.statusCode, 500);
      assert.deepEqual(res.body, { ok: false, error: "Invite request failed.", code: "INVITE_FAILED" });
      assert.deepEqual(logs, []);
    });
  }
}
