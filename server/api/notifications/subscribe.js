const u = require("./_utils");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);
  try {
    const claims = u.authenticate(request);
    const body = await u.readJson(request);
    const row = await u.upsertSubscription({ request, claims, subscription: body.subscription || body, body });
    return u.json(response, 200, { ok: true, id: row?.id || null });
  } catch (error) {
    return u.json(response, error.statusCode || 500, {
      ok: false,
      error: error.statusCode ? error.message : "알림 구독을 저장하지 못했습니다.",
    });
  }
};
