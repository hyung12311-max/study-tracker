const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const scoresHandler = require("../server/api/learning/scores");
const historyHandler = require("../server/api/learning/attempt-history");
const skillsHandler = require("../server/api/learning/skills");
const analysis = require("../server/api/learning/_analysis");

const FAMILY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PARENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ASSIGNMENT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const UNIT = "11111111-1111-4111-8111-111111111111";
const VERSION = "22222222-2222-4222-8222-222222222222";
const STAGE = "33333333-3333-4333-8333-333333333333";
const ATTEMPT_1 = "44444444-4444-4444-8444-444444444441";
const ATTEMPT_2 = "44444444-4444-4444-8444-444444444442";

function response() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

function request(route, method = "GET", memberId = CHILD) {
  return { method, url: `/api/learning/${route}?assignedMemberId=${memberId}`, headers: {} };
}

function replace(overrides) {
  const originals = {};
  for (const [key, value] of Object.entries(overrides)) {
    originals[key] = utils[key];
    utils[key] = value;
  }
  return () => Object.assign(utils, originals);
}

function rows(overrides = {}) {
  return {
    assignments: [{ id: ASSIGNMENT, unit_id: UNIT, content_version_id: VERSION, status: "completed" }],
    attempts: [
      { id: ATTEMPT_2, assignment_id: ASSIGNMENT, content_version_id: VERSION, stage_id: STAGE, attempt_no: 2, status: "passed", total_questions: 4, correct_answers: 3, started_at: "2026-08-02T00:00:00Z", finalized_at: "2026-08-02T00:05:00Z" },
      { id: ATTEMPT_1, assignment_id: ASSIGNMENT, content_version_id: VERSION, stage_id: STAGE, attempt_no: 1, status: "failed", total_questions: 4, correct_answers: 1, started_at: "2026-08-01T00:00:00Z", finalized_at: "2026-08-01T00:05:00Z" },
    ],
    questions: [
      { id: "q11", attempt_id: ATTEMPT_1, display_order: 1, skill_codes_snapshot: ["place-value"] },
      { id: "q12", attempt_id: ATTEMPT_1, display_order: 2, skill_codes_snapshot: ["place-value"] },
      { id: "q13", attempt_id: ATTEMPT_1, display_order: 3, skill_codes_snapshot: ["place-value"] },
      { id: "q14", attempt_id: ATTEMPT_1, display_order: 4, skill_codes_snapshot: [] },
      { id: "q21", attempt_id: ATTEMPT_2, display_order: 1, skill_codes_snapshot: ["place-value"] },
      { id: "q22", attempt_id: ATTEMPT_2, display_order: 2, skill_codes_snapshot: ["place-value"] },
      { id: "q23", attempt_id: ATTEMPT_2, display_order: 3, skill_codes_snapshot: ["place-value"] },
      { id: "q24", attempt_id: ATTEMPT_2, display_order: 4, skill_codes_snapshot: ["read-number"] },
    ],
    answers: [
      { attempt_id: ATTEMPT_1, attempt_question_id: "q11", is_correct: false },
      { attempt_id: ATTEMPT_1, attempt_question_id: "q12", is_correct: false },
      { attempt_id: ATTEMPT_1, attempt_question_id: "q13", is_correct: true },
      { attempt_id: ATTEMPT_1, attempt_question_id: "q14", is_correct: false },
      { attempt_id: ATTEMPT_2, attempt_question_id: "q21", is_correct: false },
      { attempt_id: ATTEMPT_2, attempt_question_id: "q22", is_correct: false },
      { attempt_id: ATTEMPT_2, attempt_question_id: "q23", is_correct: true },
      { attempt_id: ATTEMPT_2, attempt_question_id: "q24", is_correct: true },
    ],
    firstPasses: [{ attempt_id: ATTEMPT_2 }],
    units: [{ id: UNIT, unit_code: "grade2-three-digit-numbers", display_title: "세 자리 수를 알아봐요" }],
    versions: [{ id: VERSION, unit_id: UNIT, version_no: 1 }],
    definitions: [
      { skill_code: "place-value", display_name: "자릿값 이해" },
      { skill_code: "read-number", display_name: "수 읽기" },
    ],
    ...overrides,
  };
}

function parentMocks(data = rows(), observed = []) {
  return {
    authenticate: (_request) => {
      return { sub: PARENT, family: FAMILY, role: "parent" };
    },
    memberInFamily: async () => ({ id: PARENT, family_id: FAMILY, role: "parent", is_active: true }),
    supabaseFetch: async (query) => {
      observed.push(query);
      if (query.startsWith("family_members?")) return [{ id: CHILD, family_id: FAMILY, role: "child", is_active: true }];
      if (query.startsWith("learning_assignments?")) return data.assignments;
      if (query.startsWith("learning_attempts?")) return data.attempts;
      if (query.startsWith("learning_attempt_questions?")) return data.questions;
      if (query.startsWith("learning_attempt_answers?")) return data.answers;
      if (query.startsWith("learning_stage_first_passes?")) return data.firstPasses;
      if (query.startsWith("learning_units?")) return data.units;
      if (query.startsWith("learning_content_versions?")) return data.versions;
      if (query.startsWith("learning_skill_definitions?")) return data.definitions;
      throw new Error(`Unexpected query: ${query}`);
    },
  };
}

test("router exposes three explicit Phase C read-only routes", () => {
  const router = fs.readFileSync(path.join(__dirname, "../api/[...path].js"), "utf8");
  assert.match(router, /"learning\/scores": learningScores/);
  assert.match(router, /"learning\/attempt-history": learningAttemptHistory/);
  assert.match(router, /"learning\/skills": learningSkills/);
});

test("score model uses stored official counts for first latest and best", async () => {
  const restore = replace(parentMocks());
  try {
    const result = response();
    await scoresHandler(request("scores"), result);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.scores.length, 1);
    const score = result.body.scores[0];
    assert.equal(score.attemptCount, 2);
    assert.deepEqual([score.first.correct, score.latest.correct, score.best.correct], [1, 3, 3]);
    assert.equal(score.latest.accuracyPercent, 75);
    assert.equal(score.latest.firstPass, true);
    assert.deepEqual(score.latest.skillCodes, ["place-value", "read-number"]);
    assert.equal(score.changePercentagePoints, 50);
    assert.equal(score.unitTitle, "세 자리 수를 알아봐요");
  } finally { restore(); }
});

test("attempt history is newest first and exposes snapshot presence without raw answers", async () => {
  const restore = replace(parentMocks());
  try {
    const result = response();
    await historyHandler(request("attempt-history"), result);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.attemptHistory.map((item) => item.attemptId), [ATTEMPT_2, ATTEMPT_1]);
    assert.equal(result.body.attemptHistory[0].correct, 3);
    assert.equal(result.body.attemptHistory[0].incorrect, 1);
    assert.equal(result.body.attemptHistory[0].hasSkillSnapshot, true);
    assert.deepEqual(result.body.attemptHistory[0].skillCodes, ["place-value", "read-number"]);
    assert.doesNotMatch(JSON.stringify(result.body), /selected_option|correct_option|family_id|service_role/);
  } finally { restore(); }
});

test("skill aggregation uses immutable snapshots and the repository weak-skill policy", async () => {
  const restore = replace(parentMocks());
  try {
    const result = response();
    await skillsHandler(request("skills"), result);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.policy, analysis.WEAK_SKILL_POLICY);
    const placeValue = result.body.skills.find((skill) => skill.skillCode === "place-value");
    assert.deepEqual({
      name: placeValue.skillName,
      questions: placeValue.attemptedQuestions,
      attempts: placeValue.attemptCount,
      correct: placeValue.correct,
      incorrect: placeValue.incorrect,
      accuracy: placeValue.accuracyPercent,
      weak: placeValue.weak,
    }, { name: "자릿값 이해", questions: 6, attempts: 2, correct: 2, incorrect: 4, accuracy: 33.3, weak: true });
    assert.equal(placeValue.latest.incorrect, 2);
    assert.equal(result.body.skills.find((skill) => skill.skillCode === "read-number").weak, false);
  } finally { restore(); }
});

test("missing skill snapshots stay unclassified and are never backfilled from current mappings", async () => {
  const data = rows({
    questions: [
      { id: "q11", attempt_id: ATTEMPT_1, display_order: 1, skill_codes_snapshot: [] },
      { id: "q21", attempt_id: ATTEMPT_2, display_order: 1, skill_codes_snapshot: [] },
    ],
    definitions: [],
  });
  const restore = replace(parentMocks(data));
  try {
    const history = response();
    await historyHandler(request("attempt-history"), history);
    assert.ok(history.body.attemptHistory.every((item) => item.hasSkillSnapshot === false));
    const skills = response();
    await skillsHandler(request("skills"), skills);
    assert.deepEqual(skills.body.skills, []);
  } finally { restore(); }
});

test("empty assignments return stable empty score state without querying attempts", async () => {
  const observed = [];
  const restore = replace(parentMocks(rows({ assignments: [] }), observed));
  try {
    const result = response();
    await scoresHandler(request("scores"), result);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.scores, []);
    assert.equal(observed.some((query) => query.startsWith("learning_attempts?")), false);
  } finally { restore(); }
});

test("unauthenticated and non-parent callers are blocked before analysis queries", async () => {
  let queried = false;
  const restore = replace({
    authenticate: () => { throw utils.err("로그인이 필요합니다.", 401, "AUTH_REQUIRED"); },
    supabaseFetch: async () => { queried = true; return []; },
  });
  try {
    const result = response();
    await scoresHandler(request("scores"), result);
    assert.equal(result.statusCode, 401);
    assert.equal(result.body.code, "AUTH_REQUIRED");
    assert.equal(queried, false);
  } finally { restore(); }
});

test("invalid or other-family child scope is hidden before assignment access", async () => {
  const observed = [];
  const mocks = parentMocks(rows(), observed);
  mocks.supabaseFetch = async (query) => {
    observed.push(query);
    if (query.startsWith("family_members?")) return [];
    throw new Error("assignment access should not occur");
  };
  const restore = replace(mocks);
  try {
    const result = response();
    await historyHandler(request("attempt-history"), result);
    assert.equal(result.statusCode, 404);
    assert.equal(result.body.code, "FAMILY_CHILD_NOT_FOUND");
    assert.equal(observed.some((query) => query.startsWith("learning_assignments?")), false);
  } finally { restore(); }
});

test("every user-data query is derived from the authenticated family and child scope", async () => {
  const observed = [];
  const restore = replace(parentMocks(rows(), observed));
  try {
    const result = response();
    await skillsHandler(request("skills"), result);
    const assignmentQuery = observed.find((query) => query.startsWith("learning_assignments?"));
    const attemptQuery = observed.find((query) => query.startsWith("learning_attempts?"));
    const firstPassQuery = observed.find((query) => query.startsWith("learning_stage_first_passes?"));
    for (const query of [assignmentQuery, attemptQuery, firstPassQuery]) {
      assert.ok(query.includes(`family_id=eq.${FAMILY}`));
      assert.ok(query.includes(`assigned_member_id=eq.${CHILD}`));
    }
    assert.equal(result.body.assignedMemberId, CHILD);
    assert.doesNotMatch(JSON.stringify(result.body), new RegExp(FAMILY));
  } finally { restore(); }
});

test("analysis endpoints reject every non-GET method", async () => {
  for (const [handler, route] of [[scoresHandler, "scores"], [historyHandler, "attempt-history"], [skillsHandler, "skills"]]) {
    const result = response();
    await handler(request(route, "POST"), result);
    assert.equal(result.statusCode, 405);
    assert.equal(result.headers.Allow, "GET");
  }
});

test("unexpected database errors are sanitized", async () => {
  const mocks = parentMocks();
  mocks.supabaseFetch = async (query) => {
    if (query.startsWith("family_members?")) return [{ id: CHILD, family_id: FAMILY, role: "child", is_active: true }];
    const error = new Error("database detail with service key");
    error.supabaseCode = "XX000";
    throw error;
  };
  const restore = replace(mocks);
  try {
    const result = response();
    await scoresHandler(request("scores"), result);
    assert.equal(result.statusCode, 500);
    assert.equal(result.body.code, "LEARNING_ANALYSIS_FAILED");
    assert.doesNotMatch(JSON.stringify(result.body), /database detail|service key/);
  } finally { restore(); }
});
