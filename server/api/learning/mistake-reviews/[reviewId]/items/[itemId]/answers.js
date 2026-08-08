const learning = require("../../../../_utils");
const reviews = require("../../../../_mistake-reviews");

module.exports = async function submitMistakeReviewAnswer(request, response) {
  if (request.method !== "POST") return learning.allow(response, ["POST"]);
  try {
    learning.requireMutationGuard(request);
    const body = learning.exactBody(
      await learning.u.readJson(request),
      new Set(["optionId", "requestId"])
    );
    const reviewId = learning.uuid(request.query?.reviewId || "", "INVALID_REVIEW_ID");
    const itemId = learning.uuid(request.query?.itemId || "", "INVALID_REVIEW_ITEM_ID");
    const optionId = learning.uuid(body.optionId, "INVALID_OPTION_ID");
    const requestId = learning.uuid(body.requestId, "INVALID_REQUEST_ID");
    const { claims } = await learning.activeMember(request);
    const rows = await learning.u.supabaseFetch("rpc/submit_learning_mistake_review_answer", {
      method: "POST",
      body: JSON.stringify({
        p_family_id: claims.family,
        p_actor_member_id: claims.sub,
        p_session_id: reviewId,
        p_review_item_id: itemId,
        p_selected_option_id: optionId,
        p_request_id: requestId,
      }),
    });
    const result = rows?.[0] || rows;
    if (!result?.review_answer_id) {
      throw learning.u.err("복습 답안을 저장하지 못했습니다.", 500, "REVIEW_ANSWER_SUBMIT_FAILED");
    }
    return learning.send(response, 200, {
      ok: true,
      feedback: {
        selectedAnswer: result.selected_answer,
        correctAnswer: result.correct_answer,
        explanation: result.explanation,
        isCorrect: result.is_correct === true,
        submittedAt: result.submitted_at,
      },
      review: {
        id: reviewId,
        status: result.session_status,
        answeredCount: Number(result.answered_count),
        totalItems: Number(result.total_items),
        completedAt: result.completed_at || null,
      },
    });
  } catch (error) {
    return reviews.reviewError(response, error);
  }
};
