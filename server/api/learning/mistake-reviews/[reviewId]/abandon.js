const learning = require("../../_utils");
const reviews = require("../../_mistake-reviews");

module.exports = async function abandonMistakeReview(request, response) {
  if (request.method !== "POST") return learning.allow(response, ["POST"]);
  try {
    learning.requireMutationGuard(request);
    const body = learning.exactBody(await learning.u.readJson(request), new Set(["requestId"]));
    const reviewId = learning.uuid(request.query?.reviewId || "", "INVALID_REVIEW_ID");
    const requestId = learning.uuid(body.requestId, "INVALID_REQUEST_ID");
    const { claims } = await learning.activeMember(request);
    const rows = await learning.u.supabaseFetch("rpc/abandon_learning_mistake_review", {
      method: "POST",
      body: JSON.stringify({
        p_family_id: claims.family,
        p_actor_member_id: claims.sub,
        p_session_id: reviewId,
        p_request_id: requestId,
      }),
    });
    const result = rows?.[0] || rows;
    if (!result?.review_session_id) {
      throw learning.u.err("복습을 중단하지 못했습니다.", 500, "REVIEW_ABANDON_FAILED");
    }
    return learning.send(response, 200, {
      ok: true,
      review: {
        id: reviewId,
        status: result.session_status,
        answeredCount: Number(result.answered_count),
        totalItems: Number(result.total_items),
        abandonedAt: result.abandoned_at || null,
      },
    });
  } catch (error) {
    return reviews.reviewError(response, error);
  }
};
