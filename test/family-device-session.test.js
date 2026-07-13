const assert = require("node:assert/strict");
const test = require("node:test");

const utils = require("../server/api/family/_utils");
const restoreHandler = require("../server/api/family/session-restore");
const childLoginHandler = require("../server/api/family/child-login");

function responseCapture() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
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

const child = {
  id: "11111111-1111-4111-8111-111111111111",
  family_id: "22222222-2222-4222-8222-222222222222",
  member_key: "hagyeom",
  display_name: "하겸이",
  role: "child",
  avatar_emoji: "👦",
  is_active: true,
};

test("child login creates the same persistent device session used by parent login", async () => {
  const calls = [];
  const restore = replaceUtils({
    readJson: async () => ({ memberId: child.id, rememberDevice: true, deviceSessionToken: "old-token" }),
    supabaseFetch: async (path) => {
      calls.push(path);
      if (path.startsWith("family_members?")) return [child];
      return null;
    },
    createDeviceSession: async (_request, _response, member, oldToken) => {
      assert.equal(member.member_key, "hagyeom");
      assert.equal(oldToken, "old-token");
      return { token: "new-device-token", expiresAt: "2026-10-11T00:00:00.000Z" };
    },
    signToken: () => "family-token",
    signRealtimeToken: () => "realtime-token",
  });
  try {
    const response = responseCapture();
    await childLoginHandler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.rememberDevice, true);
    assert.equal(response.body.deviceSessionToken, "new-device-token");
    assert.equal(response.body.member.role, "child");
    assert.ok(calls.some((path) => path.startsWith("family_members?")));
  } finally {
    restore();
  }
});

test("device session restore accepts an active child and applies 90-day sliding expiration", async () => {
  const writes = [];
  const rawToken = "a".repeat(43);
  const restore = replaceUtils({
    readJson: async () => ({ deviceSessionToken: rawToken }),
    validDeviceToken: () => true,
    tokenHash: () => "hashed-token",
    supabaseFetch: async (path, options = {}) => {
      if (path.startsWith("family_device_sessions?select=")) return [{ id: "session-id", family_id: child.family_id, member_id: child.id, member_key: child.member_key, is_active: true, expires_at: "2099-01-01T00:00:00.000Z", revoked_at: null }];
      if (path.startsWith("family_members?select=")) return [child];
      writes.push({ path, body: JSON.parse(options.body) });
      return null;
    },
    signToken: () => "family-token",
    signRealtimeToken: () => "realtime-token",
    setDeviceCookie: () => {},
  });
  try {
    const before = Date.now() + 89 * 24 * 60 * 60 * 1000;
    const response = responseCapture();
    await restoreHandler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.member.member_key, "hagyeom");
    assert.ok(new Date(response.body.expires_at).getTime() > before);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].body.last_used_at.length > 0, true);
    assert.equal(writes[0].body.expires_at, response.body.expires_at);
  } finally {
    restore();
  }
});

test("device session restore rejects an inactive member and revokes the session", async () => {
  const writes = [];
  const restore = replaceUtils({
    readJson: async () => ({ deviceSessionToken: "a".repeat(43) }),
    validDeviceToken: () => true,
    tokenHash: () => "hashed-token",
    supabaseFetch: async (path, options = {}) => {
      if (path.startsWith("family_device_sessions?select=")) return [{ id: "session-id", family_id: child.family_id, member_id: child.id, member_key: child.member_key, is_active: true, expires_at: "2099-01-01T00:00:00.000Z", revoked_at: null }];
      if (path.startsWith("family_members?select=")) return [];
      writes.push(JSON.parse(options.body));
      return null;
    },
    clearDeviceCookie: () => {},
  });
  try {
    const response = responseCapture();
    await restoreHandler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.code, "DEVICE_MEMBER_INVALID");
    assert.equal(writes[0].is_active, false);
    assert.equal(writes[0].revoked_reason, "member_unavailable");
  } finally {
    restore();
  }
});
