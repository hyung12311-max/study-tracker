const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const analysis = require("../server/api/learning/_analysis");
const skillsHandler = require("../server/api/learning/skills");
const answerHandler = require("../server/api/learning/mistake-reviews/[reviewId]/items/[itemId]/answers");

const FAMILY = "10000000-0000-4000-8000-000000000001";
const OTHER_FAMILY = "10000000-0000-4000-8000-000000000002";
const PARENT = "20000000-0000-4000-8000-000000000001";
const CHILD = "20000000-0000-4000-8000-000000000002";
const ASSIGNMENT = "30000000-0000-4000-8000-000000000001";
const VERSION = "40000000-0000-4000-8000-000000000001";
const STAGE = "50000000-0000-4000-8000-000000000001";
const ATTEMPT_1 = "60000000-0000-4000-8000-000000000001";
const ATTEMPT_2 = "60000000-0000-4000-8000-000000000002";
const REVIEW = "70000000-0000-4000-8000-000000000001";
const ITEM = "80000000-0000-4000-8000-000000000001";
const OPTION = "90000000-0000-4000-8000-000000000001";
const REQUEST = "a0000000-0000-4000-8000-000000000001";

function response() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

function answerRequest(body = { optionId: OPTION, requestId: REQUEST }) {
  return {
    method: "POST",
    url: `/api/learning/mistake-reviews/${REVIEW}/items/${ITEM}/answers`,
    query: { reviewId: REVIEW, itemId: ITEM },
    headers: {
      host: "study.test",
      origin: "https://study.test",
      "content-type": "application/json",
      "x-study-csrf": "1",
    },
    testBody: body,
  };
}

function skillsRequest(memberId = CHILD) {
  return {
    method: "GET",
    url: `/api/learning/skills?assignedMemberId=${memberId}`,
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

function officialState() {
  const attempts = [
    { id: ATTEMPT_1, assignment_id: ASSIGNMENT, content_version_id: VERSION, stage_id: STAGE, attempt_no: 1, status: "failed", total_questions: 3, correct_answers: 1, started_at: "2026-08-01T00:00:00Z", finalized_at: "2026-08-01T00:10:00Z" },
    { id: ATTEMPT_2, assignment_id: ASSIGNMENT, content_version_id: VERSION, stage_id: STAGE, attempt_no: 2, status: "passed", total_questions: 3, correct_answers: 2, started_at: "2026-08-02T00:00:00Z", finalized_at: "2026-08-02T00:10:00Z" },
  ];
  const questionRows = [
    { id: "q11", attempt_id: ATTEMPT_1, skill_codes_snapshot: ["place-value"] },
    { id: "q12", attempt_id: ATTEMPT_1, skill_codes_snapshot: ["place-value"] },
    { id: "q13", attempt_id: ATTEMPT_1, skill_codes_snapshot: ["place-value"] },
    { id: "q21", attempt_id: ATTEMPT_2, skill_codes_snapshot: ["place-value"] },
    { id: "q22", attempt_id: ATTEMPT_2, skill_codes_snapshot: ["place-value"] },
    { id: "q23", attempt_id: ATTEMPT_2, skill_codes_snapshot: ["place-value"] },
  ];
  const answerRows = [
    { attempt_id: ATTEMPT_1, attempt_question_id: "q11", is_correct: false },
    { attempt_id: ATTEMPT_1, attempt_question_id: "q12", is_correct: false },
    { attempt_id: ATTEMPT_1, attempt_question_id: "q13", is_correct: true },
    { attempt_id: ATTEMPT_2, attempt_question_id: "q21", is_correct: false },
    { attempt_id: ATTEMPT_2, attempt_question_id: "q22", is_correct: true },
    { attempt_id: ATTEMPT_2, attempt_question_id: "q23", is_correct: true },
  ];
  return {
    attempts,
    questionRows,
    answerRows,
    firstPasses: new Set([ATTEMPT_2]),
    skillNameByCode: new Map([["place-value", "자릿값 이해"]]),
  };
}

function authenticated(overrides = {}) {
  return {
    readJson: async (request) => request.testBody,
    authenticate: () => ({ sub: CHILD, family: FAMILY, role: "child" }),
    memberInFamily: async () => ({ id: CHILD, family_id: FAMILY, role: "child", is_active: true }),
    ...overrides,
  };
}

test("Phase F contract connects planning, official analysis, and isolated review boundaries", () => {
  const root = path.join(__dirname, "..");
  const router = fs.readFileSync(path.join(root, "api/[...path].js"), "utf8");
  const plan = fs.readFileSync(path.join(root, "server/api/learning/plans.js"), "utf8");
  const analysisSource = fs.readFileSync(path.join(root, "server/api/learning/_analysis.js"), "utf8");
  const review = fs.readFileSync(path.join(root, "server/api/learning/_mistake-reviews.js"), "utf8");
  const lifecycle = fs.readFileSync(path.join(root, "supabase/migrations/202608080003_learning_mistake_review_lifecycle.sql"), "utf8");

  assert.match(router, /learning\/plans/);
  assert.match(router, /learning\/skills/);
  assert.match(router, /reviewAnswerMatch/);
  assert.match(plan, /learning_stage_first_passes/);
  assert.match(analysisSource, /skill_codes_snapshot/);
  assert.match(review, /learning_mistake_review_answers/);
  assert.doesNotMatch(lifecycle, /update\s+public\.learning_attempts|learning_stage_progress|learning_stage_first_passes|sticker_transactions/i);
});

test("review answer completion leaves official score, progress, reward, and weak-skill evidence unchanged", async () => {
  const official = officialState();
  const beforeRows = structuredClone({
    attempts: official.attempts,
    questionRows: official.questionRows,
    answerRows: official.answerRows,
  });
  const beforeSkills = analysis.skillSummaries(official);
  const observed = [];
  const restore = replace(authenticated({
    supabaseFetch: async (query, options) => {
      observed.push({ query, options });
      if (query !== "rpc/submit_learning_mistake_review_answer") throw new Error("unexpected query");
      return [{
        review_answer_id: "b0000000-0000-4000-8000-000000000001",
        selected_answer: "30",
        correct_answer: "30",
        explanation: "3십은 30입니다.",
        is_correct: true,
        answered_count: 1,
        total_items: 1,
        session_status: "completed",
        submitted_at: "2026-08-08T03:00:00Z",
        completed_at: "2026-08-08T03:00:00Z",
      }];
    },
  }));
  try {
    const result = response();
    await answerHandler(answerRequest(), result);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.review.status, "completed");
    assert.equal(result.body.feedback.isCorrect, true);
    assert.equal(observed.length, 1);
    assert.deepEqual({ attempts: official.attempts, questionRows: official.questionRows, answerRows: official.answerRows }, beforeRows);
    assert.deepEqual(analysis.skillSummaries(official), beforeSkills);
    assert.equal(beforeSkills[0].weak, true);
  } finally { restore(); }
});

test("empty official learning state remains a stable empty analysis state", async () => {
  const observed = [];
  const restore = replace({
    authenticate: (_request, role) => {
      assert.equal(role, "parent");
      return { sub: PARENT, family: FAMILY, role: "parent" };
    },
    memberInFamily: async (id) => ({ id, family_id: FAMILY, role: id === PARENT ? "parent" : "child", is_active: true }),
    supabaseFetch: async (query) => {
      observed.push(query);
      if (query.startsWith("family_members?")) return [{ id: CHILD, family_id: FAMILY, role: "child", is_active: true }];
      if (query.startsWith("learning_assignments?")) return [];
      throw new Error("empty state queried beyond assignments");
    },
  });
  try {
    const result = response();
    await skillsHandler(skillsRequest(), result);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.skills, []);
    assert.equal(observed.some((query) => query.startsWith("learning_attempts?")), false);
  } finally { restore(); }
});

test("invalid review input is rejected before authentication and mutation", async () => {
  let authenticatedCalled = false;
  let mutated = false;
  const restore = replace({
    readJson: async (request) => request.testBody,
    authenticate: () => { authenticatedCalled = true; return {}; },
    supabaseFetch: async () => { mutated = true; return []; },
  });
  try {
    const result = response();
    await answerHandler(answerRequest({ optionId: "invalid", requestId: REQUEST }), result);
    assert.equal(result.statusCode, 400);
    assert.equal(result.body.code, "INVALID_OPTION_ID");
    assert.equal(authenticatedCalled, false);
    assert.equal(mutated, false);
  } finally { restore(); }
});

test("unauthorized analysis is blocked before any family data query", async () => {
  let queried = false;
  const restore = replace({
    authenticate: () => { throw utils.err("Authentication required", 401, "AUTH_REQUIRED"); },
    supabaseFetch: async () => { queried = true; return []; },
  });
  try {
    const result = response();
    await skillsHandler(skillsRequest(), result);
    assert.equal(result.statusCode, 401);
    assert.equal(result.body.code, "AUTH_REQUIRED");
    assert.equal(queried, false);
  } finally { restore(); }
});

test("other-family child scope is hidden before official learning queries", async () => {
  const observed = [];
  const restore = replace({
    authenticate: (_request, role) => {
      assert.equal(role, "parent");
      return { sub: PARENT, family: FAMILY, role: "parent" };
    },
    memberInFamily: async (id) => ({ id, family_id: FAMILY, role: "parent", is_active: true }),
    supabaseFetch: async (query) => {
      observed.push(query);
      if (query.startsWith("family_members?")) return [{ id: CHILD, family_id: OTHER_FAMILY, role: "child", is_active: true }].filter((row) => row.family_id === FAMILY);
      throw new Error("out-of-scope data query");
    },
  });
  try {
    const result = response();
    await skillsHandler(skillsRequest(), result);
    assert.equal(result.statusCode, 404);
    assert.equal(result.body.code, "LEARNING_TARGET_NOT_FOUND");
    assert.equal(observed.some((query) => query.startsWith("learning_assignments?")), false);
  } finally { restore(); }
});

test("terminal review state conflicts use a stable response without database details", async () => {
  const restore = replace(authenticated({
    supabaseFetch: async () => {
      const error = new Error("private database session detail");
      error.supabaseCode = "55000";
      error.supabaseMessage = "REVIEW_SESSION_COMPLETED";
      throw error;
    },
  }));
  try {
    const result = response();
    await answerHandler(answerRequest(), result);
    assert.equal(result.statusCode, 409);
    assert.equal(result.body.code, "REVIEW_SESSION_COMPLETED");
    assert.doesNotMatch(JSON.stringify(result.body), /database|session detail|55000/i);
  } finally { restore(); }
});

test("unexpected integrated-flow failures are generalized without credentials or scope details", async () => {
  const restore = replace(authenticated({
    supabaseFetch: async () => {
      const error = new Error("postgres://service_role:secret@private-family/learning");
      error.supabaseCode = "XX000";
      throw error;
    },
  }));
  try {
    const result = response();
    await answerHandler(answerRequest(), result);
    assert.equal(result.statusCode, 500);
    assert.equal(result.body.code, "MISTAKE_REVIEW_FAILED");
    assert.doesNotMatch(JSON.stringify(result.body), /postgres|service_role|secret|private-family/i);
  } finally { restore(); }
});
