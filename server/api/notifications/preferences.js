const u = require("./_utils");

const FIELDS = ["study_complete_enabled", "family_chat_enabled", "reward_request_enabled", "overdue_study_enabled"];

function normalizePatch(body) {
  const patch = {};
  for (const field of FIELDS) {
    if (typeof body[field] === "boolean") patch[field] = body[field];
  }
  return patch;
}

module.exports = async function handler(request, response) {
  if (!["GET", "PATCH"].includes(request.method)) return u.allow(response, ["GET", "PATCH"]);
  try {
    const claims = u.authenticate(request);
    if (request.method === "GET") {
      const memberFilter = claims.role === "parent" ? "" : `&member_key=eq.${encodeURIComponent(claims.key)}`;
      const rows = await u.supabaseFetch(
        `family_notification_preferences?select=member_key,study_complete_enabled,family_chat_enabled,reward_request_enabled,overdue_study_enabled&family_id=eq.${claims.family}${memberFilter}&order=member_key.asc`
      );
      return u.json(response, 200, { preferences: rows || [] });
    }

    const body = await u.readJson(request);
    const memberKey = String(body.member_key || claims.key);
    if (claims.role !== "parent" && memberKey !== claims.key) {
      throw u.err("본인의 알림 설정만 변경할 수 있습니다.", 403);
    }
    if (!/^[a-z0-9_-]{2,40}$/.test(memberKey)) throw u.err("가족 사용자를 확인할 수 없습니다.");
    const patch = normalizePatch(body);
    if (!Object.keys(patch).length) throw u.err("변경할 알림 설정이 없습니다.");

    await u.supabaseFetch(`family_notification_preferences?family_id=eq.${claims.family}&member_key=eq.${encodeURIComponent(memberKey)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return u.json(response, 200, { ok: true });
  } catch (error) {
    return u.json(response, error.statusCode || 500, {
      ok: false,
      error: error.statusCode ? error.message : "알림 설정을 저장하지 못했습니다.",
    });
  }
};
