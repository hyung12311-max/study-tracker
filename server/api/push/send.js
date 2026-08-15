const {
  configureWebPush,
  json,
  methodNotAllowed,
  normalizeSubscription,
  readJson,
  supabaseFetch,
  validateSubscriptionPayload,
  webPush,
} = require("./_utils");
const authorization = require("../_authorization");

function isDone(status) {
  return status === "done" || status === "완료";
}

async function getActiveSubscriptions(familyId, endpoint) {
  const query = endpoint
    ? `family_push_subscriptions?select=id,endpoint,p256dh,auth&family_id=eq.${encodeURIComponent(familyId)}&is_active=eq.true&endpoint=eq.${encodeURIComponent(endpoint)}`
    : `family_push_subscriptions?select=id,endpoint,p256dh,auth&family_id=eq.${encodeURIComponent(familyId)}&is_active=eq.true`;
  return supabaseFetch(query);
}

async function getChildDisplayName(familyId, memberId) {
  if (!memberId) return null;
  const member = (await supabaseFetch(
    `family_members?select=display_name&id=eq.${encodeURIComponent(memberId)}&family_id=eq.${encodeURIComponent(familyId)}&role=eq.child&is_active=eq.true&limit=1`
  ))?.[0];
  return String(member?.display_name || "").trim() || null;
}

async function markFamilySubscriptionInactive(familyId, row) {
  if (!row?.id || !row.endpoint) return;
  await supabaseFetch(
    `family_push_subscriptions?id=eq.${encodeURIComponent(row.id)}&family_id=eq.${encodeURIComponent(familyId)}&endpoint=eq.${encodeURIComponent(row.endpoint)}`,
    { method: "PATCH", body: JSON.stringify({ is_active: false }) }
  );
}

async function buildStudyPayload(body, context) {
  if (!body.planId) {
    const error = new Error("planId is required.");
    error.statusCode = 400;
    throw error;
  }

  const plans = await supabaseFetch(
    `study_plans?select=id,subject,workbook,status,parent_notified_at,assigned_member_id&id=eq.${encodeURIComponent(body.planId)}&family_id=eq.${encodeURIComponent(context.familyId)}${context.role === "child" ? `&assigned_member_id=eq.${encodeURIComponent(context.memberId)}` : ""}&limit=1`
  );
  const plan = plans?.[0];
  if (!plan) return { skipped: true, reason: "plan-not-found" };
  if (!isDone(plan.status)) return { skipped: true, reason: "plan-not-completed" };
  if (plan.parent_notified_at) return { skipped: true, reason: "already-notified" };
  const reward = (await supabaseFetch(
    `sticker_history?select=sticker_count&family_id=eq.${encodeURIComponent(context.familyId)}&member_id=eq.${encodeURIComponent(plan.assigned_member_id)}&study_plan_id=eq.${encodeURIComponent(plan.id)}&limit=1`
  ))?.[0];
  const awardedStickerCount = Number(reward?.sticker_count || 0);
  const childName = await getChildDisplayName(context.familyId, plan.assigned_member_id);
  const childLabel = childName || "자녀";
  const childSubject = childName ? `${childName} 자녀` : "자녀";

  return {
    tag: `study-complete-${plan.id}`,
    url: "/?tab=progress",
    title: `${childLabel} 학습 완료 ⭐`,
    body: `${childSubject}가 ${plan.subject}${plan.workbook ? ` · ${plan.workbook}` : ""} 학습을 완료했어요. ${awardedStickerCount > 0 ? `스티커 ${awardedStickerCount}개를 받았습니다.` : "지급된 스티커는 없습니다."}`,
    afterSend: async (delivered) => {
      await supabaseFetch(`study_plans?id=eq.${encodeURIComponent(plan.id)}&family_id=eq.${encodeURIComponent(context.familyId)}&assigned_member_id=eq.${encodeURIComponent(plan.assigned_member_id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          parent_notified_at: new Date().toISOString(),
          parent_notification_delivered: delivered,
        }),
      });
    },
  };
}

async function buildAcademyPayload(body, context) {
  if (!body.scheduleId || !body.completedDate) {
    const error = new Error("scheduleId and completedDate are required.");
    error.statusCode = 400;
    throw error;
  }

  const completions = await supabaseFetch(
    `academy_completion_history?select=id&academy_schedule_id=eq.${encodeURIComponent(body.scheduleId)}&family_id=eq.${encodeURIComponent(context.familyId)}&completed_date=eq.${encodeURIComponent(body.completedDate)}&limit=1`
  );
  if (!completions?.length) return { skipped: true, reason: "academy-completion-not-found" };

  const schedules = await supabaseFetch(
    `academy_schedules?select=id,name,assigned_member_id&id=eq.${encodeURIComponent(body.scheduleId)}&family_id=eq.${encodeURIComponent(context.familyId)}&limit=1`
  );
  const schedule = schedules?.[0];
  if (!schedule) return { skipped: true, reason: "academy-schedule-not-found" };
  const childName = await getChildDisplayName(context.familyId, schedule.assigned_member_id);
  const childLabel = childName || "자녀";
  const childSubject = childName ? `${childName} 자녀` : "자녀";

  return {
    tag: `academy-complete-${schedule.id}-${body.completedDate}`,
    url: "/?tab=progress",
    title: `${childLabel} 일정 완료 ⭐`,
    body: `${childSubject}가 ${schedule.name} 일정을 완료했어요.`,
  };
}

async function buildTestPayload(body) {
  const subscription = body.subscription || body;
  validateSubscriptionPayload(subscription);
  return {
    endpoint: subscription.endpoint,
    tag: "study-tracker-test",
    url: "/?tab=parent",
    title: "Study Sticker 테스트 알림",
    body: "이 기기에서 부모 알림을 받을 수 있어요.",
  };
}

async function sendToSubscriptions(payload, rows, familyId) {
  let success = 0;
  let failure = 0;

  await Promise.all(rows.map(async (row) => {
    try {
      await webPush.sendNotification(normalizeSubscription(row), JSON.stringify(payload));
      success += 1;
    } catch (error) {
      failure += 1;
      if (error.statusCode === 404 || error.statusCode === 410) {
        await markFamilySubscriptionInactive(familyId, row);
      }
    }
  }));

  return { success, failure };
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return methodNotAllowed(response);

  try {
    const context = await authorization.authenticateActiveMember(request, { allowRoles: ["parent", "child"] });
    configureWebPush();
    const body = await readJson(request);
    const payload = body.type === "test"
      ? await buildTestPayload(body)
      : body.type === "academy-complete"
        ? await buildAcademyPayload(body, context)
        : await buildStudyPayload(body, context);

    if (payload.skipped) return json(response, 200, { ok: true, skipped: true, reason: payload.reason });

    const rows = await getActiveSubscriptions(context.familyId, payload.endpoint);
    const result = await sendToSubscriptions(payload, rows || [], context.familyId);
    if (payload.afterSend) await payload.afterSend(result.success > 0);

    return json(response, 200, { ok: true, ...result, subscriptionCount: rows?.length || 0 });
  } catch (error) {
    const safe = authorization.publicAuthorizationError(error);
    if (safe.status !== 500) return json(response, safe.status, safe.body);
    return json(response, error.statusCode === 400 ? 400 : 500, {
      ok: false,
      error: error.statusCode === 400 ? "Invalid push request." : "Unable to send push notification.",
      code: error.statusCode === 400 ? "INVALID_PUSH_REQUEST" : "PUSH_SEND_FAILED",
    });
  }
};
