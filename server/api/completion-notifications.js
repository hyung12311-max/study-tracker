const u = require("./family/_utils");
const BIGINT_PATTERN = /^[1-9]\d{0,18}$/;
const BIGINT_MAX = 9223372036854775807n;

function planId(value) {
  if (typeof value !== "string" || !BIGINT_PATTERN.test(value) || BigInt(value) > BIGINT_MAX) return null;
  return value;
}

async function activeMember(claims) {
  return (await u.supabaseFetch(
    `family_members?select=id,role,is_active&id=eq.${encodeURIComponent(claims.sub)}&family_id=eq.${encodeURIComponent(claims.family)}&is_active=eq.true&limit=1`
  ))?.[0] || null;
}

module.exports = async function completionNotifications(request, response) {
  if (!["GET", "POST"].includes(request.method)) return u.allow(response, ["GET", "POST"]);
  try {
    const claims = u.authenticate(request);
    const member = await activeMember(claims);
    if (!member) throw u.err("권한이 없습니다.", 403, "ACTIVE_MEMBER_REQUIRED");
    if (request.method === "GET") {
      const memberFilter = member.role === "parent" ? "" : `&member_id=eq.${encodeURIComponent(claims.sub)}`;
      const rows = await u.supabaseFetch(
        `completion_notifications?select=id,study_plan_id,title,body,delivered,delivery_channel,error_message,created_at&family_id=eq.${encodeURIComponent(claims.family)}${memberFilter}&order=created_at.desc&limit=100`
      );
      const notifications = (rows || []).map((row) => ({
        ...row,
        study_plan_id: row.study_plan_id == null ? null : String(row.study_plan_id),
      }));
      return u.json(response, 200, { notifications });
    }
    const body = await u.readJson(request);
    const requestedPlanId = planId(body.study_plan_id ?? body.planId);
    const title = String(body.title || "").trim();
    const message = String(body.body || "").trim();
    if (!requestedPlanId || !title || title.length > 150 || !message || message.length > 1000) {
      throw u.err("완료 알림 기록을 확인해 주세요.", 400, "INVALID_COMPLETION_NOTIFICATION");
    }
    const assigneeFilter = member.role === "parent"
      ? ""
      : `&assigned_member_id=eq.${encodeURIComponent(claims.sub)}`;
    const plan = (await u.supabaseFetch(
      `study_plans?select=id&id=eq.${encodeURIComponent(requestedPlanId)}&family_id=eq.${encodeURIComponent(claims.family)}${assigneeFilter}&limit=1`
    ))?.[0];
    if (!plan) throw u.err("학습 계획을 찾을 수 없습니다.", 404, "STUDY_PLAN_NOT_FOUND");
    const rows = await u.supabaseFetch("completion_notifications", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        family_id: claims.family,
        member_id: claims.sub,
        study_plan_id: requestedPlanId,
        title,
        body: message,
        delivered: body.delivered === true,
        delivery_channel: String(body.delivery_channel || body.deliveryChannel || "browser").slice(0, 40),
        error_message: String(body.error_message || body.errorMessage || "").slice(0, 1000) || null,
      }),
    });
    const notification = rows?.[0]
      ? { ...rows[0], study_plan_id: requestedPlanId }
      : null;
    return u.json(response, 200, { ok: true, notification });
  } catch (error) {
    console.error("[completion notifications failed]", { status: error.statusCode || 500, code: error.supabaseCode || error.code || null, message: error.supabaseMessage || error.message, details: error.supabaseDetails || null });
    return u.json(response, error.supabaseCode ? 500 : (error.statusCode || 500), { error: error.statusCode === 401 ? "로그인이 만료되었습니다." : error.statusCode === 403 ? "권한이 없습니다." : error.statusCode ? error.message : "서버 오류가 발생했습니다.", code: error.supabaseCode || error.code || "COMPLETION_NOTIFICATIONS_FAILED" });
  }
};
