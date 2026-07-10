const crypto = require("crypto");
const push = require("../push/_utils");
const FAMILY_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

function err(message, statusCode = 400, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
}

function secret() {
  const value = push.env("FAMILY_AUTH_SECRET");
  if (!value || value.length < 32) {
    const error = err("Family authentication is not configured.", 500, "FAMILY_AUTH_NOT_CONFIGURED");
    error.missingEnvironmentVariables = ["FAMILY_AUTH_SECRET"];
    throw error;
  }
  return value;
}

function signToken(member) {
  const payload = Buffer.from(JSON.stringify({
    sub: member.member_id || member.id,
    family: member.family_id,
    key: member.member_key,
    role: member.role,
    exp: Math.floor(Date.now() / 1000) + FAMILY_TOKEN_TTL_SECONDS,
  })).toString("base64url");
  return `${payload}.${crypto.createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}

function signRealtimeToken(member) {
  const jwtSecret = push.env("SUPABASE_JWT_SECRET");
  if (!jwtSecret) {
    const error = err("Realtime authentication is not configured.", 500, "REALTIME_AUTH_NOT_CONFIGURED");
    error.missingEnvironmentVariables = ["SUPABASE_JWT_SECRET"];
    throw error;
  }
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub: member.member_id || member.id,
    aud: "authenticated",
    role: "authenticated",
    family_id: member.family_id,
    exp: Math.floor(Date.now() / 1000) + FAMILY_TOKEN_TTL_SECONDS,
  })).toString("base64url");
  const input = `${header}.${payload}`;
  return `${input}.${crypto.createHmac("sha256", jwtSecret).update(input).digest("base64url")}`;
}

function verify(raw) {
  const [payload, sig] = String(raw || "").split(".");
  if (!payload || !sig) throw err("AUTH_REQUIRED", 401, "AUTH_REQUIRED");
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(sig, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw err("AUTH_REQUIRED", 401, "AUTH_REQUIRED");
  }
  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    throw err("AUTH_REQUIRED", 401, "AUTH_REQUIRED");
  }
  if (!claims.sub || !claims.family || claims.exp <= Date.now() / 1000) throw err("AUTH_REQUIRED", 401, "AUTH_REQUIRED");
  return claims;
}

function authenticate(req, role) {
  const header = req.headers.authorization || "";
  const claims = verify(header.startsWith("Bearer ") ? header.slice(7) : "");
  if (role && claims.role !== role) throw err("Parent permission is required.", 403, "PARENT_ONLY");
  return claims;
}

function allow(res, methods) {
  res.setHeader("Allow", methods.join(", "));
  return push.json(res, 405, { error: "Method not allowed." });
}

function safe(row) {
  return {
    id: row.id,
    family_id: row.family_id,
    sender_id: row.sender_id,
    message_type: row.message_type,
    content: row.content,
    related_type: row.related_type,
    related_id: row.related_id,
    client_message_id: row.client_message_id,
    created_at: row.created_at,
    sender: row.sender_id ? {
      id: row.sender_id,
      display_name: row.sender_name,
      avatar_emoji: row.sender_avatar,
    } : null,
  };
}

async function fetchMessages(family, before, limit) {
  let query = `family_messages?select=id,family_id,sender_id,message_type,content,related_type,related_id,client_message_id,created_at,family_members!family_messages_sender_id_fkey(display_name,avatar_emoji)&family_id=eq.${encodeURIComponent(family)}&deleted_at=is.null&order=created_at.desc&limit=${Math.min(Math.max(Number(limit) || 50, 1), 50)}`;
  if (before) query += `&created_at=lt.${encodeURIComponent(before)}`;
  const rows = await push.supabaseFetch(query);
  return (rows || []).map((row) => safe({
    ...row,
    sender_name: row.family_members?.display_name,
    sender_avatar: row.family_members?.avatar_emoji,
  })).reverse();
}

async function sendPush(message, sender) {
  try {
    const notifications = require("../notifications/_utils");
    const settings = (await push.supabaseFetch(
      `families?select=chat_notifications_enabled,system_notifications_enabled&id=eq.${message.family_id}&limit=1`
    ))?.[0];
    if (!settings?.chat_notifications_enabled || (message.message_type === "system" && !settings.system_notifications_enabled)) return;
    const result = await notifications.sendToFamily({
      familyId: message.family_id,
      excludeMemberKey: sender?.member_key,
      event: message.message_type === "system" ? "study_complete" : "family_chat",
      payload: {
        title: message.message_type === "system" ? "📚 학습 알림" : `💬 ${sender?.display_name || "가족"}`,
        body: notifications.truncate(message.content, 50),
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        url: "/?tab=family-chat",
        tag: `family-message-${message.id}`,
      },
    });
    console.log("[family push]", { messageId: message.id, ok: result.success, failed: result.failure });
    await push.supabaseFetch(`family_messages?id=eq.${message.id}`, {
      method: "PATCH",
      body: JSON.stringify({ push_sent_at: new Date().toISOString() }),
    });
  } catch (error) {
    console.warn("[family push] delivery failed", { messageId: message.id, statusCode: error.statusCode || 500 });
  }
}

module.exports = {
  allow,
  authenticate,
  env: push.env,
  err,
  fetchMessages,
  json: push.json,
  readJson: push.readJson,
  requireEnv: push.requireEnv,
  safe,
  sendPush,
  signRealtimeToken,
  signToken,
  supabaseFetch: push.supabaseFetch,
  FAMILY_TOKEN_TTL_SECONDS,
};
