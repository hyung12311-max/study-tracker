const u = require("../rewards/_utils");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const SCHEDULE_SELECT = [
  "id",
  "academy_name",
  "day_of_week",
  "start_time",
  "memo",
  "star_count",
].join(",");
const COMPLETION_SELECT = [
  "id",
  "academy_schedule_id",
  "completed_date",
  "star_count",
  "created_at",
].join(",");

function exactBody(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw u.err("학원일정 요청 형식이 올바르지 않습니다.", 400, "INVALID_ACADEMY_REQUEST");
  }
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length) {
    throw u.err("허용되지 않은 학원일정 입력이 있습니다.", 400, "ACADEMY_FIELD_NOT_ALLOWED");
  }
  return value;
}

function uuid(value, code) {
  const text = String(value || "");
  if (!UUID_PATTERN.test(text)) {
    throw u.err("학원일정 요청을 확인해 주세요.", 400, code);
  }
  return text;
}

function scheduleInput(body) {
  const name = String(body.name ?? "").trim();
  const memo = String(body.memo ?? "").trim();
  const dayOfWeek = Number(body.dayOfWeek);
  const time = String(body.time ?? "").trim();
  const stars = Number(body.stars ?? 1);
  if (!name || name.length > 200) {
    throw u.err("학원명을 확인해 주세요.", 400, "INVALID_ACADEMY_NAME");
  }
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw u.err("학원 요일을 확인해 주세요.", 400, "INVALID_ACADEMY_DAY");
  }
  if (!TIME_PATTERN.test(time)) {
    throw u.err("학원 시간을 확인해 주세요.", 400, "INVALID_ACADEMY_TIME");
  }
  if (memo.length > 1000) {
    throw u.err("학원 메모가 너무 깁니다.", 400, "INVALID_ACADEMY_MEMO");
  }
  if (!Number.isInteger(stars) || stars < 1 || stars > 20) {
    throw u.err("학원 완료 보상을 확인해 주세요.", 400, "INVALID_ACADEMY_STARS");
  }
  return { name, memo, dayOfWeek, time, stars };
}

function scheduleForClient(row) {
  return row ? {
    id: String(row.id),
    academy_name: row.academy_name,
    day_of_week: Number(row.day_of_week),
    start_time: row.start_time,
    memo: row.memo || "",
    star_count: Number(row.star_count || 1),
  } : null;
}

function completionForClient(row) {
  return row ? {
    id: String(row.id),
    academy_schedule_id: String(row.academy_schedule_id),
    completed_date: row.completed_date,
    star_count: Number(row.star_count || 0),
    created_at: row.created_at,
  } : null;
}

async function activeMember(request, role) {
  const claims = u.authenticate(request, role);
  const member = await u.memberInFamily(claims.sub, claims.family);
  if (!member || member.is_active === false || (role && member.role !== role)) {
    throw u.err(
      role === "parent" ? "활성 부모 권한이 필요합니다." : "활성 가족 구성원 인증이 필요합니다.",
      403,
      "ACTIVE_MEMBER_REQUIRED"
    );
  }
  return { claims, member };
}

async function activeChild(familyId, assignedMemberId) {
  const child = (await u.supabaseFetch(
    `family_members?select=id&id=eq.${encodeURIComponent(assignedMemberId)}&family_id=eq.${encodeURIComponent(familyId)}&role=eq.child&is_active=eq.true&limit=1`
  ))?.[0];
  if (!child) {
    throw u.err("담당 자녀를 지정할 수 없습니다.", 403, "ASSIGNED_MEMBER_NOT_ALLOWED");
  }
  return String(child.id);
}

async function selectedChild(request) {
  const { claims, member } = await activeMember(request);
  const url = new URL(request.url || "/api/study/academy-schedules", "http://localhost");
  const requested = url.searchParams.get("assignedMemberId");
  if (member.role === "child") {
    if (requested) {
      throw u.err(
        "자녀는 조회 대상을 변경할 수 없습니다.",
        403,
        "CHILD_ASSIGNEE_OVERRIDE_NOT_ALLOWED"
      );
    }
    return { claims, member, assignedMemberId: claims.sub };
  }
  if (member.role !== "parent") {
    throw u.err(
      "활성 가족 구성원 인증이 필요합니다.",
      403,
      "ACTIVE_MEMBER_REQUIRED"
    );
  }
  const assignedMemberId = uuid(
    requested,
    requested ? "INVALID_ASSIGNED_MEMBER" : "ASSIGNED_MEMBER_REQUIRED"
  );
  await activeChild(claims.family, assignedMemberId);
  return { claims, member, assignedMemberId };
}

async function listAcademyData(request) {
  const { claims, assignedMemberId } = await selectedChild(request);
  const [schedules, completions] = await Promise.all([
    u.supabaseFetch(
      `academy_schedules?select=${SCHEDULE_SELECT}&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}&order=day_of_week.asc,start_time.asc,academy_name.asc`
    ),
    u.supabaseFetch(
      `academy_completion_history?select=${COMPLETION_SELECT}&family_id=eq.${encodeURIComponent(claims.family)}&member_id=eq.${encodeURIComponent(assignedMemberId)}&order=completed_date.desc,created_at.desc`
    ),
  ]);
  return {
    schedules: (schedules || []).map(scheduleForClient),
    completions: (completions || []).map(completionForClient),
  };
}

async function parentMutationScope(request, body, allowed) {
  const { claims } = await activeMember(request, "parent");
  exactBody(body, allowed);
  const assignedMemberId = uuid(
    body.assignedMemberId,
    body.assignedMemberId ? "INVALID_ASSIGNED_MEMBER" : "ASSIGNED_MEMBER_REQUIRED"
  );
  await activeChild(claims.family, assignedMemberId);
  return { claims, assignedMemberId };
}

async function createSchedule(request) {
  const body = await u.readJson(request);
  const { claims, assignedMemberId } = await parentMutationScope(
    request,
    body,
    new Set(["assignedMemberId", "name", "dayOfWeek", "time", "memo", "stars"])
  );
  const input = scheduleInput(body);
  const rows = await u.supabaseFetch("rpc/create_academy_schedule_for_assignee", {
    method: "POST",
    body: JSON.stringify({
      p_family_id: claims.family,
      p_actor_member_id: claims.sub,
      p_assigned_member_id: assignedMemberId,
      p_academy_name: input.name,
      p_day_of_week: input.dayOfWeek,
      p_start_time: input.time,
      p_memo: input.memo,
      p_star_count: input.stars,
    }),
  });
  const schedule = scheduleForClient(rows?.[0] || rows);
  if (!schedule) {
    throw u.err("학원일정을 저장하지 못했습니다.", 500, "ACADEMY_CREATE_FAILED");
  }
  return schedule;
}

async function updateSchedule(request) {
  const body = await u.readJson(request);
  const { claims, assignedMemberId } = await parentMutationScope(
    request,
    body,
    new Set(["id", "assignedMemberId", "name", "dayOfWeek", "time", "memo", "stars"])
  );
  const scheduleId = uuid(body.id, "INVALID_ACADEMY_SCHEDULE_ID");
  const input = scheduleInput(body);
  const rows = await u.supabaseFetch("rpc/update_academy_schedule_for_assignee", {
    method: "POST",
    body: JSON.stringify({
      p_family_id: claims.family,
      p_actor_member_id: claims.sub,
      p_assigned_member_id: assignedMemberId,
      p_schedule_id: scheduleId,
      p_academy_name: input.name,
      p_day_of_week: input.dayOfWeek,
      p_start_time: input.time,
      p_memo: input.memo,
      p_star_count: input.stars,
    }),
  });
  const schedule = scheduleForClient(rows?.[0] || rows);
  if (!schedule) {
    throw u.err("학원일정을 찾을 수 없습니다.", 404, "ACADEMY_SCHEDULE_NOT_FOUND");
  }
  return schedule;
}

async function deleteSchedule(request) {
  const body = await u.readJson(request);
  const { claims, assignedMemberId } = await parentMutationScope(
    request,
    body,
    new Set(["id", "assignedMemberId"])
  );
  const scheduleId = uuid(body.id, "INVALID_ACADEMY_SCHEDULE_ID");
  const result = await u.supabaseFetch("rpc/delete_academy_schedule_for_assignee", {
    method: "POST",
    body: JSON.stringify({
      p_family_id: claims.family,
      p_actor_member_id: claims.sub,
      p_assigned_member_id: assignedMemberId,
      p_schedule_id: scheduleId,
    }),
  });
  if (result === null || result === undefined) {
    throw u.err("학원일정을 찾을 수 없습니다.", 404, "ACADEMY_SCHEDULE_NOT_FOUND");
  }
  return scheduleId;
}

function safeError(response, error) {
  const databaseCode = error.supabaseCode;
  if (databaseCode === "42501") {
    return u.json(response, 403, {
      ok: false,
      error: "학원일정에 접근할 권한이 없습니다.",
      code: "ACADEMY_ACCESS_DENIED",
    });
  }
  if (databaseCode === "P0002") {
    return u.json(response, 404, {
      ok: false,
      error: "학원일정을 찾을 수 없습니다.",
      code: "ACADEMY_SCHEDULE_NOT_FOUND",
    });
  }
  if (databaseCode === "P0003") {
    return u.json(response, 409, {
      ok: false,
      error: "완료 이력이 있는 학원일정은 삭제할 수 없습니다.",
      code: "ACADEMY_COMPLETION_HISTORY_EXISTS",
    });
  }
  if (databaseCode === "40001") {
    return u.json(response, 409, {
      ok: false,
      error: "학원일정이 변경되어 다시 확인해야 합니다.",
      code: "ACADEMY_MUTATION_STALE",
    });
  }
  const isPublic = Boolean(error.statusCode && !databaseCode);
  console.error("[academy schedules API failed]", {
    status: error.statusCode || 500,
    code: databaseCode || error.code || null,
  });
  return u.json(response, isPublic ? error.statusCode : 500, {
    ok: false,
    error: isPublic ? error.message : "학원일정 요청을 처리하지 못했습니다.",
    code: error.code || databaseCode || "ACADEMY_REQUEST_FAILED",
  });
}

module.exports = async function academySchedules(request, response) {
  if (!["GET", "POST", "PATCH", "DELETE"].includes(request.method)) {
    return u.allow(response, ["GET", "POST", "PATCH", "DELETE"]);
  }
  try {
    if (request.method === "GET") {
      const data = await listAcademyData(request);
      return u.json(response, 200, { ok: true, ...data });
    }
    if (request.method === "POST") {
      return u.json(response, 201, {
        ok: true,
        schedule: await createSchedule(request),
      });
    }
    if (request.method === "PATCH") {
      return u.json(response, 200, {
        ok: true,
        schedule: await updateSchedule(request),
      });
    }
    return u.json(response, 200, {
      ok: true,
      deletedScheduleId: await deleteSchedule(request),
    });
  } catch (error) {
    return safeError(response, error);
  }
};
