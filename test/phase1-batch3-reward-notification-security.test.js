const assert = require("node:assert/strict");
const test = require("node:test");

const authorization = require("../server/api/_authorization");
const family = require("../server/api/family/_utils");
const rewards = require("../server/api/rewards/_utils");
const notifications = require("../server/api/notifications/_utils");

const productsHandler = require("../server/api/rewards/products");
const exchangeHandler = require("../server/api/rewards/exchange");
const wishlistHandler = require("../server/api/rewards/wishlist");
const stickerSettingsHandler = require("../server/api/rewards/sticker-settings");
const milestonesHandler = require("../server/api/reward-milestones");
const preferencesHandler = require("../server/api/notifications/preferences");
const notificationTestHandler = require("../server/api/notifications/test");
const notificationStudyHandler = require("../server/api/notifications/study-complete");
const subscribeHandler = require("../server/api/notifications/subscribe");
const completionNotificationsHandler = require("../server/api/completion-notifications");

const FAMILY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PARENT_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PRODUCT_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PRODUCT_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const REQUEST_A = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function context(role = "parent") {
  const child = role === "child";
  return {
    familyId: FAMILY_A,
    memberId: child ? CHILD_A : PARENT_A,
    memberKey: child ? "child-a" : "parent-a",
    role,
    member: {
      id: child ? CHILD_A : PARENT_A,
      family_id: FAMILY_A,
      member_key: child ? "child-a" : "parent-a",
      display_name: child ? "Child A" : "Parent A",
      role,
      is_active: true,
    },
    claims: { sub: child ? CHILD_A : PARENT_A, family: FAMILY_A, key: child ? "child-a" : "parent-a", role },
  };
}

function authError(code = "AUTH_SESSION_INVALID") {
  const error = new Error("private authentication drift");
  error.code = code;
  error.statusCode = code === "AUTH_ROLE_REQUIRED" ? 403 : 401;
  return error;
}

function responseCapture() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
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

test("reward product PATCH preflights and mutates by object plus authenticated Family", async () => {
  const calls = [];
  const restore = replace(rewards, {
    authenticateActiveMember: async (_request, options) => { assert.equal(options.requiredRole, "parent"); return context(); },
    readJson: async () => ({ id: PRODUCT_A, name: "Book", stickerCost: 5 }),
    supabaseFetch: async (path, options = {}) => {
      calls.push({ path, options });
      if (options.method === "PATCH") return [{ id: PRODUCT_A, name: "Book", sticker_cost: 5, family_id: FAMILY_A, is_active: true }];
      return [{ id: PRODUCT_A, family_id: FAMILY_A }];
    },
  });
  try {
    const response = responseCapture();
    await productsHandler({ method: "PATCH", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(calls.length, 2);
    assert.ok(calls.every(({ path }) => path.includes(`family_id=eq.${FAMILY_A}`)));
    assert.match(calls[1].path, new RegExp(`id=eq\\.${PRODUCT_A}`));
  } finally { restore(); }
});

test("cross-family product PATCH and DELETE return 404 with zero mutation", async () => {
  for (const method of ["PATCH", "DELETE"]) {
    let mutations = 0;
    const restore = replace(rewards, {
      authenticateActiveMember: async () => context(),
      readJson: async () => ({ id: PRODUCT_B, name: "Other", stickerCost: 5 }),
      supabaseFetch: async (_path, options = {}) => { if (options.method) mutations += 1; return []; },
    });
    try {
      const response = responseCapture();
      await productsHandler({ method, headers: {} }, response);
      assert.equal(response.statusCode, 404);
      assert.equal(mutations, 0);
    } finally { restore(); }
  }
});

test("stale or demoted Parent reaches no reward product data", async () => {
  let calls = 0;
  const restore = replace(rewards, {
    authenticateActiveMember: async () => { throw authError(); },
    readJson: async () => { calls += 1; return {}; },
    supabaseFetch: async () => { calls += 1; return []; },
  });
  try {
    const response = responseCapture();
    await productsHandler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(calls, 0);
    assert.doesNotMatch(JSON.stringify(response.body), /private/);
  } finally { restore(); }
});

test("reward exchange POST resolves same-Family child and product before scoped RPC", async () => {
  let rpcBody;
  const restore = replace(rewards, {
    authenticateActiveMember: async () => context(),
    resolveActiveFamilyChild: async (_context, id) => { assert.equal(id, CHILD_A); return { id: CHILD_A, family_id: FAMILY_A, display_name: "Child A" }; },
    readJson: async () => ({ productId: PRODUCT_A, memberId: CHILD_A, clientRequestId: "request_12345678" }),
    supabaseFetch: async (path, options = {}) => {
      if (path.startsWith("reward_products?")) return [{ id: PRODUCT_A, family_id: FAMILY_A, is_active: true, stock: 1 }];
      if (path === "rpc/create_reward_exchange_request_v2") {
        rpcBody = JSON.parse(options.body);
        return [{ id: REQUEST_A, member_id: CHILD_A, product_name: "Book", product_emoji: "📘", sticker_cost: 5, status: "pending" }];
      }
      return [];
    },
    memberInFamily: async () => ({ id: CHILD_A, display_name: "Child A" }),
    insertSystemMessage: async () => ({ created: true }),
    sendTargetedPush: async () => ({ success: 0 }),
  });
  try {
    const response = responseCapture();
    await exchangeHandler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 201);
    assert.deepEqual(rpcBody, {
      p_family_id: FAMILY_A,
      p_actor_member_id: PARENT_A,
      p_target_member_id: CHILD_A,
      p_product_id: PRODUCT_A,
      p_client_request_id: "request_12345678",
    });
  } finally { restore(); }
});

test("child self exchange accepts current and null availability windows", async () => {
  for (const availability of [
    { available_from: null, available_until: null },
    { available_from: new Date(Date.now() - 60_000).toISOString(), available_until: new Date(Date.now() + 60_000).toISOString() },
  ]) {
    let productPath = "";
    let rpcBody;
    const restore = replace(rewards, {
      authenticateActiveMember: async () => context("child"),
      readJson: async () => ({ productId: PRODUCT_A, clientRequestId: "request_child_01" }),
      supabaseFetch: async (path, options = {}) => {
        if (path.startsWith("reward_products?")) {
          productPath = path;
          return [{ id: PRODUCT_A, family_id: FAMILY_A, is_active: true, stock: 1, ...availability }];
        }
        if (path === "rpc/create_reward_exchange_request_v2") {
          rpcBody = JSON.parse(options.body);
          return [{ id: REQUEST_A, member_id: CHILD_A, product_name: "Book", product_emoji: "📘", sticker_cost: 1, status: "pending" }];
        }
        return [];
      },
      insertSystemMessage: async () => ({ created: true }),
      sendTargetedPush: async () => ({ success: 0 }),
    });
    try {
      const response = responseCapture();
      await exchangeHandler({ method: "POST", headers: {} }, response);
      assert.equal(response.statusCode, 201);
      assert.match(decodeURIComponent(productPath), /available_from,available_until/);
      assert.equal(rpcBody.p_actor_member_id, CHILD_A);
      assert.equal(rpcBody.p_target_member_id, CHILD_A);
      assert.equal(rpcBody.p_family_id, FAMILY_A);
    } finally { restore(); }
  }
});

test("future and expired reward products stop before exchange RPC", async () => {
  for (const availability of [
    { available_from: new Date(Date.now() + 60_000).toISOString(), available_until: null },
    { available_from: null, available_until: new Date(Date.now() - 60_000).toISOString() },
  ]) {
    let rpcCalls = 0;
    const restore = replace(rewards, {
      authenticateActiveMember: async () => context("child"),
      readJson: async () => ({ productId: PRODUCT_A, clientRequestId: "request_child_02" }),
      supabaseFetch: async (path) => {
        if (path.startsWith("reward_products?")) return [{ id: PRODUCT_A, family_id: FAMILY_A, is_active: true, stock: 1, ...availability }];
        if (path === "rpc/create_reward_exchange_request_v2") rpcCalls += 1;
        return [];
      },
    });
    try {
      const response = responseCapture();
      await exchangeHandler({ method: "POST", headers: {} }, response);
      assert.equal(response.statusCode, 409);
      assert.equal(response.body.code, "REWARD_PRODUCT_UNAVAILABLE");
      assert.equal(rpcCalls, 0);
    } finally { restore(); }
  }
});

test("insufficient exchange RPC remains a sanitized 409 with zero created request", async () => {
  const restore = replace(rewards, {
    authenticateActiveMember: async () => context("child"),
    readJson: async () => ({ productId: PRODUCT_A, clientRequestId: "request_child_03" }),
    supabaseFetch: async (path) => {
      if (path.startsWith("reward_products?")) return [{ id: PRODUCT_A, family_id: FAMILY_A, is_active: true, stock: 1, available_from: null, available_until: null }];
      const error = new Error("private reward balance detail");
      error.statusCode = 400;
      error.supabaseCode = "55000";
      error.supabaseMessage = "INSUFFICIENT_AVAILABLE_STICKERS";
      throw error;
    },
  });
  try {
    const response = responseCapture();
    await exchangeHandler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 409);
    assert.equal(response.body.code, "REWARD_BALANCE_INSUFFICIENT");
    assert.doesNotMatch(JSON.stringify(response.body), /55000|private|STICKERS/);
  } finally { restore(); }
});

test("cross-family exchange product or request produces 404 and zero RPC/mutation", async () => {
  for (const [method, body] of [
    ["POST", { productId: PRODUCT_B, memberId: CHILD_A, clientRequestId: "request_12345678" }],
    ["PATCH", { requestId: REQUEST_A, action: "reject" }],
  ]) {
    let mutations = 0;
    const restore = replace(rewards, {
      authenticateActiveMember: async () => context(),
      resolveActiveFamilyChild: async () => ({ id: CHILD_A }),
      readJson: async () => body,
      supabaseFetch: async (_path, options = {}) => { if (options.method) mutations += 1; return []; },
    });
    try {
      const response = responseCapture();
      await exchangeHandler({ method, headers: {} }, response);
      assert.equal(response.statusCode, 404);
      assert.equal(mutations, 0);
    } finally { restore(); }
  }
});

test("child exchange forces self and rejects a supplied member before product or RPC access", async () => {
  let calls = 0;
  const restore = replace(rewards, {
    authenticateActiveMember: async () => context("child"),
    readJson: async () => ({ productId: PRODUCT_A, memberId: CHILD_A, clientRequestId: "request_12345678" }),
    supabaseFetch: async () => { calls += 1; return []; },
  });
  try {
    const response = responseCapture();
    await exchangeHandler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(calls, 0);
  } finally { restore(); }
});

test("wishlist uses authenticated member and repeats Family scope on deletion", async () => {
  const calls = [];
  const restore = replace(rewards, {
    authenticateActiveMember: async () => context("child"),
    readJson: async () => ({ productId: PRODUCT_A }),
    supabaseFetch: async (path, options = {}) => {
      calls.push({ path, options });
      if (path.startsWith("reward_products?")) return [{ id: PRODUCT_A, family_id: FAMILY_A }];
      if (path.startsWith("reward_wishlist?select=")) return [{ id: REQUEST_A }];
      return [];
    },
  });
  try {
    const response = responseCapture();
    await wishlistHandler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    const deletion = calls.find(({ options }) => options.method === "DELETE");
    assert.match(deletion.path, new RegExp(`family_id=eq\\.${FAMILY_A}`));
    assert.match(deletion.path, new RegExp(`member_id=eq\\.${CHILD_A}`));
    assert.match(deletion.path, new RegExp(`product_id=eq\\.${PRODUCT_A}`));
  } finally { restore(); }
});

test("cross-family wishlist product returns 404 with zero wishlist mutation", async () => {
  let mutations = 0;
  const restore = replace(rewards, {
    authenticateActiveMember: async () => context("child"),
    readJson: async () => ({ productId: PRODUCT_B }),
    supabaseFetch: async (_path, options = {}) => { if (options.method) mutations += 1; return []; },
  });
  try {
    const response = responseCapture();
    await wishlistHandler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 404);
    assert.equal(mutations, 0);
  } finally { restore(); }
});

test("sticker settings and milestones require current DB Parent before mutation", async () => {
  for (const [handler, method] of [[stickerSettingsHandler, "PUT"], [milestonesHandler, "PUT"]]) {
    let calls = 0;
    const target = handler === milestonesHandler ? family : rewards;
    const restore = replace(target, {
      authenticateActiveMember: async () => { throw authError(); },
      readJson: async () => { calls += 1; return {}; },
      supabaseFetch: async () => { calls += 1; return []; },
    });
    try {
      const response = responseCapture();
      await handler({ method, headers: {} }, response);
      assert.equal(response.statusCode, 401);
      assert.equal(calls, 0);
    } finally { restore(); }
  }
});

test("notification preferences Parent target lookup and mutation remain same-Family", async () => {
  const calls = [];
  const restoreAuth = replace(authorization, { authenticateActiveMember: async () => context() });
  const restoreUtils = replace(notifications, {
    readJson: async () => ({ member_key: "child1", study_complete_enabled: false }),
    supabaseFetch: async (path, options = {}) => {
      calls.push({ path, options });
      if (path.startsWith("family_members?")) return [{ id: CHILD_A, family_id: FAMILY_A, member_key: "child1", is_active: true }];
      return [];
    },
  });
  try {
    const response = responseCapture();
    await preferencesHandler({ method: "PATCH", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(calls.length, 2);
    assert.ok(calls.every(({ path }) => path.includes(`family_id=eq.${FAMILY_A}`)));
    assert.equal(JSON.parse(calls[1].options.body).study_complete_enabled, false);
  } finally { restoreUtils(); restoreAuth(); }
});

test("notification foreign-only member key returns safe 404 with zero mutation", async () => {
  const calls = [];
  let mutations = 0;
  const preferences = {
    a: { child1: true, child2: true },
    b: { child1: true, child2: true, child3: true },
  };
  const before = structuredClone(preferences);
  const restoreAuth = replace(authorization, { authenticateActiveMember: async () => context() });
  const restoreUtils = replace(notifications, {
    readJson: async () => ({ member_key: "child3", family_chat_enabled: false }),
    supabaseFetch: async (path, options = {}) => {
      calls.push(path);
      if (options.method) mutations += 1;
      return [];
    },
  });
  try {
    const response = responseCapture();
    await preferencesHandler({ method: "PATCH", headers: {} }, response);
    assert.equal(response.statusCode, 404);
    assert.equal(response.body.code, "FAMILY_CHILD_NOT_FOUND");
    assert.deepEqual(Object.keys(response.body).sort(), ["code", "error", "ok"]);
    assert.equal(mutations, 0);
    assert.deepEqual(preferences.a, before.a);
    assert.deepEqual(preferences.b, before.b);
    assert.equal(calls.length, 1);
    assert.match(calls[0], new RegExp(`family_id=eq\\.${FAMILY_A}`));
    assert.match(calls[0], /member_key=eq\.child3/);
    assert.doesNotMatch(JSON.stringify(response.body), /[0-9a-f]{8}-[0-9a-f-]{27,}|family_id|member_key|constraint|supabase|sql/i);
  } finally { restoreUtils(); restoreAuth(); }
});

test("notification preference child override and session drift have zero mutation", async () => {
  for (const mode of ["child-override", "drift"]) {
    let calls = 0;
    const restoreAuth = replace(authorization, {
      authenticateActiveMember: async () => { if (mode === "drift") throw authError(); return context("child"); },
    });
    const restoreUtils = replace(notifications, {
      readJson: async () => ({ member_key: "other-child", family_chat_enabled: false }),
      supabaseFetch: async () => { calls += 1; return []; },
    });
    try {
      const response = responseCapture();
      await preferencesHandler({ method: "PATCH", headers: {} }, response);
      assert.equal(response.statusCode, mode === "drift" ? 401 : 403);
      assert.equal(response.body.code, mode === "drift" ? "AUTH_SESSION_INVALID" : "AUTH_ROLE_REQUIRED");
      assert.equal(calls, 0);
    } finally { restoreUtils(); restoreAuth(); }
  }
});

test("notification test requires current Parent and targets only its Family/key", async () => {
  let sent;
  const restoreAuth = replace(authorization, {
    authenticateActiveMember: async (_request, options) => { assert.equal(options.requiredRole, "parent"); return context(); },
  });
  const restoreUtils = replace(notifications, { sendToFamily: async (options) => { sent = options; return { success: 1, failure: 0 }; } });
  try {
    const response = responseCapture();
    await notificationTestHandler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(sent.familyId, FAMILY_A);
    assert.deepEqual(sent.memberKeys, ["parent-a"]);
  } finally { restoreUtils(); restoreAuth(); }
});

test("notification test role drift sends zero push and exposes no internal error", async () => {
  let sends = 0;
  const restoreAuth = replace(authorization, { authenticateActiveMember: async () => { throw authError(); } });
  const restoreUtils = replace(notifications, { sendToFamily: async () => { sends += 1; } });
  try {
    const response = responseCapture();
    await notificationTestHandler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(sends, 0);
    assert.doesNotMatch(JSON.stringify(response.body), /private/);
  } finally { restoreUtils(); restoreAuth(); }
});

test("study-complete notification uses child context and same-Family plan", async () => {
  const calls = [];
  const restoreAuth = replace(authorization, { authenticateActiveMember: async (_request, options) => { assert.equal(options.requiredRole, "child"); return context("child"); } });
  const restoreUtils = replace(notifications, {
    readJson: async () => ({ planId: "42" }),
    supabaseFetch: async (path, options = {}) => {
      calls.push({ path, options });
      if (path.startsWith("study_plans?select=")) return [{ id: "42", status: "done", subject: "Math" }];
      if (path.startsWith("family_members?")) return [{ member_key: "parent-a", role: "parent" }];
      if (path.startsWith("sticker_history?")) return [];
      return [];
    },
    sendToFamily: async (options) => { calls.push({ push: options }); return { success: 1, failure: 0 }; },
  });
  try {
    const response = responseCapture();
    await notificationStudyHandler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.ok(calls.some(({ path = "" }) => path.includes(`family_id=eq.${FAMILY_A}`) && path.includes(`assigned_member_id=eq.${CHILD_A}`)));
    assert.equal(calls.find(({ push }) => push).push.familyId, FAMILY_A);
  } finally { restoreUtils(); restoreAuth(); }
});

test("study-complete drift, subscribe drift, and completion-notification drift are zero mutation", async () => {
  for (const [handler, target] of [
    [notificationStudyHandler, notifications],
    [subscribeHandler, notifications],
    [completionNotificationsHandler, family],
  ]) {
    let calls = 0;
    const restoreAuth = handler === completionNotificationsHandler
      ? replace(family, { authenticateActiveMember: async () => { throw authError(); }, supabaseFetch: async () => { calls += 1; return []; } })
      : replace(authorization, { authenticateActiveMember: async () => { throw authError(); } });
    const restoreTarget = handler === completionNotificationsHandler ? () => {} : replace(target, {
      readJson: async () => { calls += 1; return {}; },
      supabaseFetch: async () => { calls += 1; return []; },
      upsertSubscription: async () => { calls += 1; },
      sendToFamily: async () => { calls += 1; },
    });
    try {
      const response = responseCapture();
      await handler({ method: "POST", headers: {} }, response);
      assert.equal(response.statusCode, 401);
      assert.equal(calls, 0);
    } finally { restoreTarget(); restoreAuth(); }
  }
});

test("Reward and Notification database failures expose no SQLSTATE or private detail", async () => {
  const privateError = () => {
    const error = new Error("private table constraint detail");
    error.supabaseCode = "23505";
    error.supabaseMessage = "duplicate key violates private_constraint";
    error.supabaseDetails = "private row detail";
    error.supabaseHint = "private hint";
    return error;
  };

  const restoreReward = replace(rewards, {
    authenticateActiveMember: async () => context(),
    readJson: async () => ({ name: "Book", stickerCost: 5 }),
    supabaseFetch: async () => { throw privateError(); },
  });
  try {
    const response = responseCapture();
    await productsHandler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 500);
    assert.equal(response.body.code, "REWARD_PRODUCT_FAILED");
    assert.doesNotMatch(JSON.stringify(response.body), /23505|private|constraint|duplicate|hint/);
  } finally { restoreReward(); }

  const restoreAuth = replace(authorization, { authenticateActiveMember: async () => context() });
  const restoreNotification = replace(notifications, {
    readJson: async () => ({ subscription: { endpoint: "https://push.example.test/a" } }),
    upsertSubscription: async () => { throw privateError(); },
  });
  try {
    const response = responseCapture();
    await subscribeHandler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 500);
    assert.equal(response.body.code, "PUSH_SUBSCRIBE_FAILED");
    assert.doesNotMatch(JSON.stringify(response.body), /23505|private|constraint|duplicate|hint/);
  } finally { restoreNotification(); restoreAuth(); }
});
