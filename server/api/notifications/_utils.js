const family = require("../family/_utils");
const push = require("../push/_utils");

const EVENT_COLUMNS = Object.freeze({
  study_complete: "study_complete_enabled",
  family_chat: "family_chat_enabled",
  reward_request: "reward_request_enabled",
  overdue_study: "overdue_study_enabled",
});

function truncate(value, limit = 50) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function clientDeviceName(request, body) {
  return String(body.deviceName || body.device_name || request.headers["sec-ch-ua-platform"] || "")
    .replace(/"/g, "")
    .slice(0, 100) || null;
}

function subscriptionPayload(row) {
  return {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  };
}

async function upsertSubscription({ request, claims, subscription, body }) {
  const { endpoint, p256dh, auth } = push.validateSubscriptionPayload(subscription);
  const rows = await family.supabaseFetch("family_push_subscriptions?on_conflict=endpoint", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      family_id: claims.family,
      member_id: claims.sub,
      member_key: claims.key,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers["user-agent"] || "",
      device_name: clientDeviceName(request, body),
      is_active: true,
      last_used_at: new Date().toISOString(),
    }),
  });
  return rows?.[0] || null;
}

async function markInactive(endpoint) {
  await family.supabaseFetch(`family_push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: false }),
  });
  await push.markInactive(endpoint).catch(() => {});
}

async function activeSubscriptions({ familyId, memberKeys, excludeMemberKey, event = "family_chat" }) {
  const column = EVENT_COLUMNS[event] || EVENT_COLUMNS.family_chat;
  const keyFilter = memberKeys?.length ? `&member_key=in.(${memberKeys.map(encodeURIComponent).join(",")})` : "";
  const excludeFilter = excludeMemberKey ? `&member_key=neq.${encodeURIComponent(excludeMemberKey)}` : "";
  const rows = await family.supabaseFetch(
    `family_push_subscriptions?select=endpoint,p256dh,auth,member_key&family_id=eq.${familyId}&is_active=eq.true${keyFilter}${excludeFilter}`
  );
  const preferenceRows = await family.supabaseFetch(
    `family_notification_preferences?select=member_key,${column}&family_id=eq.${familyId}`
  ).catch(() => []);
  const preferences = new Map((preferenceRows || []).map((row) => [row.member_key, row[column]]));
  return (rows || []).filter((row) => preferences.get(row.member_key) !== false);
}

async function sendPayload(payload, rows) {
  push.configureWebPush();
  let success = 0;
  let failure = 0;
  await Promise.all((rows || []).map(async (row) => {
    try {
      await push.webPush.sendNotification(subscriptionPayload(row), JSON.stringify(payload));
      success += 1;
      await family.supabaseFetch(`family_push_subscriptions?endpoint=eq.${encodeURIComponent(row.endpoint)}`, {
        method: "PATCH",
        body: JSON.stringify({ last_used_at: new Date().toISOString() }),
      }).catch(() => {});
    } catch (error) {
      failure += 1;
      if ([404, 410].includes(error.statusCode)) await markInactive(row.endpoint);
    }
  }));
  return { success, failure, subscriptionCount: rows?.length || 0 };
}

async function sendToFamily({ familyId, memberKeys, excludeMemberKey, event, payload }) {
  const rows = await activeSubscriptions({ familyId, memberKeys, excludeMemberKey, event });
  return sendPayload(payload, rows);
}

module.exports = {
  ...family,
  activeSubscriptions,
  sendPayload,
  sendToFamily,
  truncate,
  upsertSubscription,
};
