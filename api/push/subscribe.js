const {
  json,
  methodNotAllowed,
  readJson,
  supabaseFetch,
  validateSubscriptionPayload,
} = require("./_utils");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return methodNotAllowed(response);

  try {
    const body = await readJson(request);
    const subscription = body.subscription || body;
    const { endpoint, p256dh, auth } = validateSubscriptionPayload(subscription);
    const userAgent = request.headers["user-agent"] || body.userAgent || "";
    let familyMemberId = null;
    if (body.familyMemberId) {
      const { authenticate } = require("../family/_utils");
      const claims = authenticate(request);
      if (claims.sub !== body.familyMemberId) {
        const error = new Error("Cannot register a device for another member.");
        error.statusCode = 403;
        throw error;
      }
      familyMemberId = claims.sub;
    }

    const rows = await supabaseFetch("push_subscriptions?on_conflict=endpoint", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        user_role: familyMemberId ? "family" : "parent",
        child_name: body.childName || "하겸이",
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent,
        family_member_id: familyMemberId,
        device_name: String(body.deviceName || "").slice(0, 100) || null,
        is_active: true,
      }),
    });

    return json(response, 200, { ok: true, id: rows?.[0]?.id || null });
  } catch (error) {
    return json(response, error.statusCode || 500, { error: error.message });
  }
};
