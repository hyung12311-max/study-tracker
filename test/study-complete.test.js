const assert = require("node:assert/strict");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const handler = require("../server/api/rewards/study-complete");

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

test("POST study-complete returns 200 after plan completion, sticker award, and parent targeting", async () => {
  const calls = [];
  const restore = replaceUtils({
    authenticate: () => ({ sub: "child-id", family: "family-id", key: "hagyeom", role: "child" }),
    readJson: async () => ({ planId: "36" }),
    memberInFamily: async () => ({ id: "child-id", display_name: "하겸이", role: "child", is_active: true }),
    supabaseFetch: async (path, options = {}) => {
      calls.push({ path, options });
      if (path.startsWith("study_plans?select=")) return [{ id: 36, subject: "수학", status: "예정" }];
      if (path === "rpc/complete_study_plan_with_reward") return [{
        completed_plan: { id: 36, status: "done" },
        adjustment_type: "normal",
        rescheduled_count: 0,
        sticker_count: 2,
        reward_type: "study_on_time",
        reward_reason: "계획한 날짜에 완료",
        already_completed: false,
        balance: 7,
      }];
      return null;
    },
    sendTargetedPush: async (options) => {
      calls.push({ push: options });
      return { success: 2, failure: 0, subscriptionCount: 2 };
    },
  });
  try {
    const response = responseCapture();
    await handler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.completion.plan.status, "done");
    assert.equal(response.body.completion.stickerCount, 2);
    assert.equal(response.body.parentNotification.success, 2);
    assert.ok(calls.some((call) => call.path === "rpc/complete_study_plan_with_reward"));
    assert.ok(calls.some((call) => call.push?.target === "parent" && call.push?.event === "study_complete"));
  } finally {
    restore();
  }
});

test("missing Supabase completion RPC is reported as server configuration error, not API 404", async () => {
  const restore = replaceUtils({
    authenticate: () => ({ sub: "child-id", family: "family-id", key: "hagyeom", role: "child" }),
    readJson: async () => ({ planId: "36" }),
    memberInFamily: async () => ({ id: "child-id", display_name: "하겸이", role: "child", is_active: true }),
    supabaseFetch: async (path) => {
      if (path.startsWith("study_plans?select=")) return [{ id: 36, subject: "수학", status: "예정" }];
      const error = new Error("Supabase rejected the request.");
      error.statusCode = 404;
      error.supabaseCode = "PGRST202";
      error.supabaseMessage = "Could not find the function";
      throw error;
    },
  });
  try {
    const response = responseCapture();
    await handler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 500);
    assert.equal(response.body.code, "STUDY_COMPLETION_RPC_MISSING");
    assert.equal(response.body.error, "학습 완료 서버 구성이 누락되었습니다.");
  } finally {
    restore();
  }
});

test("a reading plan from another family cannot be completed", async () => {
  let completed = false;
  const restore = replaceUtils({
    authenticate: () => ({ sub: "child-id", family: "family-id", key: "hagyeom", role: "child" }),
    readJson: async () => ({ planId: "36" }),
    memberInFamily: async () => ({ id: "child-id", display_name: "하겸이", role: "child", is_active: true }),
    supabaseFetch: async (path) => {
      if (path.startsWith("study_plans?select=")) return [{ id: 36, subject: "독서", status: "예정", reading_plan_id: "reading-id", reading_plans: { family_id: "other-family" } }];
      completed = true;
      return [];
    },
  });
  try {
    const response = responseCapture();
    await handler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 404);
    assert.equal(response.body.code, "STUDY_PLAN_NOT_FOUND");
    assert.equal(completed, false);
  } finally {
    restore();
  }
});
