const learning = require("../../_utils");

function assignmentIdFrom(request) {
  const queryValue = request.query?.assignmentId;
  if (typeof queryValue === "string") return queryValue;
  const url = new URL(request.url || "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  return parts.at(-2) || "";
}

async function cancel(request) {
  learning.requireMutationGuard(request);
  const body = learning.exactBody(
    await learning.u.readJson(request),
    new Set(["assignedMemberId"])
  );
  const { claims, assignedMemberId } = await learning.parentScope(request, body.assignedMemberId);
  const assignmentId = learning.uuid(assignmentIdFrom(request), "INVALID_ASSIGNMENT_ID");
  const existing = (await learning.u.supabaseFetch(
    `learning_assignments?select=id,status&id=eq.${encodeURIComponent(assignmentId)}&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}&limit=1`
  ))?.[0];
  if (!existing) {
    throw learning.u.err("문제풀이 학습 배정을 찾을 수 없습니다.", 404, "LEARNING_NOT_FOUND");
  }
  if (existing.status !== "active") {
    throw learning.u.err("활성 배정만 취소할 수 있습니다.", 409, "ASSIGNMENT_NOT_ACTIVE");
  }
  const cancelled = await learning.u.supabaseFetch("rpc/cancel_learning_assignment", {
    method: "POST",
    body: JSON.stringify({
      p_family_id: claims.family,
      p_actor_member_id: claims.sub,
      p_assigned_member_id: assignedMemberId,
      p_assignment_id: assignmentId,
    }),
  });
  const row = cancelled?.[0] || cancelled;
  return {
    id: assignmentId,
    status: row?.status || "cancelled",
    cancelledAt: row?.cancelled_at || null,
  };
}

module.exports = async function cancelLearningAssignment(request, response) {
  if (request.method !== "POST") return learning.u.allow(response, ["POST"]);
  try {
    return learning.send(response, 200, { ok: true, assignment: await cancel(request) });
  } catch (error) {
    return learning.safeError(response, error);
  }
};
