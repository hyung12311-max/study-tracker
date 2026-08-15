const u = require("./_utils");
const authorization = require("../_authorization");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);
  try {
    const context = await authorization.authenticateActiveMember(request, { allowRoles: ["parent", "child"] });
    const body = await u.readJson(request);
    const endpoint = body.endpoint || body.subscription?.endpoint;
    if (!endpoint) throw u.err("endpoint is required.");
    await u.supabaseFetch(
      `family_push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}&family_id=eq.${encodeURIComponent(context.familyId)}&member_id=eq.${encodeURIComponent(context.memberId)}&member_key=eq.${encodeURIComponent(context.memberKey)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ is_active: false }),
      }
    );
    return u.json(response, 200, { ok: true });
  } catch (error) {
    const safe = authorization.publicAuthorizationError(error);
    if (safe.status !== 500) return u.json(response, safe.status, safe.body);
    const controlled = Boolean(error.statusCode && error.statusCode < 500 && !error.supabaseCode && !String(error.code || "").startsWith("SUPABASE_"));
    return u.json(response, controlled ? error.statusCode : 500, {
      ok: false,
      error: controlled ? "알림 구독 정보를 확인해 주세요." : "알림 구독을 해제하지 못했습니다.",
      ...(controlled ? { code: "INVALID_SUBSCRIPTION" } : {}),
    });
  }
};
