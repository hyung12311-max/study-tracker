const u = require("./_utils");

module.exports = async function childLogin(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);
  try {
    const body = await u.readJson(request);
    if (!/^[0-9a-f-]{36}$/i.test(body.memberId || "")) throw u.err("Select a child member.");
    const rows = await u.supabaseFetch(`family_members?select=id,family_id,member_key,display_name,role,avatar_emoji,is_active&id=eq.${encodeURIComponent(body.memberId)}&role=eq.child&is_active=eq.true&limit=1`);
    const member = rows?.[0];
    if (!member) throw u.err("Active child member not found.", 404);
    let deviceSession = null;
    if (body.rememberDevice !== false) {
      deviceSession = await u.createDeviceSession(request, response, member, body.deviceSessionToken);
    } else {
      await u.revokeDeviceSession(body.deviceSessionToken, "remember_device_disabled");
      u.clearDeviceCookie(request, response);
    }
    return u.json(response, 200, {
      token: u.signToken(member), realtimeToken: u.signRealtimeToken(member), expiresIn: 28800,
      expires_at: deviceSession?.expiresAt || null,
      rememberDevice: Boolean(deviceSession),
      ...(deviceSession ? { deviceSessionToken: deviceSession.token } : {}),
      member: { id: member.id, family_id: member.family_id, member_key: member.member_key, display_name: member.display_name, role: member.role, avatar_emoji: member.avatar_emoji },
    });
  } catch (error) {
    console.error("[child login] failed", { status: error.statusCode || 500, message: error.message });
    return u.json(response, error.statusCode || 500, { error: error.statusCode ? error.message : "Child login failed." });
  }
};
