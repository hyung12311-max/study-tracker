const u = require("./_utils");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);
  try {
    const claims = u.authenticate(request);
    const result = await u.sendToFamily({
      familyId: claims.family,
      memberKeys: [claims.key],
      event: "family_chat",
      payload: {
        title: "테스트 알림",
        body: "이 기기에서 학습 스티커 알림을 받을 수 있어요.",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        url: "/?tab=family-chat",
        tag: `test-${claims.key}-${Date.now()}`,
      },
    });
    return u.json(response, 200, { ok: true, ...result });
  } catch (error) {
    return u.json(response, error.statusCode || 500, {
      ok: false,
      error: error.statusCode ? error.message : "테스트 알림을 보내지 못했습니다.",
    });
  }
};
