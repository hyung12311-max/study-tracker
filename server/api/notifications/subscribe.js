const u = require("./_utils");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);
  try {
    const claims = u.authenticate(request);
    const body = await u.readJson(request);
    const row = await u.upsertSubscription({ request, claims, subscription: body.subscription || body, body });
    return u.json(response, 200, { ok: true, id: row?.id || null, member_key: claims.key, role: claims.role });
  } catch (error) {
    const code = error.code || (error.statusCode === 401 ? "AUTH_REQUIRED" : "SUBSCRIPTION_SAVE_FAILED");
    return u.json(response, error.statusCode || 500, {
      ok: false,
      code,
      error: code,
      message: error.message,
    });
  }
};
