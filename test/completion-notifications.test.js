const assert = require("node:assert/strict");
const test = require("node:test");

const utils = require("../server/api/family/_utils");
const handler = require("../server/api/completion-notifications");

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

function validNotificationBody(studyPlanId) {
  return {
    study_plan_id: studyPlanId,
    title: "Study complete",
    body: "Completed safely",
  };
}

test("completion notifications preserve valid bigint plan ids through lookup, insert, and response", async (t) => {
  for (const value of [
    "1",
    "9007199254740991",
    "9007199254740992",
    "9223372036854775807",
  ]) {
    await t.test(value, async () => {
      let insertedPlanId = null;
      const restore = replaceUtils({
        authenticateActiveMember: async () => ({ familyId: "family-id", memberId: "child-id", memberKey: "child-key", role: "child", member: { id: "child-id", family_id: "family-id", member_key: "child-key", role: "child", is_active: true } }),
        readJson: async () => validNotificationBody(value),
        supabaseFetch: async (path, options = {}) => {
          if (path.startsWith("family_members?")) return [{ id: "child-id", role: "child", is_active: true }];
          if (path.startsWith("study_plans?select=")) {
            assert.match(path, new RegExp(`id=eq\\.${value}`));
            return [{ id: value }];
          }
          if (path === "completion_notifications") {
            insertedPlanId = JSON.parse(options.body).study_plan_id;
            return [{ id: "notification-id", study_plan_id: 1 }];
          }
          return [];
        },
      });
      try {
        const response = responseCapture();
        await handler({ method: "POST", headers: {} }, response);
        assert.equal(response.statusCode, 200);
        assert.equal(insertedPlanId, value);
        assert.equal(typeof insertedPlanId, "string");
        assert.equal(response.body.notification.study_plan_id, value);
        assert.equal(typeof response.body.notification.study_plan_id, "string");
      } finally {
        restore();
      }
    });
  }
});

test("completion notifications reject non-canonical or non-string bigint ids before plan access", async (t) => {
  const invalidValues = [
    "",
    " 1",
    "1 ",
    "0",
    "-1",
    "+1",
    "1.0",
    "1e3",
    "abc",
    "01",
    "9223372036854775808",
    9007199254740992,
    [],
    {},
    true,
    null,
  ];

  for (const value of invalidValues) {
    await t.test(JSON.stringify(value), async () => {
      let planOrInsertCalls = 0;
      const restore = replaceUtils({
        authenticateActiveMember: async () => ({ familyId: "family-id", memberId: "child-id", memberKey: "child-key", role: "child", member: { id: "child-id", family_id: "family-id", member_key: "child-key", role: "child", is_active: true } }),
        readJson: async () => validNotificationBody(value),
        supabaseFetch: async (path) => {
          if (path.startsWith("family_members?")) return [{ id: "child-id", role: "child", is_active: true }];
          planOrInsertCalls += 1;
          return [];
        },
      });
      try {
        const response = responseCapture();
        await handler({ method: "POST", headers: {} }, response);
        assert.equal(response.statusCode, 400);
        assert.equal(response.body.code, "INVALID_COMPLETION_NOTIFICATION");
        assert.equal(planOrInsertCalls, 0);
      } finally {
        restore();
      }
    });
  }
});

test("completion notification GET exposes bigint foreign keys as decimal strings", async () => {
  const restore = replaceUtils({
    authenticateActiveMember: async () => ({ familyId: "family-id", memberId: "child-id", memberKey: "child-key", role: "child", member: { id: "child-id", family_id: "family-id", member_key: "child-key", role: "child", is_active: true } }),
    supabaseFetch: async (path) => {
      if (path.startsWith("family_members?")) return [{ id: "child-id", role: "child", is_active: true }];
      return [
        { id: "notification-one", study_plan_id: "9223372036854775807" },
        { id: "notification-two", study_plan_id: null },
      ];
    },
  });
  try {
    const response = responseCapture();
    await handler({ method: "GET", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.notifications[0].study_plan_id, "9223372036854775807");
    assert.equal(typeof response.body.notifications[0].study_plan_id, "string");
    assert.equal(response.body.notifications[1].study_plan_id, null);
  } finally {
    restore();
  }
});
