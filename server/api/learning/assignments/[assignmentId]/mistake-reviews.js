const learning = require("../../_utils");
const reviews = require("../../_mistake-reviews");

module.exports = async function startLearningMistakeReview(request, response) {
  if (request.method !== "POST") return learning.allow(response, ["POST"]);
  try {
    learning.requireMutationGuard(request);
    const assignmentId = learning.uuid(request.query?.assignmentId || "", "INVALID_ASSIGNMENT_ID");
    const body = learning.exactBody(
      await learning.u.readJson(request),
      new Set(["assignedMemberId", "status", "stageId", "skillCode", "requestId"])
    );
    const filters = reviews.reviewFilters(body);
    const requestId = learning.uuid(body.requestId, "INVALID_REQUEST_ID");
    const scope = await reviews.reviewScope(request, body.assignedMemberId);
    const rows = await learning.u.supabaseFetch("rpc/start_learning_mistake_review", {
      method: "POST",
      body: JSON.stringify({
        p_family_id: scope.claims.family,
        p_actor_member_id: scope.claims.sub,
        p_assigned_member_id: scope.assignedMemberId,
        p_assignment_id: assignmentId,
        p_status_filter: filters.status,
        p_stage_id: filters.stageId,
        p_skill_code: filters.skillCode,
        p_request_id: requestId,
      }),
    });
    const reviewId = String((rows?.[0] || rows)?.review_session_id || "");
    if (!reviewId) {
      throw learning.u.err("생성된 오답 복습을 확인하지 못했습니다.", 500, "REVIEW_CREATE_FAILED");
    }
    const review = await reviews.loadReviewForScope(scope, reviewId);
    return learning.send(response, 201, { ok: true, review });
  } catch (error) {
    return reviews.reviewError(response, error);
  }
};
