const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const helperSource = fs.readFileSync(path.join(root, "js/learning-today.js"), "utf8");
const learningSource = fs.readFileSync(path.join(root, "js/learning.js"), "utf8");
const queueSource = fs.readFileSync(path.join(root, "js/learning-review-queue.js"), "utf8");
const queueBackend = fs.readFileSync(path.join(root, "server/api/learning/_review-queue.js"), "utf8");

async function todayModule() {
  return import(`data:text/javascript;base64,${Buffer.from(helperSource).toString("base64")}`);
}

function learning(dueState = "dueToday", overrides = {}) {
  return {
    title: "세 자리 수 · 입문",
    unitTitle: "세 자리 수",
    stageTitle: "입문",
    progress: "unlocked",
    targetDate: "2026-08-16",
    dueState,
    actionable: true,
    actionType: "start",
    stageOrder: 1,
    assignmentKey: "assignment-learning",
    stageKey: "stage-learning",
    attemptKey: null,
    difficulty: "seed",
    ...overrides,
  };
}

function review(actionType = "start", dueAt = "2026-08-16T12:00:00Z", overrides = {}) {
  return {
    assignmentId: "assignment-review",
    unit: { title: "덧셈과 뺄셈" },
    skill: { code: "carry", name: "받아올림" },
    questionCount: 5,
    dueQuestionCount: 3,
    due: actionType !== "scheduled",
    effectiveDueAt: dueAt,
    scheduleSource: "default",
    priorityStatus: "repeated_wrong",
    action: { type: actionType, reviewId: actionType === "resume" ? "opaque-review" : null },
    ...overrides,
  };
}

test("A: review-only due-today work becomes the Primary Today action", async () => {
  const { deriveReviewToday, combineLearningReviewToday, primaryToday } = await todayModule();
  const combined = combineLearningReviewToday([], deriveReviewToday([review()], { today: "2026-08-16" }));
  assert.equal(primaryToday(combined).type, "review");
});

test("B: learning-only work preserves the Batch 2 Primary action", async () => {
  const { combineLearningReviewToday, primaryToday } = await todayModule();
  assert.equal(primaryToday(combineLearningReviewToday([learning()], [])).type, "learning");
});

test("C: overdue review outranks learning due today", async () => {
  const { deriveReviewToday, combineLearningReviewToday, primaryToday } = await todayModule();
  const reviews = deriveReviewToday([review("start", "2026-08-15T12:00:00Z")], { today: "2026-08-16" });
  assert.equal(primaryToday(combineLearningReviewToday([learning()], reviews)).type, "review");
});

test("D: overdue learning outranks review due today", async () => {
  const { deriveReviewToday, combineLearningReviewToday, primaryToday } = await todayModule();
  const reviews = deriveReviewToday([review()], { today: "2026-08-16" });
  assert.equal(primaryToday(combineLearningReviewToday([learning("overdue")], reviews)).type, "learning");
});

test("E: future snoozed review is visible but excluded from Primary selection", async () => {
  const { deriveReviewToday, primaryToday } = await todayModule();
  const [item] = deriveReviewToday([review("scheduled", "2026-08-20T12:00:00Z", { scheduleSource: "override", due: false })], { today: "2026-08-16" });
  assert.equal(item.dueState, "reviewSnoozed");
  assert.equal(item.actionable, false);
  assert.equal(primaryToday([item]), null);
});

test("F: in-progress review resumes through the existing lifecycle without duplicate start", async () => {
  const { deriveReviewToday } = await todayModule();
  const [item] = deriveReviewToday([review("resume")], { today: "2026-08-16" });
  assert.equal(item.actionType, "reviewResume");
  assert.match(learningSource, /item\.actionType === "reviewResume" \? "복습 계속하기" : "복습하기"/);
  assert.match(learningSource, /const queueItem = reviewSnapshot\.queue\[Number\(reviewButton\.dataset\.learningTodayReviewIndex\)\][\s\S]*openReviewToday\(queueItem\)/);
});

test("G: completed and cleared review states are not Today candidates", async () => {
  const { deriveReviewToday } = await todayModule();
  assert.deepEqual(deriveReviewToday([review("completed"), review("cleared")], { today: "2026-08-16" }), []);
});

test("H: Review Today projection contains no Parent or internal scheduling metadata", async () => {
  const { deriveReviewToday } = await todayModule();
  const [item] = deriveReviewToday([review("start", "2026-08-16T12:00:00Z", {
    familyId: "foreign-family",
    memberId: "foreign-member",
    scheduleRevision: 7,
    actorId: "parent",
  })], { today: "2026-08-16" });
  assert.doesNotMatch(JSON.stringify(item), /familyId|memberId|scheduleRevision|actorId|reviewId|effectiveDueAt/i);
});

test("I: multiple Learning and Review candidates retain exact deterministic order", async () => {
  const { deriveReviewToday, combineLearningReviewToday } = await todayModule();
  const reviews = deriveReviewToday([
    review("start", "2026-08-16T12:00:00Z"),
    review("start", "2026-08-15T12:00:00Z", { assignmentId: "assignment-review-2" }),
  ], { today: "2026-08-16" });
  const learningItems = [learning("dueToday"), learning("overdue", { assignmentKey: "assignment-learning-2" })];
  const first = combineLearningReviewToday(learningItems, reviews);
  const second = combineLearningReviewToday(learningItems, reviews);
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((item) => `${item.type}:${item.dueState}`), [
    "review:reviewOverdue",
    "learning:overdue",
    "review:reviewDueToday",
    "learning:dueToday",
  ]);
});

test("J: Review Today remains behind the existing Child self and family-scoped queue", () => {
  assert.match(queueBackend, /const scope = await learning\.assignmentReadScope\(request\)/);
  assert.match(queueBackend, /family_id=eq\.\$\{family\}/);
  assert.match(queueBackend, /assigned_member_id=eq\.\$\{child\}/);
  assert.match(queueSource, /member\?\.role === "parent" \? selectedAssignee\(\) : ""/);
  assert.doesNotMatch(learningSource, /review-queue\?assignedMemberId/);
});
