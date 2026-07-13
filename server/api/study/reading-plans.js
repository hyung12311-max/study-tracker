const u = require("../rewards/_utils");

function seoulDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function inputFrom(body) {
  const mode = String(body.mode || "free");
  const weekdays = Array.isArray(body.weekdays) ? [...new Set(body.weekdays.map(Number))].sort((a, b) => a - b) : [];
  const bookTitle = String(body.bookTitle || "").trim();
  const startPage = mode === "pages" ? Number(body.startPage) : null;
  const endPage = mode === "pages" ? Number(body.endPage) : null;
  if (!["free", "pages"].includes(mode)) throw u.err("독서 방식을 확인해 주세요.", 400, "INVALID_READING_MODE");
  if (!weekdays.length || weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw u.err("독서 요일을 하나 이상 선택해 주세요.", 400, "INVALID_READING_WEEKDAYS");
  }
  if (bookTitle.length > 120) throw u.err("책 이름은 120자 이내로 입력해 주세요.", 400, "INVALID_BOOK_TITLE");
  if (mode === "pages" && (!Number.isInteger(startPage) || !Number.isInteger(endPage) || startPage < 1 || endPage < startPage || endPage > 100000)) {
    throw u.err("독서 페이지 범위를 확인해 주세요.", 400, "INVALID_READING_PAGES");
  }
  return { mode, weekdays, bookTitle, startPage, endPage };
}

module.exports = async function readingPlans(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);
  try {
    const claims = u.authenticate(request, "parent");
    const member = await u.memberInFamily(claims.sub, claims.family);
    if (!member || member.role !== "parent" || member.is_active === false) {
      throw u.err("권한이 없습니다.", 403, "ACTIVE_PARENT_REQUIRED");
    }
    const input = inputFrom(await u.readJson(request));
    const rows = await u.supabaseFetch("rpc/create_reading_plan", {
      method: "POST",
      body: JSON.stringify({
        p_family_id: claims.family,
        p_created_by_member_id: claims.sub,
        p_reading_mode: input.mode,
        p_book_title: input.bookTitle || null,
        p_start_page: input.startPage,
        p_end_page: input.endPage,
        p_study_weekdays: input.weekdays,
        p_start_date: seoulDate(),
      }),
    });
    const result = rows?.[0];
    if (!result || Number(result.generated_count) < 1) throw u.err("생성할 독서 일정이 없습니다.", 409, "NO_READING_DATES");
    return u.json(response, 200, {
      ok: true,
      readingPlanId: result.reading_plan_id,
      generatedCount: Number(result.generated_count),
      firstStudyDate: result.first_study_date,
      lastStudyDate: result.last_study_date,
    });
  } catch (error) {
    console.error("[create reading plan failed]", {
      status: error.statusCode || 500,
      code: error.supabaseCode || error.code || null,
      message: error.supabaseMessage || error.message,
      details: error.supabaseDetails || null,
    });
    return u.json(response, error.statusCode && !error.supabaseCode ? error.statusCode : 500, {
      ok: false,
      error: error.statusCode && !error.supabaseCode ? error.message : "독서 계획을 생성하지 못했습니다.",
      code: error.supabaseCode || error.code || "READING_PLAN_CREATE_FAILED",
    });
  }
};
