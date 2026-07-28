const u = require("../rewards/_utils");

const PLAN_SELECT = [
  "id",
  "subject",
  "workbook",
  "chapter",
  "lesson",
  "study_date",
  "day_label",
  "content",
  "goal",
  "status",
  "book_plan_id",
  "reading_plan_id",
  "sequence_no",
  "start_page",
  "end_page",
  "task_type",
  "note",
  "study_weekdays",
  "family_id",
  "assigned_member_id",
  "created_by_member_id",
].join(",");

const INPUT_FIELDS = Object.freeze({
  subject: "subject",
  book: "workbook",
  unit: "chapter",
  lessonNo: "lesson",
  studyDate: "study_date",
  dayNo: "day_label",
  content: "content",
  target: "goal",
  status: "status",
});
const REQUIRED_CREATE_FIELDS = Object.freeze(Object.keys(INPUT_FIELDS));
const ALLOWED_STATUS = new Set(["planned", "done", "late", "예정", "완료", "지연"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BIGINT_PATTERN = /^(?:[1-9]\d{0,18})$/;

function planForClient(row) {
  return row ? { ...row, id: String(row.id) } : row;
}

function requestBody(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw u.err("학습계획 요청 형식이 올바르지 않습니다.", 400, "INVALID_PLAN_REQUEST");
  }
  return value;
}

function rejectUnknownFields(body, allowed) {
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));
  if (unknown.length) throw u.err("허용되지 않은 학습계획 입력이 있습니다.", 400, "PLAN_FIELD_NOT_ALLOWED");
}

function planId(value) {
  const text = String(value ?? "");
  if (!BIGINT_PATTERN.test(text) || BigInt(text) > 9223372036854775807n) {
    throw u.err("학습계획 ID가 올바르지 않습니다.", 400, "INVALID_PLAN_ID");
  }
  return text;
}

function memberId(value) {
  const text = String(value || "");
  if (!UUID_PATTERN.test(text)) throw u.err("담당 자녀를 확인해 주세요.", 400, "INVALID_ASSIGNED_MEMBER");
  return text;
}

function planChanges(body, { requireAll = false } = {}) {
  const result = {};
  for (const [clientKey, databaseKey] of Object.entries(INPUT_FIELDS)) {
    if (!(clientKey in body)) continue;
    const value = body[clientKey];
    if (typeof value !== "string") throw u.err("학습계획 입력 형식이 올바르지 않습니다.", 400, "INVALID_PLAN_INPUT");
    const normalized = value.trim();
    if (!normalized) throw u.err("학습계획의 필수 내용을 입력해 주세요.", 400, "PLAN_FIELD_REQUIRED");
    if (clientKey === "studyDate" && !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      throw u.err("학습일자를 확인해 주세요.", 400, "INVALID_STUDY_DATE");
    }
    if (clientKey === "status" && !ALLOWED_STATUS.has(normalized)) {
      throw u.err("학습계획 상태를 확인해 주세요.", 400, "INVALID_PLAN_STATUS");
    }
    if (normalized.length > (clientKey === "content" ? 5000 : 1000)) {
      throw u.err("학습계획 입력이 너무 깁니다.", 400, "PLAN_FIELD_TOO_LONG");
    }
    result[databaseKey] = normalized;
  }
  if (requireAll) {
    const missing = REQUIRED_CREATE_FIELDS.filter((key) => !(INPUT_FIELDS[key] in result));
    if (missing.length) throw u.err("학습계획의 필수 내용을 입력해 주세요.", 400, "PLAN_FIELD_REQUIRED");
  }
  return result;
}

async function requireActiveMember(request, role) {
  const claims = u.authenticate(request, role);
  const member = await u.memberInFamily(claims.sub, claims.family);
  if (!member || member.is_active === false || (role && member.role !== role)) {
    throw u.err(role === "parent" ? "활성 부모 권한이 필요합니다." : "활성 가족 구성원 인증이 필요합니다.", 403, "ACTIVE_MEMBER_REQUIRED");
  }
  return { claims, member };
}

async function requireActiveChild(assignedMemberId, familyId) {
  const child = (await u.supabaseFetch(
    `family_members?select=id&family_id=eq.${encodeURIComponent(familyId)}&id=eq.${encodeURIComponent(assignedMemberId)}&role=eq.child&is_active=eq.true&limit=1`
  ))?.[0];
  if (!child) throw u.err("담당 자녀를 지정할 수 없습니다.", 403, "ASSIGNED_MEMBER_NOT_ALLOWED");
  return child.id;
}

async function ownedPlans(ids, familyId, assignedMemberId) {
  const filter = ids.length === 1 ? `id=eq.${ids[0]}` : `id=in.(${ids.join(",")})`;
  return await u.supabaseFetch(
    `study_plans?select=${PLAN_SELECT}&${filter}&family_id=eq.${encodeURIComponent(familyId)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}`
  ) || [];
}

async function createPlan(request) {
  const { claims } = await requireActiveMember(request, "parent");
  const body = requestBody(await u.readJson(request));
  rejectUnknownFields(body, new Set(["assignedMemberId", ...Object.keys(INPUT_FIELDS)]));
  const assignedMemberId = memberId(body.assignedMemberId);
  await requireActiveChild(assignedMemberId, claims.family);
  const rows = await u.supabaseFetch("study_plans", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      ...planChanges(body, { requireAll: true }),
      family_id: claims.family,
      assigned_member_id: assignedMemberId,
      created_by_member_id: claims.sub,
    }),
  });
  if (!rows?.[0]) throw u.err("학습계획을 저장하지 못했습니다.", 500, "PLAN_CREATE_FAILED");
  return planForClient(rows[0]);
}

async function updatePlan(request) {
  const { claims } = await requireActiveMember(request, "parent");
  const body = requestBody(await u.readJson(request));
  const bulk = Array.isArray(body.ids);
  rejectUnknownFields(body, bulk
    ? new Set(["ids", "status", "assignedMemberId"])
    : new Set(["id", "assignedMemberId", ...Object.keys(INPUT_FIELDS)]));
  const assignedMemberId = memberId(body.assignedMemberId);
  await requireActiveChild(assignedMemberId, claims.family);

  if (bulk) {
    if (body.status !== "지연" || !body.ids.length || body.ids.length > 500) {
      throw u.err("지연 처리 요청이 올바르지 않습니다.", 400, "INVALID_LATE_UPDATE");
    }
    const ids = [...new Set(body.ids.map(planId))];
    const existing = await ownedPlans(ids, claims.family, assignedMemberId);
    if (existing.length !== ids.length) throw u.err("학습계획을 찾을 수 없습니다.", 404, "PLAN_NOT_FOUND");
    const rows = await u.supabaseFetch(
      `study_plans?id=in.(${ids.join(",")})&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "지연" }),
      }
    );
    if ((rows || []).length !== ids.length) {
      throw u.err("학습계획이 변경되어 다시 확인해야 합니다.", 409, "PLAN_MUTATION_STALE");
    }
    return (rows || []).map(planForClient);
  }

  const id = planId(body.id);
  const existing = await ownedPlans([id], claims.family, assignedMemberId);
  if (existing.length !== 1) throw u.err("학습계획을 찾을 수 없습니다.", 404, "PLAN_NOT_FOUND");
  const changes = planChanges(body);
  if (!Object.keys(changes).length) throw u.err("수정할 학습계획 내용이 없습니다.", 400, "EMPTY_PLAN_PATCH");
  const rows = await u.supabaseFetch(
    `study_plans?id=eq.${id}&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(changes),
    }
  );
  if (!rows?.[0]) throw u.err("학습계획을 찾을 수 없습니다.", 404, "PLAN_NOT_FOUND");
  return planForClient(rows[0]);
}

async function deletePlan(request) {
  const { claims } = await requireActiveMember(request, "parent");
  const body = requestBody(await u.readJson(request));
  rejectUnknownFields(body, new Set(["id", "assignedMemberId"]));
  const id = planId(body.id);
  const assignedMemberId = memberId(body.assignedMemberId);
  await requireActiveChild(assignedMemberId, claims.family);
  const existing = await ownedPlans([id], claims.family, assignedMemberId);
  if (existing.length !== 1) throw u.err("학습계획을 찾을 수 없습니다.", 404, "PLAN_NOT_FOUND");
  const rows = await u.supabaseFetch(
    `study_plans?id=eq.${id}&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}`,
    { method: "DELETE", headers: { Prefer: "return=representation" } }
  );
  if (!rows?.[0]) throw u.err("학습계획을 찾을 수 없습니다.", 404, "PLAN_NOT_FOUND");
  return id;
}

async function listPlans(request) {
  const { claims, member } = await requireActiveMember(request);
  const url = new URL(request.url || "/api/study/plans", "http://localhost");
  let assignedMemberId = url.searchParams.get("assignedMemberId");
  if (member.role === "child") {
    if (assignedMemberId) {
      throw u.err("자녀는 조회 대상을 변경할 수 없습니다.", 403, "CHILD_ASSIGNEE_OVERRIDE_NOT_ALLOWED");
    }
    assignedMemberId = claims.sub;
  } else {
    if (!assignedMemberId) {
      throw u.err("조회할 담당 자녀를 선택해 주세요.", 400, "ASSIGNED_MEMBER_REQUIRED");
    }
    assignedMemberId = memberId(assignedMemberId);
    await requireActiveChild(assignedMemberId, claims.family);
  }
  const through = url.searchParams.get("through");
  const excludeCompleted = url.searchParams.get("excludeCompleted");
  if (through && !/^\d{4}-\d{2}-\d{2}$/.test(through)) {
    throw u.err("조회 날짜 범위가 올바르지 않습니다.", 400, "INVALID_PLAN_DATE_RANGE");
  }
  if (excludeCompleted && excludeCompleted !== "true") {
    throw u.err("완료 제외 조건이 올바르지 않습니다.", 400, "INVALID_PLAN_STATUS_FILTER");
  }
  const dateFilter = through ? `&study_date=lte.${encodeURIComponent(through)}` : "";
  const statusFilter = excludeCompleted === "true" ? "&status=not.in.(%EC%99%84%EB%A3%8C,done)" : "";
  const rows = await u.supabaseFetch(
    `study_plans?select=${PLAN_SELECT}&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}${dateFilter}${statusFilter}&order=study_date.asc`
  ) || [];
  return rows.map(planForClient);
}

function errorResponse(response, error) {
  const isPublic = Boolean(error.statusCode && !error.supabaseCode);
  console.error("[study plans API failed]", {
    status: error.statusCode || 500,
    code: error.supabaseCode || error.code || null,
  });
  return u.json(response, isPublic ? error.statusCode : 500, {
    ok: false,
    error: isPublic ? error.message : "학습계획 요청을 처리하지 못했습니다.",
    code: error.supabaseCode || error.code || "STUDY_PLAN_REQUEST_FAILED",
  });
}

module.exports = async function plans(request, response) {
  if (!["GET", "POST", "PATCH", "DELETE"].includes(request.method)) {
    return u.allow(response, ["GET", "POST", "PATCH", "DELETE"]);
  }
  try {
    if (request.method === "GET") return u.json(response, 200, { ok: true, plans: await listPlans(request) });
    if (request.method === "POST") return u.json(response, 201, { ok: true, plan: await createPlan(request) });
    if (request.method === "PATCH") {
      const result = await updatePlan(request);
      return u.json(response, 200, Array.isArray(result) ? { ok: true, plans: result } : { ok: true, plan: result });
    }
    return u.json(response, 200, { ok: true, deletedPlanId: await deletePlan(request) });
  } catch (error) {
    return errorResponse(response, error);
  }
};
