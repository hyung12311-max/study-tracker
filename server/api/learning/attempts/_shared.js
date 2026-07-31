const { randomUUID } = require("node:crypto");
const learning = require("../_utils");

const EMPTY_COMPLETION = Object.freeze({
  firstPass: false,
  rewardGranted: false,
  rewardAmount: 0,
  unlockedStageId: null,
  assignmentCompleted: false,
});

function attemptIdFrom(request) {
  return learning.uuid(request.query?.attemptId || "", "INVALID_ATTEMPT_ID");
}

async function childScope(request) {
  return learning.activeMember(request, "child");
}

async function scopedAttempt(claims, attemptId) {
  const row = (await learning.u.supabaseFetch(
    `learning_attempts?select=id,assignment_id,stage_id,status,total_questions,correct_answers,required_correct_answers,started_at,finalized_at,abandoned_at&id=eq.${encodeURIComponent(attemptId)}&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(claims.sub)}&limit=1`
  ))?.[0];
  if (!row) {
    throw learning.u.err("문제풀이 응시를 찾을 수 없습니다.", 404, "LEARNING_NOT_FOUND");
  }
  return row;
}

function publicOptions(snapshot) {
  return Array.isArray(snapshot) ? snapshot.map((option) => ({
    id: String(option.id),
    order: Number(option.displayOrder),
    text: String(option.text || ""),
  })) : [];
}

function booleanResult(value, fallback, field) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") {
    throw learning.u.err("Learning result is invalid.", 500, `INVALID_${field}`);
  }
  return value;
}

function completionResult(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw learning.u.err("Learning result is unavailable.", 500, "FINALIZE_RESULT_MISSING");
  }
  const firstPass = booleanResult(row.first_pass, false, "FIRST_PASS");
  const rewardGranted = booleanResult(row.reward_granted, false, "REWARD_GRANTED");
  const assignmentCompleted = booleanResult(row.assignment_completed, false, "ASSIGNMENT_COMPLETED");
  const passed = booleanResult(row.passed, row.attempt_status === "passed", "PASSED");
  if (row.attempt_status !== undefined && !["passed", "failed"].includes(row.attempt_status)) {
    throw learning.u.err("Learning result status is invalid.", 500, "INVALID_ATTEMPT_STATUS");
  }
  if ((row.attempt_status === "passed") !== passed && row.attempt_status !== undefined) {
    throw learning.u.err("Learning result status is inconsistent.", 500, "FINALIZE_RESULT_INCONSISTENT");
  }
  const rawAmount = row.reward_amount ?? 0;
  const rewardAmount = typeof rawAmount === "number" ? rawAmount : Number.NaN;
  if (!Number.isSafeInteger(rewardAmount) || rewardAmount < 0) {
    throw learning.u.err("Learning reward result is invalid.", 500, "INVALID_REWARD_AMOUNT");
  }
  const unlockedStageId = row.unlocked_stage_id == null
    ? null
    : learning.uuid(row.unlocked_stage_id, "INVALID_UNLOCKED_STAGE_ID");
  if (!passed) return { ...EMPTY_COMPLETION };
  if (firstPass !== rewardGranted) {
    throw learning.u.err("Learning reward result is inconsistent.", 500, "REWARD_RESULT_INCONSISTENT");
  }
  if (rewardGranted ? ![1, 2, 3, 5].includes(rewardAmount) : rewardAmount !== 0) {
    throw learning.u.err("Learning reward result is inconsistent.", 500, "REWARD_RESULT_INCONSISTENT");
  }
  return {
    firstPass,
    rewardGranted,
    rewardAmount,
    unlockedStageId,
    assignmentCompleted,
  };
}

async function finalizeResult(claims, attemptId, requestId = randomUUID()) {
  const rows = await learning.u.supabaseFetch("rpc/finalize_learning_stage_attempt", {
    method: "POST",
    body: JSON.stringify({
      p_actor_member_id: claims.sub,
      p_attempt_id: attemptId,
      p_request_id: requestId,
    }),
  });
  const row = rows?.[0] || rows;
  if (String(row?.attempt_id || "") !== String(attemptId)) {
    throw learning.u.err("Learning result is unavailable.", 500, "FINALIZE_RESULT_MISMATCH");
  }
  return completionResult(row);
}

async function attemptDto(claims, attempt, completion = EMPTY_COMPLETION) {
  const answers = await learning.u.supabaseFetch(
    `learning_attempt_answers?select=attempt_question_id,selected_option_id,is_correct,submitted_at&attempt_id=eq.${encodeURIComponent(attempt.id)}`
  ) || [];
  const answerByQuestion = new Map(answers.map((answer) => [String(answer.attempt_question_id), answer]));
  const questionRows = await learning.u.supabaseFetch(
    `learning_attempt_questions?select=id,display_order,prompt_snapshot,explanation_snapshot,options_snapshot,correct_option_id&attempt_id=eq.${encodeURIComponent(attempt.id)}&order=display_order.asc`
  ) || [];
  const questions = questionRows.map((question) => {
    const answer = answerByQuestion.get(String(question.id));
    const options = publicOptions(question.options_snapshot);
    const dto = {
      id: String(question.id),
      order: Number(question.display_order),
      prompt: question.prompt_snapshot,
      options,
      answer: null,
    };
    if (answer) {
      dto.answer = {
        selectedOptionId: String(answer.selected_option_id),
        isCorrect: answer.is_correct === true,
        correctOptionText: options.find((option) => option.id === String(question.correct_option_id))?.text || "",
        explanation: question.explanation_snapshot,
        submittedAt: answer.submitted_at,
      };
    }
    return dto;
  });
  const terminal = attempt.status === "passed" || attempt.status === "failed";
  return {
    id: String(attempt.id),
    status: attempt.status,
    totalQuestions: Number(attempt.total_questions),
    answeredCount: answers.length,
    startedAt: attempt.started_at,
    questions,
    result: terminal ? {
      correctAnswers: Number(attempt.correct_answers),
      requiredCorrectAnswers: Number(attempt.required_correct_answers),
      passed: attempt.status === "passed",
      finalizedAt: attempt.finalized_at,
      ...completion,
    } : null,
  };
}

async function loadAttempt(request) {
  const { claims } = await childScope(request);
  const attemptId = attemptIdFrom(request);
  const attempt = await scopedAttempt(claims, attemptId);
  const terminal = attempt.status === "passed" || attempt.status === "failed";
  const completion = terminal ? await finalizeResult(claims, attemptId) : EMPTY_COMPLETION;
  return { claims, attempt, dto: await attemptDto(claims, attempt, completion) };
}

module.exports = {
  attemptDto,
  attemptIdFrom,
  childScope,
  completionResult,
  finalizeResult,
  learning,
  loadAttempt,
  scopedAttempt,
};
