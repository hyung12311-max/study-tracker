const u = require("./_utils");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);
  try {
    const claims = u.authenticate(request);
    const body = await u.readJson(request);
    if (!body.scheduleId || !body.completedDate) throw u.err("scheduleId and completedDate are required.");

    const completions = await u.supabaseFetch(
      `academy_completion_history?select=id,parent_notified_at&academy_schedule_id=eq.${encodeURIComponent(body.scheduleId)}&completed_date=eq.${encodeURIComponent(body.completedDate)}&limit=1`
    );
    const completion = completions?.[0];
    if (!completion) return u.json(response, 404, { ok: false, error: "학원 일정 완료 기록을 찾지 못했습니다." });
    if (completion.parent_notified_at) return u.json(response, 200, { ok: true, skipped: true, reason: "already-notified" });

    const schedule = (await u.supabaseFetch(
      `academy_schedules?select=id,name&id=eq.${encodeURIComponent(body.scheduleId)}&limit=1`
    ))?.[0];
    if (!schedule) return u.json(response, 404, { ok: false, error: "학원 일정을 찾지 못했습니다." });

    const member = await u.activeMember(claims);
    const parentKeys = await u.parentMemberKeys(claims.family, claims.key);
    const result = await u.sendToFamily({
      familyId: claims.family,
      memberKeys: parentKeys,
      excludeMemberKey: claims.key,
      event: "study_complete",
      payload: {
        title: "⭐ 학원 일정 완료",
        body: `${member.display_name || "아이가"} ${schedule.name || "학원"} 일정을 완료했어요.`,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        url: "/?tab=today",
        tag: `academy-complete:${schedule.id}:${body.completedDate}:${claims.key}`,
      },
    });

    await u.supabaseFetch(`academy_completion_history?id=eq.${encodeURIComponent(completion.id)}`, {
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
      code: error.code || "ACADEMY_NOTIFICATION_FAILED",
      error: error.message,
    });
  }
};
