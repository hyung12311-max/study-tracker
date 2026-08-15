const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const handler = require("../server/api/learning/recommendations");
const recommendation = require("../server/api/learning/_recommendations");

const FAMILY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PARENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ASSIGNMENT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const UNIT = "11111111-1111-4111-8111-111111111111";
const VERSION = "22222222-2222-4222-8222-222222222222";
const STAGE = "33333333-3333-4333-8333-333333333333";
const COURSE = "66666666-6666-4666-8666-666666666666";
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

function request(method = "GET", memberId = CHILD) {
  return { method, url: `/api/learning/recommendations?assignedMemberId=${memberId}`, headers: {} };
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
    attempts: [
      { id: ATTEMPT_2, assignment_id: ASSIGNMENT, content_version_id: VERSION, stage_id: STAGE, attempt_no: 2, status: "failed", total_questions: 3, correct_answers: 1, started_at: "2026-08-02T00:00:00Z", finalized_at: "2026-08-02T00:05:00Z" },
      { id: ATTEMPT_1, assignment_id: ASSIGNMENT, content_version_id: VERSION, stage_id: STAGE, attempt_no: 1, status: "failed", total_questions: 3, correct_answers: 1, started_at: "2026-08-01T00:00:00Z", finalized_at: "2026-08-01T00:05:00Z" },
    ],
    attemptQuestions: [
      { id: "aq11", attempt_id: ATTEMPT_1, display_order: 1, skill_codes_snapshot: ["place-value"] },
      { id: "aq12", attempt_id: ATTEMPT_1, display_order: 2, skill_codes_snapshot: ["place-value"] },
      { id: "aq13", attempt_id: ATTEMPT_1, display_order: 3, skill_codes_snapshot: ["place-value"] },
      { id: "aq21", attempt_id: ATTEMPT_2, display_order: 1, skill_codes_snapshot: ["place-value"] },
      { id: "aq22", attempt_id: ATTEMPT_2, display_order: 2, skill_codes_snapshot: ["place-value"] },
      { id: "aq23", attempt_id: ATTEMPT_2, display_order: 3, skill_codes_snapshot: ["place-value"] },
    ],
    answers: [
      { attempt_id: ATTEMPT_1, attempt_question_id: "aq11", is_correct: true },
      { attempt_id: ATTEMPT_1, attempt_question_id: "aq12", is_correct: false },
      { attempt_id: ATTEMPT_1, attempt_question_id: "aq13", is_correct: false },
      { attempt_id: ATTEMPT_2, attempt_question_id: "aq21", is_correct: true },
      { attempt_id: ATTEMPT_2, attempt_question_id: "aq22", is_correct: false },
      { attempt_id: ATTEMPT_2, attempt_question_id: "aq23", is_correct: false },
    ],
    definitions: [{ skill_code: "place-value", display_name: "자릿값 이해" }],
    mappings: [
      { question_id: "cq1", skill_code: "place-value", is_primary: true },
      { question_id: "cq2", skill_code: "place-value", is_primary: false },
    ],
    contentQuestions: [{ id: "cq1", stage_id: "cs1" }, { id: "cq2", stage_id: "cs1" }],
    contentStages: [{ id: "cs1", content_version_id: VERSION }],
    versions: [{ id: VERSION, unit_id: UNIT, version_no: 2, status: "published" }],
    units: [{ id: UNIT, course_id: COURSE, unit_code: "three-digit-numbers", display_title: "세 자리 수" }],
    courses: [{ id: COURSE, status: "published" }],
    ...overrides,
  };
}

function parentMocks(data = fixture(), observed = []) {
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
      if (query.startsWith("learning_attempt_questions?")) return data.attemptQuestions;
      if (query.startsWith("learning_attempt_answers?")) return data.answers;
      if (query.startsWith("learning_stage_first_passes?")) return [];
      if (query.startsWith("learning_skill_definitions?")) return data.definitions;
      if (query.startsWith("learning_question_skills?")) return data.mappings;
      if (query.startsWith("learning_questions?")) return data.contentQuestions;
      if (query.startsWith("learning_stages?")) return data.contentStages;
      if (query.startsWith("learning_content_versions?") && query.includes("status")) return data.versions;
      if (query.startsWith("learning_content_versions?")) return data.versions;
      if (query.startsWith("learning_units?") && query.includes("course_id")) return data.units;
      if (query.startsWith("learning_units?")) return data.units;
      if (query.startsWith("learning_courses?")) return data.courses;
      throw new Error(`Unexpected query: ${query}`);
    },
  };
}

test("router exposes the explicit Phase C recommendation route", () => {
  const router = fs.readFileSync(path.join(__dirname, "../api/[...path].js"), "utf8");
  assert.match(router, /"learning\/recommendations": learningRecommendations/);
});

test("weak skill recommendation returns an explainable published content candidate", async () => {
  const restore = replace(parentMocks());
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.state, "ready");
    assert.deepEqual(result.body.recommendations[0], {
      skillCode: "place-value", skillName: "자릿값 이해", accuracy: 33.3,
      attemptedQuestionCount: 6, correctCount: 2,
      reason: "최근 정답률이 낮아 복습이 필요합니다.",
      recommendedUnit: { code: "three-digit-numbers", title: "세 자리 수" },
      recommendedContentVersion: { versionNumber: 2 }, mappedQuestionCount: 2,
      previouslyCompleted: false, priority: 1,
    });
  } finally { restore(); }
});

test("multiple weak skills are prioritized by accuracy then attempted questions", () => {
  const common = {
    mappings: [
      { question_id: "q1", skill_code: "skill-a", is_primary: true },
      { question_id: "q1", skill_code: "skill-b", is_primary: false },
    ],
    questions: [{ id: "q1", stage_id: "s1" }], stages: [{ id: "s1", content_version_id: "v1" }],
    versions: [{ id: "v1", unit_id: "u1", version_no: 1, status: "published" }],
    units: [{ id: "u1", course_id: "c1", unit_code: "unit", display_title: "단원" }],
    courses: [{ id: "c1", status: "published" }], assignments: [],
  };
  const items = recommendation.buildRecommendations({
    ...common,
    skills: [
      { skillCode: "skill-a", skillName: "A", weak: true, accuracyPercent: 40, attemptedQuestions: 8, correct: 3, attemptCount: 2 },
      { skillCode: "skill-b", skillName: "B", weak: true, accuracyPercent: 20, attemptedQuestions: 3, correct: 1, attemptCount: 2 },
    ],
  });
  assert.deepEqual(items.map((item) => [item.skillCode, item.priority]), [["skill-b", 1], ["skill-a", 2]]);
});

test("completed identical content is ranked below an uncompleted mapped candidate", () => {
  const items = recommendation.buildRecommendations({
    skills: [{ skillCode: "skill", skillName: "개념", weak: true, accuracyPercent: 30, attemptedQuestions: 6, correct: 2, attemptCount: 2 }],
    mappings: [
      { question_id: "q1", skill_code: "skill", is_primary: true },
      { question_id: "q2", skill_code: "skill", is_primary: false },
    ],
    questions: [{ id: "q1", stage_id: "s1" }, { id: "q2", stage_id: "s2" }],
    stages: [{ id: "s1", content_version_id: "v1" }, { id: "s2", content_version_id: "v2" }],
    versions: [{ id: "v1", unit_id: "u1", version_no: 1, status: "published" }, { id: "v2", unit_id: "u2", version_no: 1, status: "published" }],
    units: [{ id: "u1", course_id: "c1", unit_code: "done", display_title: "완료 단원" }, { id: "u2", course_id: "c1", unit_code: "next", display_title: "복습 단원" }],
    courses: [{ id: "c1", status: "published" }],
    assignments: [{ content_version_id: "v1", status: "completed" }],
  });
  assert.equal(items[0].recommendedUnit.code, "next");
  assert.equal(items[0].previouslyCompleted, false);
});

test("no weak skill is a normal empty state and skips content mapping queries", async () => {
  const data = fixture({ answers: fixture().answers.map((answer) => ({ ...answer, is_correct: true })) });
  const observed = [];
  const restore = replace(parentMocks(data, observed));
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.body.state, "no_weak_skills");
    assert.deepEqual(result.body.recommendations, []);
    assert.equal(observed.some((query) => query.startsWith("learning_question_skills?")), false);
  } finally { restore(); }
});

test("insufficient history is a normal empty state", async () => {
  const restore = replace(parentMocks(fixture({ assignments: [] })));
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.body.state, "insufficient_history");
    assert.deepEqual(result.body.recommendations, []);
  } finally { restore(); }
});

test("weak skills without mappings return no mapped content", async () => {
  const restore = replace(parentMocks(fixture({ mappings: [] })));
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.body.state, "no_mapped_content");
  } finally { restore(); }
});

test("unpublished or retired content cannot become a recommendation", async () => {
  const restore = replace(parentMocks(fixture({ versions: [] })));
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.body.state, "no_mapped_content");
    assert.deepEqual(result.body.recommendations, []);
  } finally { restore(); }
});

test("invalid or other-family children are hidden before analysis access", async () => {
  const observed = [];
  const mocks = parentMocks(fixture(), observed);
  mocks.supabaseFetch = async (query) => {
    observed.push(query);
    if (query.startsWith("family_members?")) return [];
    throw new Error("scoped analysis must not run");
  };
  const restore = replace(mocks);
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 404);
    assert.equal(result.body.code, "FAMILY_CHILD_NOT_FOUND");
    assert.equal(observed.some((query) => query.startsWith("learning_assignments?")), false);
  } finally { restore(); }
});

test("unauthorized callers are blocked before database access", async () => {
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

test("recommendation endpoint is GET only", async () => {
  const result = response();
  await handler(request("POST"), result);
  assert.equal(result.statusCode, 405);
  assert.equal(result.headers.Allow, "GET");
});

test("all family data queries retain authenticated family and selected child scope", async () => {
  const observed = [];
  const restore = replace(parentMocks(fixture(), observed));
  try {
    await handler(request(), response());
    for (const query of observed.filter((value) => /learning_(assignments|attempts|stage_first_passes)\?/.test(value))) {
      assert.match(query, new RegExp(`family_id=eq\\.${FAMILY}`));
      assert.match(query, new RegExp(`assigned_member_id=eq\\.${CHILD}`));
    }
  } finally { restore(); }
});

test("database failures are generalized and output contains no raw or internal identifiers", async () => {
  const mocks = parentMocks();
  mocks.supabaseFetch = async (query) => {
    if (query.startsWith("family_members?")) return [{ id: CHILD, family_id: FAMILY, role: "child", is_active: true }];
    const error = new Error("database host secret");
    error.supabaseCode = "XX999";
    throw error;
  };
  const restore = replace(mocks);
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 500);
    assert.equal(result.body.code, "LEARNING_RECOMMENDATIONS_FAILED");
    assert.doesNotMatch(JSON.stringify(result.body), /database host secret|family_id|service_role|question_id|content_version_id|correct_option|selected_option/i);
  } finally { restore(); }
});
