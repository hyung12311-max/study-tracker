const learning = require("./_utils");
const reviewQueue = require("./_review-queue");

module.exports = async function learningReviewQueue(request, response) {
  if (request.method !== "GET") return learning.allow(response, ["GET"]);
  try {
    const data = await reviewQueue.load(request);
    const generatedAt = new Date().toISOString();
    const queue = reviewQueue.buildReviewQueue(data, generatedAt);
    return learning.send(response, 200, {
      ok: true,
      assignedMemberId: data.scope.assignedMemberId,
      viewerRole: data.scope.viewerRole,
      generatedAt,
      policy: reviewQueue.REVIEW_QUEUE_POLICY,
      state: queue.length ? "ready" : "empty",
      queue,
    });
  } catch (error) {
    if (!error.supabaseCode) return learning.safeError(response, error);
    console.error("[learning review queue failed]", { status: 500, code: "DATABASE_ERROR" });
    return learning.send(response, 500, {
      ok: false,
      error: "반복 복습 순서를 불러오지 못했습니다.",
      code: "LEARNING_REVIEW_QUEUE_FAILED",
    });
  }
};
