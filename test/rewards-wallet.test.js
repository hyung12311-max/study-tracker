const assert = require("node:assert/strict");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const handler = require("../server/api/rewards");

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

test("GET rewards returns only the authenticated member sticker wallet", async () => {
  const calls = [];
  const stickerHistory = [
    { id: "history-1", study_plan_id: "plan-1", sticker_count: 3 },
    { id: "history-2", study_plan_id: "plan-2", sticker_count: 2 },
  ];
  const restore = replaceUtils({
    authenticate: () => ({ sub: "hagyeom-id", family: "family-id", key: "hagyeom", role: "child" }),
    memberInFamily: async () => ({ id: "hagyeom-id", member_key: "hagyeom", display_name: "하겸", role: "child", is_active: true }),
    supabaseFetch: async (path) => {
      calls.push(path);
      if (path.startsWith("sticker_transactions?select=amount")) return [{ amount: 5 }, { amount: 3 }];
      if (path.startsWith("sticker_history?")) return stickerHistory;
      return [];
    },
  });

  try {
    const response = responseCapture();
    await handler({ method: "GET", headers: {}, url: "/api/rewards" }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.balance, 8);
    assert.equal(response.body.stickerHistoryCount, 2);
    assert.deepEqual(response.body.stickerHistory, stickerHistory);
    assert.equal(response.body.viewer.memberKey, "hagyeom");
    assert.equal(response.body.viewer.walletMemberKey, "hagyeom");
    assert.ok(calls.some((path) => path.includes("sticker_transactions?select=amount&member_id=eq.hagyeom-id")));
    assert.ok(calls.some((path) => path.includes("sticker_history?") && path.includes("family_id=eq.family-id") && path.includes("member_id=eq.hagyeom-id")));
    assert.ok(calls.every((path) => !path.includes("member_id=eq.other-member")));
  } finally {
    restore();
  }
});

test("GET rewards rejects a restored session whose member_key no longer matches", async () => {
  let queriedWallet = false;
  const restore = replaceUtils({
    authenticate: () => ({ sub: "hagyeom-id", family: "family-id", key: "hagyeom", role: "child" }),
    memberInFamily: async () => ({ id: "hagyeom-id", member_key: "other-child", role: "child", is_active: true }),
    supabaseFetch: async () => { queriedWallet = true; return []; },
  });

  try {
    const response = responseCapture();
    await handler({ method: "GET", headers: {}, url: "/api/rewards" }, response);

    assert.equal(response.statusCode, 403);
    assert.equal(queriedWallet, false);
  } finally {
    restore();
  }
});
