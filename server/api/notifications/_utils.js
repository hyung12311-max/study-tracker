const family = require("../family/_utils");
const push = require("../push/_utils");

const EVENT_COLUMNS = Object.freeze({
  study_complete: "study_complete_enabled",
  family_chat: "family_chat_enabled",
  reward_request: "reward_request_enabled",
  overdue_study: "overdue_study_enabled",
});

const PARENT_ROLES = new Set(["parent", "guardian", "protector"]);

function truncate(value, limit = 50) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function isParentRole(role) {
  return PARENT_ROLES.has(String(role || "").toLowerCase());
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

function subscriptionLogInfo(row) {
  let host = "";
  let tail = "";
  try {
    const url = new URL(row.endpoint);
    host = url.hostname;
    tail = row.endpoint.slice(-16);
  } catch {
    tail = String(row.endpoint || "").slice(-16);
  }
  return {
    member_key: row.member_key || null,
    role: row.role || null,
    endpoint_host: host,
    endpoint_tail: tail,
    has_p256dh: Boolean(row.p256dh),
    has_auth: Boolean(row.auth),
  };
}

async function activeMember(claims) {
  const row = (await family.supabaseFetch(
    `family_members?select=id,family_id,member_key,display_name,role,is_active&family_id=eq.${claims.family}&id=eq.${claims.sub}&member_key=eq.${encodeURIComponent(claims.key)}&limit=1`
  ))?.[0];
  if (!row) throw family.err("AUTH_REQUIRED", 401, "AUTH_REQUIRED");
  if (!row.is_active) throw family.err("MEMBER_INACTIVE", 403, "MEMBER_INACTIVE");
  return row;
}

async function upsertSubscription({ request, claims, subscription, body }) {
  const member = await activeMember(claims);
  const { endpoint, p256dh, auth } = push.validateSubscriptionPayload(subscription);
  try {
    const rows = await family.supabaseFetch("family_push_subscriptions?on_conflict=endpoint", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        family_id: member.family_id,
        member_id: member.id,
        member_key: member.member_key,
        role: member.role,
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
  } catch (error) {
    console.error("[notifications/subscribe] save failed", {
      code: error.code || null,
      statusCode: error.statusCode || null,
      supabaseCode: error.supabaseCode || null,
      message: error.message,
      supabaseMessage: error.supabaseMessage || null,
    });
    throw family.err(error.message || "SUBSCRIPTION_SAVE_FAILED", error.statusCode || 500, "SUBSCRIPTION_SAVE_FAILED");
  }
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
    `family_push_subscriptions?select=endpoint,p256dh,auth,member_key,role&family_id=eq.${familyId}&is_active=eq.true${keyFilter}${excludeFilter}`
  );
  const [preferenceRows, activeMembers] = await Promise.all([
    family.supabaseFetch(`family_notification_preferences?select=member_key,${column}&family_id=eq.${familyId}`).catch(() => []),
    family.supabaseFetch(`family_members?select=member_key,role&family_id=eq.${familyId}&is_active=eq.true`).catch(() => []),
  ]);
  const preferences = new Map((preferenceRows || []).map((row) => [row.member_key, row[column]]));
  const activeMemberMap = new Map((activeMembers || []).map((row) => [row.member_key, row.role]));
  const filtered = (rows || []).filter((row) => activeMemberMap.has(row.member_key) && preferences.get(row.member_key) !== false);
  console.log("[notifications/activeSubscriptions]", {
    familyId,
    event,
    requestedMemberKeys: memberKeys || null,
    excludeMemberKey: excludeMemberKey || null,
    fetchedCount: rows?.length || 0,
    enabledCount: filtered.length,
  });
  return filtered.map((row) => ({ ...row, role: activeMemberMap.get(row.member_key) || row.role }));
}

async function sendPayload(payload, rows) {
  console.log("[notifications/sendPayload] start", {
    title: payload?.title || null,
    tag: payload?.tag || null,
    subscriptionCount: rows?.length || 0,
  });
  push.configureWebPush();
  let success = 0;
  let failure = 0;
  await Promise.all((rows || []).map(async (row) => {
    const info = subscriptionLogInfo(row);
    try {
      console.log("[notifications/sendPayload] before sendNotification", info);
      await push.webPush.sendNotification(subscriptionPayload(row), JSON.stringify(payload));
      console.log("[notifications/sendPayload] after sendNotification", info);
      success += 1;
      await family.supabaseFetch(`family_push_subscriptions?endpoint=eq.${encodeURIComponent(row.endpoint)}`, {
        method: "PATCH",
        body: JSON.stringify({ last_used_at: new Date().toISOString() }),
      }).catch(() => {});
    } catch (error) {
      failure += 1;
      console.error("[notifications/sendPayload] sendNotification failed", {
        ...info,
        statusCode: error.statusCode || null,
        message: error.message,
        body: error.body || null,
      });
      if ([404, 410].includes(error.statusCode)) await markInactive(row.endpoint);
    }
  }));
  console.log("[notifications/sendPayload] done", { success, failure, subscriptionCount: rows?.length || 0 });
  return { success, failure, subscriptionCount: rows?.length || 0 };
}

async function parentMemberKeys(familyId, excludeMemberKey) {
  const rows = await family.supabaseFetch(`family_members?select=member_key,role&family_id=eq.${familyId}&is_active=eq.true`);
  return (rows || [])
    .filter((member) => isParentRole(member.role) && member.member_key !== excludeMemberKey)
    .map((member) => member.member_key);
}

async function sendToFamily({ familyId, memberKeys, excludeMemberKey, event, payload }) {
  const rows = await activeSubscriptions({ familyId, memberKeys, excludeMemberKey, event });
  return sendPayload(payload, rows);
}

module.exports = {
  ...family,
  activeMember,
  activeSubscriptions,
  isParentRole,
  parentMemberKeys,
  sendPayload,
  sendToFamily,
  truncate,
  upsertSubscription,
};
