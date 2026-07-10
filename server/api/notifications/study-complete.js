const u = require("./_utils");

function isDone(status) {
  return ["done", "완료"].includes(status);
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);
  try {
    const claims = u.authenticate(request);
    const body = await u.readJson(request);
    if (!body.planId) throw u.err("planId is required.");

    const rows = await u.supabaseFetch(
      `study_plans?select=id,subject,workbook,status,parent_notified_at&id=eq.${encodeURIComponent(body.planId)}&limit=1`
    );
    const plan = rows?.[0];
    if (!plan) return u.json(response, 404, { ok: false, error: "학습 기록을 찾지 못했습니다." });
    if (!isDone(plan.status)) return u.json(response, 409, { ok: false, error: "완료된 학습만 알림을 보낼 수 있습니다." });
    if (plan.parent_notified_at) return u.json(response, 200, { ok: true, skipped: true, reason: "already-notified" });

    const member = await u.activeMember(claims);
    const parentKeys = await u.parentMemberKeys(claims.family, claims.key);
    const subject = plan.subject || plan.workbook || "학습";
    const result = await u.sendToFamily({
      familyId: claims.family,
      memberKeys: parentKeys,
      excludeMemberKey: claims.key,
      event: "study_complete",
      payload: {
        title: "⭐ 학습 완료",
        body: `${member.display_name || "아이가"} ${subject} 학습을 완료했어요.`,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        url: "/?tab=today",
        tag: `study-complete:${plan.id}:${claims.key}`,
      },
    });

    await u.supabaseFetch(`study_plans?id=eq.${encodeURIComponent(plan.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        parent_notified_at: new Date().toISOString(),
        parent_notification_delivered: result.success > 0,
      }),
    });
    return u.json(response, 200, { ok: true, targetMemberKeys: parentKeys, ...result });
  } catch (error) {
    return u.json(response, error.statusCode || 500, {
      ok: false,
      code: error.code || "STUDY_NOTIFICATION_FAILED",
      error: error.message,
    });
  }
};
