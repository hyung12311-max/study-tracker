const assert = require("node:assert/strict");
const test = require("node:test");

const pushUtilsPath = require.resolve("../server/api/push/_utils");
const familyUtilsPath = require.resolve("../server/api/family/_utils");
const sendPath = require.resolve("../server/api/push/send");
const pushUtils = require(pushUtilsPath);
const familyUtils = require(familyUtilsPath);

const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CHILD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function responseCapture() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

async function runStudyPush({ childName, failedEndpoint = null }) {
  const calls = [];
  const payloads = [];
  const rows = [
    { id: "11111111-1111-4111-8111-111111111111", endpoint: "https://push.example/good", p256dh: "a", auth: "b" },
    { id: "22222222-2222-4222-8222-222222222222", endpoint: "https://push.example/bad", p256dh: "c", auth: "d" },
  ];
  const originalPush = { ...pushUtils };
  const originalFamily = { ...familyUtils };
  try {
    Object.assign(pushUtils, {
      configureWebPush: () => {},
      readJson: async () => ({ planId: "42" }),
      normalizeSubscription: (row) => row,
      validateSubscriptionPayload: () => {},
      webPush: {
        sendNotification: async (subscription, rawPayload) => {
          payloads.push({ endpoint: subscription.endpoint, payload: JSON.parse(rawPayload) });
          if (subscription.endpoint === failedEndpoint) throw Object.assign(new Error("gone"), { statusCode: 410 });
        },
      },
      supabaseFetch: async (requestPath, options = {}) => {
        calls.push({ path: requestPath, options });
        if (requestPath.startsWith("study_plans?select=")) {
          return [{
            id: 42,
            subject: "수학",
            workbook: "문제집",
            status: "done",
            parent_notified_at: null,
            assigned_member_id: CHILD_ID,
          }];
        }
        if (requestPath.startsWith("sticker_history?")) return [{ sticker_count: 2 }];
        if (requestPath.startsWith("family_members?select=display_name")) {
          return childName ? [{ display_name: childName }] : [];
        }
        if (requestPath.startsWith("family_push_subscriptions?select=")) return rows;
        if (options.method === "PATCH") return [];
        throw new Error(`Unexpected Supabase path: ${requestPath}`);
      },
    });
    Object.assign(familyUtils, {
      authenticate: () => ({ sub: CHILD_ID, family: FAMILY_ID, key: "child", role: "child" }),
      supabaseFetch: async (requestPath) => {
        return [{ id: CHILD_ID, family_id: FAMILY_ID, member_key: "child", role: "child", is_active: true }];
      },
    });
    delete require.cache[sendPath];
    const handler = require(sendPath);
    const response = responseCapture();
    await handler({ method: "POST", headers: {} }, response);
    return { response, calls, payloads, rows };
  } finally {
    Object.assign(pushUtils, originalPush);
    Object.assign(familyUtils, originalFamily);
    delete require.cache[sendPath];
  }
}

for (const childName of ["하겸", "다율"]) {
  test(`study push uses the verified ${childName} display name`, async () => {
    const { response, calls, payloads } = await runStudyPush({ childName });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, 2);
    assert.ok(payloads.every(({ payload }) => payload.title === `${childName} 학습 완료 ⭐`));
    assert.ok(payloads.every(({ payload }) => payload.body.startsWith(`${childName} 자녀가 `)));
    const memberQuery = calls.find(({ path }) => path.startsWith("family_members?select=display_name")).path;
    assert.match(memberQuery, new RegExp(`id=eq\\.${CHILD_ID}`));
    assert.match(memberQuery, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
  });
}

test("study push uses a non-identifying fallback when the assigned child name is unavailable", async () => {
  const { payloads } = await runStudyPush({ childName: null });
  assert.ok(payloads.every(({ payload }) => payload.title === "자녀 학습 완료 ⭐"));
  assert.ok(payloads.every(({ payload }) => payload.body.startsWith("자녀가 ")));
});

test("only the failed family subscription is disabled in family_push_subscriptions", async () => {
  const failedEndpoint = "https://push.example/bad";
  const { response, calls } = await runStudyPush({ childName: "다율", failedEndpoint });
  assert.equal(response.body.success, 1);
  assert.equal(response.body.failure, 1);
  const patches = calls.filter(({ options }) => options.method === "PATCH");
  const subscriptionPatches = patches.filter(({ path }) => path.startsWith("family_push_subscriptions?"));
  assert.equal(subscriptionPatches.length, 1);
  assert.match(subscriptionPatches[0].path, /id=eq\.22222222-2222-4222-8222-222222222222/);
  assert.match(subscriptionPatches[0].path, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
  assert.match(subscriptionPatches[0].path, /endpoint=eq\.https%3A%2F%2Fpush\.example%2Fbad/);
  assert.deepEqual(JSON.parse(subscriptionPatches[0].options.body), { is_active: false });
  assert.ok(!calls.some(({ path }) => path.startsWith("push_subscriptions?")));
  assert.ok(!subscriptionPatches[0].path.includes("good"));
});

test("the family push path contains no hard-coded child name", () => {
  const source = require("node:fs").readFileSync(sendPath, "utf8");
  assert.doesNotMatch(source, /하겸이 (?:학습|일정) 완료|하겸이가/);
  assert.match(source, /family_push_subscriptions\?id=eq\./);
});

for (const [label, member] of [
  ["role drift", { id: CHILD_ID, family_id: FAMILY_ID, member_key: "parent", role: "child", is_active: true }],
  ["family drift", { id: CHILD_ID, family_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", member_key: "parent", role: "parent", is_active: true }],
]) {
  test(`push send rejects ${label} before configuration or target access`, async () => {
    const originalPush = { ...pushUtils };
    const originalFamily = { ...familyUtils };
    let configured = false;
    try {
      Object.assign(pushUtils, {
        configureWebPush: () => { configured = true; },
        readJson: async () => { throw new Error("body must not be read"); },
      });
      Object.assign(familyUtils, {
        authenticate: () => ({ sub: CHILD_ID, family: FAMILY_ID, key: "parent", role: "parent" }),
        supabaseFetch: async () => [member],
      });
      delete require.cache[sendPath];
      const handler = require(sendPath);
      const response = responseCapture();
      await handler({ method: "POST", headers: {} }, response);
      assert.equal(response.statusCode, 401);
      assert.equal(response.body.code, "AUTH_SESSION_INVALID");
      assert.equal(configured, false);
    } finally {
      Object.assign(pushUtils, originalPush);
      Object.assign(familyUtils, originalFamily);
      delete require.cache[sendPath];
    }
  });
}
