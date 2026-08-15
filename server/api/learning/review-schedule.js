const learning = require("./_utils");

const SKILL_CODE_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const SNOOZE_DAYS = new Set([1, 3, 7]);

function scheduleRequest(body) {
  const value = learning.exactBody(
    body,
    new Set(["assignedMemberId", "assignmentId", "skillCode", "action", "durationDays", "requestId"])
  );
  const assignmentId = learning.uuid(value.assignmentId, "INVALID_ASSIGNMENT_ID");
  const requestId = learning.uuid(value.requestId, "INVALID_REQUEST_ID");
  if (typeof value.skillCode !== "string" || value.skillCode.length > 100
      || !SKILL_CODE_PATTERN.test(value.skillCode)) {
    throw learning.u.err("복습 일정 개념을 확인해 주세요.", 400, "INVALID_SKILL_CODE");
  }
  if (!new Set(["snooze", "clear"]).has(value.action)) {
    throw learning.u.err("복습 일정 작업을 확인해 주세요.", 400, "INVALID_SCHEDULE_ACTION");
  }
  if (
    (value.action === "snooze" && !SNOOZE_DAYS.has(value.durationDays))
    || (value.action === "clear" && value.durationDays !== undefined)
  ) {
    throw learning.u.err("복습 미루기 기간을 확인해 주세요.", 400, "INVALID_SNOOZE_DURATION");
  }
  return {
    assignedMemberId: value.assignedMemberId,
    assignmentId,
    skillCode: value.skillCode,
    action: value.action,
    durationDays: value.action === "snooze" ? value.durationDays : null,
    requestId,
  };
}

function scheduleError(response, error) {
  if (!error.supabaseCode) return learning.safeError(response, error);
  const message = String(error.supabaseMessage || "");
  if (message.includes("IDEMPOTENCY_CONFLICT")) {
    return learning.send(response, 409, {
      ok: false,
      error: "같은 요청 ID가 다른 복습 일정에 사용되었습니다.",
      code: "IDEMPOTENCY_CONFLICT",
    });
  }
  const mappings = {
    "22004": [400, "INVALID_REVIEW_SCHEDULE", "복습 일정 요청 값을 확인해 주세요."],
    "22023": [400, "INVALID_REVIEW_SCHEDULE", "복습 일정 요청 값을 확인해 주세요."],
    "42501": [403, "LEARNING_ACCESS_DENIED", "복습 일정을 변경할 권한이 없습니다."],
    "55000": [409, "REVIEW_SCHEDULE_CONFLICT", "복습 일정 상태가 변경되었습니다."],
    P0002: [404, "REVIEW_SCHEDULE_NOT_FOUND", "복습 일정 대상을 찾을 수 없습니다."],
  };
  const mapping = mappings[error.supabaseCode];
  if (mapping) return learning.send(response, mapping[0], { ok: false, code: mapping[1], error: mapping[2] });
  console.error("[learning review schedule failed]", { status: 500, code: "DATABASE_ERROR" });
  return learning.send(response, 500, {
    ok: false,
    error: "복습 일정을 변경하지 못했습니다.",
    code: "LEARNING_REVIEW_SCHEDULE_FAILED",
  });
}

module.exports = async function learningReviewSchedule(request, response) {
  if (request.method !== "PUT") return learning.allow(response, ["PUT"]);
  try {
    learning.requireMutationGuard(request);
    const input = scheduleRequest(await learning.u.readJson(request));
    const scope = await learning.parentScope(request, input.assignedMemberId);
    const assignment = (await learning.u.supabaseFetch(
      `learning_assignments?select=id&id=eq.${encodeURIComponent(input.assignmentId)}&family_id=eq.${encodeURIComponent(scope.claims.family)}&assigned_member_id=eq.${encodeURIComponent(scope.assignedMemberId)}&limit=1`
    ))?.[0];
    if (!assignment) throw learning.u.err("복습 일정 대상을 찾을 수 없습니다.", 404, "REVIEW_SCHEDULE_NOT_FOUND");
    const rows = await learning.u.supabaseFetch("rpc/set_learning_review_schedule_override", {
      method: "POST",
      body: JSON.stringify({
        p_family_id: scope.claims.family,
        p_actor_member_id: scope.claims.sub,
        p_assigned_member_id: scope.assignedMemberId,
        p_assignment_id: input.assignmentId,
        p_skill_code: input.skillCode,
        p_action: input.action,
        p_duration_days: input.durationDays,
        p_request_id: input.requestId,
      }),
    });
    const result = rows?.[0] || rows;
    if (!result?.schedule_override_id) {
      throw learning.u.err("변경된 복습 일정을 확인하지 못했습니다.", 500, "REVIEW_SCHEDULE_RESULT_INVALID");
    }
    return learning.send(response, 200, {
      ok: true,
      schedule: {
        assignmentId: String(result.schedule_assignment_id),
        skillCode: result.schedule_skill_code,
        overrideDueAt: result.schedule_override_due_at || null,
        durationDays: result.schedule_duration_days === null ? null : Number(result.schedule_duration_days),
        revision: Number(result.schedule_revision),
        operation: result.schedule_operation,
        changedAt: result.schedule_changed_at,
      },
    });
  } catch (error) {
    return scheduleError(response, error);
  }
};

module.exports.SNOOZE_DAYS = SNOOZE_DAYS;
module.exports.scheduleRequest = scheduleRequest;
