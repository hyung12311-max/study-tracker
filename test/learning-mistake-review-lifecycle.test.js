const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const answerHandler = require("../server/api/learning/mistake-reviews/[reviewId]/items/[itemId]/answers");
const abandonHandler = require("../server/api/learning/mistake-reviews/[reviewId]/abandon");

const FAMILY = "10000000-0000-4000-8000-000000000001";
const PARENT = "20000000-0000-4000-8000-000000000001";
const CHILD = "20000000-0000-4000-8000-000000000002";
const REVIEW = "a0000000-0000-4000-8000-000000000001";
const ITEM = "b0000000-0000-4000-8000-000000000001";
const OPTION = "90000000-0000-4000-8000-000000000002";
const REQUEST = "c0000000-0000-4000-8000-000000000001";

function response() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

function request({ action = "answer", role = "child", method = "POST", body } = {}) {
  const host = "study.test";
  return {
    method,
    url: action === "answer"
      ? `/api/learning/mistake-reviews/${REVIEW}/items/${ITEM}/answers`
      : `/api/learning/mistake-reviews/${REVIEW}/abandon`,
    query: action === "answer" ? { reviewId: REVIEW, itemId: ITEM } : { reviewId: REVIEW },
    headers: {
      "content-type": "application/json",
      "x-study-csrf": "1",
      origin: `https://${host}`,
      host,
    },
    testRole: role,
    testBody: body || (action === "answer"
      ? { optionId: OPTION, requestId: REQUEST }
      : { requestId: REQUEST }),
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

function mocks(observed = [], answerOverrides = {}, abandonOverrides = {}) {
  return {
    readJson: async (req) => req.testBody,
    authenticate: (req) => ({
      sub: req.testRole === "parent" ? PARENT : CHILD,
      family: FAMILY,
      role: req.testRole,
    }),
    memberInFamily: async (id) => ({
      id,
      family_id: FAMILY,
      role: id === PARENT ? "parent" : "child",
      is_active: true,
    }),
    supabaseFetch: async (query, options) => {
      observed.push({ query, options });
      if (query === "rpc/submit_learning_mistake_review_answer") {
        return [{
          review_answer_id: "d0000000-0000-4000-8000-000000000001",
          selected_answer: "30",
          correct_answer: "30",
          explanation: "3 tens are 30.",
          is_correct: true,
          answered_count: 2,
          total_items: 2,
          session_status: "completed",
          submitted_at: "2026-08-08T03:00:00Z",
          completed_at: "2026-08-08T03:00:00Z",
          ...answerOverrides,
        }];
      }
      if (query === "rpc/abandon_learning_mistake_review") {
        return [{
          review_session_id: REVIEW,
          session_status: "abandoned",
          answered_count: 1,
          total_items: 2,
          abandoned_at: "2026-08-08T03:00:00Z",
          ...abandonOverrides,
        }];
      }
      throw new Error(`Unexpected query: ${query}`);
    },
  };
}

test("router exposes review answer and abandon lifecycle routes", () => {
  const router = fs.readFileSync(path.join(__dirname, "../api/[...path].js"), "utf8");
  assert.match(router, /reviewAnswerMatch/);
  assert.match(router, /handler = learningMistakeReviewAnswer/);
  assert.match(router, /reviewAbandonMatch/);
  assert.match(router, /handler = learningMistakeReviewAbandon/);
});

test("child submits a correct immutable-snapshot review answer and completes the session", async () => {
  const observed = [];
  const restore = replace(mocks(observed));
  try {
    const result = response();
    await answerHandler(request(), result);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.feedback, {
      selectedAnswer: "30",
      correctAnswer: "30",
      explanation: "3 tens are 30.",
      isCorrect: true,
      submittedAt: "2026-08-08T03:00:00Z",
    });
    assert.equal(result.body.review.status, "completed");
    const payload = JSON.parse(observed[0].options.body);
    assert.equal(payload.p_family_id, FAMILY);
    assert.equal(payload.p_actor_member_id, CHILD);
    assert.equal(payload.p_session_id, REVIEW);
    assert.equal(payload.p_review_item_id, ITEM);
    assert.equal(payload.p_selected_option_id, OPTION);
    assert.equal(payload.p_request_id, REQUEST);
  } finally { restore(); }
});

test("incorrect review feedback is returned only for the submitted item", async () => {
  const restore = replace(mocks([], {
    selected_answer: "3",
    is_correct: false,
    answered_count: 1,
    session_status: "in_progress",
    completed_at: null,
  }));
  try {
    const result = response();
    await answerHandler(request(), result);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.feedback.isCorrect, false);
    assert.equal(result.body.feedback.correctAnswer, "30");
    assert.equal(result.body.review.status, "in_progress");
    assert.doesNotMatch(JSON.stringify(result.body), /future|options_snapshot|correct_option_id/i);
  } finally { restore(); }
});

test("active parent may submit for a review in the same family", async () => {
  const observed = [];
  const restore = replace(mocks(observed));
  try {
    const result = response();
    await answerHandler(request({ role: "parent" }), result);
    assert.equal(result.statusCode, 200);
    assert.equal(JSON.parse(observed[0].options.body).p_actor_member_id, PARENT);
  } finally { restore(); }
});

test("answer request enforces JSON CSRF and origin before authentication", async () => {
  let authenticated = false;
  const restore = replace({
    readJson: async (req) => req.testBody,
    authenticate: () => { authenticated = true; return {}; },
  });
  try {
    for (const mutate of [
      (req) => { req.headers["content-type"] = "text/plain"; },
      (req) => { delete req.headers["x-study-csrf"]; },
      (req) => { req.headers.origin = "https://evil.test"; },
    ]) {
      const req = request();
      mutate(req);
      const result = response();
      await answerHandler(req, result);
      assert.ok([403, 415].includes(result.statusCode));
    }
    assert.equal(authenticated, false);
  } finally { restore(); }
});

test("invalid answer input is rejected before lifecycle RPC", async () => {
  let queried = false;
  const restore = replace({
    readJson: async (req) => req.testBody,
    authenticate: () => ({ sub: CHILD, family: FAMILY, role: "child" }),
    memberInFamily: async () => ({ id: CHILD, family_id: FAMILY, role: "child", is_active: true }),
    supabaseFetch: async () => { queried = true; return []; },
  });
  try {
    const result = response();
    await answerHandler(request({ body: { optionId: "bad", requestId: REQUEST } }), result);
    assert.equal(result.statusCode, 400);
    assert.equal(result.body.code, "INVALID_OPTION_ID");
    assert.equal(queried, false);
  } finally { restore(); }
});

test("other-family or wrong session item is hidden as not found", async () => {
  const restore = replace({
    ...mocks(),
    supabaseFetch: async (query) => {
      if (query !== "rpc/submit_learning_mistake_review_answer") throw new Error("unexpected query");
      const error = new Error("hidden scope");
      error.supabaseCode = "P0002";
      throw error;
    },
  });
  try {
    const result = response();
    await answerHandler(request(), result);
    assert.equal(result.statusCode, 404);
    assert.equal(result.body.code, "REVIEWABLE_MISTAKES_NOT_FOUND");
    assert.doesNotMatch(JSON.stringify(result.body), /hidden scope|family_id|session_id/i);
  } finally { restore(); }
});

for (const [token, code] of [
  ["IDEMPOTENCY_CONFLICT", "IDEMPOTENCY_CONFLICT"],
  ["REVIEW_ANSWER_CONFLICT", "REVIEW_ANSWER_CONFLICT"],
  ["REVIEW_SESSION_COMPLETED", "REVIEW_SESSION_COMPLETED"],
  ["REVIEW_SESSION_ABANDONED", "REVIEW_SESSION_ABANDONED"],
]) {
  test(`${token} is returned as a stable lifecycle conflict`, async () => {
    const restore = replace({
      ...mocks(),
      supabaseFetch: async () => {
        const error = new Error("database detail");
        error.supabaseCode = "55000";
        error.supabaseMessage = token;
        throw error;
      },
    });
    try {
      const result = response();
      await answerHandler(request(), result);
      assert.equal(result.statusCode, 409);
      assert.equal(result.body.code, code);
      assert.doesNotMatch(JSON.stringify(result.body), /database detail/i);
    } finally { restore(); }
  });
}

test("parent or self-child can explicitly abandon an active review", async () => {
  for (const role of ["parent", "child"]) {
    const observed = [];
    const restore = replace(mocks(observed));
    try {
      const result = response();
      await abandonHandler(request({ action: "abandon", role }), result);
      assert.equal(result.statusCode, 200);
      assert.equal(result.body.review.status, "abandoned");
      assert.equal(JSON.parse(observed[0].options.body).p_actor_member_id, role === "parent" ? PARENT : CHILD);
    } finally { restore(); }
  }
});

test("unauthorized lifecycle requests stop before database access", async () => {
  let queried = false;
  const restore = replace({
    readJson: async (req) => req.testBody,
    authenticate: () => { throw utils.err("Authentication required", 401, "AUTH_REQUIRED"); },
    supabaseFetch: async () => { queried = true; return []; },
  });
  try {
    const result = response();
    await abandonHandler(request({ action: "abandon" }), result);
    assert.equal(result.statusCode, 401);
    assert.equal(result.body.code, "AUTH_REQUIRED");
    assert.equal(queried, false);
  } finally { restore(); }
});

test("unexpected database errors are generalized", async () => {
  const restore = replace({
    ...mocks(),
    supabaseFetch: async () => {
      const error = new Error("postgres://secret-host/private-family");
      error.supabaseCode = "XX999";
      throw error;
    },
  });
  try {
    const result = response();
    await abandonHandler(request({ action: "abandon" }), result);
    assert.equal(result.statusCode, 500);
    assert.equal(result.body.code, "MISTAKE_REVIEW_FAILED");
    assert.doesNotMatch(JSON.stringify(result.body), /postgres|secret-host|private-family|service_role/i);
  } finally { restore(); }
});

test("lifecycle endpoints are POST-only", async () => {
  for (const [handler, req] of [
    [answerHandler, request({ method: "GET" })],
    [abandonHandler, request({ action: "abandon", method: "GET" })],
  ]) {
    const result = response();
    await handler(req, result);
    assert.equal(result.statusCode, 405);
    assert.equal(result.headers.Allow, "POST");
  }
});
