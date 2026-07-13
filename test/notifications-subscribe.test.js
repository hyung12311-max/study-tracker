const assert = require("node:assert/strict");
const test = require("node:test");

process.env.FAMILY_AUTH_SECRET = "test-family-auth-secret-that-is-at-least-32-characters";

const family = require("../server/api/family/_utils");
const notifications = require("../server/api/notifications/_utils");

const endpoint = "https://push.example.test/subscription/account-switch";
const subscription = {
  endpoint,
  keys: { p256dh: "test-p256dh", auth: "test-auth" },
};
const request = { headers: { "user-agent": "node-test" } };

test("family auth tokens expose the same required claims for parents and children", () => {
  for (const role of ["parent", "child"]) {
    const member = {
      id: `${role}-member-id`,
      family_id: "family-id",
      member_key: `${role}-key`,
      display_name: `${role}-name`,
      role,
    };
    const token = family.signToken(member);
    const payload = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
    assert.equal(payload.family_id, member.family_id);
    assert.equal(payload.member_key, member.member_key);
    assert.equal(payload.role, role);
    assert.equal(payload.display_name, member.display_name);
    assert.ok(payload.exp > Date.now() / 1000);
    const claims = family.authenticate({ headers: { authorization: `Bearer ${token}` } });
    assert.equal(claims.family, member.family_id);
    assert.equal(claims.key, member.member_key);
    assert.equal(claims.role, role);
  }
});

test("subscription registration accepts active parents and children and reassigns one endpoint", async () => {
  const originalFetch = family.supabaseFetch;
  const writes = [];
  family.supabaseFetch = async (path, options = {}) => {
    if (path.startsWith("family_members?")) {
      const memberKey = path.includes("child-key") ? "child-key" : "parent-key";
      const role = memberKey === "child-key" ? "child" : "parent";
      return [{ id: `${role}-id`, family_id: "family-id", member_key: memberKey, role, is_active: true }];
    }
    const row = JSON.parse(options.body);
    writes.push({ path, row });
    return [{ id: `subscription-${writes.length}`, ...row }];
  };
  try {
    for (const claims of [
      { sub: "parent-id", family: "family-id", key: "parent-key", role: "parent" },
      { sub: "child-id", family: "family-id", key: "child-key", role: "child" },
    ]) {
      await notifications.upsertSubscription({ request, claims, subscription, body: {} });
    }
  } finally {
    family.supabaseFetch = originalFetch;
  }
  assert.equal(writes.length, 2);
  assert.ok(writes.every(({ path }) => path === "family_push_subscriptions?on_conflict=endpoint"));
  assert.equal(writes[0].row.endpoint, writes[1].row.endpoint);
  assert.equal(writes[0].row.member_key, "parent-key");
  assert.equal(writes[1].row.member_key, "child-key");
  assert.equal(writes[1].row.role, "child");
});

test("subscription registration rejects a token that does not match an active member", async () => {
  const originalFetch = family.supabaseFetch;
  family.supabaseFetch = async () => [];
  try {
    await assert.rejects(
      notifications.upsertSubscription({
        request,
        claims: { sub: "child-id", family: "family-id", key: "child-key", role: "child" },
        subscription,
        body: {},
      }),
      (error) => error.statusCode === 403 && error.code === "ACTIVE_MEMBER_REQUIRED"
    );
  } finally {
    family.supabaseFetch = originalFetch;
  }
});
