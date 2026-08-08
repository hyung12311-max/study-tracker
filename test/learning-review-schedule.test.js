const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const handler = require("../server/api/learning/review-schedule");
const queueModel = require("../server/api/learning/_review-queue");

const FAMILY = "10000000-0000-4000-8000-000000000001";
const PARENT = "20000000-0000-4000-8000-000000000001";
const CHILD = "20000000-0000-4000-8000-000000000002";
const ASSIGNMENT = "30000000-0000-4000-8000-000000000001";
const UNIT = "40000000-0000-4000-8000-000000000001";
const VERSION = "50000000-0000-4000-8000-000000000001";
const ATTEMPT = "60000000-0000-4000-8000-000000000001";
const QUESTION = "70000000-0000-4000-8000-000000000001";
const ANSWER = "80000000-0000-4000-8000-000000000001";
const REVIEW = "90000000-0000-4000-8000-000000000001";
const REQUEST = "a0000000-0000-4000-8000-000000000001";

function response() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

function request(overrides = {}) {
  return {
    method: "PUT",
    url: "/api/learning/review-schedule",
    headers: {
      host: "study.test",
      origin: "https://study.test",
      "content-type": "application/json",
      "x-study-csrf": "1",
    },
    testBody: {
      assignedMemberId: CHILD,
      assignmentId: ASSIGNMENT,
      skillCode: "place-value",
      action: "snooze",
      durationDays: 3,
      requestId: REQUEST,
    },
    ...overrides,
  };
}

function replace(overrides) {
  const originals = {};
  for (const [key, value] of Object.entries(overrides)) {
    originals[key] = utils[key];
    utils[key] = value;
  }
  return () => Object.assign(utils, originals);
}

function parentMocks(observed = []) {
  return {
    readJson: async (req) => req.testBody,
    authenticate: (_request, role) => {
      assert.equal(role, "parent");
      return { sub: PARENT, family: FAMILY, role: "parent" };
    },
    memberInFamily: async () => ({ id: PARENT, family_id: FAMILY, role: "parent", is_active: true }),
    supabaseFetch: async (query, options) => {
      observed.push({ query, options });
      if (query.startsWith("family_members?")) return [{ id: CHILD, family_id: FAMILY, role: "child", is_active: true }];
      if (query === "rpc/set_learning_review_schedule_override") return [{
        schedule_override_id: "b0000000-0000-4000-8000-000000000001",
        schedule_assignment_id: ASSIGNMENT,
        schedule_skill_code: "place-value",
        schedule_override_due_at: "2026-08-11T00:00:00Z",
        schedule_duration_days: 3,
        schedule_revision: 1,
        schedule_operation: "override_created",
        schedule_changed_at: "2026-08-08T00:00:00Z",
      }];
      throw new Error(`Unexpected query: ${query}`);
    },
  };
}

function queueData(overrides = {}) {
  return {
    assignments: [{ id: ASSIGNMENT, unit_id: UNIT, content_version_id: VERSION }],
    attempts: [{ id: ATTEMPT, assignment_id: ASSIGNMENT, finalized_at: "2026-08-01T00:00:00Z" }],
    answerRows: [{ id: ANSWER, attempt_id: ATTEMPT, attempt_question_id: QUESTION, is_correct: false, submitted_at: "2026-08-01T00:00:00Z" }],
    questionRows: [{ id: QUESTION, attempt_id: ATTEMPT, skill_codes_snapshot: ["place-value"] }],
    reviewSessions: [],
    reviewItems: [],
    reviewAnswers: [],
    scheduleOverrides: [],
    unitById: new Map([[UNIT, { unit_code: "unit", display_title: "단원" }]]),
    versionById: new Map([[VERSION, { version_no: 1 }]]),
    skillNameByCode: new Map([["place-value", "자릿값 이해"]]),
    ...overrides,
  };
}

test("router exposes one explicit review schedule mutation route", () => {
  const router = fs.readFileSync(path.join(__dirname, "../api/[...path].js"), "utf8");
  assert.match(router, /"learning\/review-schedule": learningReviewSchedule/);
});

test("parent snoozes an owned child queue target with the hardened RPC", async () => {
  const observed = [];
  const restore = replace(parentMocks(observed));
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.schedule, {
      assignmentId: ASSIGNMENT,
      skillCode: "place-value",
      overrideDueAt: "2026-08-11T00:00:00Z",
      durationDays: 3,
      revision: 1,
      operation: "override_created",
      changedAt: "2026-08-08T00:00:00Z",
    });
    const rpc = observed.find(({ query }) => query === "rpc/set_learning_review_schedule_override");
    assert.deepEqual(JSON.parse(rpc.options.body), {
      p_family_id: FAMILY,
      p_actor_member_id: PARENT,
      p_assigned_member_id: CHILD,
      p_assignment_id: ASSIGNMENT,
      p_skill_code: "place-value",
      p_action: "snooze",
      p_duration_days: 3,
      p_request_id: REQUEST,
    });
  } finally { restore(); }
});

test("clear sends no duration and returns the deterministic-default boundary", async () => {
  const observed = [];
  const mocks = parentMocks(observed);
  const originalFetch = mocks.supabaseFetch;
  mocks.supabaseFetch = async (query, options) => {
    if (query === "rpc/set_learning_review_schedule_override") return [{
      schedule_override_id: "b0000000-0000-4000-8000-000000000001",
      schedule_assignment_id: ASSIGNMENT,
      schedule_skill_code: "place-value",
      schedule_override_due_at: null,
      schedule_duration_days: null,
      schedule_revision: 2,
      schedule_operation: "override_cleared",
      schedule_changed_at: "2026-08-08T01:00:00Z",
    }];
    return originalFetch(query, options);
  };
  const restore = replace(mocks);
  try {
    const result = response();
    await handler(request({ testBody: {
      assignedMemberId: CHILD,
      assignmentId: ASSIGNMENT,
      skillCode: "place-value",
      action: "clear",
      requestId: REQUEST,
    } }), result);
    assert.equal(result.body.schedule.overrideDueAt, null);
    assert.equal(result.body.schedule.durationDays, null);
  } finally { restore(); }
});

test("queue uses override as effective schedule and clear returns to deterministic default", () => {
  const override = queueModel.buildReviewQueue(queueData({
    scheduleOverrides: [{ assignment_id: ASSIGNMENT, skill_code: "place-value", override_due_at: "2026-08-20T00:00:00Z", revision: 4 }],
  }), "2026-08-08T00:00:00Z")[0];
  assert.equal(override.defaultDueAt, "2026-08-01T00:00:00.000Z");
  assert.equal(override.overrideDueAt, "2026-08-20T00:00:00Z");
  assert.equal(override.effectiveDueAt, "2026-08-20T00:00:00Z");
  assert.equal(override.scheduleSource, "override");
  assert.equal(override.action.type, "scheduled");
  const cleared = queueModel.buildReviewQueue(queueData({
    scheduleOverrides: [{ assignment_id: ASSIGNMENT, skill_code: "place-value", override_due_at: null, revision: 5 }],
  }), "2026-08-08T00:00:00Z")[0];
  assert.equal(cleared.scheduleSource, "default");
  assert.equal(cleared.effectiveDueAt, cleared.defaultDueAt);
  assert.equal(cleared.action.type, "start");
});

test("active review resume remains first even when override is not due", () => {
  const queue = queueModel.buildReviewQueue(queueData({
    reviewSessions: [{ id: REVIEW, assignment_id: ASSIGNMENT, status: "in_progress", started_at: "2026-08-08T00:00:00Z" }],
    scheduleOverrides: [{ assignment_id: ASSIGNMENT, skill_code: "place-value", override_due_at: "2026-08-20T00:00:00Z", revision: 1 }],
  }), "2026-08-08T00:00:00Z");
  assert.deepEqual(queue[0].action, { type: "resume", reviewId: REVIEW });
});

test("snooze duration is restricted to the 1 3 7 day allowlist", () => {
  for (const durationDays of [0, 2, 8, "3", null]) {
    assert.throws(
      () => handler.scheduleRequest({ ...request().testBody, durationDays }),
      (error) => error.statusCode === 400 && error.code === "INVALID_SNOOZE_DURATION"
    );
  }
});

test("invalid action skill and identifiers are rejected before scope or RPC", () => {
  for (const body of [
    { ...request().testBody, action: "dismiss" },
    { ...request().testBody, skillCode: "Bad Skill" },
    { ...request().testBody, assignmentId: "invalid" },
    { ...request().testBody, requestId: "invalid" },
  ]) {
    assert.throws(() => handler.scheduleRequest(body), (error) => error.statusCode === 400);
  }
});

test("mutation requires JSON CSRF and matching Origin before reading body", async () => {
  for (const headers of [
    { ...request().headers, "content-type": "text/plain" },
    { ...request().headers, "x-study-csrf": "0" },
    { ...request().headers, origin: "https://other.test" },
  ]) {
    let read = false;
    const restore = replace({ readJson: async () => { read = true; return {}; } });
    try {
      const result = response();
      await handler(request({ headers }), result);
      assert.ok([403, 415].includes(result.statusCode));
      assert.equal(read, false);
    } finally { restore(); }
  }
});

test("unauthorized caller is blocked before schedule RPC", async () => {
  let mutated = false;
  const restore = replace({
    readJson: async (req) => req.testBody,
    authenticate: () => { throw utils.err("로그인이 필요합니다.", 401, "AUTH_REQUIRED"); },
    supabaseFetch: async () => { mutated = true; return []; },
  });
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 401);
    assert.equal(mutated, false);
  } finally { restore(); }
});

test("child scheduling is denied because only parent policy is approved", async () => {
  let mutated = false;
  const restore = replace({
    readJson: async (req) => req.testBody,
    authenticate: () => ({ sub: CHILD, family: FAMILY, role: "child" }),
    memberInFamily: async () => ({ id: CHILD, family_id: FAMILY, role: "child", is_active: true }),
    supabaseFetch: async () => { mutated = true; return []; },
  });
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 403);
    assert.equal(result.body.code, "ACTIVE_PARENT_REQUIRED");
    assert.equal(mutated, false);
  } finally { restore(); }
});

test("other-family child is hidden before schedule RPC", async () => {
  const observed = [];
  const mocks = parentMocks(observed);
  mocks.supabaseFetch = async (query) => {
    observed.push({ query });
    if (query.startsWith("family_members?")) return [];
    throw new Error("schedule RPC must not run");
  };
  const restore = replace(mocks);
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 404);
    assert.equal(result.body.code, "LEARNING_TARGET_NOT_FOUND");
    assert.equal(observed.some(({ query }) => query === "rpc/set_learning_review_schedule_override"), false);
  } finally { restore(); }
});

test("duplicate-safe response and idempotency conflicts are generalized", async () => {
  const restore = replace({
    ...parentMocks(),
    supabaseFetch: async (query) => {
      if (query.startsWith("family_members?")) return [{ id: CHILD, family_id: FAMILY, role: "child", is_active: true }];
      const error = new Error("private request collision");
      error.supabaseCode = "55000";
      error.supabaseMessage = "IDEMPOTENCY_CONFLICT";
      throw error;
    },
  });
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 409);
    assert.equal(result.body.code, "IDEMPOTENCY_CONFLICT");
    assert.doesNotMatch(JSON.stringify(result.body), /private request collision|55000/);
  } finally { restore(); }
});

test("unexpected database failures expose no schedule or credential details", async () => {
  const restore = replace({
    ...parentMocks(),
    supabaseFetch: async (query) => {
      if (query.startsWith("family_members?")) return [{ id: CHILD, family_id: FAMILY, role: "child", is_active: true }];
      const error = new Error("postgres://service_role:secret@private-family/schedule");
      error.supabaseCode = "XX999";
      throw error;
    },
  });
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 500);
    assert.equal(result.body.code, "LEARNING_REVIEW_SCHEDULE_FAILED");
    assert.doesNotMatch(JSON.stringify(result.body), /postgres|service_role|secret|family|assignment/i);
  } finally { restore(); }
});

test("schedule endpoint is PUT only and source cannot mutate official or review results", async () => {
  const result = response();
  await handler(request({ method: "POST" }), result);
  assert.equal(result.statusCode, 405);
  assert.equal(result.headers.Allow, "PUT");
  const source = fs.readFileSync(path.join(__dirname, "../server/api/learning/review-schedule.js"), "utf8");
  assert.doesNotMatch(source, /learning_attempts|learning_stage_progress|learning_stage_first_passes|sticker_transactions|learning_mistake_review_answers/);
});
