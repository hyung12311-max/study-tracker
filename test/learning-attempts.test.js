const assert = require("node:assert/strict");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const startHandler = require("../server/api/learning/assignments/[assignmentId]/stages/[stageId]/attempts");
const attemptHandler = require("../server/api/learning/attempts/[attemptId]");
const answerHandler = require("../server/api/learning/attempts/[attemptId]/answers");
const finalizeHandler = require("../server/api/learning/attempts/[attemptId]/finalize");
const abandonHandler = require("../server/api/learning/attempts/[attemptId]/abandon");

const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PARENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_CHILD_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ASSIGNMENT_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const STAGE_ID = "33333333-3333-4333-8333-333333333333";
const ATTEMPT_ID = "44444444-4444-4444-8444-444444444444";
const QUESTION_ID = "55555555-5555-4555-8555-555555555555";
const FUTURE_QUESTION_ID = "66666666-6666-4666-8666-666666666666";
const OPTION_ID = "77777777-7777-4777-8777-777777777777";
const WRONG_OPTION_ID = "88888888-8888-4888-8888-888888888888";
const REQUEST_ID = "99999999-9999-4999-8999-999999999999";
const NEXT_STAGE_ID = "aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa";

function responseCapture() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

function replaceUtils(overrides) {
  const originals = {};
  for (const [key, value] of Object.entries(overrides)) {
    originals[key] = utils[key];
    utils[key] = value;
  }
  return () => Object.assign(utils, originals);
}

function request(method, body = {}, query = {}, headers = {}) {
  return {
    method,
    url: "/api/learning/test",
    query,
    headers: {
      host: "study.example",
      origin: "https://study.example",
      "x-forwarded-proto": "https",
      "content-type": "application/json",
      "x-study-csrf": "1",
      ...headers,
    },
    testBody: body,
  };
}

function mocks({ role = "child", active = true, body = {}, supabaseFetch }) {
  const id = role === "parent" ? PARENT_ID : CHILD_ID;
  return {
    authenticate: (_request, requiredRole) => {
      if (requiredRole && role !== requiredRole) throw utils.err("Permission required.", 403, "ROLE_REQUIRED");
      return { sub: id, family: FAMILY_ID, role };
    },
    memberInFamily: async () => ({ id, family_id: FAMILY_ID, role, is_active: active }),
    readJson: async () => body,
    supabaseFetch,
  };
}

function attemptRow(status = "in_progress") {
  return {
    id: ATTEMPT_ID,
    assignment_id: ASSIGNMENT_ID,
    stage_id: STAGE_ID,
    status,
    total_questions: 5,
    correct_answers: status === "passed" ? 4 : status === "failed" ? 3 : 0,
    required_correct_answers: 4,
    started_at: "2026-07-31T01:00:00Z",
    finalized_at: status === "in_progress" ? null : "2026-07-31T01:05:00Z",
    abandoned_at: null,
  };
}

function finalizeRow({
  status = "passed",
  firstPass = true,
  rewardGranted = true,
  rewardAmount = 3,
  unlockedStageId = NEXT_STAGE_ID,
  assignmentCompleted = false,
} = {}) {
  return {
    attempt_id: ATTEMPT_ID,
    attempt_status: status,
    passed: status === "passed",
    first_pass: firstPass,
    reward_granted: rewardGranted,
    reward_amount: rewardAmount,
    unlocked_stage_id: unlockedStageId,
    assignment_completed: assignmentCompleted,
  };
}

function attemptRead(path, status = "in_progress", answered = []) {
  if (path.startsWith("learning_attempts?")) {
    assert.match(path, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
    assert.match(path, new RegExp(`assigned_member_id=eq\\.${CHILD_ID}`));
    return [attemptRow(status)];
  }
  if (path.startsWith("learning_attempt_answers?")) {
    return answered.map((id, index) => ({
      attempt_question_id: id,
      selected_option_id: index === 0 ? OPTION_ID : WRONG_OPTION_ID,
      is_correct: index === 0,
      submitted_at: "2026-07-31T01:02:00Z",
    }));
  }
  if (path.startsWith("learning_attempt_questions?")) {
    assert.doesNotMatch(path, /source_question_id/);
    return [
      {
        id: QUESTION_ID,
        display_order: 1,
        prompt_snapshot: "2 + 2는 무엇일까요?",
        explanation_snapshot: "둘과 둘을 더하면 넷이에요.",
        correct_option_id: OPTION_ID,
        options_snapshot: [
          { id: OPTION_ID, displayOrder: 1, text: "4" },
          { id: WRONG_OPTION_ID, displayOrder: 2, text: "5" },
        ],
      },
      {
        id: FUTURE_QUESTION_ID,
        display_order: 2,
        prompt_snapshot: "미래 문제",
        explanation_snapshot: "미래 해설",
        correct_option_id: OPTION_ID,
        options_snapshot: [{ id: OPTION_ID, displayOrder: 1, text: "미래 정답" }],
      },
    ];
  }
  return null;
}

test("unauthenticated, inactive, and parent actors are blocked before attempt RPC", async () => {
  for (const scenario of ["unauthenticated", "inactive", "parent"]) {
    let rpcCalled = false;
    const base = mocks({
      role: scenario === "parent" ? "parent" : "child",
      active: scenario !== "inactive",
      body: { requestId: REQUEST_ID },
      supabaseFetch: async (path) => { if (path.startsWith("rpc/")) rpcCalled = true; return []; },
    });
    if (scenario === "unauthenticated") base.authenticate = () => { throw utils.err("Auth required.", 401, "AUTH_REQUIRED"); };
    const restore = replaceUtils(base);
    try {
      const response = responseCapture();
      await startHandler(request("POST", { requestId: REQUEST_ID }, { assignmentId: ASSIGNMENT_ID, stageId: STAGE_ID }), response);
      assert.ok([401, 403].includes(response.statusCode));
      assert.equal(rpcCalled, false);
      assert.equal(response.headers["Cache-Control"], "no-store");
    } finally { restore(); }
  }
});

test("attempt routes return no-store for unsupported methods", async () => {
  for (const [handler, method] of [
    [startHandler, "GET"],
    [attemptHandler, "POST"],
    [answerHandler, "GET"],
    [finalizeHandler, "GET"],
    [abandonHandler, "GET"],
  ]) {
    const response = responseCapture();
    await handler(request(method), response);
    assert.equal(response.statusCode, 405);
    assert.equal(response.headers["Cache-Control"], "no-store");
  }
});

test("child start is self-scoped, idempotent, and projects every ordered question without future feedback", async () => {
  const calls = [];
  const restore = replaceUtils(mocks({
    body: { requestId: REQUEST_ID },
    supabaseFetch: async (path, options = {}) => {
      calls.push({ path, options });
      if (path.startsWith("learning_assignments?")) return [{ id: ASSIGNMENT_ID, content_version_id: VERSION_ID, status: "active" }];
      if (path.startsWith("learning_stages?")) return [{ id: STAGE_ID }];
      if (path.startsWith("learning_stage_progress?")) return [{ status: "unlocked" }];
      if (path === "rpc/start_or_resume_learning_attempt") {
        assert.deepEqual(JSON.parse(options.body), {
          p_family_id: FAMILY_ID,
          p_actor_member_id: CHILD_ID,
          p_assigned_member_id: CHILD_ID,
          p_assignment_id: ASSIGNMENT_ID,
          p_stage_id: STAGE_ID,
          p_start_request_id: REQUEST_ID,
        });
        return [{ attempt_id: ATTEMPT_ID, attempt_status: "in_progress", resumed: false }];
      }
      return attemptRead(path) || [];
    },
  }));
  try {
    const response = responseCapture();
    await startHandler(request("POST", { requestId: REQUEST_ID }, { assignmentId: ASSIGNMENT_ID, stageId: STAGE_ID }), response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.attempt.questions.map((question) => question.id), [QUESTION_ID, FUTURE_QUESTION_ID]);
    assert.equal(response.body.attempt.questions[0].options[0].id, OPTION_ID);
    assert.equal(response.body.attempt.questions[0].answer, null);
    const serialized = JSON.stringify(response.body);
    assert.doesNotMatch(serialized, /isCorrect|correctOption|explanation|contentVersion|course|grade|미래 해설/i);
    assert.equal(calls.filter(({ path }) => path === "rpc/start_or_resume_learning_attempt").length, 1);
  } finally { restore(); }
});

test("attempt GET is child self-scoped and hides other-family attempts", async () => {
  for (const found of [true, false]) {
    const restore = replaceUtils(mocks({
      supabaseFetch: async (path) => {
        if (path.startsWith("learning_attempts?")) return found ? [attemptRow()] : [];
        return attemptRead(path) || [];
      },
    }));
    try {
      const response = responseCapture();
      await attemptHandler(request("GET", {}, { attemptId: ATTEMPT_ID }), response);
      assert.equal(response.statusCode, found ? 200 : 404);
      if (found) assert.equal(response.body.attempt.questions[0].id, QUESTION_ID);
    } finally { restore(); }
  }
});

test("resume exposes feedback only for submitted questions and keeps unanswered answers secret", async () => {
  const restore = replaceUtils(mocks({
    supabaseFetch: async (path) => attemptRead(path, "in_progress", [QUESTION_ID]) || [],
  }));
  try {
    const response = responseCapture();
    await attemptHandler(request("GET", {}, { attemptId: ATTEMPT_ID }), response);
    assert.equal(response.statusCode, 200);
    const [answered, unanswered] = response.body.attempt.questions;
    assert.deepEqual(answered.answer, {
      selectedOptionId: OPTION_ID,
      isCorrect: true,
      correctOptionText: "4",
      explanation: "둘과 둘을 더하면 넷이에요.",
      submittedAt: "2026-07-31T01:02:00Z",
    });
    assert.equal(unanswered.answer, null);
    assert.doesNotMatch(JSON.stringify(unanswered), /미래 해설|correctOption|isCorrect/);
  } finally { restore(); }
});

test("answer submission sends no client grading fields and returns scoped immediate feedback", async () => {
  let attemptStatus = "in_progress";
  const restore = replaceUtils(mocks({
    body: { questionId: QUESTION_ID, optionId: OPTION_ID, requestId: REQUEST_ID },
    supabaseFetch: async (path, options = {}) => {
      if (path === "rpc/submit_learning_attempt_answer") {
        const payload = JSON.parse(options.body);
        assert.deepEqual(payload, {
          p_actor_member_id: CHILD_ID,
          p_attempt_id: ATTEMPT_ID,
          p_attempt_question_id: QUESTION_ID,
          p_selected_option_id: OPTION_ID,
          p_client_request_id: REQUEST_ID,
        });
        assert.doesNotMatch(options.body, /is_correct|score|passed|required/i);
        return [{
          answer_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
          is_correct: true,
          correct_option_text: "4",
          explanation: "둘과 둘을 더하면 넷이에요.",
          submitted_at: "2026-07-31T01:02:00Z",
          answered_count: 1,
          total_questions: 5,
          is_complete: false,
          attempt_status: attemptStatus,
        }];
      }
      return attemptRead(path, attemptStatus) || [];
    },
  }));
  try {
    const response = responseCapture();
    await answerHandler(request("POST", {
      questionId: QUESTION_ID, optionId: OPTION_ID, requestId: REQUEST_ID,
    }, { attemptId: ATTEMPT_ID }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.feedback.isCorrect, true);
    assert.equal(response.body.feedback.correctOptionText, "4");
    assert.equal(response.body.feedback.selectedOptionId, OPTION_ID);
    assert.doesNotMatch(JSON.stringify(response.body), /correct_option_id|source_question_id|content_version/i);
  } finally { restore(); }
});

test("same answer request is returned idempotently without changing the API contract", async () => {
  let rpcCalls = 0;
  const restore = replaceUtils(mocks({
    body: { questionId: QUESTION_ID, optionId: OPTION_ID, requestId: REQUEST_ID },
    supabaseFetch: async (path) => {
      if (path === "rpc/submit_learning_attempt_answer") {
        rpcCalls += 1;
        return [{
          answer_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
          is_correct: true,
          correct_option_text: "4",
          explanation: "둘과 둘을 더하면 넷이에요.",
          submitted_at: "2026-07-31T01:02:00Z",
          answered_count: 1,
          total_questions: 5,
          is_complete: false,
          attempt_status: "in_progress",
        }];
      }
      return attemptRead(path) || [];
    },
  }));
  try {
    const responses = [];
    for (let index = 0; index < 2; index += 1) {
      const response = responseCapture();
      await answerHandler(request("POST", {
        questionId: QUESTION_ID, optionId: OPTION_ID, requestId: REQUEST_ID,
      }, { attemptId: ATTEMPT_ID }), response);
      responses.push(response);
    }
    assert.equal(rpcCalls, 2);
    assert.deepEqual(responses[1].body, responses[0].body);
    assert.equal(responses[0].body.feedback.selectedOptionId, OPTION_ID);
  } finally { restore(); }
});

test("answer conflict and order violations map to stable 409 without database details", async () => {
  for (const databaseCode of ["23505", "55000"]) {
    const restore = replaceUtils(mocks({
      body: { questionId: QUESTION_ID, optionId: OPTION_ID, requestId: REQUEST_ID },
      supabaseFetch: async (path) => {
        if (path === "rpc/submit_learning_attempt_answer") {
          const error = new Error("sensitive database message");
          error.supabaseCode = databaseCode;
          throw error;
        }
        return attemptRead(path) || [];
      },
    }));
    try {
      const response = responseCapture();
      await answerHandler(request("POST", {
        questionId: QUESTION_ID, optionId: OPTION_ID, requestId: REQUEST_ID,
      }, { attemptId: ATTEMPT_ID }), response);
      assert.equal(response.statusCode, 409);
      assert.equal(response.body.code, databaseCode === "23505" ? "ANSWER_CONFLICT" : "ANSWER_STATE_CONFLICT");
      assert.doesNotMatch(JSON.stringify(response.body), /sensitive|sql|supabase/i);
    } finally { restore(); }
  }
});

test("last answer reflects automatic finalize result using stored threshold", async () => {
  for (const status of ["passed", "failed"]) {
    const restore = replaceUtils(mocks({
      body: { questionId: QUESTION_ID, optionId: OPTION_ID, requestId: REQUEST_ID },
      supabaseFetch: async (path, options = {}) => {
        if (path === "rpc/submit_learning_attempt_answer") return [{
          answer_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
          is_correct: status === "passed",
          correct_option_text: "4",
          explanation: "해설",
          submitted_at: "2026-07-31T01:05:00Z",
          answered_count: 5,
          total_questions: 5,
          is_complete: true,
          attempt_status: status,
        }];
        if (path === "rpc/finalize_learning_stage_attempt") {
          assert.deepEqual(JSON.parse(options.body), {
            p_actor_member_id: CHILD_ID,
            p_attempt_id: ATTEMPT_ID,
            p_request_id: REQUEST_ID,
          });
          return [status === "passed"
            ? finalizeRow()
            : finalizeRow({
                status: "failed",
                firstPass: false,
                rewardGranted: false,
                rewardAmount: 0,
                unlockedStageId: null,
              })];
        }
        return attemptRead(path, status, [QUESTION_ID, "1", "2", "3", "4"]) || [];
      },
    }));
    try {
      const response = responseCapture();
      await answerHandler(request("POST", {
        questionId: QUESTION_ID, optionId: OPTION_ID, requestId: REQUEST_ID,
      }, { attemptId: ATTEMPT_ID }), response);
      assert.equal(response.statusCode, 200);
      assert.equal(response.body.attempt.result.passed, status === "passed");
      assert.equal(response.body.attempt.result.requiredCorrectAnswers, 4);
      assert.equal(response.body.attempt.result.correctAnswers, status === "passed" ? 4 : 3);
      assert.deepEqual(
        {
          firstPass: response.body.attempt.result.firstPass,
          rewardGranted: response.body.attempt.result.rewardGranted,
          rewardAmount: response.body.attempt.result.rewardAmount,
          unlockedStageId: response.body.attempt.result.unlockedStageId,
          assignmentCompleted: response.body.attempt.result.assignmentCompleted,
        },
        status === "passed"
          ? { firstPass: true, rewardGranted: true, rewardAmount: 3, unlockedStageId: NEXT_STAGE_ID, assignmentCompleted: false }
          : { firstPass: false, rewardGranted: false, rewardAmount: 0, unlockedStageId: null, assignmentCompleted: false }
      );
    } finally { restore(); }
  }
});

test("explicit finalize is idempotent and incomplete attempts return stable 409", async () => {
  for (const databaseCode of [null, "55000"]) {
    const restore = replaceUtils(mocks({
      body: { requestId: REQUEST_ID },
      supabaseFetch: async (path) => {
        if (path === "rpc/finalize_learning_stage_attempt") {
          if (databaseCode) {
            const error = new Error("incomplete internal detail");
            error.supabaseCode = databaseCode;
            throw error;
          }
          return [finalizeRow({ assignmentCompleted: true, unlockedStageId: null })];
        }
        return attemptRead(path, databaseCode ? "in_progress" : "passed", [QUESTION_ID]) || [];
      },
    }));
    try {
      const response = responseCapture();
      await finalizeHandler(request("POST", { requestId: REQUEST_ID }, { attemptId: ATTEMPT_ID }), response);
      assert.equal(response.statusCode, databaseCode ? 409 : 200);
      if (databaseCode) assert.equal(response.body.code, "ATTEMPT_INCOMPLETE");
      else {
        assert.equal(response.body.attempt.result.passed, true);
        assert.equal(response.body.attempt.result.rewardGranted, true);
        assert.equal(response.body.attempt.result.rewardAmount, 3);
        assert.equal(response.body.attempt.result.unlockedStageId, null);
        assert.equal(response.body.attempt.result.assignmentCompleted, true);
      }
    } finally { restore(); }
  }
});

test("terminal GET replays stable public completion fields without internal reward identifiers", async () => {
  let finalizeCalls = 0;
  const restore = replaceUtils(mocks({
    supabaseFetch: async (path) => {
      if (path === "rpc/finalize_learning_stage_attempt") {
        finalizeCalls += 1;
        return [finalizeRow()];
      }
      return attemptRead(path, "passed", [QUESTION_ID]) || [];
    },
  }));
  try {
    const bodies = [];
    for (let index = 0; index < 2; index += 1) {
      const response = responseCapture();
      await attemptHandler(request("GET", {}, { attemptId: ATTEMPT_ID }), response);
      assert.equal(response.statusCode, 200);
      bodies.push(response.body);
    }
    assert.equal(finalizeCalls, 2);
    assert.deepEqual(bodies[1], bodies[0]);
    assert.deepEqual(bodies[0].attempt.result, {
      correctAnswers: 4,
      requiredCorrectAnswers: 4,
      passed: true,
      finalizedAt: "2026-07-31T01:05:00Z",
      firstPass: true,
      rewardGranted: true,
      rewardAmount: 3,
      unlockedStageId: NEXT_STAGE_ID,
      assignmentCompleted: false,
    });
    assert.doesNotMatch(JSON.stringify(bodies[0]), /first_pass_id|reward_transaction|ledger|family_id|member_id|content_version/i);
  } finally { restore(); }
});

test("completion mapper supplies explicit defaults and rejects malformed database types", () => {
  const shared = require("../server/api/learning/attempts/_shared");
  assert.deepEqual(shared.completionResult({}), {
    firstPass: false,
    rewardGranted: false,
    rewardAmount: 0,
    unlockedStageId: null,
    assignmentCompleted: false,
  });
  for (const rewardAmount of [1, 2, 3, 5]) {
    assert.equal(shared.completionResult(finalizeRow({ rewardAmount })).rewardAmount, rewardAmount);
  }
  assert.deepEqual(shared.completionResult(finalizeRow({
    status: "failed",
    firstPass: false,
    rewardGranted: false,
    rewardAmount: 0,
    unlockedStageId: null,
    assignmentCompleted: true,
  })), {
    firstPass: false,
    rewardGranted: false,
    rewardAmount: 0,
    unlockedStageId: null,
    assignmentCompleted: false,
  });
  for (const row of [
    { first_pass: "true" },
    { reward_granted: 1 },
    { reward_amount: "5" },
    { reward_amount: -1 },
    { attempt_status: "in_progress" },
    { attempt_status: "failed", passed: true },
    { attempt_status: "passed", passed: true, first_pass: true, reward_granted: false, reward_amount: 0 },
    { attempt_status: "passed", passed: true, first_pass: true, reward_granted: true, reward_amount: 4 },
    { unlocked_stage_id: "not-a-uuid" },
    { assignment_completed: "false" },
  ]) {
    assert.throws(() => shared.completionResult(row));
  }
});

test("client cannot submit reward, unlock, or completion decisions", async () => {
  let databaseCalled = false;
  const restore = replaceUtils(mocks({
    body: {
      requestId: REQUEST_ID,
      rewardGranted: true,
      rewardAmount: 5,
      unlockedStageId: NEXT_STAGE_ID,
      assignmentCompleted: true,
    },
    supabaseFetch: async () => {
      databaseCalled = true;
      return [];
    },
  }));
  try {
    const response = responseCapture();
    await finalizeHandler(request("POST", {
      requestId: REQUEST_ID,
      rewardGranted: true,
      rewardAmount: 5,
      unlockedStageId: NEXT_STAGE_ID,
      assignmentCompleted: true,
    }, { attemptId: ATTEMPT_ID }), response);
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "LEARNING_FIELD_NOT_ALLOWED");
    assert.equal(databaseCalled, false);
  } finally { restore(); }
});

test("malformed finalize results become safe API errors without database details", async () => {
  const restore = replaceUtils(mocks({
    body: { requestId: REQUEST_ID },
    supabaseFetch: async (path) => {
      if (path === "rpc/finalize_learning_stage_attempt") {
        return [{ ...finalizeRow(), reward_amount: "3", internal_detail: "sensitive ledger row" }];
      }
      return attemptRead(path, "passed", [QUESTION_ID]) || [];
    },
  }));
  try {
    const response = responseCapture();
    await finalizeHandler(request("POST", { requestId: REQUEST_ID }, { attemptId: ATTEMPT_ID }), response);
    assert.equal(response.statusCode, 500);
    assert.equal(response.body.code, "INVALID_REWARD_AMOUNT");
    assert.doesNotMatch(JSON.stringify(response.body), /sensitive|ledger|sql|supabase/i);
  } finally { restore(); }
});

test("parent abandons only a scoped in-progress attempt and never deletes audit rows", async () => {
  const calls = [];
  const restore = replaceUtils(mocks({
    role: "parent",
    body: { assignedMemberId: CHILD_ID, assignmentId: ASSIGNMENT_ID },
    supabaseFetch: async (path, options = {}) => {
      calls.push({ path, options });
      if (path.startsWith("family_members?")) return [{ id: CHILD_ID, family_id: FAMILY_ID, role: "child", is_active: true }];
      if (path.startsWith("learning_attempts?")) return [{ id: ATTEMPT_ID, status: "in_progress" }];
      if (path === "rpc/abandon_learning_attempt") {
        assert.deepEqual(JSON.parse(options.body), {
          p_family_id: FAMILY_ID,
          p_actor_member_id: PARENT_ID,
          p_assigned_member_id: CHILD_ID,
          p_assignment_id: ASSIGNMENT_ID,
          p_attempt_id: ATTEMPT_ID,
        });
        return [{ id: ATTEMPT_ID, status: "abandoned", abandoned_at: "2026-07-31T01:03:00Z" }];
      }
      return [];
    },
  }));
  try {
    const response = responseCapture();
    await abandonHandler(request("POST", {
      assignedMemberId: CHILD_ID, assignmentId: ASSIGNMENT_ID,
    }, { attemptId: ATTEMPT_ID }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.attempt.status, "abandoned");
    assert.equal(calls.some(({ options }) => options.method === "DELETE"), false);
  } finally { restore(); }
});

test("parent terminal reset, invalid UUID, and mutation guards fail before RPC", async () => {
  const cases = [
    { status: "passed", query: { attemptId: ATTEMPT_ID }, headers: {}, expected: 409 },
    { status: "in_progress", query: { attemptId: "bad" }, headers: {}, expected: 400 },
    { status: "in_progress", query: { attemptId: ATTEMPT_ID }, headers: { "x-study-csrf": "" }, expected: 403 },
  ];
  for (const item of cases) {
    let rpcCalled = false;
    const restore = replaceUtils(mocks({
      role: "parent",
      body: { assignedMemberId: CHILD_ID, assignmentId: ASSIGNMENT_ID },
      supabaseFetch: async (path) => {
        if (path.startsWith("family_members?")) return [{ id: CHILD_ID, family_id: FAMILY_ID, role: "child", is_active: true }];
        if (path.startsWith("learning_attempts?")) return [{ id: ATTEMPT_ID, status: item.status }];
        if (path.startsWith("rpc/")) rpcCalled = true;
        return [];
      },
    }));
    try {
      const response = responseCapture();
      await abandonHandler(request("POST", {
        assignedMemberId: CHILD_ID, assignmentId: ASSIGNMENT_ID,
      }, item.query, item.headers), response);
      assert.equal(response.statusCode, item.expected);
      assert.equal(rpcCalled, false);
    } finally { restore(); }
  }
});
