const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const handler = require("../server/api/learning/assignments/[assignmentId]/mistakes/[questionId]/reveal");

const FAMILY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PARENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ASSIGNMENT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const QUESTION = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const REQUEST = "11111111-1111-4111-8111-111111111111";

function request(role = "parent", method = "POST") {
  return {
    method,
    url: `/api/learning/assignments/${ASSIGNMENT}/mistakes/${QUESTION}/reveal`,
    query: { assignmentId: ASSIGNMENT, questionId: QUESTION },
    headers: {
      "content-type": "application/json",
      "x-study-csrf": "1",
      origin: "https://study.example",
      host: "study.example",
    },
    role,
  };
}

function response() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
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

function mocks(role = "parent", observed = []) {
  const actor = role === "parent" ? PARENT : CHILD;
  return {
    authenticate: () => ({ sub: actor, family: FAMILY, role }),
    memberInFamily: async () => ({ id: actor, family_id: FAMILY, role, is_active: true }),
    readJson: async () => ({ requestId: REQUEST }),
    supabaseFetch: async (resource, options) => {
      observed.push({ resource, options });
      assert.equal(resource, "rpc/reveal_learning_mistake_solution");
      return [{ correct_answer: "30", explanation: "3은 십의 자리이므로 30입니다.", review_status: "reviewed", revealed_at: "2026-08-08T00:00:00Z" }];
    },
  };
}

for (const role of ["parent", "child"]) {
  test(`${role} reveal uses the authenticated actor and returns only the requested solution`, async () => {
    const observed = [];
    const restore = replace(mocks(role, observed));
    try {
      const result = response();
      await handler(request(role), result);
      assert.equal(result.statusCode, 200);
      assert.deepEqual(result.body.solution, {
        correctAnswer: "30",
        explanation: "3은 십의 자리이므로 30입니다.",
        reviewStatus: "reviewed",
        revealedAt: "2026-08-08T00:00:00Z",
      });
      const payload = JSON.parse(observed[0].options.body);
      assert.equal(payload.p_family_id, FAMILY);
      assert.equal(payload.p_actor_member_id, role === "parent" ? PARENT : CHILD);
      assert.equal(payload.p_assignment_id, ASSIGNMENT);
      assert.equal(payload.p_attempt_question_id, QUESTION);
      assert.equal(payload.p_request_id, REQUEST);
      assert.doesNotMatch(JSON.stringify(result.body), /family_id|attempt_id|question_id|service_role/i);
    } finally { restore(); }
  });
}

test("reveal is POST only and requires the standard mutation guard", async () => {
  const getResult = response();
  await handler(request("parent", "GET"), getResult);
  assert.equal(getResult.statusCode, 405);
  assert.equal(getResult.headers.Allow, "POST");

  let read = false;
  const restore = replace({ readJson: async () => { read = true; return {}; } });
  try {
    const invalid = request();
    delete invalid.headers["x-study-csrf"];
    const result = response();
    await handler(invalid, result);
    assert.equal(result.statusCode, 403);
    assert.equal(result.body.code, "CSRF_REQUIRED");
    assert.equal(read, false);
  } finally { restore(); }
});

test("missing, cross-family, future, non-terminal, unsubmitted, correct, and wrong-version targets share 404", async () => {
  for (const scenario of ["missing", "other-family", "future", "non-terminal", "unsubmitted", "correct", "wrong-version"]) {
    const base = mocks();
    base.supabaseFetch = async () => {
      const error = new Error(`private ${scenario}`);
      error.supabaseCode = "P0002";
      error.supabaseMessage = "reviewable mistake was not found";
      throw error;
    };
    const restore = replace(base);
    try {
      const result = response();
      await handler(request(), result);
      assert.equal(result.statusCode, 404);
      assert.equal(result.body.code, "MISTAKE_NOT_FOUND");
      assert.doesNotMatch(JSON.stringify(result.body), new RegExp(scenario));
    } finally { restore(); }
  }
});

test("duplicate request results stay stable and contain one solution only", async () => {
  const observed = [];
  const restore = replace(mocks("parent", observed));
  try {
    const first = response();
    const second = response();
    await handler(request(), first);
    await handler(request(), second);
    assert.deepEqual(second.body, first.body);
    assert.equal(observed.length, 2);
  } finally { restore(); }
});

test("idempotency conflicts are sanitized", async () => {
  const base = mocks();
  base.supabaseFetch = async () => {
    const error = new Error("private target");
    error.supabaseCode = "55000";
    error.supabaseMessage = "IDEMPOTENCY_CONFLICT";
    throw error;
  };
  const restore = replace(base);
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 409);
    assert.equal(result.body.code, "IDEMPOTENCY_CONFLICT");
    assert.doesNotMatch(JSON.stringify(result.body), /private target|constraint|sql/i);
  } finally { restore(); }
});

test("unexpected database errors are generalized", async () => {
  const base = mocks();
  base.supabaseFetch = async () => {
    const error = new Error("database host secret");
    error.supabaseCode = "XX999";
    throw error;
  };
  const restore = replace(base);
  try {
    const result = response();
    await handler(request(), result);
    assert.equal(result.statusCode, 500);
    assert.equal(result.body.code, "LEARNING_MISTAKE_REVEAL_FAILED");
    assert.doesNotMatch(JSON.stringify(result.body), /database host secret|service_role|sql/i);
  } finally { restore(); }
});

test("router exposes the reveal endpoint before the list endpoint", () => {
  const router = fs.readFileSync(path.join(__dirname, "../api/[...path].js"), "utf8");
  assert.match(router, /const revealMatch = key\.match/);
  assert.ok(router.indexOf("if (!handler && revealMatch)") < router.indexOf("if (!handler && mistakesMatch)"));
});
