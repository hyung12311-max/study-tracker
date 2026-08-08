const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const handler = require("../server/api/learning/review-queue");
const model = require("../server/api/learning/_review-queue");

const FAMILY = "10000000-0000-4000-8000-000000000001";
const OTHER_FAMILY = "10000000-0000-4000-8000-000000000002";
const PARENT = "20000000-0000-4000-8000-000000000001";
const CHILD = "20000000-0000-4000-8000-000000000002";
const ASSIGNMENT = "30000000-0000-4000-8000-000000000001";
const UNIT = "40000000-0000-4000-8000-000000000001";
const VERSION = "50000000-0000-4000-8000-000000000001";
const ATTEMPT = "60000000-0000-4000-8000-000000000001";
const QUESTION_1 = "70000000-0000-4000-8000-000000000001";
const QUESTION_2 = "70000000-0000-4000-8000-000000000002";
const ANSWER_1 = "80000000-0000-4000-8000-000000000001";
const ANSWER_2 = "80000000-0000-4000-8000-000000000002";
const REVIEW_1 = "90000000-0000-4000-8000-000000000001";
const REVIEW_2 = "90000000-0000-4000-8000-000000000002";
const ITEM_1 = "a0000000-0000-4000-8000-000000000001";
const ITEM_2 = "a0000000-0000-4000-8000-000000000002";

function response() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

function request(method = "GET", memberId = CHILD) {
  return {
    method,
    url: `/api/learning/review-queue${memberId ? `?assignedMemberId=${memberId}` : ""}`,
    headers: {},
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

function fixture(overrides = {}) {
  return {
    assignments: [{ id: ASSIGNMENT, unit_id: UNIT, content_version_id: VERSION, status: "active" }],
    attempts: [{ id: ATTEMPT, assignment_id: ASSIGNMENT, status: "failed", finalized_at: "2026-08-01T10:00:00Z" }],
    answers: [
      { id: ANSWER_1, attempt_id: ATTEMPT, attempt_question_id: QUESTION_1, is_correct: false, submitted_at: "2026-08-01T09:58:00Z" },
      { id: ANSWER_2, attempt_id: ATTEMPT, attempt_question_id: QUESTION_2, is_correct: false, submitted_at: "2026-08-01T09:59:00Z" },
    ],
    questions: [
      { id: QUESTION_1, attempt_id: ATTEMPT, skill_codes_snapshot: ["place-value"] },
      { id: QUESTION_2, attempt_id: ATTEMPT, skill_codes_snapshot: ["place-value", "read-number"] },
    ],
    sessions: [],
    items: [],
    reviewAnswers: [],
    scheduleOverrides: [],
    units: [{ id: UNIT, unit_code: "three-digit-numbers", display_title: "세 자리 수" }],
    versions: [{ id: VERSION, version_no: 1 }],
    definitions: [
      { skill_code: "place-value", display_name: "자릿값 이해" },
      { skill_code: "read-number", display_name: "수 읽기" },
    ],
    ...overrides,
  };
}

function mocks(data = fixture(), observed = [], role = "parent") {
  return {
    authenticate: () => ({ sub: role === "parent" ? PARENT : CHILD, family: FAMILY, role }),
    memberInFamily: async () => ({
      id: role === "parent" ? PARENT : CHILD,
      family_id: FAMILY,
      role,
      is_active: true,
    }),
    supabaseFetch: async (query) => {
      observed.push(query);
      if (query.startsWith("family_members?")) return [{ id: CHILD, family_id: FAMILY, role: "child", is_active: true }];
      if (query.startsWith("learning_assignments?")) return data.assignments;
      if (query.startsWith("learning_attempts?")) return data.attempts;
      if (query.startsWith("learning_attempt_answers?")) return data.answers;
      if (query.startsWith("learning_attempt_questions?")) return data.questions;
      if (query.startsWith("learning_mistake_review_sessions?")) return data.sessions;
      if (query.startsWith("learning_mistake_review_items?")) return data.items;
      if (query.startsWith("learning_mistake_review_answers?")) return data.reviewAnswers;
      if (query.startsWith("learning_review_schedule_overrides?")) return data.scheduleOverrides;
      if (query.startsWith("learning_units?")) return data.units;
      if (query.startsWith("learning_content_versions?")) return data.versions;
      if (query.startsWith("learning_skill_definitions?")) return data.definitions;
      throw new Error(`Unexpected query: ${query}`);
    },
  };
}

function modelData(data = fixture()) {
  return {
    assignments: data.assignments,
    attempts: data.attempts,
    answerRows: data.answers,
    questionRows: data.questions,
    reviewSessions: data.sessions,
    reviewItems: data.items,
    reviewAnswers: data.reviewAnswers,
    scheduleOverrides: data.scheduleOverrides,
    unitById: new Map(data.units.map((row) => [row.id, row])),
    versionById: new Map(data.versions.map((row) => [row.id, row])),
    skillNameByCode: new Map(data.definitions.map((row) => [row.skill_code, row.display_name])),
  };
}

test("router exposes the Phase G review queue GET route", () => {
  const router = fs.readFileSync(path.join(__dirname, "../api/[...path].js"), "utf8");
  assert.match(router, /"learning\/review-queue": learningReviewQueue/);
});

test("queue groups immutable official mistake snapshots by assignment and skill", () => {
  const queue = model.buildReviewQueue(modelData(), "2026-08-02T00:00:00Z");
  assert.equal(queue.length, 2);
  assert.deepEqual(queue[0], {
    assignmentId: ASSIGNMENT,
    unit: { code: "three-digit-numbers", title: "세 자리 수" },
    contentVersion: { number: 1 },
    skill: { code: "place-value", name: "자릿값 이해" },
    questionCount: 2,
    dueQuestionCount: 2,
    due: true,
    dueAt: "2026-08-01T09:58:00.000Z",
    defaultDueAt: "2026-08-01T09:58:00.000Z",
    overrideDueAt: null,
    effectiveDueAt: "2026-08-01T09:58:00.000Z",
    scheduleSource: "default",
    scheduleRevision: null,
    priorityStatus: "unreviewed",
    stateCounts: { repeated_wrong: 0, unreviewed: 2, retried_wrong: 0, resolved: 0 },
    action: { type: "start", reviewId: null },
  });
  assert.equal(queue[1].skill.code, "read-number");
});

test("review evidence produces deterministic retry resolved and repeated intervals", () => {
  const data = fixture({
    sessions: [
      { id: REVIEW_1, assignment_id: ASSIGNMENT, status: "completed", started_at: "2026-08-02T00:00:00Z" },
      { id: REVIEW_2, assignment_id: ASSIGNMENT, status: "completed", started_at: "2026-08-03T00:00:00Z" },
    ],
    items: [
      { id: ITEM_1, session_id: REVIEW_1, source_attempt_question_id: QUESTION_1 },
      { id: ITEM_2, session_id: REVIEW_2, source_attempt_question_id: QUESTION_1 },
    ],
    reviewAnswers: [
      { id: "r1", session_id: REVIEW_1, review_item_id: ITEM_1, is_correct: false, submitted_at: "2026-08-02T10:00:00Z" },
      { id: "r2", session_id: REVIEW_2, review_item_id: ITEM_2, is_correct: false, submitted_at: "2026-08-03T10:00:00Z" },
    ],
  });
  const repeated = model.buildReviewQueue(modelData(data), "2026-08-04T10:00:00Z")[0];
  assert.equal(repeated.priorityStatus, "repeated_wrong");
  assert.equal(repeated.dueAt, "2026-08-04T10:00:00.000Z");
  data.reviewAnswers[1].is_correct = true;
  const resolved = model.buildReviewQueue(modelData(data), "2026-08-04T10:00:00Z")[0];
  assert.equal(resolved.priorityStatus, "unreviewed");
  assert.equal(resolved.stateCounts.resolved, 1);
});

test("active review state returns resume instead of conflicting start", () => {
  const data = fixture({
    sessions: [{ id: REVIEW_1, assignment_id: ASSIGNMENT, status: "in_progress", started_at: "2026-08-02T00:00:00Z" }],
  });
  const queue = model.buildReviewQueue(modelData(data), "2026-08-02T00:00:00Z");
  assert.deepEqual(queue[0].action, { type: "resume", reviewId: REVIEW_1 });
});

test("empty assignment state avoids official and review evidence queries", async () => {
  const observed = [];
  const restore = replace(mocks(fixture({ assignments: [] }), observed));
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.state, "empty");
    assert.deepEqual(result.body.queue, []);
    assert.equal(observed.some((query) => query.startsWith("learning_attempts?")), false);
  } finally { restore(); }
});

test("questions without immutable skill snapshots stay outside the queue", async () => {
  const data = fixture({ questions: [{ id: QUESTION_1, attempt_id: ATTEMPT, skill_codes_snapshot: [] }] });
  const observed = [];
  const restore = replace(mocks(data, observed));
  try {
    const result = response();
    await handler(request(), result);
    assert.deepEqual(result.body.queue, []);
    assert.equal(observed.some((query) => query.startsWith("learning_question_skills?")), false);
  } finally { restore(); }
});

test("parent request enforces selected child family scope on every scoped root query", async () => {
  const observed = [];
  const restore = replace(mocks(fixture(), observed));
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 200);
    for (const query of observed.filter((value) => /learning_(assignments|attempts|mistake_review_sessions)\?/.test(value))) {
      assert.match(query, new RegExp(`family_id=eq\\.${FAMILY}`));
      assert.match(query, new RegExp(`assigned_member_id=eq\\.${CHILD}`));
    }
    assert.doesNotMatch(JSON.stringify(result.body), new RegExp(FAMILY));
  } finally { restore(); }
});

test("other-family child is hidden before learning evidence access", async () => {
  const observed = [];
  const base = mocks(fixture(), observed);
  base.supabaseFetch = async (query) => {
    observed.push(query);
    if (query.startsWith("family_members?")) return [{ id: CHILD, family_id: OTHER_FAMILY, role: "child", is_active: true }]
      .filter((row) => row.family_id === FAMILY);
    throw new Error("out-of-scope learning query");
  };
  const restore = replace(base);
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 404);
    assert.equal(result.body.code, "LEARNING_TARGET_NOT_FOUND");
    assert.equal(observed.some((query) => query.startsWith("learning_assignments?")), false);
  } finally { restore(); }
});

test("child reads only the self queue and cannot override the assignee", async () => {
  const observed = [];
  const restore = replace(mocks(fixture(), observed, "child"));
  try {
    const self = response();
    await handler(request("GET", null), self);
    assert.equal(self.statusCode, 200);
    assert.equal(self.body.assignedMemberId, CHILD);
    assert.equal(self.body.viewerRole, "child");
    const override = response();
    await handler(request("GET", PARENT), override);
    assert.equal(override.statusCode, 403);
    assert.equal(override.body.code, "CHILD_ASSIGNEE_OVERRIDE_NOT_ALLOWED");
  } finally { restore(); }
});

test("invalid member input is rejected before authentication data access", async () => {
  let queried = false;
  const restore = replace({
    authenticate: () => ({ sub: PARENT, family: FAMILY, role: "parent" }),
    memberInFamily: async () => ({ id: PARENT, family_id: FAMILY, role: "parent", is_active: true }),
    supabaseFetch: async () => { queried = true; return []; },
  });
  try {
    const result = response();
    await handler(request("GET", "invalid"), result);
    assert.equal(result.statusCode, 400);
    assert.equal(result.body.code, "INVALID_ASSIGNED_MEMBER");
    assert.equal(queried, false);
  } finally { restore(); }
});

test("unauthorized request is blocked before database access", async () => {
  let queried = false;
  const restore = replace({
    authenticate: () => { throw utils.err("로그인이 필요합니다.", 401, "AUTH_REQUIRED"); },
    supabaseFetch: async () => { queried = true; return []; },
  });
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 401);
    assert.equal(result.body.code, "AUTH_REQUIRED");
    assert.equal(queried, false);
  } finally { restore(); }
});

test("review queue is GET only and cannot mutate official or review state", async () => {
  const result = response();
  await handler(request("POST"), result);
  assert.equal(result.statusCode, 405);
  assert.equal(result.headers.Allow, "GET");
  const source = fs.readFileSync(path.join(__dirname, "../server/api/learning/_review-queue.js"), "utf8");
  assert.doesNotMatch(source, /method:\s*"(?:POST|PUT|PATCH|DELETE)"|rpc\/|learning_stage_progress|learning_stage_first_passes|sticker_transactions/);
});

test("database failures are generalized without private evidence", async () => {
  const base = mocks();
  base.supabaseFetch = async (query) => {
    if (query.startsWith("family_members?")) return [{ id: CHILD, family_id: FAMILY, role: "child", is_active: true }];
    const error = new Error("postgres://service_role:secret@private-family/review");
    error.supabaseCode = "XX999";
    throw error;
  };
  const restore = replace(base);
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 500);
    assert.equal(result.body.code, "LEARNING_REVIEW_QUEUE_FAILED");
    assert.doesNotMatch(JSON.stringify(result.body), /postgres|service_role|secret|family_id|correct|explanation|question/i);
  } finally { restore(); }
});
