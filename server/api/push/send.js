const {
  configureWebPush,
  json,
  markInactive,
  methodNotAllowed,
  normalizeSubscription,
  readJson,
  supabaseFetch,
  validateSubscriptionPayload,
  webPush,
} = require("./_utils");

function isDone(status) {
  return status === "done" || status === "완료";
}

async function getActiveSubscriptions(endpoint) {
  const query = endpoint
    ? `push_subscriptions?select=endpoint,p256dh,auth&is_active=eq.true&endpoint=eq.${encodeURIComponent(endpoint)}`
    : "push_subscriptions?select=endpoint,p256dh,auth&is_active=eq.true";
  return supabaseFetch(query);
}

async function buildStudyPayload(body) {
  if (!body.planId) {
    const error = new Error("planId is required.");
    error.statusCode = 400;
    throw error;
  }

  const plans = await supabaseFetch(
    `study_plans?select=id,subject,book,unit,target,status,parent_notified_at&id=eq.${encodeURIComponent(body.planId)}&limit=1`
  );
  const plan = plans?.[0];
  if (!plan) return { skipped: true, reason: "plan-not-found" };
  if (!isDone(plan.status)) return { skipped: true, reason: "plan-not-completed" };
  if (plan.parent_notified_at) return { skipped: true, reason: "already-notified" };
  const reward = (await supabaseFetch(
    `sticker_history?select=sticker_count&study_plan_id=eq.${encodeURIComponent(plan.id)}&limit=1`
  ))?.[0];
  const awardedStickerCount = Number(reward?.sticker_count || 0);

  return {
    tag: `study-complete-${plan.id}`,
    url: "/?tab=progress",
    title: "하겸이 학습 완료 ⭐",
    body: `하겸이가 ${plan.subject} · ${plan.book} 학습을 완료했어요. ${awardedStickerCount > 0 ? `스티커 ${awardedStickerCount}개를 받았습니다.` : "지급된 스티커는 없습니다."}`,
    afterSend: async (delivered) => {
      await supabaseFetch(`study_plans?id=eq.${encodeURIComponent(plan.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          parent_notified_at: new Date().toISOString(),
          parent_notification_delivered: delivered,
        }),
      });
    },
  };
}

async function buildAcademyPayload(body) {
  if (!body.scheduleId || !body.completedDate) {
    const error = new Error("scheduleId and completedDate are required.");
    error.statusCode = 400;
    throw error;
  }

  const completions = await supabaseFetch(
    `academy_completion_history?select=id&academy_schedule_id=eq.${encodeURIComponent(body.scheduleId)}&completed_date=eq.${encodeURIComponent(body.completedDate)}&limit=1`
  );
  if (!completions?.length) return { skipped: true, reason: "academy-completion-not-found" };

  const schedules = await supabaseFetch(
    `academy_schedules?select=id,name&id=eq.${encodeURIComponent(body.scheduleId)}&limit=1`
  );
  const schedule = schedules?.[0];
  if (!schedule) return { skipped: true, reason: "academy-schedule-not-found" };

  return {
    tag: `academy-complete-${schedule.id}-${body.completedDate}`,
    url: "/?tab=progress",
    title: "하겸이 일정 완료 ⭐",
    body: `하겸이가 ${schedule.name} 일정을 완료했어요.`,
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

async function sendToSubscriptions(payload, rows) {
  let success = 0;
  let failure = 0;

  await Promise.all(rows.map(async (row) => {
    try {
      await webPush.sendNotification(normalizeSubscription(row), JSON.stringify(payload));
      success += 1;
    } catch (error) {
      failure += 1;
      if (error.statusCode === 404 || error.statusCode === 410) {
        await markInactive(row.endpoint);
      }
    }
  }));

  return { success, failure };
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return methodNotAllowed(response);

  try {
    configureWebPush();
    const body = await readJson(request);
    const payload = body.type === "test"
      ? await buildTestPayload(body)
      : body.type === "academy-complete"
        ? await buildAcademyPayload(body)
        : await buildStudyPayload(body);

    if (payload.skipped) return json(response, 200, { ok: true, skipped: true, reason: payload.reason });

    const rows = await getActiveSubscriptions(payload.endpoint);
    const result = await sendToSubscriptions(payload, rows || []);
    if (payload.afterSend) await payload.afterSend(result.success > 0);

    return json(response, 200, { ok: true, ...result, subscriptionCount: rows?.length || 0 });
  } catch (error) {
    return json(response, error.statusCode || 500, { error: error.message });
  }
};
