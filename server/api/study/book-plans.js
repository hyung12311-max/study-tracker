const u = require("../rewards/_utils");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BIGINT_PATTERN = /^(?:[1-9]\d{0,18})$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BOOK_PLAN_SELECT = [
  "id",
  "subject",
  "workbook",
  "chapter",
  "lesson",
  "content",
  "start_date",
  "study_weekdays",
  "start_page",
  "end_page",
  "pages_per_day",
  "goal",
  "memo",
  "expected_end_date",
  "updated_at",
  "assigned_member_id",
].join(",");

function uuid(value, code) {
  const text = String(value || "");
  if (!UUID_PATTERN.test(text)) throw u.err("교재 계획 요청을 확인해 주세요.", 400, code);
  return text;
}

function positiveInteger(value, code, maximum = 100000) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > maximum) {
    throw u.err("교재 계획 숫자 범위를 확인해 주세요.", 400, code);
  }
  return number;
}

function text(value, maximum, code, { required = false } = {}) {
  const normalized = String(value ?? "").trim();
  if ((required && !normalized) || normalized.length > maximum) {
    throw u.err("교재 계획 입력을 확인해 주세요.", 400, code);
  }
  return normalized;
}

function exactFields(body, fields) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw u.err("교재 계획 요청 형식이 올바르지 않습니다.", 400, "INVALID_BOOK_PLAN_REQUEST");
  }
  const unexpected = Object.keys(body).filter((key) => !fields.has(key));
  if (unexpected.length) throw u.err("허용되지 않은 교재 계획 입력이 있습니다.", 400, "BOOK_PLAN_FIELD_NOT_ALLOWED");
}

async function activeParent(request) {
  const claims = u.authenticate(request, "parent");
  const member = await u.memberInFamily(claims.sub, claims.family);
  if (!member || member.role !== "parent" || member.is_active === false) {
    throw u.err("활성 부모 권한이 필요합니다.", 403, "ACTIVE_PARENT_REQUIRED");
  }
  return claims;
}

async function activeChild(familyId, assignedMemberId) {
  const child = (await u.supabaseFetch(
    `family_members?select=id&id=eq.${encodeURIComponent(assignedMemberId)}&family_id=eq.${encodeURIComponent(familyId)}&role=eq.child&is_active=eq.true&limit=1`
  ))?.[0];
  if (!child) throw u.err("담당 자녀를 지정할 수 없습니다.", 403, "ASSIGNED_MEMBER_NOT_ALLOWED");
  return child.id;
}

async function selectedChild(claims, value) {
  const assignedMemberId = uuid(value, value ? "INVALID_ASSIGNED_MEMBER" : "ASSIGNED_MEMBER_REQUIRED");
  await activeChild(claims.family, assignedMemberId);
  return assignedMemberId;
}

async function listBookPlans(claims, assignedMemberId) {
  const rows = await u.supabaseFetch(
    `book_plans?select=${BOOK_PLAN_SELECT}&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}&order=updated_at.desc`
  ) || [];
  return rows.map((row) => ({
    ...row,
    id: String(row.id),
    assigned_member_id: String(row.assigned_member_id),
  }));
}

async function requireOwnedBookPlan(claims, assignedMemberId, bookPlanId) {
  const row = (await u.supabaseFetch(
    `book_plans?select=id&id=eq.${encodeURIComponent(bookPlanId)}&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}&limit=1`
  ))?.[0];
  if (!row) throw u.err("교재 계획을 찾을 수 없습니다.", 404, "BOOK_PLAN_NOT_FOUND");
}

async function requireOwnedBookTask(claims, assignedMemberId, studyPlanId) {
  const row = (await u.supabaseFetch(
    `study_plans?select=id,book_plan_id&id=eq.${encodeURIComponent(studyPlanId)}&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}&book_plan_id=not.is.null&limit=1`
  ))?.[0];
  if (!row) throw u.err("교재 일정을 찾을 수 없습니다.", 404, "BOOK_TASK_NOT_FOUND");
}

async function createBookPlan(claims, body) {
  exactFields(body, new Set([
    "action", "assignedMemberId", "subject", "book", "unit", "lessonNo", "content",
    "startDate", "startPage", "endPage", "pagesPerDay", "weekdays", "target", "memo",
  ]));
  const assignedMemberId = await selectedChild(claims, body.assignedMemberId);
  const weekdays = Array.isArray(body.weekdays)
    ? [...new Set(body.weekdays.map(Number))].sort((a, b) => a - b)
    : [];
  if (!weekdays.length || weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw u.err("학습 요일을 하나 이상 선택해 주세요.", 400, "INVALID_BOOK_WEEKDAYS");
  }
  const startPage = positiveInteger(body.startPage, "INVALID_BOOK_PAGE_RANGE");
  const endPage = positiveInteger(body.endPage, "INVALID_BOOK_PAGE_RANGE");
  if (endPage < startPage) throw u.err("교재 페이지 범위를 확인해 주세요.", 400, "INVALID_BOOK_PAGE_RANGE");
  const startDate = String(body.startDate || "");
  if (!DATE_PATTERN.test(startDate)) throw u.err("교재 시작일을 확인해 주세요.", 400, "INVALID_BOOK_START_DATE");

  const rows = await u.supabaseFetch("rpc/create_book_plan_for_member", {
    method: "POST",
    body: JSON.stringify({
      p_family_id: claims.family,
      p_assigned_member_id: assignedMemberId,
      p_created_by_member_id: claims.sub,
      p_subject: text(body.subject, 1000, "INVALID_BOOK_SUBJECT", { required: true }),
      p_workbook: text(body.book, 1000, "INVALID_BOOK_TITLE", { required: true }),
      p_lesson: text(body.unit, 1000, "INVALID_BOOK_UNIT", { required: true }),
      p_chapter: text(body.lessonNo, 1000, "INVALID_BOOK_LESSON", { required: true }),
      p_content: text(body.content, 5000, "INVALID_BOOK_CONTENT"),
      p_start_date: startDate,
      p_start_page: startPage,
      p_end_page: endPage,
      p_pages_per_day: positiveInteger(body.pagesPerDay, "INVALID_BOOK_PAGES_PER_DAY"),
      p_study_weekdays: weekdays,
      p_goal: text(body.target, 1000, "INVALID_BOOK_TARGET"),
      p_memo: text(body.memo, 5000, "INVALID_BOOK_MEMO"),
    }),
  });
  const result = rows?.[0];
  if (!result || Number(result.generated_count) < 1) {
    throw u.err("생성할 교재 일정이 없습니다.", 409, "NO_BOOK_PLAN_DATES");
  }
  return {
    generatedCount: Number(result.generated_count),
    firstStudyDate: result.first_study_date,
    lastStudyDate: result.last_study_date,
    rows: Array.isArray(result.generated_rows) ? result.generated_rows : [],
  };
}

async function mutateBookPlan(claims, body) {
  async function scope() {
    const assignedMemberId = await selectedChild(claims, body.assignedMemberId);
    return {
      assignedMemberId,
      shared: {
        p_family_id: claims.family,
        p_actor_member_id: claims.sub,
        p_assigned_member_id: assignedMemberId,
      },
    };
  }
  if (body.action === "addReview") {
    exactFields(body, new Set(["action", "assignedMemberId", "bookPlanId", "afterSequence", "content"]));
    const { assignedMemberId, shared } = await scope();
    const bookPlanId = uuid(body.bookPlanId, "INVALID_BOOK_PLAN_ID");
    await requireOwnedBookPlan(claims, assignedMemberId, bookPlanId);
    return u.supabaseFetch("rpc/add_book_plan_review_for_assignee", {
      method: "POST",
      body: JSON.stringify({
        ...shared,
        p_book_plan_id: bookPlanId,
        p_after_sequence: Math.max(0, positiveInteger(Number(body.afterSequence || 0) + 1, "INVALID_BOOK_SEQUENCE") - 1),
        p_content: text(body.content || "복습", 5000, "INVALID_BOOK_REVIEW", { required: true }),
      }),
    });
  }
  if (body.action === "updatePages") {
    exactFields(body, new Set(["action", "assignedMemberId", "bookPlanId", "pagesPerDay"]));
    const { assignedMemberId, shared } = await scope();
    const bookPlanId = uuid(body.bookPlanId, "INVALID_BOOK_PLAN_ID");
    await requireOwnedBookPlan(claims, assignedMemberId, bookPlanId);
    return u.supabaseFetch("rpc/update_book_plan_pages_for_assignee", {
      method: "POST",
      body: JSON.stringify({
        ...shared,
        p_book_plan_id: bookPlanId,
        p_pages_per_day: positiveInteger(body.pagesPerDay, "INVALID_BOOK_PAGES_PER_DAY"),
      }),
    });
  }
  if (body.action === "deleteTask") {
    exactFields(body, new Set(["action", "assignedMemberId", "studyPlanId"]));
    const { assignedMemberId, shared } = await scope();
    const studyPlanId = String(body.studyPlanId || "");
    if (!BIGINT_PATTERN.test(studyPlanId) || BigInt(studyPlanId) > 9223372036854775807n) {
      throw u.err("교재 일정을 확인해 주세요.", 400, "INVALID_STUDY_PLAN_ID");
    }
    await requireOwnedBookTask(claims, assignedMemberId, studyPlanId);
    return u.supabaseFetch("rpc/delete_book_plan_task_for_assignee", {
      method: "POST",
      body: JSON.stringify({ ...shared, p_study_plan_id: studyPlanId }),
    });
  }
  if (body.action === "reflow") {
    exactFields(body, new Set(["action", "assignedMemberId", "bookPlanId", "fromDate"]));
    const { assignedMemberId, shared } = await scope();
    const fromDate = String(body.fromDate || "");
    if (!DATE_PATTERN.test(fromDate)) throw u.err("재배치 시작일을 확인해 주세요.", 400, "INVALID_REFLOW_DATE");
    const bookPlanId = uuid(body.bookPlanId, "INVALID_BOOK_PLAN_ID");
    await requireOwnedBookPlan(claims, assignedMemberId, bookPlanId);
    return u.supabaseFetch("rpc/reflow_book_plan_for_assignee", {
      method: "POST",
      body: JSON.stringify({
        ...shared,
        p_book_plan_id: bookPlanId,
        p_from_date: fromDate,
      }),
    });
  }
  throw u.err("지원하지 않는 교재 계획 작업입니다.", 400, "INVALID_BOOK_PLAN_ACTION");
}

module.exports = async function bookPlans(request, response) {
  if (!["GET", "POST"].includes(request.method)) return u.allow(response, ["GET", "POST"]);
  try {
    const claims = await activeParent(request);
    if (request.method === "GET") {
      const url = new URL(request.url || "/api/study/book-plans", "http://localhost");
      const assignedMemberId = await selectedChild(claims, url.searchParams.get("assignedMemberId"));
      return u.json(response, 200, {
        ok: true,
        bookPlans: await listBookPlans(claims, assignedMemberId),
      });
    }
    const body = await u.readJson(request);
    const result = body?.action === "create"
      ? await createBookPlan(claims, body)
      : await mutateBookPlan(claims, body);
    return u.json(response, 200, { ok: true, ...(body.action === "create" ? result : {}) });
  } catch (error) {
    if (error.supabaseCode === "42501") {
      error.statusCode = 403;
      error.message = "교재 계획에 접근할 권한이 없습니다.";
    }
    if (error.supabaseCode === "P0002") {
      error.statusCode = 404;
      error.message = "교재 계획을 찾을 수 없습니다.";
    }
    const isPublic = Boolean(error.statusCode && !error.supabaseCode);
    const safeDatabaseStatus = error.statusCode === 403 || error.statusCode === 404;
    console.error("[study book plans failed]", {
      status: error.statusCode || 500,
      code: error.supabaseCode || error.code || null,
    });
    return u.json(response, safeDatabaseStatus ? error.statusCode : isPublic ? error.statusCode : 500, {
      ok: false,
      error: safeDatabaseStatus ? error.message : isPublic ? error.message : "교재 계획을 처리하지 못했습니다.",
      code: error.supabaseCode || error.code || "BOOK_PLAN_REQUEST_FAILED",
    });
  }
};
