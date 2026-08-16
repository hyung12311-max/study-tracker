const TERMINAL_ATTEMPT_STATUSES = new Set(["passed", "failed"]);

export function metricPercent(numerator, denominator) {
  const total = Number(denominator);
  if (!Number.isFinite(total) || total <= 0) return null;
  const value = Number(numerator);
  if (!Number.isFinite(value)) return null;
  return Math.round((value * 1000) / total) / 10;
}

export function reviewQueueMetrics(queue = []) {
  const rows = Array.isArray(queue) ? queue : [];
  return {
    queueCount: rows.length,
    dueQueueCount: rows.filter((item) => ["start", "resume"].includes(item?.action?.type)).length,
    inProgressCount: rows.filter((item) => item?.action?.type === "resume").length,
    snoozedCount: rows.filter((item) => item?.action?.type === "scheduled" && item?.scheduleSource === "override").length,
  };
}

function reviewForAssignment(reviewSummary, assignmentKey) {
  const value = reviewSummary?.byAssignment?.[assignmentKey] || {};
  return {
    historicalMistakes: Number(value.historicalMistakes || 0),
    unresolvedMistakes: Number(value.unresolvedMistakes || 0),
    reviewDue: Number(value.dueQueueCount || 0),
    reviewInProgress: Number(value.inProgressCount || 0),
    reviewCompleted: Number(value.completedSessions || 0),
    reviewSnoozed: Number(value.snoozedCount || 0),
    queueCount: Number(value.queueCount || 0),
  };
}

function assignmentMetric(assignment, attemptHistory, reviewSummary) {
  const assignmentKey = String(assignment?.id || "");
  const stages = Array.isArray(assignment?.stages) ? assignment.stages : [];
  const passedStages = stages.filter((stage) => stage?.status === "passed").length;
  const terminalAttempts = (attemptHistory || [])
    .filter((attempt) => String(attempt?.assignmentId || "") === assignmentKey && TERMINAL_ATTEMPT_STATUSES.has(attempt?.status))
    .sort((left, right) => String(right.completedAt || "").localeCompare(String(left.completedAt || ""))
      || String(right.attemptId || "").localeCompare(String(left.attemptId || "")));
  const latest = terminalAttempts[0] || null;
  const currentStage = stages.find((stage) => stage?.status === "unlocked") || null;
  const scoredCount = latest ? Number(latest.total || 0) : 0;
  const correctCount = latest ? Number(latest.correct || 0) : 0;
  const serverAccuracy = latest?.accuracyPercent;
  return {
    assignmentKey,
    assignmentStatus: assignment?.status || "",
    unitTitle: assignment?.unitTitle || "학습 단원",
    currentStage: currentStage ? {
      title: currentStage.title || "현재 단계",
      status: currentStage.status,
    } : null,
    passedStages,
    totalStages: stages.length,
    remainingStages: Math.max(stages.length - passedStages, 0),
    completionPercent: metricPercent(passedStages, stages.length),
    correctCount,
    scoredCount,
    correctnessPercent: latest && serverAccuracy !== null && serverAccuracy !== undefined
      ? Number(serverAccuracy)
      : null,
    attemptCount: terminalAttempts.length,
    latestAttemptStatus: latest?.status || null,
    latestAttemptCompletedAt: latest?.completedAt || null,
    latestAttemptFirstPass: latest?.firstPass === true,
    ...reviewForAssignment(reviewSummary, assignmentKey),
  };
}

export function deriveCanonicalProgress({
  assignments = [],
  attemptHistory = [],
  reviewSummary = {},
  learningRewardEarned = null,
} = {}) {
  const metrics = (assignments || []).map((assignment) => assignmentMetric(assignment, attemptHistory, reviewSummary));
  const fallbackQueue = reviewQueueMetrics(reviewSummary?.queue || []);
  const summaryValue = (name, fallback = 0) => Number(reviewSummary?.[name] ?? fallback);
  return {
    current: metrics.filter((item) => item.assignmentStatus === "active"),
    history: metrics.filter((item) => item.assignmentStatus === "completed"),
    overall: {
      reviewDue: summaryValue("dueQueueCount", fallbackQueue.dueQueueCount),
      reviewInProgress: summaryValue("inProgressCount", fallbackQueue.inProgressCount),
      reviewCompleted: summaryValue("completedSessions"),
      reviewSnoozed: summaryValue("snoozedCount", fallbackQueue.snoozedCount),
      queueCount: summaryValue("queueCount", fallbackQueue.queueCount),
      learningRewardEarned: learningRewardEarned === null || learningRewardEarned === undefined
        ? null
        : Number(learningRewardEarned),
    },
  };
}

export function projectProgressForViewer(input, _viewerRole) {
  return deriveCanonicalProgress(input);
}
