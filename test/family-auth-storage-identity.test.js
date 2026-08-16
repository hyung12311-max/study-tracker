const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

class MemoryStorage {
  constructor() { this.values = new Map(); this.removed = []; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.removed.push(key); this.values.delete(key); }
  clear() { this.values.clear(); }
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function credentials(member, { expired = false } = {}) {
  const exp = Math.floor(Date.now() / 1000) + (expired ? -60 : 3600);
  return {
    token: `${encode({ sub: member.id, family: member.family_id, key: member.member_key, role: member.role, exp })}.signature`,
    realtimeToken: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: member.id, role: "authenticated", exp })}.signature`,
  };
}

async function loadFamilyAuth() {
  global.sessionStorage = new MemoryStorage();
  global.localStorage = new MemoryStorage();
  global.window = { dispatchEvent() {} };
  global.CustomEvent = class CustomEvent { constructor(type, options) { this.type = type; this.detail = options?.detail; } };
  const source = fs.readFileSync(path.join(root, "js", "family-auth.js"), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${Date.now()}-${Math.random()}`);
}

function member(role) {
  return {
    id: role === "parent" ? "11111111-1111-4111-8111-111111111111" : "22222222-2222-4222-8222-222222222222",
    family_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    member_key: role === "parent" ? "parent" : "child1",
    display_name: role === "parent" ? "Parent" : "Child",
    role,
    avatar_emoji: "👤",
  };
}

async function refreshAndRestore(role) {
  const auth = await loadFamilyAuth();
  const existing = member(role);
  const signed = credentials(existing);
  auth.saveFamilyAuth({ ...signed, member: existing });
  const restored = auth.restoreFamilyAuth();
  const incoming = { id: existing.id, display_name: `${existing.display_name} refreshed`, role, avatar_emoji: "✅", is_active: true };
  const merged = auth.mergePublicMemberIdentity(restored.member, incoming);
  auth.saveFamilyAuth({ token: restored.token, realtimeToken: restored.realtimeToken, member: merged });
  const rewardStyleRestore = auth.restoreFamilyAuth();
  return { auth, existing, merged, rewardStyleRestore };
}

test("public member refresh preserves authenticated hidden member identity and API auth storage", async () => {
  for (const role of ["parent", "child"]) {
    const { auth, existing, merged, rewardStyleRestore } = await refreshAndRestore(role);
    assert.equal(merged.id, existing.id);
    assert.equal(merged.family_id, existing.family_id);
    assert.equal(merged.member_key, existing.member_key);
    assert.equal(merged.role, role);
    assert.equal(rewardStyleRestore.member.member_key, existing.member_key);
    assert.equal(Boolean(sessionStorage.getItem(auth.TOKEN_KEY)), true);
    assert.equal(Boolean(sessionStorage.getItem(auth.REALTIME_TOKEN_KEY)), true);
    assert.equal(Boolean(sessionStorage.getItem(auth.AUTH_KEY)), true);
    assert.equal(sessionStorage.removed.length, 0);
  }
});

test("missing or empty public member keys cannot overwrite authenticated identity", async () => {
  const auth = await loadFamilyAuth();
  const existing = member("parent");
  const missing = auth.mergePublicMemberIdentity(existing, { id: existing.id, display_name: "Updated", role: "parent" });
  const empty = auth.mergePublicMemberIdentity(existing, { id: existing.id, member_key: "", family_id: "", display_name: "Updated", role: "parent" });
  assert.equal(missing.member_key, "parent");
  assert.equal(empty.member_key, "parent");
  assert.equal(empty.family_id, existing.family_id);
});

test("public member refresh matches only the current opaque member ID", async () => {
  const auth = await loadFamilyAuth();
  const existing = member("parent");
  assert.equal(auth.mergePublicMemberIdentity(existing, { ...existing, id: member("child").id }), null);
});

test("reward-style re-restore and reload retain Parent and Child API bearer sources", async () => {
  for (const role of ["parent", "child"]) {
    const { auth, existing } = await refreshAndRestore(role);
    const reloadRestore = auth.restoreFamilyAuth();
    assert.equal(reloadRestore.member.role, role);
    assert.equal(reloadRestore.member.member_key, existing.member_key);
    assert.equal(Boolean(sessionStorage.getItem(auth.TOKEN_KEY)), true);
  }
});

test("actual stored identity drift and expired authentication still clear every auth key", async () => {
  for (const defect of ["member-key", "member-id", "family", "expired"]) {
    const auth = await loadFamilyAuth();
    const existing = member("parent");
    const signed = credentials(existing, { expired: defect === "expired" });
    auth.saveFamilyAuth({ ...signed, member: existing });
    if (defect !== "expired") {
      const stored = JSON.parse(sessionStorage.getItem(auth.AUTH_KEY));
      if (defect === "member-key") stored.member.member_key = "corrupt";
      if (defect === "member-id") stored.member.id = member("child").id;
      if (defect === "family") stored.member.family_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
      sessionStorage.setItem(auth.AUTH_KEY, JSON.stringify(stored));
    }
    assert.equal(auth.restoreFamilyAuth(), null);
    assert.equal(sessionStorage.getItem(auth.TOKEN_KEY), null);
    assert.equal(sessionStorage.getItem(auth.REALTIME_TOKEN_KEY), null);
    assert.equal(sessionStorage.getItem(auth.AUTH_KEY), null);
  }
});

test("public family member DTO remains free of hidden identity and authentication fields", () => {
  const source = fs.readFileSync(path.join(root, "server", "api", "family", "members.js"), "utf8");
  const projection = source.slice(source.indexOf("const members="), source.indexOf("console.info", source.indexOf("const members=")));
  for (const field of ["family_id", "member_key", "pin", "pin_hash", "locked_until", "session"]) {
    assert.equal(projection.includes(field), false);
  }
});
