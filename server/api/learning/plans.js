const learning = require("./_utils");

function planResultDto(row) {
  const targets = row?.stage_targets || [];
  return {
    id: String(row.plan_id),
    assignmentId: String(row.assignment_id),
    state: row.plan_state,
    plannedStartDate: row.planned_start_date,
    unitTargetCompletionDate: row.target_completion_date,
    timezone: row.timezone_name,
    currentRevision: Number(row.plan_revision),
    pausedAt: row.paused_at || null,
    stageTargets: targets.map((target) => ({
      stageId: String(target.stage_id),
      displayOrder: Number(target.display_order),
      targetDate: target.target_date,
    })),
  };
}

function planPayload(body) {
  const plannedStartDate = learning.date(body.plannedStartDate, "INVALID_PLAN_START_DATE");
  const unitTargetCompletionDate = learning.date(
    body.unitTargetCompletionDate,
    "INVALID_PLAN_COMPLETION_DATE"
  );
  if (plannedStartDate > unitTargetCompletionDate) {
    throw learning.u.err("학습 계획 날짜 범위를 확인해 주세요.", 400, "INVALID_PLAN_DATE_RANGE");
  }
  return {
    plannedStartDate,
    unitTargetCompletionDate,
    timezone: learning.timezone(body.timezone),
    stageTargets: learning.stageTargets(
      body.stageTargets,
      plannedStartDate,
      unitTargetCompletionDate
    ),
    requestId: learning.uuid(body.requestId, "INVALID_REQUEST_ID"),
  };
}

async function scopedAssignment(claims, assignedMemberId, assignmentId) {
  const row = (await learning.u.supabaseFetch(
    `learning_assignments?select=id,status,completed_at&` +
    `id=eq.${encodeURIComponent(assignmentId)}&family_id=eq.${encodeURIComponent(claims.family)}` +
    `&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}&limit=1`
  ))?.[0];
  if (!row) throw learning.u.err("학습 배정을 찾을 수 없습니다.", 404, "ASSIGNMENT_NOT_FOUND");
  return row;
}

async function scopedPlan(claims, assignedMemberId, planId) {
  const plan = (await learning.u.supabaseFetch(
    `learning_assignment_plans?select=id,assignment_id,family_id,assigned_member_id,content_version_id,` +
    `planned_start_date,target_completion_date,timezone_name,plan_state,paused_at,revision&` +
    `id=eq.${encodeURIComponent(planId)}&family_id=eq.${encodeURIComponent(claims.family)}` +
    `&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}&limit=1`
  ))?.[0];
  if (!plan) throw learning.u.err("학습 계획을 찾을 수 없습니다.", 404, "PLAN_NOT_FOUND");
  return plan;
}

async function listPlanning(request) {
  const url = new URL(request.url || "/api/learning/plans", "http://localhost");
  const { claims, assignedMemberId } = await learning.parentScope(
    request,
    url.searchParams.get("assignedMemberId")
  );
  const assignments = await learning.u.supabaseFetch(
    `learning_assignments?select=id,unit_id,content_version_id,status,assigned_at,completed_at,cancelled_at&` +
    `family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}` +
    `&order=assigned_at.desc`
  ) || [];
  if (!assignments.length) return [];
  const assignmentIds = learning.idList(assignments);
  const plans = await learning.u.supabaseFetch(
    `learning_assignment_plans?select=id,assignment_id,planned_start_date,target_completion_date,timezone_name,` +
    `plan_state,paused_at,revision&assignment_id=in.(${learning.inFilter(assignmentIds)})` +
    `&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}`
  ) || [];
  const planByAssignment = new Map(plans.map((plan) => [String(plan.assignment_id), plan]));
  const planIds = learning.idList(plans);
  const [targets, firstPasses, progress] = await Promise.all([
    planIds.length ? learning.u.supabaseFetch(
      `learning_assignment_stage_targets?select=plan_id,assignment_id,stage_id,display_order,target_date&` +
      `plan_id=in.(${learning.inFilter(planIds)})&order=display_order.asc`
    ) : [],
    learning.u.supabaseFetch(
      `learning_stage_first_passes?select=assignment_id,stage_id,passed_at&assignment_id=in.(${learning.inFilter(assignmentIds)})` +
      `&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}`
    ),
    learning.u.supabaseFetch(
      `learning_stage_progress?select=assignment_id,stage_id,passed_at&assignment_id=in.(${learning.inFilter(assignmentIds)})` +
      `&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}` +
      `&passed_at=not.is.null`
    ),
  ]);
  const firstPassByStage = new Map((firstPasses || []).map(
    (row) => [`${row.assignment_id}:${row.stage_id}`, row.passed_at]
  ));
  const progressByStage = new Map((progress || []).map(
    (row) => [`${row.assignment_id}:${row.stage_id}`, row.passed_at]
  ));

  return assignments.map((assignment) => {
    const plan = planByAssignment.get(String(assignment.id));
    if (!plan) {
      return {
        assignmentId: String(assignment.id),
        unitId: String(assignment.unit_id),
        assignmentStatus: assignment.status,
        unitCompletedAt: assignment.completed_at || null,
        legacyAssignment: true,
        plan: null,
      };
    }
    const stageTargets = (targets || [])
      .filter((target) => String(target.plan_id) === String(plan.id))
      .map((target) => ({
        stageId: String(target.stage_id),
        displayOrder: Number(target.display_order),
        targetDate: target.target_date,
        actualPassedAt: firstPassByStage.get(`${assignment.id}:${target.stage_id}`)
          || progressByStage.get(`${assignment.id}:${target.stage_id}`)
          || null,
      }));
    return {
      assignmentId: String(assignment.id),
      unitId: String(assignment.unit_id),
      assignmentStatus: assignment.status,
      unitCompletedAt: assignment.completed_at || null,
      legacyAssignment: false,
      plan: {
        id: String(plan.id),
        state: plan.plan_state,
        plannedStartDate: plan.planned_start_date,
        unitTargetCompletionDate: plan.target_completion_date,
        timezone: plan.timezone_name,
        currentRevision: Number(plan.revision),
        pausedAt: plan.paused_at || null,
        stageTargets,
      },
    };
  });
}

async function createPlan(request) {
  learning.requireMutationGuard(request);
  const body = learning.exactBody(
    await learning.u.readJson(request),
    new Set([
      "assignedMemberId", "assignmentId", "plannedStartDate", "unitTargetCompletionDate",
      "timezone", "stageTargets", "requestId",
    ])
  );
  const { claims, assignedMemberId } = await learning.parentScope(request, body.assignedMemberId);
  const assignmentId = learning.uuid(body.assignmentId, "INVALID_ASSIGNMENT_ID");
  await scopedAssignment(claims, assignedMemberId, assignmentId);
  const payload = planPayload(body);
  const rows = await learning.u.supabaseFetch("rpc/create_learning_assignment_plan", {
    method: "POST",
    body: JSON.stringify({
      p_family_id: claims.family,
      p_actor_member_id: claims.sub,
      p_assigned_member_id: assignedMemberId,
      p_assignment_id: assignmentId,
      p_planned_start_date: payload.plannedStartDate,
      p_target_completion_date: payload.unitTargetCompletionDate,
      p_timezone_name: payload.timezone,
      p_stage_targets: payload.stageTargets,
      p_request_id: payload.requestId,
    }),
  });
  return planResultDto(rows?.[0] || rows);
}

async function updatePlan(request) {
  learning.requireMutationGuard(request);
  const body = learning.exactBody(
    await learning.u.readJson(request),
    new Set([
      "assignedMemberId", "expectedRevision", "plannedStartDate", "unitTargetCompletionDate",
      "timezone", "stageTargets", "requestId",
    ])
  );
  const { claims, assignedMemberId } = await learning.parentScope(request, body.assignedMemberId);
  const planId = learning.uuid(request.query?.planId || "", "INVALID_PLAN_ID");
  await scopedPlan(claims, assignedMemberId, planId);
  const payload = planPayload(body);
  const rows = await learning.u.supabaseFetch("rpc/update_learning_assignment_plan", {
    method: "POST",
    body: JSON.stringify({
      p_family_id: claims.family,
      p_actor_member_id: claims.sub,
      p_assigned_member_id: assignedMemberId,
      p_plan_id: planId,
      p_expected_revision: learning.revision(body.expectedRevision),
      p_planned_start_date: payload.plannedStartDate,
      p_target_completion_date: payload.unitTargetCompletionDate,
      p_timezone_name: payload.timezone,
      p_stage_targets: payload.stageTargets,
      p_request_id: payload.requestId,
    }),
  });
  return planResultDto(rows?.[0] || rows);
}

async function changeState(request, state) {
  learning.requireMutationGuard(request);
  const body = learning.exactBody(
    await learning.u.readJson(request),
    new Set(["assignedMemberId", "expectedRevision", "requestId"])
  );
  const { claims, assignedMemberId } = await learning.parentScope(request, body.assignedMemberId);
  const planId = learning.uuid(request.query?.planId || "", "INVALID_PLAN_ID");
  await scopedPlan(claims, assignedMemberId, planId);
  const rows = await learning.u.supabaseFetch(
    state === "paused" ? "rpc/pause_learning_assignment_plan" : "rpc/resume_learning_assignment_plan",
    {
      method: "POST",
      body: JSON.stringify({
        p_family_id: claims.family,
        p_actor_member_id: claims.sub,
        p_assigned_member_id: assignedMemberId,
        p_plan_id: planId,
        p_expected_revision: learning.revision(body.expectedRevision),
        p_request_id: learning.uuid(body.requestId, "INVALID_REQUEST_ID"),
      }),
    }
  );
  return planResultDto(rows?.[0] || rows);
}

async function collection(request, response) {
  if (!["GET", "POST"].includes(request.method)) return learning.allow(response, ["GET", "POST"]);
  try {
    if (request.method === "GET") {
      return learning.send(response, 200, { ok: true, planning: await listPlanning(request) });
    }
    return learning.send(response, 201, { ok: true, plan: await createPlan(request) });
  } catch (error) {
    return learning.planningError(response, error);
  }
}

async function item(request, response) {
  if (!["GET", "PUT"].includes(request.method)) return learning.allow(response, ["GET", "PUT"]);
  try {
    if (request.method === "GET") {
      const planId = learning.uuid(request.query?.planId || "", "INVALID_PLAN_ID");
      const rows = await listPlanning(request);
      const result = rows.find((row) => row.plan?.id === planId);
      if (!result) throw learning.u.err("학습 계획을 찾을 수 없습니다.", 404, "PLAN_NOT_FOUND");
      return learning.send(response, 200, { ok: true, planning: result });
    }
    return learning.send(response, 200, { ok: true, plan: await updatePlan(request) });
  } catch (error) {
    return learning.planningError(response, error);
  }
}

function stateHandler(state) {
  return async (request, response) => {
    if (request.method !== "POST") return learning.allow(response, ["POST"]);
    try {
      return learning.send(response, 200, { ok: true, plan: await changeState(request, state) });
    } catch (error) {
      return learning.planningError(response, error);
    }
  };
}

module.exports = collection;
module.exports.item = item;
module.exports.pause = stateHandler("paused");
module.exports.resume = stateHandler("active");
module.exports.listPlanning = listPlanning;
module.exports.planPayload = planPayload;
module.exports.planResultDto = planResultDto;
