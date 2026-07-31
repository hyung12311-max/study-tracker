const shared = require("../_shared");
const learning = shared.learning;

async function finalize(request) {
  learning.requireMutationGuard(request);
  const body = learning.exactBody(
    await learning.u.readJson(request),
    new Set(["requestId"])
  );
  const { claims } = await shared.childScope(request);
  const attemptId = shared.attemptIdFrom(request);
  const requestId = learning.uuid(body.requestId, "INVALID_REQUEST_ID");
  await shared.scopedAttempt(claims, attemptId);
  await learning.u.supabaseFetch("rpc/finalize_learning_stage_attempt", {
    method: "POST",
    body: JSON.stringify({
      p_actor_member_id: claims.sub,
      p_attempt_id: attemptId,
      p_request_id: requestId,
    }),
  });
  const attempt = await shared.scopedAttempt(claims, attemptId);
  return shared.attemptDto(claims, attempt);
}

module.exports = async function finalizeLearningAttempt(request, response) {
  if (request.method !== "POST") return learning.allow(response, ["POST"]);
  try {
    return learning.send(response, 200, { ok: true, attempt: await finalize(request) });
  } catch (error) {
    return learning.attemptError(response, error, "ATTEMPT_INCOMPLETE");
  }
};
