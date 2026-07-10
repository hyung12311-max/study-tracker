const u = require("./_utils");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);
  try {
    const claims = u.authenticate(request);
    const body = await u.readJson(request);
    const endpoint = body.endpoint || body.subscription?.endpoint;
    if (!endpoint) throw u.err("endpoint is required.");
    await u.supabaseFetch(
      `family_push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}&family_id=eq.${claims.family}&member_key=eq.${encodeURIComponent(claims.key)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ is_active: false }),
      }
    );
    return u.json(response, 200, { ok: true });
  } catch (error) {
    return u.json(response, error.statusCode || 500, {
      ok: false,
      error: error.statusCode ? error.message : "알림 구독을 해제하지 못했습니다.",
    });
  }
};
