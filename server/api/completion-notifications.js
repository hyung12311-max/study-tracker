const u = require("./family/_utils");
const authorization = require("./_authorization");
const BIGINT_PATTERN = /^[1-9]\d{0,18}$/;
const BIGINT_MAX = 9223372036854775807n;

function planId(value) {
  if (typeof value !== "string" || !BIGINT_PATTERN.test(value) || BigInt(value) > BIGINT_MAX) return null;
  return value;
}

module.exports = async function completionNotifications(request, response) {
  if (!["GET", "POST"].includes(request.method)) return u.allow(response, ["GET", "POST"]);
  try {
    const context = await u.authenticateActiveMember(request, { allowRoles: ["parent", "child"] });
    const familyId = encodeURIComponent(context.familyId);
    if (request.method === "GET") {
      const memberFilter = context.role === "parent" ? "" : `&member_id=eq.${encodeURIComponent(context.memberId)}`;
      const rows = await u.supabaseFetch(`completion_notifications?select=id,study_plan_id,title,body,delivered,delivery_channel,error_message,created_at&family_id=eq.${familyId}${memberFilter}&order=created_at.desc&limit=100`);
      return u.json(response, 200, {
        notifications: (rows || []).map((row) => ({ ...row, study_plan_id: row.study_plan_id == null ? null : String(row.study_plan_id) })),
      });
    }
    const body = await u.readJson(request);
    const requestedPlanId = planId(body.study_plan_id ?? body.planId);
    const title = String(body.title || "").trim();
    const message = String(body.body || "").trim();
    if (!requestedPlanId || !title || title.length > 150 || !message || message.length > 1000) {
      throw u.err("완료 알림 기록을 확인해 주세요.", 400, "INVALID_COMPLETION_NOTIFICATION");
    }
    const assigneeFilter = context.role === "parent" ? "" : `&assigned_member_id=eq.${encodeURIComponent(context.memberId)}`;
    const plan = (await u.supabaseFetch(`study_plans?select=id&id=eq.${encodeURIComponent(requestedPlanId)}&family_id=eq.${familyId}${assigneeFilter}&limit=1`))?.[0];
    if (!plan) throw authorization.safeNotFound();
    const rows = await u.supabaseFetch("completion_notifications", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        family_id: context.familyId,
        member_id: context.memberId,
        study_plan_id: requestedPlanId,
        title,
        body: message,
        delivered: body.delivered === true,
        delivery_channel: String(body.delivery_channel || body.deliveryChannel || "browser").slice(0, 40),
        error_message: String(body.error_message || body.errorMessage || "").slice(0, 1000) || null,
      }),
    });
    return u.json(response, 200, { ok: true, notification: rows?.[0] ? { ...rows[0], study_plan_id: requestedPlanId } : null });
  } catch (error) {
    const safe = authorization.publicAuthorizationError(error);
    if (safe.status !== 500) return u.json(response, safe.status, safe.body);
    const controlled = Boolean(error.statusCode >= 400 && error.statusCode < 500 && !error.supabaseCode);
    return u.json(response, controlled ? error.statusCode : 500, {
      ok: false,
      error: controlled ? error.message : "완료 알림을 처리하지 못했습니다.",
      code: controlled && error.code ? error.code : "COMPLETION_NOTIFICATIONS_FAILED",
    });
  }
};
