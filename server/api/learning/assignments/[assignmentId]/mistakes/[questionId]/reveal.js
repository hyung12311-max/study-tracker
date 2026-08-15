const learning = require("../../../../_utils");

function revealError(response, error) {
  if (error.supabaseCode === "P0002") {
    return learning.send(response, 404, {
      ok: false,
      error: "공개할 오답을 찾을 수 없습니다.",
      code: "MISTAKE_NOT_FOUND",
    });
  }
  if (error.supabaseCode === "55000" && String(error.supabaseMessage || "").includes("IDEMPOTENCY_CONFLICT")) {
    return learning.send(response, 409, {
      ok: false,
      error: "같은 요청 ID가 다른 공개 요청에 사용되었습니다.",
      code: "IDEMPOTENCY_CONFLICT",
    });
  }
  if (!error.supabaseCode) return learning.safeError(response, error);
  console.error("[learning mistake reveal failed]", { status: 500, code: "DATABASE_ERROR" });
  return learning.send(response, 500, {
    ok: false,
    error: "정답과 해설을 불러오지 못했습니다.",
    code: "LEARNING_MISTAKE_REVEAL_FAILED",
  });
}

module.exports = async function revealLearningMistake(request, response) {
  if (request.method !== "POST") return learning.allow(response, ["POST"]);
  try {
    learning.requireMutationGuard(request);
    const assignmentId = learning.uuid(request.query?.assignmentId || "", "INVALID_ASSIGNMENT_ID");
    const questionId = learning.uuid(request.query?.questionId || "", "INVALID_QUESTION_ID");
    const body = learning.exactBody(await learning.u.readJson(request), new Set(["requestId"]));
    const requestId = learning.uuid(body.requestId, "INVALID_REQUEST_ID");
    const { claims, member } = await learning.activeMember(request);
    const childFilter = member.role === "child"
      ? `&assigned_member_id=eq.${encodeURIComponent(claims.sub)}`
      : "";
    const assignment = (await learning.u.supabaseFetch(
      `learning_assignments?select=id,assigned_member_id&id=eq.${encodeURIComponent(assignmentId)}&family_id=eq.${encodeURIComponent(claims.family)}${childFilter}&limit=1`
    ))?.[0];
    if (!assignment) throw learning.u.err("공개할 오답을 찾을 수 없습니다.", 404, "MISTAKE_NOT_FOUND");
    const attempts = await learning.u.supabaseFetch(
      `learning_attempts?select=id&assignment_id=eq.${encodeURIComponent(assignmentId)}&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignment.assigned_member_id)}&status=in.(passed,failed)`
    ) || [];
    const attemptIds = learning.idList(attempts);
    if (!attemptIds.length) throw learning.u.err("공개할 오답을 찾을 수 없습니다.", 404, "MISTAKE_NOT_FOUND");
    const question = (await learning.u.supabaseFetch(
      `learning_attempt_questions?select=id,attempt_id&id=eq.${encodeURIComponent(questionId)}&attempt_id=in.(${learning.inFilter(attemptIds)})&limit=1`
    ))?.[0];
    if (!question) throw learning.u.err("공개할 오답을 찾을 수 없습니다.", 404, "MISTAKE_NOT_FOUND");
    const rows = await learning.u.supabaseFetch("rpc/reveal_learning_mistake_solution", {
      method: "POST",
      body: JSON.stringify({
        p_family_id: claims.family,
        p_actor_member_id: claims.sub,
        p_assignment_id: assignmentId,
        p_attempt_question_id: questionId,
        p_request_id: requestId,
      }),
    });
    const result = rows?.[0] || rows;
    if (!result || typeof result.correct_answer !== "string" || typeof result.explanation !== "string") {
      throw learning.u.err("정답 공개 결과를 확인하지 못했습니다.", 500, "REVEAL_RESULT_MISSING");
    }
    return learning.send(response, 200, {
      ok: true,
      solution: {
        correctAnswer: result.correct_answer,
        explanation: result.explanation,
        reviewStatus: "reviewed",
        revealedAt: result.revealed_at || null,
      },
    });
  } catch (error) {
    return revealError(response, error);
  }
};
