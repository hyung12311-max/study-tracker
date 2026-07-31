const shared = require("../_shared");
const learning = shared.learning;

async function answer(request) {
  learning.requireMutationGuard(request);
  const body = learning.exactBody(
    await learning.u.readJson(request),
    new Set(["questionId", "optionId", "requestId"])
  );
  const { claims } = await shared.childScope(request);
  const attemptId = shared.attemptIdFrom(request);
  const questionId = learning.uuid(body.questionId, "INVALID_QUESTION_ID");
  const optionId = learning.uuid(body.optionId, "INVALID_OPTION_ID");
  const requestId = learning.uuid(body.requestId, "INVALID_REQUEST_ID");
  await shared.scopedAttempt(claims, attemptId);
  const rows = await learning.u.supabaseFetch("rpc/submit_learning_attempt_answer", {
    method: "POST",
    body: JSON.stringify({
      p_actor_member_id: claims.sub,
      p_attempt_id: attemptId,
      p_attempt_question_id: questionId,
      p_selected_option_id: optionId,
      p_client_request_id: requestId,
    }),
  });
  const result = rows?.[0] || rows;
  if (!result?.answer_id) throw learning.u.err("답안을 저장하지 못했습니다.", 500, "ANSWER_SUBMIT_FAILED");
  const complete = result.is_complete === true;
  const completion = complete
    ? await shared.finalizeResult(claims, attemptId, requestId)
    : null;
  const attempt = await shared.scopedAttempt(claims, attemptId);
  return {
    feedback: {
      isCorrect: result.is_correct === true,
      selectedOptionId: optionId,
      correctOptionText: result.correct_option_text,
      explanation: result.explanation,
      submittedAt: result.submitted_at,
      answeredCount: Number(result.answered_count),
      totalQuestions: Number(result.total_questions),
      hasRemaining: !complete,
    },
    attempt: complete ? await shared.attemptDto(claims, attempt, completion) : {
      id: attemptId,
      status: result.attempt_status,
      totalQuestions: Number(result.total_questions),
      answeredCount: Number(result.answered_count),
      currentQuestion: null,
      result: null,
    },
  };
}

module.exports = async function submitLearningAnswer(request, response) {
  if (request.method !== "POST") return learning.allow(response, ["POST"]);
  try {
    return learning.send(response, 200, { ok: true, ...(await answer(request)) });
  } catch (error) {
    return learning.attemptError(response, error, "ANSWER_STATE_CONFLICT");
  }
};
