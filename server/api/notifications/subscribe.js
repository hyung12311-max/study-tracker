const u = require("./_utils");

function errorPayload(error) {
  return {
    status: error.statusCode || 500,
    code: error.supabaseCode || error.code || "PUSH_SUBSCRIBE_FAILED",
    message: error.supabaseMessage || error.message || "Push subscription failed.",
    details: error.supabaseDetails || null,
    hint: error.supabaseHint || null,
    supabaseStatus: error.supabaseStatus || null,
  };
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);
  let claims = null;
  try {
    claims = u.authenticate(request);
    const body = await u.readJson(request);
    const row = await u.upsertSubscription({ request, claims, subscription: body.subscription || body, body });
    console.log("[push subscribe] success", {
      status: 200,
      memberKey: claims.key,
      role: claims.role,
      subscriptionId: row?.id || null,
    });
    return u.json(response, 200, { ok: true, id: row?.id || null, memberKey: claims.key, role: claims.role });
  } catch (error) {
    const failure = errorPayload(error);
    console.error("[push subscribe failed]", {
      ...failure,
      memberKey: claims?.key || null,
      role: claims?.role || null,
    });
    return u.json(response, failure.status, {
      ok: false,
      error: "알림 등록에 실패했습니다. 로그인 권한 또는 기기 알림 설정을 확인해 주세요.",
      code: failure.code,
      message: failure.message,
      details: failure.details,
    });
  }
};
