export const LEARNING_TODAY_DUE_SOON_DAYS = 3;

const DUE_RANK = Object.freeze({
  overdue: 1,
  dueToday: 2,
  dueSoon: 3,
  upcoming: 4,
  noTarget: 5,
});

const COMBINED_PRIORITY = Object.freeze({
  reviewOverdue: 1,
  learningOverdue: 2,
  reviewDueToday: 3,
  learningDueToday: 4,
  reviewDueSoon: 5,
  learningDueSoon: 6,
  learningUpcoming: 7,
  reviewUpcoming: 8,
  learningNoTarget: 9,
  reviewSnoozed: 10,
});

function calendarOrdinal(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
}

export function localCalendarDate(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dueStateForDate(targetDate, today, dueSoonDays = LEARNING_TODAY_DUE_SOON_DAYS) {
  if (!targetDate) return "noTarget";
  const targetOrdinal = calendarOrdinal(targetDate);
  const todayOrdinal = calendarOrdinal(today);
  if (targetOrdinal === null || todayOrdinal === null) return "noTarget";
  const difference = targetOrdinal - todayOrdinal;
  if (difference < 0) return "overdue";
  if (difference === 0) return "dueToday";
  if (difference <= dueSoonDays) return "dueSoon";
  return "upcoming";
}

export function compareTodayCandidates(left, right) {
  return DUE_RANK[left.dueState] - DUE_RANK[right.dueState]
    || String(left.targetDate || "9999-12-31").localeCompare(String(right.targetDate || "9999-12-31"))
    || Number(left.stageOrder) - Number(right.stageOrder)
    || String(left.assignmentKey).localeCompare(String(right.assignmentKey))
    || String(left.stageKey).localeCompare(String(right.stageKey));
}

export function deriveLearningToday(assignments, { today, dueSoonDays = LEARNING_TODAY_DUE_SOON_DAYS } = {}) {
  const candidates = [];
  for (const assignment of assignments || []) {
    if (assignment?.status !== "active") continue;
    const stages = [...(assignment.stages || [])].sort(
      (left, right) => Number(left.order) - Number(right.order) || String(left.id).localeCompare(String(right.id))
    );
    const stage = stages.find((entry) => entry.status === "unlocked");
    if (!stage) continue;
    const paused = assignment.target?.state === "paused";
    const actionable = Boolean(stage.actionable) && !paused;
    const actionType = paused
      ? "paused"
      : actionable && stage.attempt?.status === "in_progress"
        ? "resume"
        : actionable ? "start" : "unavailable";
    candidates.push({
      title: `${assignment.unitTitle || "학습 단원"} · ${stage.title || "현재 단계"}`,
      unitTitle: assignment.unitTitle || "학습 단원",
      stageTitle: stage.title || "현재 단계",
      progress: stage.status,
      targetDate: stage.targetDate || null,
      dueState: dueStateForDate(stage.targetDate, today, dueSoonDays),
      actionable,
      actionType,
      stageOrder: Number(stage.order || 0),
      assignmentKey: String(assignment.id),
      stageKey: String(stage.id),
      attemptKey: stage.attempt?.status === "in_progress" ? String(stage.attempt.id) : null,
      difficulty: stage.difficulty || "",
    });
  }
  return candidates.sort(compareTodayCandidates);
}

function reviewDueState(item, today, dueSoonDays) {
  if (item.scheduleSource === "override" && item.action?.type === "scheduled") return "reviewSnoozed";
  const dueAt = new Date(item.effectiveDueAt);
  if (!Number.isFinite(dueAt.getTime())) return "reviewUpcoming";
  const state = dueStateForDate(localCalendarDate(dueAt), today, dueSoonDays);
  return ({
    overdue: "reviewOverdue",
    dueToday: "reviewDueToday",
    dueSoon: "reviewDueSoon",
    upcoming: "reviewUpcoming",
    noTarget: "reviewUpcoming",
  })[state];
}

export function deriveReviewToday(queue, { today, dueSoonDays = LEARNING_TODAY_DUE_SOON_DAYS } = {}) {
  const candidates = [];
  for (const [domainIndex, item] of (queue || []).entries()) {
    const queueAction = item?.action?.type;
    if (!["start", "resume", "scheduled"].includes(queueAction)) continue;
    const dueState = reviewDueState(item, today, dueSoonDays);
    const actionable = queueAction === "start" || queueAction === "resume";
    candidates.push({
      type: "review",
      title: item.unit?.title || "오답 복습",
      subtitle: item.skill?.name || item.skill?.code || "복습 개념",
      progress: `${Number(item.dueQuestionCount || 0)} / ${Number(item.questionCount || 0)}문항`,
      dueState,
      actionable,
      actionType: queueAction === "resume"
        ? "reviewResume"
        : queueAction === "start" ? "reviewStart" : dueState === "reviewSnoozed" ? "reviewSnoozed" : "reviewScheduled",
      priority: COMBINED_PRIORITY[dueState],
      domainIndex,
      queueKey: `${String(item.assignmentId || "")}|${String(item.skill?.code || "")}`,
      targetDate: Number.isFinite(Date.parse(item.effectiveDueAt))
        ? localCalendarDate(new Date(item.effectiveDueAt))
        : null,
    });
  }
  return candidates;
}

function learningCombinedPriority(dueState) {
  return ({
    overdue: COMBINED_PRIORITY.learningOverdue,
    dueToday: COMBINED_PRIORITY.learningDueToday,
    dueSoon: COMBINED_PRIORITY.learningDueSoon,
    upcoming: COMBINED_PRIORITY.learningUpcoming,
    noTarget: COMBINED_PRIORITY.learningNoTarget,
  })[dueState] || COMBINED_PRIORITY.learningNoTarget;
}

export function combineLearningReviewToday(learningItems, reviewItems) {
  const learning = (learningItems || []).map((item, domainIndex) => ({
    ...item,
    type: "learning",
    subtitle: item.stageTitle,
    priority: learningCombinedPriority(item.dueState),
    domainIndex,
  }));
  return [...learning, ...(reviewItems || [])].sort((left, right) => (
    Number(left.priority) - Number(right.priority)
    || (left.type === right.type ? Number(left.domainIndex) - Number(right.domainIndex) : left.type.localeCompare(right.type))
    || String(left.queueKey || left.assignmentKey || "").localeCompare(String(right.queueKey || right.assignmentKey || ""))
  ));
}

export function primaryToday(items) {
  return (items || []).find((item) => item.actionable) || null;
}
