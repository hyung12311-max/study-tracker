const learning = require("./_utils");
const recommendation = require("./_recommendations");

module.exports = async function learningRecommendations(request, response) {
  if (request.method !== "GET") return learning.allow(response, ["GET"]);
  try {
    const result = await recommendation.load(request);
    return learning.send(response, 200, {
      ok: true,
      policy: recommendation.RECOMMENDATION_POLICY,
      state: result.state,
      recommendations: result.recommendations,
    });
  } catch (error) {
    if (!error.supabaseCode) return learning.safeError(response, error);
    console.error("[learning recommendations failed]", { status: 500, code: "DATABASE_ERROR" });
    return learning.send(response, 500, {
      ok: false,
      error: "보완 학습 추천을 불러오지 못했습니다.",
      code: "LEARNING_RECOMMENDATIONS_FAILED",
    });
  }
};
