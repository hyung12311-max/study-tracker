const u = require("./_utils");
const authorization = require("../_authorization");

const FIELDS = ["study_complete_enabled", "family_chat_enabled", "reward_request_enabled", "overdue_study_enabled"];

function normalizePatch(body) {
  const patch = {};
  for (const field of FIELDS) if (typeof body[field] === "boolean") patch[field] = body[field];
  return patch;
}

module.exports = async function handler(request, response) {
  if (!["GET", "PATCH"].includes(request.method)) return u.allow(response, ["GET", "PATCH"]);
  try {
    const context = await authorization.authenticateActiveMember(request, { allowRoles: ["parent", "child"] });
    const familyId = encodeURIComponent(context.familyId);
    if (request.method === "GET") {
      const memberFilter = context.role === "parent" ? "" : `&member_key=eq.${encodeURIComponent(context.memberKey)}`;
      const rows = await u.supabaseFetch(`family_notification_preferences?select=member_key,study_complete_enabled,family_chat_enabled,reward_request_enabled,overdue_study_enabled&family_id=eq.${familyId}${memberFilter}&order=member_key.asc`);
      return u.json(response, 200, { preferences: rows || [] });
    }

    const body = await u.readJson(request);
    const requestedKey = body.member_key === undefined ? context.memberKey : String(body.member_key);
    if (!/^[a-z0-9_-]{2,40}$/.test(requestedKey)) throw u.err("가족 사용자를 확인할 수 없습니다.", 400, "NOTIFICATION_MEMBER_INVALID");
    let memberKey = context.memberKey;
    if (context.role === "child") {
      authorization.childSelfScope(context, body.member_key === undefined ? undefined : body.member_key);
    } else {
      const member = (await u.supabaseFetch(
        `family_members?select=id,family_id,member_key,is_active&family_id=eq.${familyId}&member_key=eq.${encodeURIComponent(requestedKey)}&is_active=eq.true&limit=1`
      ))?.[0];
      if (!member || String(member.family_id) !== context.familyId) throw authorization.safeNotFound("FAMILY_CHILD_NOT_FOUND");
      memberKey = member.member_key;
    }
    const patch = normalizePatch(body);
    if (!Object.keys(patch).length) throw u.err("변경할 알림 설정이 없습니다.", 400, "NOTIFICATION_PATCH_EMPTY");
    await u.supabaseFetch(`family_notification_preferences?family_id=eq.${familyId}&member_key=eq.${encodeURIComponent(memberKey)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return u.json(response, 200, { ok: true });
  } catch (error) {
    const safe = authorization.publicAuthorizationError(error);
    if (safe.status !== 500) return u.json(response, safe.status, safe.body);
    const controlled = Boolean(error.statusCode >= 400 && error.statusCode < 500 && !error.supabaseCode);
    return u.json(response, controlled ? error.statusCode : 500, {
      ok: false,
      error: controlled ? error.message : "알림 설정을 저장하지 못했습니다.",
      code: controlled && error.code ? error.code : "NOTIFICATION_PREFERENCES_FAILED",
    });
  }
};
