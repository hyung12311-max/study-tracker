const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const handler = require("../server/api/learning/assignments/[assignmentId]/mistakes");

const FAMILY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PARENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ASSIGNMENT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const VERSION = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const STAGE = "11111111-1111-4111-8111-111111111111";
const ATTEMPT = "22222222-2222-4222-8222-222222222222";
const QUESTION = "33333333-3333-4333-8333-333333333333";
const WRONG_OPTION = "44444444-4444-4444-8444-444444444444";
const CORRECT_OPTION = "55555555-5555-4555-8555-555555555555";

function response() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

function request({ method = "GET", role = "parent", query = "" } = {}) {
  const assigned = role === "parent" ? `assignedMemberId=${CHILD}` : "";
  const suffix = [assigned, query].filter(Boolean).join("&");
  return {
    method,
    url: `/api/learning/assignments/${ASSIGNMENT}/mistakes${suffix ? `?${suffix}` : ""}`,
    query: { assignmentId: ASSIGNMENT },
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

function data(overrides = {}) {
  return {
    assignments: [{ id: ASSIGNMENT, unit_id: "unit-1", content_version_id: VERSION, status: "completed" }],
    attempts: [{ id: ATTEMPT, stage_id: STAGE, attempt_no: 1, status: "failed", finalized_at: "2026-08-01T00:05:00Z" }],
    answers: [{ attempt_id: ATTEMPT, attempt_question_id: QUESTION, selected_option_id: WRONG_OPTION, submitted_at: "2026-08-01T00:04:00Z" }],
    questions: [{
      id: QUESTION,
      attempt_id: ATTEMPT,
      display_order: 2,
      prompt_snapshot: "537에서 3이 나타내는 값은?",
      explanation_snapshot: "3은 십의 자리이므로 30입니다.",
      correct_option_id: CORRECT_OPTION,
      options_snapshot: [
        { id: WRONG_OPTION, displayOrder: 1, text: "3" },
        { id: CORRECT_OPTION, displayOrder: 2, text: "30" },
      ],
      skill_codes_snapshot: ["place-value"],
    }],
    stages: [{ id: STAGE, display_order: 1, display_title: "기초" }],
    definitions: [{ skill_code: "place-value", display_name: "자릿값 이해" }],
    revealEvents: [],
    ...overrides,
  };
}

function mocks(rows = data(), observed = [], role = "parent") {
  return {
    authenticate: (_request, requestedRole) => {
      if (role === "child") assert.equal(requestedRole, undefined);
      if (role === "parent") assert.ok(requestedRole === undefined || requestedRole === "parent");
      return { sub: role === "parent" ? PARENT : CHILD, family: FAMILY, role };
    },
    memberInFamily: async () => ({
      id: role === "parent" ? PARENT : CHILD,
      family_id: FAMILY,
      role,
      is_active: true,
    }),
    supabaseFetch: async (query) => {
      observed.push(query);
      if (query.startsWith("family_members?")) return [{ id: CHILD, family_id: FAMILY, role: "child", is_active: true }];
      if (query.startsWith("learning_assignments?")) return rows.assignments;
      if (query.startsWith("learning_attempts?")) return rows.attempts;
      if (query.startsWith("learning_attempt_answers?")) return rows.answers;
      if (query.startsWith("learning_attempt_questions?")) return rows.questions;
      if (query.startsWith("learning_stages?")) return rows.stages;
      if (query.startsWith("learning_skill_definitions?")) return rows.definitions;
      if (query.startsWith("learning_mistake_reveal_events?")) return rows.revealEvents;
      throw new Error(`Unexpected query: ${query}`);
    },
  };
}

test("router exposes the scoped assignment mistakes route", () => {
  const router = fs.readFileSync(path.join(__dirname, "../api/[...path].js"), "utf8");
  assert.match(router, /const mistakesMatch = key\.match/);
  assert.match(router, /handler = learningAssignmentMistakes/);
});

test("parent reads snapshot-based incorrect answers without solution leakage", async () => {
  const observed = [];
  const restore = replace(mocks(data(), observed));
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.viewerRole, "parent");
    assert.equal(result.body.mistakes.length, 1);
    assert.deepEqual(result.body.mistakes[0].options, [
      { order: 1, text: "3", selected: true },
      { order: 2, text: "30", selected: false },
    ]);
    assert.deepEqual(result.body.mistakes[0].selectedAnswer, { text: "3" });
    assert.deepEqual(result.body.mistakes[0].skills, [{ code: "place-value", name: "자릿값 이해" }]);
    assert.equal(result.body.mistakes[0].status, "unreviewed");
    assert.doesNotMatch(JSON.stringify(result.body), /십의 자리이므로|correctOption|correct_option|explanation/i);
    const questionQuery = observed.find((value) => value.startsWith("learning_attempt_questions?"));
    assert.doesNotMatch(questionQuery, /explanation_snapshot|correct_option_id/);
  } finally { restore(); }
});

test("only submitted incorrect answers from terminal attempts are requested", async () => {
  const observed = [];
  const restore = replace(mocks(data(), observed));
  try {
    await handler(request(), response());
    const attemptQuery = observed.find((value) => value.startsWith("learning_attempts?"));
    const answerQuery = observed.find((value) => value.startsWith("learning_attempt_answers?"));
    assert.match(attemptQuery, /status=in\.\(passed,failed\)/);
    assert.match(answerQuery, /is_correct=eq\.false/);
  } finally { restore(); }
});

test("assignment content version is fixed on every attempt and stage read", async () => {
  const observed = [];
  const restore = replace(mocks(data(), observed));
  try {
    await handler(request(), response());
    assert.match(observed.find((value) => value.startsWith("learning_attempts?")), new RegExp(`content_version_id=eq\\.${VERSION}`));
    assert.match(observed.find((value) => value.startsWith("learning_stages?")), new RegExp(`content_version_id=eq\\.${VERSION}`));
  } finally { restore(); }
});

test("stage and immutable skill snapshot filters are applied", async () => {
  const observed = [];
  const restore = replace(mocks(data(), observed));
  try {
    const result = response();
    await handler(request({ query: `stageId=${STAGE}&skillCode=other-skill` }), result);
    assert.deepEqual(result.body.mistakes, []);
    assert.match(observed.find((value) => value.startsWith("learning_attempts?")), new RegExp(`stage_id=eq\\.${STAGE}`));
    assert.equal(observed.some((value) => value.startsWith("learning_question_skills?")), false);
  } finally { restore(); }
});

test("persisted reveal events produce reviewed state without solution fields", async () => {
  const restore = replace(mocks(data({ revealEvents: [{ attempt_question_id: QUESTION }] })));
  try {
    const result = response();
    await handler(request({ query: "status=reviewed" }), result);
    assert.equal(result.body.mistakes[0].status, "reviewed");
    assert.doesNotMatch(JSON.stringify(result.body), /correctAnswer|explanation/);
  } finally { restore(); }
});

test("child can read only their own assignment without an assignee override", async () => {
  const observed = [];
  const restore = replace(mocks(data(), observed, "child"));
  try {
    const result = response();
    await handler(request({ role: "child" }), result);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.viewerRole, "child");
    assert.equal(result.body.assignedMemberId, CHILD);
    assert.equal(observed.some((value) => value.startsWith("family_members?")), false);
  } finally { restore(); }
});

test("child assignee override is rejected before assignment reads", async () => {
  const observed = [];
  const restore = replace(mocks(data(), observed, "child"));
  try {
    const result = response();
    await handler({ ...request({ role: "child" }), url: `/api/learning/assignments/${ASSIGNMENT}/mistakes?assignedMemberId=${PARENT}` }, result);
    assert.equal(result.statusCode, 403);
    assert.equal(result.body.code, "CHILD_ASSIGNEE_OVERRIDE_NOT_ALLOWED");
    assert.equal(observed.some((value) => value.startsWith("learning_assignments?")), false);
  } finally { restore(); }
});

test("other-family or missing assignments are hidden with the same 404", async () => {
  const observed = [];
  const restore = replace(mocks(data({ assignments: [] }), observed));
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 404);
    assert.equal(result.body.code, "ASSIGNMENT_NOT_FOUND");
    assert.equal(observed.some((value) => value.startsWith("learning_attempts?")), false);
  } finally { restore(); }
});

test("unauthorized callers are rejected before database access", async () => {
  let queried = false;
  const restore = replace({
    authenticate: () => { throw utils.err("로그인이 필요합니다.", 401, "AUTH_REQUIRED"); },
    supabaseFetch: async () => { queried = true; return []; },
  });
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 401);
    assert.equal(queried, false);
  } finally { restore(); }
});

test("mistakes endpoint is GET only", async () => {
  const result = response();
  await handler(request({ method: "POST" }), result);
  assert.equal(result.statusCode, 405);
  assert.equal(result.headers.Allow, "GET");
});

test("database failures are generalized without internal details", async () => {
  const base = mocks();
  base.supabaseFetch = async (query) => {
    if (query.startsWith("family_members?")) return [{ id: CHILD, family_id: FAMILY, role: "child", is_active: true }];
    const error = new Error("database host secret");
    error.supabaseCode = "XX999";
    throw error;
  };
  const restore = replace(base);
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 500);
    assert.equal(result.body.code, "LEARNING_MISTAKES_FAILED");
    assert.doesNotMatch(JSON.stringify(result.body), /database host secret|service_role|family_id|sql/i);
  } finally { restore(); }
});
