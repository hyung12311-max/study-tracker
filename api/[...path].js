const familyMembers = require("../server/api/family/members");
const familyMessages = require("../server/api/family/messages");
const familyChangePin = require("../server/api/family/change-pin");
const familyPin = require("../server/api/family/pin");
const familyRead = require("../server/api/family/read");
const familyVerifyPin = require("../server/api/family/verify-pin");
const familyChildLogin = require("../server/api/family/child-login");
const familySession = require("../server/api/family/session");
const familySessionRestore = require("../server/api/family/session-restore");
const familyLogout = require("../server/api/family/logout");
const familyLogoutAll = require("../server/api/family/logout-all");
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
const rewardsStickerSettings = require("../server/api/rewards/sticker-settings");
const rewardsStudyComplete = require("../server/api/rewards/study-complete");
const rewardMilestones = require("../server/api/reward-milestones");
const completionNotifications = require("../server/api/completion-notifications");
const studyAcademySchedules = require("../server/api/study/academy-schedules");
const studyBookPlans = require("../server/api/study/book-plans");
const studyPlans = require("../server/api/study/plans");
const studyReadingPlans = require("../server/api/study/reading-plans");
const hangulDailyComplete = require("../server/api/hangul/daily-complete");
const learningCatalog = require("../server/api/learning/catalog");
const learningRoadmap = require("../server/api/learning/roadmap");
const learningProfile = require("../server/api/learning/profile");
const learningAssignments = require("../server/api/learning/assignments");
const learningPlans = require("../server/api/learning/plans");
const learningScores = require("../server/api/learning/scores");
const learningAttemptHistory = require("../server/api/learning/attempt-history");
const learningSkills = require("../server/api/learning/skills");
const learningRecommendations = require("../server/api/learning/recommendations");
const learningReviewQueue = require("../server/api/learning/review-queue");
const learningReviewSchedule = require("../server/api/learning/review-schedule");
const learningAssignmentCancel = require("../server/api/learning/assignments/[assignmentId]/cancel");
const learningAssignmentMistakes = require("../server/api/learning/assignments/[assignmentId]/mistakes");
const learningMistakeReveal = require("../server/api/learning/assignments/[assignmentId]/mistakes/[questionId]/reveal");
const learningMistakeReviewStart = require("../server/api/learning/assignments/[assignmentId]/mistake-reviews");
const learningMistakeReview = require("../server/api/learning/mistake-reviews/[reviewId]");
const learningMistakeReviewAnswer = require("../server/api/learning/mistake-reviews/[reviewId]/items/[itemId]/answers");
const learningMistakeReviewAbandon = require("../server/api/learning/mistake-reviews/[reviewId]/abandon");
const learningAttemptStart = require("../server/api/learning/assignments/[assignmentId]/stages/[stageId]/attempts");
const learningAttempt = require("../server/api/learning/attempts/[attemptId]");
const learningAttemptAnswer = require("../server/api/learning/attempts/[attemptId]/answers");
const learningAttemptFinalize = require("../server/api/learning/attempts/[attemptId]/finalize");
const learningAttemptAbandon = require("../server/api/learning/attempts/[attemptId]/abandon");

const routes = Object.freeze({
  "family/members": familyMembers,
  "family/login": familyVerifyPin,
  "family/change-pin": familyChangePin,
  "family/messages": familyMessages,
  "family/pin": familyPin,
  "family/read": familyRead,
  "family/verify-pin": familyVerifyPin,
  "family/child-login": familyChildLogin,
  "family/session": familySession,
  "family/session/restore": familySessionRestore,
  "family/logout": familyLogout,
  "family/logout-all": familyLogoutAll,
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
  "rewards/sticker-settings": rewardsStickerSettings,
  "rewards/study-complete": rewardsStudyComplete,
  reward_milestones: rewardMilestones,
  completion_notifications: completionNotifications,
  "study/academy-schedules": studyAcademySchedules,
  "study/book-plans": studyBookPlans,
  "study/plans": studyPlans,
  "study/reading-plans": studyReadingPlans,
  "hangul/daily-complete": hangulDailyComplete,
  "learning/catalog": learningCatalog,
  "learning/roadmap": learningRoadmap,
  "learning/profile": learningProfile,
  "learning/assignments": learningAssignments,
  "learning/plans": learningPlans,
  "learning/scores": learningScores,
  "learning/attempt-history": learningAttemptHistory,
  "learning/skills": learningSkills,
  "learning/recommendations": learningRecommendations,
  "learning/review-queue": learningReviewQueue,
  "learning/review-schedule": learningReviewSchedule,
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
  const key = routeKey(request);
  let handler = routes[key];
  const revealMatch = key.match(/^learning\/assignments\/([0-9a-f-]+)\/mistakes\/([0-9a-f-]+)\/reveal$/i);
  const mistakesMatch = key.match(/^learning\/assignments\/([0-9a-f-]+)\/mistakes$/i);
  const reviewStartMatch = key.match(/^learning\/assignments\/([0-9a-f-]+)\/mistake-reviews$/i);
  const reviewMatch = key.match(/^learning\/mistake-reviews\/([0-9a-f-]+)$/i);
  const reviewAnswerMatch = key.match(/^learning\/mistake-reviews\/([0-9a-f-]+)\/items\/([0-9a-f-]+)\/answers$/i);
  const reviewAbandonMatch = key.match(/^learning\/mistake-reviews\/([0-9a-f-]+)\/abandon$/i);
  const cancelMatch = key.match(/^learning\/assignments\/([0-9a-f-]+)\/cancel$/i);
  const planStateMatch = key.match(/^learning\/plans\/([0-9a-f-]+)\/(pause|resume)$/i);
  const planMatch = key.match(/^learning\/plans\/([0-9a-f-]+)$/i);
  const startMatch = key.match(/^learning\/assignments\/([0-9a-f-]+)\/stages\/([0-9a-f-]+)\/attempts$/i);
  const answerMatch = key.match(/^learning\/attempts\/([0-9a-f-]+)\/answers$/i);
  const finalizeMatch = key.match(/^learning\/attempts\/([0-9a-f-]+)\/finalize$/i);
  const abandonMatch = key.match(/^learning\/attempts\/([0-9a-f-]+)\/abandon$/i);
  const attemptMatch = key.match(/^learning\/attempts\/([0-9a-f-]+)$/i);
  if (!handler && revealMatch) {
    request.query = { ...(request.query || {}), assignmentId: revealMatch[1], questionId: revealMatch[2] };
    handler = learningMistakeReveal;
  }
  if (!handler && mistakesMatch) {
    request.query = { ...(request.query || {}), assignmentId: mistakesMatch[1] };
    handler = learningAssignmentMistakes;
  }
  if (!handler && reviewStartMatch) {
    request.query = { ...(request.query || {}), assignmentId: reviewStartMatch[1] };
    handler = learningMistakeReviewStart;
  }
  if (!handler && reviewAnswerMatch) {
    request.query = { ...(request.query || {}), reviewId: reviewAnswerMatch[1], itemId: reviewAnswerMatch[2] };
    handler = learningMistakeReviewAnswer;
  }
  if (!handler && reviewAbandonMatch) {
    request.query = { ...(request.query || {}), reviewId: reviewAbandonMatch[1] };
    handler = learningMistakeReviewAbandon;
  }
  if (!handler && reviewMatch) {
    request.query = { ...(request.query || {}), reviewId: reviewMatch[1] };
    handler = learningMistakeReview;
  }
  if (!handler && cancelMatch) {
    request.query = { ...(request.query || {}), assignmentId: cancelMatch[1] };
    handler = learningAssignmentCancel;
  }
  if (!handler && planStateMatch) {
    request.query = { ...(request.query || {}), planId: planStateMatch[1] };
    handler = planStateMatch[2].toLowerCase() === "pause" ? learningPlans.pause : learningPlans.resume;
  }
  if (!handler && planMatch) {
    request.query = { ...(request.query || {}), planId: planMatch[1] };
    handler = learningPlans.item;
  }
  if (!handler && startMatch) {
    request.query = { ...(request.query || {}), assignmentId: startMatch[1], stageId: startMatch[2] };
    handler = learningAttemptStart;
  }
  if (!handler && answerMatch) {
    request.query = { ...(request.query || {}), attemptId: answerMatch[1] };
    handler = learningAttemptAnswer;
  }
  if (!handler && finalizeMatch) {
    request.query = { ...(request.query || {}), attemptId: finalizeMatch[1] };
    handler = learningAttemptFinalize;
  }
  if (!handler && abandonMatch) {
    request.query = { ...(request.query || {}), attemptId: abandonMatch[1] };
    handler = learningAttemptAbandon;
  }
  if (!handler && attemptMatch) {
    request.query = { ...(request.query || {}), attemptId: attemptMatch[1] };
    handler = learningAttempt;
  }
  if (!handler) {
    response.statusCode = 404;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: "요청한 API를 찾을 수 없습니다.", code: "API_NOT_FOUND" }));
    return;
  }
  return handler(request, response);
};
