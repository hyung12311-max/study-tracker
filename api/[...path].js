const familyMembers = require("../server/api/family/members");
const familyMessages = require("../server/api/family/messages");
const familyChangePin = require("../server/api/family/change-pin");
const familyPin = require("../server/api/family/pin");
const familyRead = require("../server/api/family/read");
const familyVerifyPin = require("../server/api/family/verify-pin");
const notificationsPublicKey = require("../server/api/notifications/public-key");
const notificationsPreferences = require("../server/api/notifications/preferences");
const notificationsStudyComplete = require("../server/api/notifications/study-complete");
const notificationsSubscribe = require("../server/api/notifications/subscribe");
const notificationsTest = require("../server/api/notifications/test");
const notificationsUnsubscribe = require("../server/api/notifications/unsubscribe");
const pushPublicKey = require("../server/api/push/public-key");
const pushSend = require("../server/api/push/send");
const pushSubscribe = require("../server/api/push/subscribe");
const pushUnsubscribe = require("../server/api/push/unsubscribe");
const rewards = require("../server/api/rewards");
const rewardsAcademyComplete = require("../server/api/rewards/academy-complete");
const rewardsExchange = require("../server/api/rewards/exchange");
const rewardsProducts = require("../server/api/rewards/products");
const rewardsWishlist = require("../server/api/rewards/wishlist");

const routes = Object.freeze({
  "family/members": familyMembers,
  "family/login": familyVerifyPin,
  "family/change-pin": familyChangePin,
  "family/messages": familyMessages,
  "family/pin": familyPin,
  "family/read": familyRead,
  "family/verify-pin": familyVerifyPin,
  "notifications/public-key": notificationsPublicKey,
  "notifications/preferences": notificationsPreferences,
  "notifications/study-complete": notificationsStudyComplete,
  "notifications/subscribe": notificationsSubscribe,
  "notifications/test": notificationsTest,
  "notifications/unsubscribe": notificationsUnsubscribe,
  "push/public-key": pushPublicKey,
  "push/send": pushSend,
  "push/subscribe": pushSubscribe,
  "push/unsubscribe": pushUnsubscribe,
  rewards,
  "rewards/academy-complete": rewardsAcademyComplete,
  "rewards/exchange": rewardsExchange,
  "rewards/products": rewardsProducts,
  "rewards/wishlist": rewardsWishlist,
});

function routeKey(request) {
  const queryPath = request.query?.path;
  if (Array.isArray(queryPath)) return queryPath.join("/");
  if (typeof queryPath === "string" && queryPath) return queryPath.replace(/^\/+|\/+$/g, "");

  const url = new URL(request.url, "http://localhost");
  const searchPath = url.searchParams.get("path");
  if (searchPath) return searchPath.replace(/^\/+|\/+$/g, "");

  const pathname = url.pathname;
  return pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");
}

module.exports = async function apiRouter(request, response) {
  const handler = routes[routeKey(request)];
  if (!handler) {
    response.statusCode = 404;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: "API route not found." }));
    return;
  }
  return handler(request, response);
};
