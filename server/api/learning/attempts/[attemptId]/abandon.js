const shared = require("../_shared");
const learning = shared.learning;

async function abandon(request) {
  learning.requireMutationGuard(request);
  const body = learning.exactBody(
    await learning.u.readJson(request),
    new Set(["assignedMemberId", "assignmentId"])
  );
  const { claims, assignedMemberId } = await learning.parentScope(request, body.assignedMemberId);
  const attemptId = shared.attemptIdFrom(request);
  const assignmentId = learning.uuid(body.assignmentId, "INVALID_ASSIGNMENT_ID");
  const existing = (await learning.u.supabaseFetch(
    `learning_attempts?select=id,status&id=eq.${encodeURIComponent(attemptId)}&assignment_id=eq.${encodeURIComponent(assignmentId)}&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}&limit=1`
  ))?.[0];
  if (!existing) throw learning.u.err("진행 중인 응시를 찾을 수 없습니다.", 404, "LEARNING_NOT_FOUND");
  if (existing.status !== "in_progress") {
    throw learning.u.err("진행 중인 응시만 초기화할 수 있습니다.", 409, "ATTEMPT_NOT_IN_PROGRESS");
  }
  const rows = await learning.u.supabaseFetch("rpc/abandon_learning_attempt", {
    method: "POST",
    body: JSON.stringify({
      p_family_id: claims.family,
      p_actor_member_id: claims.sub,
      p_assigned_member_id: assignedMemberId,
      p_assignment_id: assignmentId,
      p_attempt_id: attemptId,
    }),
  });
  const row = rows?.[0] || rows;
  return { id: attemptId, status: row?.status || "abandoned", abandonedAt: row?.abandoned_at || null };
}

module.exports = async function abandonLearningAttempt(request, response) {
  if (request.method !== "POST") return learning.allow(response, ["POST"]);
  try {
    return learning.send(response, 200, { ok: true, attempt: await abandon(request) });
  } catch (error) {
    return learning.attemptError(response, error, "ATTEMPT_NOT_IN_PROGRESS");
  }
};
