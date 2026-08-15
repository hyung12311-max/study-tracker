const u = require("./_utils");
const authorization = require("../_authorization");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);
  try {
    const context = await authorization.authenticateActiveMember(request, { requiredRole: "parent" });
    const result = await u.sendToFamily({
      familyId: context.familyId,
      memberKeys: [context.memberKey],
      event: "family_chat",
      payload: {
        title: "테스트 알림",
        body: "이 기기에서 학습 스티커 알림을 받을 수 있어요.",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        url: "/?tab=family-chat",
        tag: `test-${context.memberKey}-${Date.now()}`,
      },
    });
    return u.json(response, 200, { ok: true, ...result });
  } catch (error) {
    const safe = authorization.publicAuthorizationError(error);
    if (safe.status !== 500) return u.json(response, safe.status, safe.body);
    return u.json(response, 500, { ok: false, error: "테스트 알림을 보내지 못했습니다.", code: "NOTIFICATION_TEST_FAILED" });
  }
};
