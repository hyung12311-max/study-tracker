const shared = require("../../../../attempts/_shared");
const learning = shared.learning;

async function start(request) {
  learning.requireMutationGuard(request);
  const body = learning.exactBody(
    await learning.u.readJson(request),
    new Set(["requestId"])
  );
  const { claims } = await shared.childScope(request);
  const assignmentId = learning.uuid(request.query?.assignmentId || "", "INVALID_ASSIGNMENT_ID");
  const stageId = learning.uuid(request.query?.stageId || "", "INVALID_STAGE_ID");
  const requestId = learning.uuid(body.requestId, "INVALID_REQUEST_ID");
  const assignment = (await learning.u.supabaseFetch(
    `learning_assignments?select=id,content_version_id,status&id=eq.${encodeURIComponent(assignmentId)}&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(claims.sub)}&status=eq.active&limit=1`
  ))?.[0];
  if (!assignment) throw learning.u.err("문제풀이 배정을 찾을 수 없습니다.", 404, "LEARNING_NOT_FOUND");
  const stage = (await learning.u.supabaseFetch(
    `learning_stages?select=id&id=eq.${encodeURIComponent(stageId)}&content_version_id=eq.${encodeURIComponent(assignment.content_version_id)}&limit=1`
  ))?.[0];
  if (!stage) throw learning.u.err("문제풀이 단계를 찾을 수 없습니다.", 404, "LEARNING_NOT_FOUND");
  const progress = (await learning.u.supabaseFetch(
    `learning_stage_progress?select=status&assignment_id=eq.${encodeURIComponent(assignmentId)}&stage_id=eq.${encodeURIComponent(stageId)}&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(claims.sub)}&limit=1`
  ))?.[0];
  if (!progress) throw learning.u.err("문제풀이 단계를 찾을 수 없습니다.", 404, "LEARNING_NOT_FOUND");
  if (progress.status !== "unlocked") {
    throw learning.u.err("아직 시작할 수 없는 단계입니다.", 409, "STAGE_NOT_UNLOCKED");
  }
  const rows = await learning.u.supabaseFetch("rpc/start_or_resume_learning_attempt", {
    method: "POST",
    body: JSON.stringify({
      p_family_id: claims.family,
      p_actor_member_id: claims.sub,
      p_assigned_member_id: claims.sub,
      p_assignment_id: assignmentId,
      p_stage_id: stageId,
      p_start_request_id: requestId,
    }),
  });
  const result = rows?.[0] || rows;
  const attemptId = String(result?.attempt_id || "");
  if (!attemptId) throw learning.u.err("응시를 시작하지 못했습니다.", 500, "ATTEMPT_START_FAILED");
  const attempt = await shared.scopedAttempt(claims, attemptId);
  return shared.attemptDto(claims, attempt);
}

module.exports = async function startLearningAttempt(request, response) {
  if (request.method !== "POST") return learning.allow(response, ["POST"]);
  try {
    return learning.send(response, 200, { ok: true, attempt: await start(request) });
  } catch (error) {
    return learning.attemptError(response, error, "ATTEMPT_START_CONFLICT");
  }
};
