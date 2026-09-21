const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { performance } = require("node:perf_hooks");
const { execFileSync } = require("node:child_process");
const authorization = require("../server/api/_authorization");

const root = path.resolve(__dirname, "..");
const secret = "synthetic-members-test-secret-at-least-32-characters";
const familyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const parent = { id: "aaaaaaaa-0000-4000-8000-000000000001", family_id: familyId, member_key: "synthetic-parent", display_name: "Parent", role: "parent", avatar_emoji: "P", is_active: true, notifications_enabled: false };
const child = { ...parent, id: "aaaaaaaa-0000-4000-8000-000000000002", member_key: "synthetic-child", display_name: "Child", role: "child", avatar_emoji: "C", notifications_enabled: true };
const inactive = { ...child, id: "aaaaaaaa-0000-4000-8000-000000000003", display_name: "Inactive", is_active: false };
const settings = { chat_notifications_enabled: false, system_notifications_enabled: true };
const membersPath = `family_members?select=id,display_name,role,avatar_emoji,is_active,notifications_enabled&family_id=eq.${familyId}&order=created_at.asc`;
const settingsPath = `families?select=chat_notifications_enabled,system_notifications_enabled&id=eq.${familyId}&limit=1`;
const devicesPath = `family_push_subscriptions?select=member_id&family_id=eq.${familyId}&is_active=eq.true&member_id=not.is.null`;
const quiet = { info() {}, warn() {}, error() {}, log() {} };
const turn = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function load(source, imports) {
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, Buffer, console: quiet, require(name) {
    if (!(name in imports)) throw new Error("Unexpected harness dependency");
    return imports[name];
  } });
  return module.exports;
}

// Real handler, token verification, trustedFamilyScope and authorization foundation.
// Only the downstream transport is replaced; no environment credentials or network.
function harness(options = {}) {
  const viewer = options.viewer || parent;
  const calls = [];
  const headers = {};
  let foundation;
  const defaults = {
    auth: [options.activeMember || viewer], members: options.rows || [parent, child, inactive],
    settings: options.settingsRows || [settings], devices: [{ member_id: parent.id }, { member_id: parent.id }, { member_id: child.id }], write: null,
  };
  const push = {
    env: name => name === "FAMILY_AUTH_SECRET" ? secret : "synthetic-only",
    readJson: async () => options.body || {},
    json(res, status, body) { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(body)); },
    async supabaseFetch(url, config = {}) {
      const stage = config.method === "PATCH" ? "write" : url === membersPath ? "members" : url === settingsPath ? "settings" : url === devicesPath ? "devices" : url.startsWith("family_members?select=id,family_id,") ? "auth" : null;
      assert.ok(stage, "Only expected synthetic downstream paths are allowed");
      calls.push({ stage, url, config });
      if (options.fetch) return options.fetch(stage, structuredClone(defaults[stage]), url, config);
      return structuredClone(defaults[stage]);
    },
  };
  const utils = load(fs.readFileSync(path.join(root, "server/api/family/_utils.js"), "utf8"), {
    crypto, "../push/_utils": push,
    "../_authorization": { authenticateActiveMember: (...args) => foundation.authenticateActiveMember(...args) },
  });
  foundation = authorization.createAuthorizationFoundation(utils);
  const handler = load(options.source || fs.readFileSync(path.join(root, "server/api/family/members.js"), "utf8"), { "./_utils": utils, "node:perf_hooks": { performance } });
  const req = { method: options.method || "GET", headers: { authorization: `Bearer ${utils.signToken(viewer)}` } };
  const res = {
    headers, statusCode: 0, responses: 0,
    setHeader(name, value) { if (name === "Server-Timing" && options.headerThrows) throw new Error("synthetic timing header failure"); headers[name] = value; },
    getHeader(name) { return headers[name]; },
    end(value) { this.responses++; this.body = JSON.parse(value); },
  };
  return { calls, req, res, utils, run: () => handler(req, res) };
}

function timing(res, expected) {
  const value = res.headers["Server-Timing"];
  assert.equal(typeof value, "string");
  const entries = value.split(", ");
  for (const entry of entries) assert.match(entry, /^(auth|members|settings|device-count|total);dur=\d+\.\d{2}$/);
  assert.deepEqual(entries.map(entry => entry.split(";")[0]), expected);
}

function safeMember(member, isParent) {
  const result = { id: member.id, display_name: member.display_name, role: member.role, avatar_emoji: member.avatar_emoji };
  if (isParent) Object.assign(result, { is_active: member.is_active, notifications_enabled: member.notifications_enabled, device_count: member.id === parent.id ? 2 : member.id === child.id ? 1 : 0 });
  return result;
}

function signedClaims(overrides) {
  const claims = { sub: parent.id, family: familyId, key: parent.member_key, role: "parent", exp: Math.floor(Date.now() / 1000) + 60, ...overrides };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${crypto.createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

function registerTests() {
  for (const viewer of [parent, child]) test(`${viewer.role}: auth barrier then real deferred query concurrency and exact contract`, async () => {
    const gates = Object.fromEntries(["auth", "members", "settings", "devices"].map(key => [key, deferred()]));
    const h = harness({ viewer, fetch: async (stage, result) => { await gates[stage].promise; return result; } });
    const pending = h.run();
    await turn();
    assert.deepEqual(h.calls.map(call => call.stage), ["auth"]);
    assert.equal(h.res.responses, 0);
    gates.auth.resolve();
    await turn();
    const stages = viewer.role === "parent" ? ["members", "settings", "devices"] : ["members", "settings"];
    assert.deepEqual(h.calls.map(call => call.stage), ["auth", ...stages]);
    assert.equal(h.res.responses, 0, "all post-auth reads started while none could resolve");
    // Complete out of order; response still waits for every required query.
    for (const stage of stages.slice(1).reverse()) gates[stage].resolve();
    await turn();
    assert.equal(h.res.responses, 0);
    gates.members.resolve();
    await pending;
    assert.equal(h.res.statusCode, 200);
    assert.equal(h.res.responses, 1);
    assert.deepEqual(h.res.body, { members: (viewer.role === "parent" ? [parent, child, inactive] : [parent, child]).map(m => safeMember(m, viewer.role === "parent")), settings });
    timing(h.res, viewer.role === "parent" ? ["auth", "members", "settings", "device-count", "total"] : ["auth", "members", "settings", "total"]);
    assert.deepEqual(h.calls.slice(1).map(call => call.url), viewer.role === "parent" ? [membersPath, settingsPath, devicesPath] : [membersPath, settingsPath]);
  });

  const failures = [
    ["missing auth", null, null, 0],
    ["invalid signature", "invalid.signature", null, 0],
    ["expired token", signedClaims({ exp: 1 }), null, 0],
    ["inactive member", undefined, { is_active: false }, 1],
    ["family mismatch", undefined, { family_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }, 1],
    ["role mismatch", undefined, { role: "child" }, 1],
    ["member id mismatch", undefined, { id: child.id }, 1],
    ["member key mismatch", undefined, { member_key: "other" }, 1],
  ];
  for (const [name, token, drift, count] of failures) test(`security barrier: ${name}`, async () => {
    const h = harness({ activeMember: { ...parent, ...drift } });
    if (token === null) h.req.headers = {};
    else if (token !== undefined) h.req.headers.authorization = `Bearer ${token}`;
    await h.run();
    assert.equal(h.res.statusCode, 401);
    assert.deepEqual(h.res.body, { ok: false, error: "가족 구성원을 조회하지 못했습니다.", code: "FAMILY_JWT_INVALID" });
    assert.equal(h.calls.length, count);
    assert.ok(h.calls.every(call => call.stage === "auth"));
    timing(h.res, ["auth", "total"]);
  });

  test("bootstrap cookie: only members read and no privileged fields or settings", async () => {
    const h = harness();
    h.utils.setBootstrapCookie({ headers: {} }, h.res, familyId);
    h.req.headers = { cookie: h.res.headers["Set-Cookie"].split(";")[0] };
    await h.run();
    assert.deepEqual(h.calls.map(call => call.stage), ["members"]);
    assert.deepEqual(h.res.body, { members: [parent, child].map(m => safeMember(m, false)), settings: null });
    timing(h.res, ["auth", "members", "total"]);
  });

  test("empty members and missing settings preserve null/message contract", async () => {
    const h = harness({ rows: [], settingsRows: [] });
    await h.run();
    assert.equal(h.res.statusCode, 200);
    assert.deepEqual(h.res.body, { members: [], settings: null, message: "가족 구성원이 없습니다." });
  });

  for (const stage of ["members", "settings", "devices"]) test(`required ${stage} failure preserves error; late rejections never respond twice`, async () => {
    const gates = Object.fromEntries(["members", "settings", "devices"].map(key => [key, deferred()]));
    const h = harness({ fetch: async (key, result) => key === "auth" ? result : gates[key].promise });
    const pending = h.run();
    await turn();
    assert.deepEqual(h.calls.map(call => call.stage), ["auth", "members", "settings", "devices"]);
    gates[stage].reject(Object.assign(new Error("sensitive-query-context-must-not-escape"), { code: "SUPABASE_CONNECTION_FAILED", statusCode: 502 }));
    await pending;
    assert.equal(h.res.statusCode, 502);
    assert.deepEqual(h.res.body, { ok: false, error: "Supabase에 연결할 수 없습니다.", code: "SUPABASE_CONNECTION_FAILED" });
    timing(h.res, ["auth", stage === "devices" ? "device-count" : stage, "total"]);
    const header = h.res.headers["Server-Timing"];
    for (const key of Object.keys(gates)) if (key !== stage) gates[key].reject(new Error("late failure"));
    await turn();
    assert.equal(h.res.responses, 1);
    assert.equal(h.res.headers["Server-Timing"], header);
  });

  for (const body of [{ memberId: child.id, isActive: false, notificationsEnabled: false }, { familySettings: { chatNotificationsEnabled: true, systemNotificationsEnabled: false } }]) test(`PATCH ${body.memberId ? "member" : "settings"}: write barrier and refreshed response`, async () => {
    const gate = deferred();
    let committed = false;
    const h = harness({ method: "PATCH", body, fetch: async (stage, result) => {
      if (stage === "write") { await gate.promise; committed = true; return null; }
      if (stage !== "auth") assert.equal(committed, true);
      if (stage === "members" && body.memberId) result[1] = { ...result[1], is_active: false, notifications_enabled: false };
      if (stage === "settings" && body.familySettings) result[0] = { chat_notifications_enabled: true, system_notifications_enabled: false };
      return result;
    } });
    const pending = h.run();
    await turn();
    assert.deepEqual(h.calls.map(call => call.stage), ["auth", "write"]);
    assert.equal(h.res.responses, 0);
    const write = h.calls[1];
    const payload = JSON.parse(write.config.body);
    if (body.memberId) {
      assert.equal(write.url, `family_members?id=eq.${child.id}&family_id=eq.${familyId}`);
      assert.equal(payload.is_active, false); assert.equal(payload.notifications_enabled, false); assert.ok(Number.isFinite(Date.parse(payload.updated_at)));
    } else {
      assert.equal(write.url, `families?id=eq.${familyId}`);
      assert.deepEqual(payload, { chat_notifications_enabled: true, system_notifications_enabled: false });
    }
    gate.resolve(); await pending;
    assert.equal(h.res.statusCode, 200);
    assert.deepEqual(h.calls.map(call => call.stage), ["auth", "write", "members", "settings", "devices"]);
    if (body.memberId) assert.deepEqual(h.res.body.members[1], { ...safeMember(child, true), is_active: false, notifications_enabled: false });
    else assert.deepEqual(h.res.body.settings, { chat_notifications_enabled: true, system_notifications_enabled: false });
    assert.equal(h.res.headers["Server-Timing"], undefined);
  });

  test("PATCH failed write starts no refresh reads", async () => {
    const h = harness({ method: "PATCH", body: { memberId: child.id, isActive: false }, fetch: async (stage, result) => {
      if (stage === "write") throw Object.assign(new Error("write failed"), { code: "SUPABASE_CONNECTION_FAILED" });
      return result;
    } });
    await h.run();
    assert.equal(h.res.statusCode, 502);
    assert.deepEqual(h.calls.map(call => call.stage), ["auth", "write"]);
  });

  test("PATCH child forbidden preserves existing HTTP/code mapping", async () => {
    const h = harness({ method: "PATCH", viewer: child });
    await h.run();
    assert.equal(h.res.statusCode, 500);
    assert.equal(h.res.body.code, "FAMILY_MEMBERS_UNEXPECTED_ERROR");
    assert.deepEqual(h.calls.map(call => call.stage), ["auth"]);
  });

  for (const failure of [false, true]) test(`unwritable Server-Timing does not change ${failure ? "error" : "success"} response`, async () => {
    const normal = harness(), broken = harness({ headerThrows: true });
    if (failure) { normal.req.headers = {}; broken.req.headers = {}; }
    await normal.run(); await broken.run();
    assert.equal(broken.res.statusCode, normal.res.statusCode);
    assert.deepEqual(broken.res.body, normal.res.body);
    assert.equal(broken.res.responses, 1);
  });
}

// Explicit opt-in benchmark: node test/family-members-performance.test.js --benchmark
// Loads the unmodified baseline from Git into memory; no file writes or network.
async function benchmark() {
  const before = execFileSync("git", ["show", "35ad92265f877e9929a3ebe2fdd17bf8da7b3d44:server/api/family/members.js"], { cwd: root, encoding: "utf8", windowsHide: true });
  const delays = { auth: 100, members: 300, settings: 250, devices: 200 };
  const results = [];
  for (const viewer of [parent, child]) for (const version of ["before", "after"]) {
    const values = [];
    for (let i = 0; i < 3; i++) {
      const h = harness({ viewer, source: version === "before" ? before : undefined, fetch: async (stage, result) => { await new Promise(resolve => setTimeout(resolve, delays[stage])); return result; } });
      const start = performance.now(); await h.run(); values.push(performance.now() - start);
      assert.equal(h.res.statusCode, 200);
      assert.equal(h.calls.length, viewer.role === "parent" ? 4 : 3);
    }
    values.sort((a, b) => a - b);
    results.push({ role: viewer.role, version, n: values.length, medianMs: +values[1].toFixed(2), minMs: +values[0].toFixed(2), maxMs: +values[2].toFixed(2) });
  }
  process.stdout.write(JSON.stringify({ kind: "synthetic transport delays, not Production", delays, results }, null, 2) + "\n");
}

if (process.argv.includes("--benchmark")) benchmark().catch(error => { console.error(error); process.exitCode = 1; });
else registerTests();
