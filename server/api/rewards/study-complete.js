const u = require("./_utils");

function seoulDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function completionError(error) {
  if (error.statusCode === 401) return { status: 401, code: error.code || "AUTH_EXPIRED", error: "로그인이 만료되었습니다." };
  if (error.statusCode === 403 || error.supabaseCode === "42501") return { status: 403, code: error.code || error.supabaseCode || "FORBIDDEN", error: "권한이 없습니다." };
  if (error.supabaseCode === "PGRST202") {
    return { status: 500, code: "STUDY_COMPLETION_RPC_MISSING", error: "학습 완료 서버 구성이 누락되었습니다." };
  }
  if (error.statusCode === 404 && !error.supabaseCode) return { status: 404, code: error.code || "STUDY_PLAN_NOT_FOUND", error: error.message };
  return { status: error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 500, code: error.code || error.supabaseCode || "STUDY_COMPLETION_FAILED", error: error.statusCode && !error.supabaseCode ? error.message : "서버 오류가 발생했습니다." };
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);
  try {
    const claims = u.authenticate(request);
    const body = await u.readJson(request);
    const planId = String(body.planId || "");
    if (!/^\d+$/.test(planId)) throw u.err("올바른 학습 계획을 선택해 주세요.", 400, "INVALID_PLAN_ID");

    const member = await u.memberInFamily(claims.sub, claims.family);
    if (member?.role !== "child" || member.is_active === false) throw u.err("권한이 없습니다.", 403, "CHILD_PERMISSION_REQUIRED");
    const plan = (await u.supabaseFetch(`study_plans?select=id,subject,workbook,status&id=eq.${encodeURIComponent(planId)}&limit=1`))?.[0];
    if (!plan) throw u.err("학습 계획을 찾을 수 없습니다.", 404, "STUDY_PLAN_NOT_FOUND");

    const rows = await u.supabaseFetch("rpc/complete_study_plan_with_reward", {
      method: "POST",
      body: JSON.stringify({
        p_family_id: claims.family,
        p_member_id: claims.sub,
        p_plan_id: Number(planId),
        p_completed_date: seoulDate(),
      }),
    });
    const row = rows?.[0];
    if (!row) throw u.err("학습 완료 결과를 확인할 수 없습니다.", 409, "COMPLETION_FAILED");

    let parentNotification = { success: 0, failure: 0, subscriptionCount: 0, skipped: true };
    if (!row.already_completed) {
      parentNotification = await u.sendTargetedPush({
        familyId: claims.family,
        target: "parent",
        event: "study_complete",
        title: "⭐ 학습 완료",
        body: `${member.display_name || "자녀"}님이 ${plan.subject || plan.workbook || "학습"}을 완료했습니다. 스티커 ${Number(row.sticker_count || 0)}개를 받았습니다.`,
        tag: `study-complete-${planId}`,
        url: "/?tab=today",
      });
      await u.supabaseFetch(`study_plans?id=eq.${encodeURIComponent(planId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          parent_notified_at: Number(parentNotification.success || 0) > 0 ? new Date().toISOString() : null,
          parent_notification_delivered: Number(parentNotification.success || 0) > 0,
        }),
      });
    }

    return u.json(response, 200, {
      ok: true,
      completion: {
        plan: row.completed_plan,
        adjustmentType: row.adjustment_type,
        rescheduledCount: Number(row.rescheduled_count || 0),
        stickerCount: Number(row.sticker_count || 0),
        rewardType: row.reward_type,
        rewardReason: row.reward_reason,
        alreadyCompleted: Boolean(row.already_completed),
        balance: Number(row.balance || 0),
      },
      parentNotification,
    });
  } catch (error) {
    const failure = completionError(error);
    console.error("[study complete failed]", {
      status: failure.status,
      code: failure.code,
      message: error.supabaseMessage || error.message,
      details: error.supabaseDetails || null,
      hint: error.supabaseHint || null,
      supabaseStatus: error.supabaseStatus || null,
      supabaseCode: error.supabaseCode || null,
    });
    return u.json(response, failure.status, { ok: false, ...failure, details: error.supabaseDetails || null });
  }
};
