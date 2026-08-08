const analysis = require("./_analysis");
const learning = require("./_utils");

module.exports = async function learningScores(request, response) {
  if (request.method !== "GET") return learning.allow(response, ["GET"]);
  try {
    const data = await analysis.load(request);
    return learning.send(response, 200, {
      ok: true,
      assignedMemberId: data.assignedMemberId,
      scores: analysis.scoreSummaries(data),
    });
  } catch (error) {
    return analysis.sendError(response, error);
  }
};
