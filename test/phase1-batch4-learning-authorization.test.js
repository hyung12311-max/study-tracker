const assert = require("node:assert/strict");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const learning = require("../server/api/learning/_utils");
const assignments = require("../server/api/learning/assignments");
const attemptAnswer = require("../server/api/learning/attempts/[attemptId]/answers");
const reviewAnswer = require("../server/api/learning/mistake-reviews/[reviewId]/items/[itemId]/answers");
const reviewSchedule = require("../server/api/learning/review-schedule");
const reveal = require("../server/api/learning/assignments/[assignmentId]/mistakes/[questionId]/reveal");

const FAMILY = "10000000-0000-4000-8000-000000000001";
const OTHER_FAMILY = "10000000-0000-4000-8000-000000000002";
const PARENT = "20000000-0000-4000-8000-000000000001";
const CHILD = "20000000-0000-4000-8000-000000000002";
const SIBLING = "20000000-0000-4000-8000-000000000003";
const ASSIGNMENT = "30000000-0000-4000-8000-000000000001";
const ATTEMPT = "40000000-0000-4000-8000-000000000001";
const QUESTION = "50000000-0000-4000-8000-000000000001";
const REVIEW = "60000000-0000-4000-8000-000000000001";
const ITEM = "70000000-0000-4000-8000-000000000001";
const OPTION = "80000000-0000-4000-8000-000000000001";
const REQUEST_ID = "90000000-0000-4000-8000-000000000001";

function replace(overrides) {
  const originals = {};
  for (const [key, value] of Object.entries(overrides)) {
    originals[key] = utils[key];
    utils[key] = value;
  }
  return () => Object.assign(utils, originals);
}

function response() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

function guardedRequest({ method = "POST", url = "/", query = {}, body = {} } = {}) {
  return {
    method,
    url,
    query,
    testBody: body,
    headers: {
      host: "study.test",
      origin: "https://study.test",
      "content-type": "application/json",
      "x-study-csrf": "1",
    },
  };
}

function actor(role = "child") {
  const id = role === "parent" ? PARENT : CHILD;
  return {
    authenticate: () => ({ sub: id, family: FAMILY, key: `${role}-key`, role }),
    memberInFamily: async () => ({
      id,
      family_id: FAMILY,
      member_key: `${role}-key`,
      role,
      is_active: true,
    }),
  };
}

test("Learning activeMember maps deleted inactive and identity drift to one 401 contract", async () => {
  const claims = { sub: CHILD, family: FAMILY, key: "child-key", role: "child" };
  const valid = { id: CHILD, family_id: FAMILY, member_key: "child-key", role: "child", is_active: true };
  const scenarios = [
    null,
    { ...valid, is_active: false },
    { ...valid, id: SIBLING },
    { ...valid, family_id: OTHER_FAMILY },
    { ...valid, member_key: "rotated-key" },
    { ...valid, role: "parent" },
  ];
  for (const member of scenarios) {
    const restore = replace({
      authenticate: () => claims,
      memberInFamily: async () => member,
    });
    try {
      await assert.rejects(
        learning.activeMember({}),
        (error) => error.statusCode === 401 && error.code === "AUTH_SESSION_INVALID"
      );
    } finally { restore(); }
  }
});

test("current DB role, not the token alone, enforces parent-only Learning access", async () => {
  const restore = replace(actor("child"));
  try {
    await assert.rejects(
      learning.activeMember({}, "parent"),
      (error) => error.statusCode === 403 && error.code === "AUTH_ROLE_REQUIRED"
    );
  } finally { restore(); }
});

test("parent child selection uses a same-family active-child query and safe 404", async () => {
  let path = "";
  const restore = replace({
    ...actor("parent"),
    supabaseFetch: async (value) => { path = value; return []; },
  });
  try {
    const context = (await learning.activeMember({}, "parent")).context;
    await assert.rejects(
      learning.activeChild(context, CHILD),
      (error) => error.statusCode === 404 && error.code === "FAMILY_CHILD_NOT_FOUND"
    );
    assert.match(path, new RegExp(`family_id=eq\\.${FAMILY}`));
    assert.match(path, /role=eq\.child&is_active=eq\.true/);
  } finally { restore(); }
});

test("child sibling selection is denied before assignment data access", async () => {
  let queried = false;
  const restore = replace({
    ...actor("child"),
    supabaseFetch: async () => { queried = true; return []; },
  });
  try {
    const result = response();
    await assignments({ method: "GET", url: `/api/learning/assignments?assignedMemberId=${SIBLING}`, headers: {} }, result);
    assert.equal(result.statusCode, 403);
    assert.equal(result.body.code, "CHILD_ASSIGNEE_OVERRIDE_NOT_ALLOWED");
    assert.equal(queried, false);
  } finally { restore(); }
});

test("attempt answers resolve the self-scoped attempt and its question before RPC", async () => {
  let rpcCalled = false;
  const restore = replace({
    ...actor("child"),
    readJson: async (request) => request.testBody,
    supabaseFetch: async (path) => {
      if (path.startsWith("learning_attempts?")) return [{ id: ATTEMPT, status: "in_progress" }];
      if (path.startsWith("learning_attempt_questions?")) return [];
      if (path === "rpc/submit_learning_attempt_answer") rpcCalled = true;
      return [];
    },
  });
  try {
    const result = response();
    await attemptAnswer(guardedRequest({
      url: `/api/learning/attempts/${ATTEMPT}/answers`,
      query: { attemptId: ATTEMPT },
      body: { questionId: QUESTION, optionId: OPTION, requestId: REQUEST_ID },
    }), result);
    assert.equal(result.statusCode, 404);
    assert.equal(result.body.code, "LEARNING_NOT_FOUND");
    assert.equal(rpcCalled, false);
  } finally { restore(); }
});

test("cross-family review session is a safe 404 before item lookup or answer RPC", async () => {
  const observed = [];
  const restore = replace({
    ...actor("child"),
    readJson: async (request) => request.testBody,
    supabaseFetch: async (path) => { observed.push(path); return []; },
  });
  try {
    const result = response();
    await reviewAnswer(guardedRequest({
      url: `/api/learning/mistake-reviews/${REVIEW}/items/${ITEM}/answers`,
      query: { reviewId: REVIEW, itemId: ITEM },
      body: { optionId: OPTION, requestId: REQUEST_ID },
    }), result);
    assert.equal(result.statusCode, 404);
    assert.equal(result.body.code, "MISTAKE_REVIEW_NOT_FOUND");
    assert.equal(observed.some((path) => path.startsWith("learning_mistake_review_items?")), false);
    assert.equal(observed.includes("rpc/submit_learning_mistake_review_answer"), false);
  } finally { restore(); }
});

test("parent schedule mutation resolves child and assignment in one family before RPC", async () => {
  const observed = [];
  const restore = replace({
    ...actor("parent"),
    readJson: async (request) => request.testBody,
    supabaseFetch: async (path) => {
      observed.push(path);
      if (path.startsWith("family_members?")) return [{ id: CHILD, family_id: FAMILY, member_key: "child-key", role: "child", is_active: true }];
      return [];
    },
  });
  try {
    const result = response();
    await reviewSchedule(guardedRequest({
      method: "PUT",
      url: "/api/learning/review-schedule",
      body: { assignedMemberId: CHILD, assignmentId: ASSIGNMENT, skillCode: "place-value", action: "clear", requestId: REQUEST_ID },
    }), result);
    assert.equal(result.statusCode, 404);
    assert.equal(result.body.code, "REVIEW_SCHEDULE_NOT_FOUND");
    const assignmentPath = observed.find((path) => path.startsWith("learning_assignments?"));
    assert.match(assignmentPath, new RegExp(`family_id=eq\\.${FAMILY}`));
    assert.match(assignmentPath, new RegExp(`assigned_member_id=eq\\.${CHILD}`));
    assert.equal(observed.includes("rpc/set_learning_review_schedule_override"), false);
  } finally { restore(); }
});

test("cross-family reveal target stops before attempt question and RPC access", async () => {
  const observed = [];
  const restore = replace({
    ...actor("parent"),
    readJson: async (request) => request.testBody,
    supabaseFetch: async (path) => { observed.push(path); return []; },
  });
  try {
    const result = response();
    await reveal(guardedRequest({
      url: `/api/learning/assignments/${ASSIGNMENT}/mistakes/${QUESTION}/reveal`,
      query: { assignmentId: ASSIGNMENT, questionId: QUESTION },
      body: { requestId: REQUEST_ID },
    }), result);
    assert.equal(result.statusCode, 404);
    assert.equal(result.body.code, "MISTAKE_NOT_FOUND");
    assert.equal(observed.some((path) => path.startsWith("learning_attempts?")), false);
    assert.equal(observed.includes("rpc/reveal_learning_mistake_solution"), false);
  } finally { restore(); }
});

test("Learning error sanitizer exposes neither SQLSTATE nor database diagnostics", () => {
  const error = new Error("postgres://service_role:secret@private-host/family");
  error.supabaseCode = "XX999";
  error.supabaseMessage = "private SQL message";
  error.details = "constraint family_uuid";
  error.hint = "token secret";
  const result = response();
  const originalError = console.error;
  console.error = () => {};
  try {
    learning.safeError(result, error);
  } finally {
    console.error = originalError;
  }
  assert.equal(result.statusCode, 500);
  assert.equal(result.body.code, "LEARNING_REQUEST_FAILED");
  assert.doesNotMatch(JSON.stringify(result.body), /XX999|postgres|service_role|secret|private|constraint|family_uuid|token/i);
});
