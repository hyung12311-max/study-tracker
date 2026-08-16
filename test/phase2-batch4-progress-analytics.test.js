const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

async function progressModule() {
  const source = fs.readFileSync(path.join(root, "js/learning-progress.js"), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

function assignment(id = "active", status = "active", stages = []) {
  return { id, unitTitle: `단원 ${id}`, status, stages };
}

function attempt(assignmentId, status, correct, total, completedAt, extra = {}) {
  return { assignmentId, status, correct, total, accuracyPercent: total ? Math.round(correct * 1000 / total) / 10 : null, completedAt, ...extra };
}

function reviewSummary(entries = {}, overall = {}) {
  return { byAssignment: entries, ...overall };
}

test("A: completion is passed required stages over total required stages", async () => {
  const { deriveCanonicalProgress } = await progressModule();
  const result = deriveCanonicalProgress({ assignments: [assignment("a", "active", [
    { id: "s1", status: "passed" }, { id: "s2", status: "passed" }, { id: "s3", status: "unlocked" },
  ])] });
  assert.deepEqual({ passed: result.current[0].passedStages, total: result.current[0].totalStages, remaining: result.current[0].remainingStages, percent: result.current[0].completionPercent }, { passed: 2, total: 3, remaining: 1, percent: 66.7 });
});

test("B: correctness uses authoritative scored counts and stays separate from completion", async () => {
  const { deriveCanonicalProgress } = await progressModule();
  const result = deriveCanonicalProgress({
    assignments: [assignment("a", "active", [{ id: "s1", status: "unlocked" }])],
    attemptHistory: [attempt("a", "failed", 6, 8, "2026-08-16T10:00:00Z")],
  }).current[0];
  assert.deepEqual({ correct: result.correctCount, scored: result.scoredCount, correctness: result.correctnessPercent, completion: result.completionPercent }, { correct: 6, scored: 8, correctness: 75, completion: 0 });
});

test("C: retry completion comes from stage progress and terminal history counts both attempts", async () => {
  const { deriveCanonicalProgress } = await progressModule();
  const result = deriveCanonicalProgress({
    assignments: [assignment("a", "active", [{ id: "s1", status: "passed" }])],
    attemptHistory: [attempt("a", "passed", 3, 4, "2026-08-16T11:00:00Z", { firstPass: true }), attempt("a", "failed", 1, 4, "2026-08-16T10:00:00Z")],
    learningRewardEarned: 2,
  });
  assert.equal(result.current[0].completionPercent, 100);
  assert.equal(result.current[0].attemptCount, 2);
  assert.equal(result.overall.learningRewardEarned, 2);
});

test("D: abandoned attempts do not enter the canonical terminal attempt metric", async () => {
  const { deriveCanonicalProgress } = await progressModule();
  const result = deriveCanonicalProgress({
    assignments: [assignment("a", "active", [{ id: "s1", status: "unlocked" }])],
    attemptHistory: [attempt("a", "abandoned", 2, 4, "2026-08-16T12:00:00Z"), attempt("a", "failed", 1, 4, "2026-08-16T10:00:00Z")],
  }).current[0];
  assert.equal(result.attemptCount, 1);
  assert.equal(result.latestAttemptStatus, "failed");
});

test("E: historical mistakes and review-due queues remain different metrics", async () => {
  const { deriveCanonicalProgress } = await progressModule();
  const result = deriveCanonicalProgress({
    assignments: [assignment("a", "active", [])],
    reviewSummary: reviewSummary({ a: { historicalMistakes: 7, unresolvedMistakes: 4, dueQueueCount: 2 } }, { dueQueueCount: 2 }),
  }).current[0];
  assert.deepEqual({ historical: result.historicalMistakes, unresolved: result.unresolvedMistakes, reviewDue: result.reviewDue }, { historical: 7, unresolved: 4, reviewDue: 2 });
});

test("F: review completion changes review metrics without changing learning completion", async () => {
  const { deriveCanonicalProgress } = await progressModule();
  const before = deriveCanonicalProgress({ assignments: [assignment("a", "active", [{ status: "unlocked" }])], reviewSummary: reviewSummary({ a: { dueQueueCount: 3, completedSessions: 0 } }) });
  const after = deriveCanonicalProgress({ assignments: [assignment("a", "active", [{ status: "unlocked" }])], reviewSummary: reviewSummary({ a: { dueQueueCount: 2, completedSessions: 1 } }) });
  assert.deepEqual({ reviewDue: after.current[0].reviewDue, completed: after.current[0].reviewCompleted, learningBefore: before.current[0].completionPercent, learningAfter: after.current[0].completionPercent }, { reviewDue: 2, completed: 1, learningBefore: 0, learningAfter: 0 });
});

test("G: displayed learning reward is the ledger value and never inferred from attempts", async () => {
  const { deriveCanonicalProgress } = await progressModule();
  const result = deriveCanonicalProgress({ assignments: [assignment("a", "active", [])], attemptHistory: [attempt("a", "passed", 4, 4, "2026-08-16T10:00:00Z", { difficulty: "crown" })], learningRewardEarned: 3 });
  assert.equal(result.overall.learningRewardEarned, 3);
});

test("H: current progress uses active assignment instead of completed history", async () => {
  const { deriveCanonicalProgress } = await progressModule();
  const result = deriveCanonicalProgress({ assignments: [assignment("old", "completed", [{ status: "passed" }]), assignment("new", "active", [{ status: "unlocked" }])] });
  assert.deepEqual(result.current.map((item) => item.unitTitle), ["단원 new"]);
  assert.deepEqual(result.history.map((item) => item.unitTitle), ["단원 old"]);
});

test("I: multiple assignments keep stage score and review metrics isolated", async () => {
  const { deriveCanonicalProgress } = await progressModule();
  const result = deriveCanonicalProgress({
    assignments: [assignment("a", "active", [{ status: "passed" }]), assignment("b", "active", [{ status: "unlocked" }, { status: "locked" }])],
    attemptHistory: [attempt("a", "passed", 4, 4, "2026-08-16T11:00:00Z"), attempt("b", "failed", 1, 4, "2026-08-16T10:00:00Z")],
    reviewSummary: reviewSummary({ a: { dueQueueCount: 1 }, b: { dueQueueCount: 3 } }),
  });
  assert.deepEqual(result.current.map(({ assignmentKey, completionPercent, correctnessPercent, reviewDue }) => ({ assignmentKey, completionPercent, correctnessPercent, reviewDue })), [
    { assignmentKey: "a", completionPercent: 100, correctnessPercent: 100, reviewDue: 1 },
    { assignmentKey: "b", completionPercent: 0, correctnessPercent: 25, reviewDue: 3 },
  ]);
});

test("J: Parent and Child projections have exact equality for canonical metrics", async () => {
  const { projectProgressForViewer } = await progressModule();
  const input = { assignments: [assignment("a", "active", [{ status: "passed" }, { status: "unlocked" }])], attemptHistory: [attempt("a", "failed", 3, 4, "2026-08-16T10:00:00Z")], reviewSummary: reviewSummary({ a: { dueQueueCount: 2 } }), learningRewardEarned: 5 };
  assert.deepEqual(projectProgressForViewer(input, "parent"), projectProgressForViewer(input, "child"));
});

test("K: Today actionable Review count equals Parent canonical review-due count", async () => {
  const { deriveCanonicalProgress, reviewQueueMetrics } = await progressModule();
  const queue = [{ action: { type: "resume" } }, { action: { type: "start" } }, { action: { type: "scheduled" }, scheduleSource: "override" }];
  const metrics = reviewQueueMetrics(queue);
  const result = deriveCanonicalProgress({ assignments: [], reviewSummary: metrics });
  assert.equal(metrics.dueQueueCount, 2);
  assert.equal(result.overall.reviewDue, 2);
});

test("L: retry reload and refetch do not multiply the ledger-owned reward", async () => {
  const { deriveCanonicalProgress } = await progressModule();
  const input = { assignments: [assignment("a", "active", [{ status: "passed" }])], attemptHistory: [attempt("a", "passed", 4, 4, "2026-08-16T11:00:00Z"), attempt("a", "failed", 1, 4, "2026-08-16T10:00:00Z")], learningRewardEarned: 5 };
  assert.equal(deriveCanonicalProgress(input).overall.learningRewardEarned, 5);
  assert.equal(deriveCanonicalProgress(input).overall.learningRewardEarned, 5);
});

test("review summary keeps unique mistake resolution, queue, and completed-session facts separate", () => {
  const { buildReviewSummary } = require("../server/api/learning/_review-queue");
  const summary = buildReviewSummary({
    attempts: [{ id: "t1", assignment_id: "a" }],
    answerRows: [
      { attempt_id: "t1", attempt_question_id: "q1", is_correct: false },
      { attempt_id: "t1", attempt_question_id: "q2", is_correct: false },
    ],
    reviewSessions: [{ id: "s1", assignment_id: "a", status: "completed" }],
    reviewItems: [{ id: "i1", session_id: "s1", source_attempt_question_id: "q1" }],
    reviewAnswers: [{ id: "r1", session_id: "s1", review_item_id: "i1", is_correct: true, submitted_at: "2026-08-16T10:00:00Z" }],
  }, [
    { assignmentId: "a", action: { type: "start" }, scheduleSource: "default" },
    { assignmentId: "a", action: { type: "scheduled" }, scheduleSource: "override" },
  ]);
  assert.deepEqual(summary.byAssignment.a, {
    historicalMistakes: 2,
    unresolvedMistakes: 1,
    resolvedMistakes: 1,
    queueCount: 2,
    dueQueueCount: 1,
    inProgressCount: 0,
    snoozedCount: 1,
    completedSessions: 1,
  });
});

test("Parent progress UX composes only existing scoped read APIs and ledger-owned reward", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const client = fs.readFileSync(path.join(root, "js/learning-analysis.js"), "utf8");
  const rewards = fs.readFileSync(path.join(root, "server/api/rewards/index.js"), "utf8");
  assert.match(html, /id="learningProgressSummary"[^>]*aria-live="polite"/);
  assert.match(client, /\/api\/learning\/assignments\$\{query\}/);
  assert.match(client, /\/api\/learning\/review-queue\$\{query\}/);
  assert.match(client, /\/api\/rewards\?memberId=\$\{encodeURIComponent\(assignedMemberId\)\}/);
  assert.match(rewards, /row\.source_type === "learning_stage_first_pass"/);
  assert.doesNotMatch(client, /family[_-]?id|rewardAmount\s*=|difficultyRewards|correct\s*\/\s*total/i);
});

test("Parent progress cards retain mobile labels and no horizontal metric grid", () => {
  const styles = fs.readFileSync(path.join(root, "css/styles.css"), "utf8");
  assert.match(styles, /\.learning-progress-card\{[^}]*min-width:0/);
  assert.match(styles, /@media \(max-width:480px\)[\s\S]*\.learning-progress-overall[^}]*grid-template-columns:1fr/);
  assert.match(styles, /\.learning-assignment-progress/);
});
