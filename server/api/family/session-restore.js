const u = require("./_utils");

function memberSafe(member) {
  return {
    id: member.id,
    family_id: member.family_id,
    member_key: member.member_key,
    display_name: member.display_name,
    role: member.role,
    avatar_emoji: member.avatar_emoji,
  };
}

module.exports = async function restoreFamilyDeviceSession(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);
  let stage = "read-token";
  let memberKey = null;
  try {
    const body = await u.readJson(request);
    const rawToken = body.deviceSessionToken || u.cookieToken(request);
    if (!u.validDeviceToken(rawToken)) throw u.err("Saved device session is missing.", 401, "DEVICE_SESSION_MISSING");

    stage = "load-session";
    const session = (await u.supabaseFetch(
      `family_device_sessions?select=id,family_id,member_id,member_key,is_active,expires_at,revoked_at&token_hash=eq.${u.tokenHash(rawToken)}&limit=1`
    ))?.[0];
    const expired = session && new Date(session.expires_at) <= new Date();
    if (session && !session.revoked_at && expired) {
      await u.supabaseFetch(`family_device_sessions?id=eq.${session.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: false, revoked_at: new Date().toISOString(), revoked_reason: "expired" }),
      });
    }
    if (!session || session.is_active === false || session.revoked_at || expired) {
      u.clearDeviceCookie(request, response);
      throw u.err("Saved device session is invalid or expired.", 401, "DEVICE_SESSION_INVALID");
    }

    memberKey = session.member_key;
    stage = "load-member";
    const member = (await u.supabaseFetch(
      `family_members?select=id,family_id,member_key,display_name,role,avatar_emoji,is_active&id=eq.${session.member_id}&family_id=eq.${session.family_id}&member_key=eq.${encodeURIComponent(session.member_key)}&is_active=eq.true&limit=1`
    ))?.[0];
    if (!member) {
      await u.supabaseFetch(`family_device_sessions?id=eq.${session.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: false, revoked_at: new Date().toISOString(), revoked_reason: "member_unavailable" }),
      });
      u.clearDeviceCookie(request, response);
      throw u.err("Saved family member is unavailable.", 403, "DEVICE_MEMBER_INVALID");
    }

    stage = "extend-session";
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + u.DEVICE_MAX_AGE * 1000).toISOString();
    await u.supabaseFetch(`family_device_sessions?id=eq.${session.id}`, {
      method: "PATCH",
      body: JSON.stringify({ last_used_at: now, expires_at: expiresAt, updated_at: now }),
    });
    u.setDeviceCookie(request, response, rawToken);
    console.info("[family session restore]", { stage: "complete", ok: true, status: 200, code: null, memberKey });
    return u.json(response, 200, {
      ok: true,
      token: u.signToken(member),
      realtimeToken: u.signRealtimeToken(member),
      expiresIn: 28800,
      expires_at: expiresAt,
      rememberDevice: true,
      member: memberSafe(member),
    });
  } catch (error) {
    console.warn("[family session restore]", { stage, ok: false, status: error.statusCode || 500, code: error.code || "DEVICE_SESSION_RESTORE_FAILED", message: error.message, memberKey });
    return u.json(response, error.statusCode || 500, {
      ok: false,
      error: error.statusCode ? error.message : "Unable to restore device session.",
      code: error.code || "DEVICE_SESSION_RESTORE_FAILED",
    });
  }
};
