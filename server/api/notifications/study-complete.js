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

    const members = await u.supabaseFetch(`family_members?select=member_key,display_name,role&family_id=eq.${claims.family}&is_active=eq.true`);
    const parentKeys = (members || [])
      .filter((member) => member.role === "parent" && member.member_key !== claims.key)
      .map((member) => member.member_key);
    const sender = (members || []).find((member) => member.member_key === claims.key);
    const subject = plan.subject || plan.workbook || "학습";
    const reward=(await u.supabaseFetch(`sticker_history?select=sticker_count,reward_type&study_plan_id=eq.${encodeURIComponent(plan.id)}&member_id=eq.${encodeURIComponent(claims.sub)}&limit=1`))?.[0];
    const count=Number(reward?.sticker_count||0),rewardLabel=reward?.reward_type==="study_early"?"미리 완료":reward?.reward_type==="study_on_time"?"계획한 날짜에 완료":reward?.reward_type==="study_delayed"?"지연된 학습 완료":"학습 완료";
    const result = await u.sendToFamily({
      familyId: claims.family,
      memberKeys: parentKeys,
      excludeMemberKey: claims.key,
      event: "study_complete",
      payload: {
        title: "⭐ 학습 완료",
        body: `${sender?.display_name || "아이가"} ${subject} 학습을 완료했어요. ${rewardLabel}${count>0?`로 스티커 ${count}개를 받았습니다.`:"했으며 지급된 스티커는 없습니다."}`,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        url: "/?tab=today",
        tag: `study-complete:${plan.id}:${claims.key}`,
      },
    });

    await u.supabaseFetch(`study_plans?id=eq.${encodeURIComponent(plan.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        parent_notified_at: result.success > 0 ? new Date().toISOString() : null,
        parent_notification_delivered: result.success > 0,
      }),
    });
    return u.json(response, 200, { ok: true, ...result });
  } catch (error) {
    const status=error.supabaseCode?500:(error.statusCode||500);
    console.error("[study complete notification failed]",{status,code:error.supabaseCode||error.code||null,message:error.supabaseMessage||error.message,details:error.supabaseDetails||null});
    return u.json(response, status, {
      ok: false,
      error: status===401?"로그인이 만료되었습니다.":status===403?"권한이 없습니다.":"서버 오류가 발생했습니다.",
      code:error.supabaseCode||error.code||"STUDY_NOTIFICATION_FAILED",
    });
  }
};
