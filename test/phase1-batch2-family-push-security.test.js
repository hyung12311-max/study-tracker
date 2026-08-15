const assert = require("node:assert/strict");
const test = require("node:test");

const authorization = require("../server/api/_authorization");
const family = require("../server/api/family/_utils");
const notifications = require("../server/api/notifications/_utils");
const messages = require("../server/api/family/messages");
const read = require("../server/api/family/read");
const logoutAll = require("../server/api/family/logout-all");
const pin = require("../server/api/family/pin");
const changePin = require("../server/api/family/change-pin");
const legacyPushUnsubscribe = require("../server/api/push/unsubscribe");
const notificationUnsubscribe = require("../server/api/notifications/unsubscribe");

const FAMILY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FAMILY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PARENT_A = "aaaaaaaa-0000-4000-8000-000000000001";
const CHILD_A = "aaaaaaaa-0000-4000-8000-000000000002";
const MESSAGE_A = "aaaaaaaa-1000-4000-8000-000000000001";
const MESSAGE_B = "bbbbbbbb-1000-4000-8000-000000000001";

function responseCapture() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    getHeader(name) { return this.headers[name]; },
    end(value) { this.body = JSON.parse(value); },
  };
}

function context(overrides = {}) {
  const member = {
    id: PARENT_A,
    family_id: FAMILY_A,
    member_key: "parent-a",
    display_name: "Parent A",
    role: "parent",
    avatar_emoji: "P",
    is_active: true,
  };
  return {
    claims: { sub: PARENT_A, family: FAMILY_A, key: "parent-a", role: "parent" },
    familyId: FAMILY_A,
    memberId: PARENT_A,
    memberKey: "parent-a",
    role: "parent",
    member,
    ...overrides,
  };
}

function replace(target, overrides) {
  const originals = {};
  for (const [key, value] of Object.entries(overrides)) {
    originals[key] = target[key];
    target[key] = value;
  }
  return () => Object.assign(target, originals);
}

function sessionInvalid(reason = "test-drift") {
  const error = new Error("private drift detail");
  error.statusCode = 401;
  error.code = "AUTH_SESSION_INVALID";
  error.authorizationReason = reason;
  return error;
}

test("Family message GET uses only the active context Family and member", async () => {
  const calls = [];
  const restoreAuth = replace(authorization, { authenticateActiveMember: async () => context() });
  const restoreFamily = replace(family, {
    fetchMessages: async (familyId) => { calls.push(`fetch:${familyId}`); return []; },
    supabaseFetch: async (path) => { calls.push(path); return []; },
  });
  try {
    const response = responseCapture();
    await messages({ method: "GET", headers: {}, url: "/api/family/messages" }, response);
    assert.equal(response.statusCode, 200);
    assert.ok(calls.includes(`fetch:${FAMILY_A}`));
    assert.ok(calls.some((path) => path.includes(`family_id=eq.${FAMILY_A}`)));
    assert.ok(calls.every((path) => !path.includes(FAMILY_B)));
  } finally { restoreFamily(); restoreAuth(); }
});

test("Family message POST forces sender and Family and keeps scoped idempotency fallback", async () => {
  const writes = [];
  const clientMessageId = "batch2-client-message";
  const restoreAuth = replace(authorization, { authenticateActiveMember: async () => context() });
  const restoreFamily = replace(family, {
    readJson: async () => ({ content: "hello", clientMessageId }),
    supabaseFetch: async (path, options = {}) => {
      if (options.method) writes.push({ path, body: options.body && JSON.parse(options.body) });
      if (path === "family_messages?on_conflict=family_id,client_message_id") return [];
      if (path.startsWith("family_messages?select=*&family_id=eq.")) return [{
        id: MESSAGE_A, family_id: FAMILY_A, sender_id: PARENT_A, content: "hello",
        message_type: "text", client_message_id: clientMessageId, created_at: new Date().toISOString(),
      }];
      return [];
    },
    sendPush: async () => { throw new Error("retry must not push"); },
  });
  try {
    const response = responseCapture();
    await messages({ method: "POST", headers: {}, url: "/api/family/messages" }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(writes[0].body, {
      family_id: FAMILY_A,
      sender_id: PARENT_A,
      content: "hello",
      client_message_id: clientMessageId,
    });
    assert.ok(writes[0].path.includes("on_conflict=family_id,client_message_id"));
  } finally { restoreFamily(); restoreAuth(); }
});

for (const drift of ["member-inactive", "role-drift", "family-drift", "member-key-drift"]) {
  test(`message ${drift} returns sanitized 401 with zero message mutation`, async () => {
    let databaseCalls = 0;
    const restoreAuth = replace(authorization, { authenticateActiveMember: async () => { throw sessionInvalid(drift); } });
    const restoreFamily = replace(family, { supabaseFetch: async () => { databaseCalls += 1; return []; } });
    try {
      const response = responseCapture();
      await messages({ method: "POST", headers: {}, url: "/api/family/messages" }, response);
      assert.equal(response.statusCode, 401);
      assert.equal(response.body.code, "AUTH_SESSION_INVALID");
      assert.equal(JSON.stringify(response.body).includes(drift), false);
      assert.equal(databaseCalls, 0);
    } finally { restoreFamily(); restoreAuth(); }
  });
}

test("cross-family read receipt is all-or-nothing 404 with zero writes", async () => {
  let writes = 0;
  const restoreAuth = replace(authorization, { authenticateActiveMember: async () => context() });
  const restoreFamily = replace(family, {
    readJson: async () => ({ messageIds: [MESSAGE_A, MESSAGE_B] }),
    supabaseFetch: async (path, options = {}) => {
      if (options.method) writes += 1;
      if (path.startsWith("family_messages?")) return [{ id: MESSAGE_A }];
      return [];
    },
  });
  try {
    const response = responseCapture();
    await read({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 404);
    assert.equal(response.body.code, "FAMILY_OBJECT_NOT_FOUND");
    assert.equal(writes, 0);
  } finally { restoreFamily(); restoreAuth(); }
});

test("positive read receipt uses authenticated member as reader", async () => {
  let inserted;
  const restoreAuth = replace(authorization, { authenticateActiveMember: async () => context() });
  const restoreFamily = replace(family, {
    readJson: async () => ({ messageIds: [MESSAGE_A] }),
    supabaseFetch: async (path, options = {}) => {
      if (path.startsWith("family_messages?")) return [{ id: MESSAGE_A }];
      if (path.startsWith("family_message_reads?")) inserted = JSON.parse(options.body);
      return [];
    },
  });
  try {
    const response = responseCapture();
    await read({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(inserted[0].message_id, MESSAGE_A);
    assert.equal(inserted[0].member_id, PARENT_A);
  } finally { restoreFamily(); restoreAuth(); }
});

test("read receipt drift stops before message lookup and mutation", async () => {
  let calls = 0;
  const restoreAuth = replace(authorization, { authenticateActiveMember: async () => { throw sessionInvalid(); } });
  const restoreFamily = replace(family, { supabaseFetch: async () => { calls += 1; return []; } });
  try {
    const response = responseCapture();
    await read({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(calls, 0);
  } finally { restoreFamily(); restoreAuth(); }
});

test("logout-all scopes the mutation to the active Parent context", async () => {
  let patch;
  let cleared = false;
  const restoreAuth = replace(authorization, { authenticateActiveMember: async (_request, options) => {
    assert.equal(options.requiredRole, "parent");
    return context();
  } });
  const restoreFamily = replace(family, {
    supabaseFetch: async (path, options) => { patch = { path, options }; return []; },
    clearDeviceCookie: () => { cleared = true; },
  });
  try {
    const response = responseCapture();
    await logoutAll({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.match(patch.path, new RegExp(`family_id=eq\\.${FAMILY_A}`));
    assert.match(patch.path, new RegExp(`member_id=eq\\.${PARENT_A}`));
    assert.equal(cleared, true);
  } finally { restoreFamily(); restoreAuth(); }
});

test("logout-all child or stale Parent performs zero session mutation", async () => {
  for (const error of [
    Object.assign(new Error("denied"), { statusCode: 403, code: "AUTH_ROLE_REQUIRED" }),
    sessionInvalid("role-drift"),
  ]) {
    let mutations = 0;
    const restoreAuth = replace(authorization, { authenticateActiveMember: async () => { throw error; } });
    const restoreFamily = replace(family, { supabaseFetch: async () => { mutations += 1; } });
    try {
      const response = responseCapture();
      await logoutAll({ method: "POST", headers: {} }, response);
      assert.equal(response.statusCode, error.statusCode);
      assert.equal(mutations, 0);
    } finally { restoreFamily(); restoreAuth(); }
  }
});

test("legacy PIN validates an active same-family target before its scoped RPC", async () => {
  let rpc;
  const restoreAuth = replace(authorization, { authenticateActiveMember: async () => context() });
  const restoreFamily = replace(family, {
    readJson: async () => ({ memberId: CHILD_A, pin: "2468" }),
    supabaseFetch: async (path, options = {}) => {
      if (path.startsWith("family_members?")) return [{ id: CHILD_A, family_id: FAMILY_A, is_active: true }];
      if (path === "rpc/set_family_member_pin_v2") rpc = JSON.parse(options.body);
      return [];
    },
  });
  try {
    const response = responseCapture();
    await pin({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(rpc, {
      p_family_id: FAMILY_A,
      p_actor_member_id: PARENT_A,
      p_target_member_id: CHILD_A,
      p_pin: "2468",
    });
  } finally { restoreFamily(); restoreAuth(); }
});

test("legacy PIN hides cross-family target and performs zero PIN mutation", async () => {
  let rpcCalls = 0;
  const restoreAuth = replace(authorization, { authenticateActiveMember: async () => context() });
  const restoreFamily = replace(family, {
    readJson: async () => ({ memberId: CHILD_A, pin: "2468" }),
    supabaseFetch: async (path) => {
      if (path.startsWith("family_members?")) return [{ id: CHILD_A, family_id: FAMILY_B, is_active: true }];
      if (path.startsWith("rpc/")) rpcCalls += 1;
      return [];
    },
  });
  try {
    const response = responseCapture();
    await pin({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 404);
    assert.equal(rpcCalls, 0);
  } finally { restoreFamily(); restoreAuth(); }
});

test("legacy PIN child or stale Parent performs zero lookup and PIN mutation", async () => {
  for (const error of [
    Object.assign(new Error("denied"), { statusCode: 403, code: "AUTH_ROLE_REQUIRED" }),
    sessionInvalid("role-drift"),
  ]) {
    let databaseCalls = 0;
    const restoreAuth = replace(authorization, { authenticateActiveMember: async () => { throw error; } });
    const restoreFamily = replace(family, { supabaseFetch: async () => { databaseCalls += 1; return []; } });
    try {
      const response = responseCapture();
      await pin({ method: "POST", headers: {} }, response);
      assert.equal(response.statusCode, error.statusCode);
      assert.equal(databaseCalls, 0);
    } finally { restoreFamily(); restoreAuth(); }
  }
});

test("safe self PIN change still verifies the current PIN and changes only the authenticated Parent", async () => {
  const rpcCalls = [];
  const restoreFamily = replace(family, {
    authenticate: (_request, role) => {
      assert.equal(role, "parent");
      return { sub: PARENT_A, family: FAMILY_A, key: "parent-a", role: "parent" };
    },
    readJson: async () => ({ memberKey: "parent-a", currentPin: "2468", newPin: "9753" }),
    supabaseFetch: async (path, options = {}) => {
      if (path.startsWith("rpc/")) rpcCalls.push({ path, body: JSON.parse(options.body) });
      if (path === "rpc/verify_family_parent_pin") return [{
        member_id: PARENT_A,
        family_id: FAMILY_A,
        role: "parent",
        verified: true,
      }];
      return [];
    },
    cookieToken: () => "",
  });
  try {
    const response = responseCapture();
    await changePin({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(rpcCalls.map(({ path }) => path), [
      "rpc/verify_family_parent_pin",
      "rpc/set_family_member_pin_v2",
    ]);
    assert.deepEqual(rpcCalls[1].body, {
      p_family_id: FAMILY_A,
      p_actor_member_id: PARENT_A,
      p_target_member_id: PARENT_A,
      p_pin: "9753",
    });
  } finally { restoreFamily(); }
});

test("retired legacy push unsubscribe never reads input or mutates a subscription", async () => {
  const originalFetch = global.fetch;
  let networkCalls = 0;
  global.fetch = async () => { networkCalls += 1; throw new Error("must not run"); };
  try {
    const response = responseCapture();
    await legacyPushUnsubscribe({ method: "POST", body: { endpoint: "https://other.example/push" } }, response);
    assert.equal(response.statusCode, 410);
    assert.equal(response.body.code, "PUSH_ENDPOINT_RETIRED");
    assert.equal(networkCalls, 0);
  } finally { global.fetch = originalFetch; }
});

test("notification unsubscribe requires active identity and scopes endpoint ownership", async () => {
  let patch;
  const restoreAuth = replace(authorization, { authenticateActiveMember: async () => context() });
  const restoreNotifications = replace(notifications, {
    readJson: async () => ({ endpoint: "https://push.example/device" }),
    supabaseFetch: async (path, options) => { patch = { path, options }; return []; },
  });
  try {
    const response = responseCapture();
    await notificationUnsubscribe({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.match(patch.path, new RegExp(`family_id=eq\\.${FAMILY_A}`));
    assert.match(patch.path, new RegExp(`member_id=eq\\.${PARENT_A}`));
    assert.match(patch.path, /member_key=eq\.parent-a/);
  } finally { restoreNotifications(); restoreAuth(); }
});

test("notification unsubscribe drift performs zero subscription mutation", async () => {
  let writes = 0;
  const restoreAuth = replace(authorization, { authenticateActiveMember: async () => { throw sessionInvalid("key-drift"); } });
  const restoreNotifications = replace(notifications, { supabaseFetch: async () => { writes += 1; } });
  try {
    const response = responseCapture();
    await notificationUnsubscribe({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(writes, 0);
  } finally { restoreNotifications(); restoreAuth(); }
});
