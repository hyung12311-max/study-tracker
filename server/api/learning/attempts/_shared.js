const learning = require("../_utils");

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

async function attemptDto(claims, attempt) {
  const answers = await learning.u.supabaseFetch(
    `learning_attempt_answers?select=attempt_question_id&attempt_id=eq.${encodeURIComponent(attempt.id)}`
  ) || [];
  const answeredIds = new Set(answers.map((answer) => String(answer.attempt_question_id)));
  let currentQuestion = null;
  if (attempt.status === "in_progress") {
    const questions = await learning.u.supabaseFetch(
      `learning_attempt_questions?select=id,display_order,prompt_snapshot,options_snapshot&attempt_id=eq.${encodeURIComponent(attempt.id)}&order=display_order.asc`
    ) || [];
    const next = questions.find((question) => !answeredIds.has(String(question.id)));
    if (next) {
      currentQuestion = {
        id: String(next.id),
        order: Number(next.display_order),
        prompt: next.prompt_snapshot,
        options: publicOptions(next.options_snapshot),
      };
    }
  }
  const terminal = attempt.status === "passed" || attempt.status === "failed";
  return {
    id: String(attempt.id),
    status: attempt.status,
    totalQuestions: Number(attempt.total_questions),
    answeredCount: answers.length,
    startedAt: attempt.started_at,
    currentQuestion,
    result: terminal ? {
      correctAnswers: Number(attempt.correct_answers),
      requiredCorrectAnswers: Number(attempt.required_correct_answers),
      passed: attempt.status === "passed",
      finalizedAt: attempt.finalized_at,
    } : null,
  };
}

async function loadAttempt(request) {
  const { claims } = await childScope(request);
  const attemptId = attemptIdFrom(request);
  const attempt = await scopedAttempt(claims, attemptId);
  return { claims, attempt, dto: await attemptDto(claims, attempt) };
}

module.exports = {
  attemptDto,
  attemptIdFrom,
  childScope,
  learning,
  loadAttempt,
  scopedAttempt,
};
