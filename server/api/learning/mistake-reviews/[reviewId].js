const learning = require("../_utils");
const reviews = require("../_mistake-reviews");

module.exports = async function learningMistakeReview(request, response) {
  if (request.method !== "GET") return learning.allow(response, ["GET"]);
  try {
    const { claims, member } = await learning.activeMember(request);
    const reviewId = learning.uuid(request.query?.reviewId || "", "INVALID_REVIEW_ID");
    const review = await reviews.loadReviewForScope({ claims, member }, reviewId);
    return learning.send(response, 200, { ok: true, review });
  } catch (error) {
    return reviews.reviewError(response, error);
  }
};
