const shared = require("./_shared");
const learning = shared.learning;

module.exports = async function learningAttempt(request, response) {
  if (request.method !== "GET") return learning.allow(response, ["GET"]);
  try {
    const { dto } = await shared.loadAttempt(request);
    return learning.send(response, 200, { ok: true, attempt: dto });
  } catch (error) {
    return learning.attemptError(response, error);
  }
};
