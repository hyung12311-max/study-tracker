const u = require("./_utils");

module.exports = async function familySession(request, response) {
  if (request.method !== "GET") return u.allow(response, ["GET"]);
  try {
    const claims = u.authenticate(request);
    const member = (await u.supabaseFetch(
      `family_members?select=id,family_id,member_key,display_name,role,avatar_emoji,is_active&family_id=eq.${claims.family}&id=eq.${claims.sub}&member_key=eq.${encodeURIComponent(claims.key)}&limit=1`
    ))?.[0];
    if (!member) throw u.err("AUTH_REQUIRED", 401, "AUTH_REQUIRED");
    if (!member.is_active) throw u.err("MEMBER_INACTIVE", 403, "MEMBER_INACTIVE");
    return u.json(response, 200, {
      ok: true,
      token: u.signToken(member),
      realtimeToken: u.signRealtimeToken(member),
      expiresIn: u.FAMILY_TOKEN_TTL_SECONDS,
      member: {
        id: member.id,
        family_id: member.family_id,
        member_key: member.member_key,
        display_name: member.display_name,
        role: member.role,
        avatar_emoji: member.avatar_emoji,
      },
    });
  } catch (error) {
    return u.json(response, error.statusCode || 500, {
      ok: false,
      code: error.code || "SESSION_INVALID",
      error: error.message,
    });
  }
};
