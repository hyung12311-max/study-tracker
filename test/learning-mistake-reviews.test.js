const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const startHandler = require("../server/api/learning/assignments/[assignmentId]/mistake-reviews");
const itemHandler = require("../server/api/learning/mistake-reviews/[reviewId]");

const FAMILY = "10000000-0000-4000-8000-000000000001";
const PARENT = "20000000-0000-4000-8000-000000000001";
const CHILD = "20000000-0000-4000-8000-000000000002";
const ASSIGNMENT = "30000000-0000-4000-8000-000000000001";
const VERSION = "40000000-0000-4000-8000-000000000001";
const STAGE = "50000000-0000-4000-8000-000000000001";
const ATTEMPT = "60000000-0000-4000-8000-000000000001";
const QUESTION = "70000000-0000-4000-8000-000000000001";
const ANSWER = "80000000-0000-4000-8000-000000000001";
const WRONG_OPTION = "90000000-0000-4000-8000-000000000001";
const CORRECT_OPTION = "90000000-0000-4000-8000-000000000002";
const REVIEW = "a0000000-0000-4000-8000-000000000001";
const ITEM = "b0000000-0000-4000-8000-000000000001";
const REQUEST = "c0000000-0000-4000-8000-000000000001";

function response() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

function request({ method = "POST", role = "parent", body = {}, reviewId = REVIEW } = {}) {
  const host = "study.test";
  return {
    method,
    url: method === "GET"
      ? `/api/learning/mistake-reviews/${reviewId}`
      : `/api/learning/assignments/${ASSIGNMENT}/mistake-reviews`,
    query: method === "GET" ? { reviewId } : { assignmentId: ASSIGNMENT },
    headers: {
      "content-type": "application/json",
      "x-study-csrf": "1",
      origin: `https://${host}`,
      host,
    },
    testBody: {
      ...(role === "parent" ? { assignedMemberId: CHILD } : {}),
      status: "unreviewed",
      stageId: STAGE,
      skillCode: "place-value",
      requestId: REQUEST,
      ...body,
    },
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

function rows(overrides = {}) {
  return {
    sessions: [{
      id: REVIEW,
      assigned_member_id: CHILD,
      assignment_id: ASSIGNMENT,
      content_version_id: VERSION,
      status: "in_progress",
      filter_status: "unreviewed",
      filter_stage_id: STAGE,
      filter_skill_code: "place-value",
      started_at: "2026-08-08T01:00:00Z",
      completed_at: null,
      abandoned_at: null,
    }],
    items: [{
      id: ITEM,
      source_attempt_id: ATTEMPT,
      source_attempt_question_id: QUESTION,
      source_answer_id: ANSWER,
      display_order: 1,
    }],
    attempts: [{ id: ATTEMPT, stage_id: STAGE, attempt_no: 2, finalized_at: "2026-08-08T00:30:00Z" }],
    questions: [{
      id: QUESTION,
      attempt_id: ATTEMPT,
      prompt_snapshot: "537에서 3이 나타내는 값은?",
      options_snapshot: [
        { id: WRONG_OPTION, displayOrder: 1, text: "3" },
        { id: CORRECT_OPTION, displayOrder: 2, text: "30" },
      ],
      skill_codes_snapshot: ["place-value"],
    }],
    officialAnswers: [{
      id: ANSWER,
      attempt_id: ATTEMPT,
      attempt_question_id: QUESTION,
      selected_option_id: WRONG_OPTION,
      submitted_at: "2026-08-08T00:29:00Z",
    }],
    reviewAnswers: [],
    stages: [{ id: STAGE, display_order: 1, display_title: "기초" }],
    definitions: [{ skill_code: "place-value", display_name: "자릿값 이해" }],
    ...overrides,
  };
}

function mocks(data = rows(), observed = [], role = "parent") {
  return {
    readJson: async (req) => req.testBody,
    authenticate: (_request, requestedRole) => {
      assert.equal(requestedRole, undefined);
      return { sub: role === "parent" ? PARENT : CHILD, family: FAMILY, role };
    },
    memberInFamily: async () => ({
      id: role === "parent" ? PARENT : CHILD,
      family_id: FAMILY,
      role,
      is_active: true,
    }),
    supabaseFetch: async (query, options) => {
      observed.push({ query, options });
      if (query.startsWith("family_members?")) {
        return [{ id: CHILD, family_id: FAMILY, role: "child", is_active: true }];
      }
      if (query === "rpc/start_learning_mistake_review") {
        return [{ review_session_id: REVIEW, review_status: "in_progress", item_count: data.items.length }];
      }
      if (query.startsWith("learning_mistake_review_sessions?")) return data.sessions;
      if (query.startsWith("learning_assignments?")) return data.sessions.length ? [{ id: ASSIGNMENT }] : [];
      if (query.startsWith("learning_mistake_review_items?")) return data.items;
      if (query.startsWith("learning_attempts?")) return data.attempts;
      if (query.startsWith("learning_attempt_questions?")) return data.questions;
      if (query.startsWith("learning_attempt_answers?")) return data.officialAnswers;
      if (query.startsWith("learning_mistake_review_answers?")) return data.reviewAnswers;
      if (query.startsWith("learning_stages?")) return data.stages;
      if (query.startsWith("learning_skill_definitions?")) return data.definitions;
      throw new Error(`Unexpected query: ${query}`);
    },
  };
}

test("router exposes review start and scoped review item routes", () => {
  const router = fs.readFileSync(path.join(__dirname, "../api/[...path].js"), "utf8");
  assert.match(router, /const reviewStartMatch = key\.match/);
  assert.match(router, /handler = learningMistakeReviewStart/);
  assert.match(router, /const reviewMatch = key\.match/);
  assert.match(router, /handler = learningMistakeReview/);
});

test("parent starts a scoped review and receives snapshot-safe items", async () => {
  const observed = [];
  const restore = replace(mocks(rows(), observed));
  try {
    const result = response();
    await startHandler(request(), result);
    assert.equal(result.statusCode, 201);
    assert.equal(result.body.review.id, REVIEW);
    assert.equal(result.body.review.items.length, 1);
    assert.equal(result.body.review.items[0].selectedAnswer.text, "3");
    assert.deepEqual(result.body.review.items[0].skills, [{ code: "place-value", name: "자릿값 이해" }]);
    assert.doesNotMatch(JSON.stringify(result.body), /correctOption|correct_option|explanation|family_id|source_attempt/i);
    const rpc = observed.find(({ query }) => query === "rpc/start_learning_mistake_review");
    const payload = JSON.parse(rpc.options.body);
    assert.equal(payload.p_family_id, FAMILY);
    assert.equal(payload.p_actor_member_id, PARENT);
    assert.equal(payload.p_assigned_member_id, CHILD);
    assert.equal(payload.p_status_filter, "unreviewed");
    assert.equal(payload.p_stage_id, STAGE);
    assert.equal(payload.p_skill_code, "place-value");
  } finally { restore(); }
});

test("child starts only a self-scoped review", async () => {
  const observed = [];
  const restore = replace(mocks(rows(), observed, "child"));
  try {
    const result = response();
    await startHandler(request({ role: "child" }), result);
    assert.equal(result.statusCode, 201);
    const payload = JSON.parse(observed.find(({ query }) => query === "rpc/start_learning_mistake_review").options.body);
    assert.equal(payload.p_actor_member_id, CHILD);
    assert.equal(payload.p_assigned_member_id, CHILD);
    assert.equal(observed.some(({ query }) => query.startsWith("family_members?")), false);
  } finally { restore(); }
});

test("child assignee override is rejected before review mutation", async () => {
  const observed = [];
  const restore = replace(mocks(rows(), observed, "child"));
  try {
    const result = response();
    await startHandler(request({ role: "child", body: { assignedMemberId: PARENT } }), result);
    assert.equal(result.statusCode, 403);
    assert.equal(result.body.code, "CHILD_ASSIGNEE_OVERRIDE_NOT_ALLOWED");
    assert.equal(observed.some(({ query }) => query === "rpc/start_learning_mistake_review"), false);
  } finally { restore(); }
});

test("invalid filters are rejected before authentication or database access", async () => {
  let authenticated = false;
  let queried = false;
  const restore = replace({
    readJson: async (req) => req.testBody,
    authenticate: () => { authenticated = true; return {}; },
    supabaseFetch: async () => { queried = true; return []; },
  });
  try {
    const result = response();
    await startHandler(request({ body: { status: "hidden" } }), result);
    assert.equal(result.statusCode, 400);
    assert.equal(result.body.code, "INVALID_REVIEW_STATUS");
    assert.equal(authenticated, false);
    assert.equal(queried, false);
  } finally { restore(); }
});

test("empty eligible mistakes return a stable not-found response", async () => {
  const base = mocks();
  base.supabaseFetch = async (query, options) => {
    if (query.startsWith("family_members?")) return [{ id: CHILD, family_id: FAMILY, role: "child", is_active: true }];
    if (query === "rpc/start_learning_mistake_review") {
      const error = new Error("internal candidate query");
      error.supabaseCode = "P0002";
      throw error;
    }
    return mocks().supabaseFetch(query, options);
  };
  const restore = replace(base);
  try {
    const result = response();
    await startHandler(request(), result);
    assert.equal(result.statusCode, 404);
    assert.equal(result.body.code, "REVIEWABLE_MISTAKES_NOT_FOUND");
    assert.doesNotMatch(JSON.stringify(result.body), /candidate query|sql|family_id/i);
  } finally { restore(); }
});

test("unauthorized callers are rejected before review database access", async () => {
  let queried = false;
  const restore = replace({
    readJson: async (req) => req.testBody,
    authenticate: () => { throw utils.err("로그인이 필요합니다.", 401, "AUTH_REQUIRED"); },
    supabaseFetch: async () => { queried = true; return []; },
  });
  try {
    const result = response();
    await startHandler(request(), result);
    assert.equal(result.statusCode, 401);
    assert.equal(result.body.code, "AUTH_REQUIRED");
    assert.equal(queried, false);
  } finally { restore(); }
});

test("review GET supports an empty item state", async () => {
  const restore = replace(mocks(rows({ items: [] })));
  try {
    const result = response();
    await itemHandler(request({ method: "GET" }), result);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.review.items, []);
  } finally { restore(); }
});

test("other-family and other-child reviews are hidden with the same 404", async () => {
  const observed = [];
  const restore = replace(mocks(rows({ sessions: [] }), observed, "child"));
  try {
    const result = response();
    await itemHandler(request({ method: "GET", role: "child" }), result);
    assert.equal(result.statusCode, 404);
    assert.equal(result.body.code, "MISTAKE_REVIEW_NOT_FOUND");
    const query = observed.find(({ query: value }) => value.startsWith("learning_mistake_review_sessions?")).query;
    assert.match(query, new RegExp(`family_id=eq\\.${FAMILY}`));
    assert.match(query, new RegExp(`assigned_member_id=eq\\.${CHILD}`));
    assert.equal(observed.some(({ query: value }) => value.startsWith("learning_mistake_review_items?")), false);
  } finally { restore(); }
});

test("database failures are generalized without internal details", async () => {
  const base = mocks();
  base.supabaseFetch = async (query) => {
    if (query.startsWith("family_members?")) return [{ id: CHILD, family_id: FAMILY, role: "child", is_active: true }];
    const error = new Error("postgres://secret-host/family-row");
    error.supabaseCode = "XX999";
    throw error;
  };
  const restore = replace(base);
  try {
    const result = response();
    await startHandler(request(), result);
    assert.equal(result.statusCode, 500);
    assert.equal(result.body.code, "MISTAKE_REVIEW_FAILED");
    assert.doesNotMatch(JSON.stringify(result.body), /secret-host|postgres|family-row|service_role/i);
  } finally { restore(); }
});

test("review routes enforce POST start and GET item methods", async () => {
  const startResult = response();
  await startHandler(request({ method: "GET" }), startResult);
  assert.equal(startResult.statusCode, 405);
  assert.equal(startResult.headers.Allow, "POST");

  const itemResult = response();
  await itemHandler(request({ method: "POST" }), itemResult);
  assert.equal(itemResult.statusCode, 405);
  assert.equal(itemResult.headers.Allow, "GET");
});
