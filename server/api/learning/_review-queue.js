const learning = require("./_utils");

const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_QUEUE_POLICY = Object.freeze({
  version: "official-review-evidence-v1",
  intervalsDays: Object.freeze({
    unreviewed: 0,
    repeated_wrong: 1,
    retried_wrong: 2,
    resolved: 7,
  }),
  priorityOrder: Object.freeze([
    "repeated_wrong",
    "unreviewed",
    "retried_wrong",
    "resolved",
  ]),
});

const LIMITS = Object.freeze({ assignments: 100, attempts: 200, evidence: 5000 });

function timestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareHistory(left, right) {
  return timestamp(left.submitted_at) - timestamp(right.submitted_at)
    || String(left.id).localeCompare(String(right.id));
}

function resolution(history) {
  const ordered = [...history].sort(compareHistory);
  if (!ordered.length) return { status: "unreviewed", latest: null };
  const latest = ordered[ordered.length - 1];
  if (latest.is_correct === true) return { status: "resolved", latest };
  const wrongSessions = new Set(ordered
    .filter((answer) => answer.is_correct !== true)
    .map((answer) => String(answer.session_id)));
  return {
    status: wrongSessions.size >= 2 ? "repeated_wrong" : "retried_wrong",
    latest,
  };
}

function dueEvidence(answer, question, attempt, history) {
  const result = resolution(history);
  const evidenceAt = result.latest?.submitted_at || answer.submitted_at || attempt.finalized_at;
  const evidenceTime = timestamp(evidenceAt);
  if (evidenceTime === null) return null;
  const dueTime = evidenceTime + REVIEW_QUEUE_POLICY.intervalsDays[result.status] * DAY_MS;
  return {
    status: result.status,
    evidenceAt: new Date(evidenceTime).toISOString(),
    dueAt: new Date(dueTime).toISOString(),
    skillCodes: [...new Set(Array.isArray(question.skill_codes_snapshot)
      ? question.skill_codes_snapshot.filter((code) => typeof code === "string" && code)
      : [])],
  };
}

function buildReviewQueue(data, now = new Date()) {
  const nowTime = timestamp(now instanceof Date ? now.toISOString() : now);
  if (nowTime === null) throw new TypeError("now must be a valid timestamp");
  const assignmentById = new Map((data.assignments || []).map((row) => [String(row.id), row]));
  const attemptById = new Map((data.attempts || []).map((row) => [String(row.id), row]));
  const questionById = new Map((data.questionRows || []).map((row) => [String(row.id), row]));
  const itemById = new Map((data.reviewItems || []).map((row) => [String(row.id), row]));
  const historyByQuestion = new Map();
  for (const answer of data.reviewAnswers || []) {
    const item = itemById.get(String(answer.review_item_id));
    if (!item) continue;
    const questionId = String(item.source_attempt_question_id);
    if (!historyByQuestion.has(questionId)) historyByQuestion.set(questionId, []);
    historyByQuestion.get(questionId).push({ ...answer, session_id: item.session_id });
  }
  const activeByAssignment = new Map();
  for (const session of data.reviewSessions || []) {
    if (session.status !== "in_progress") continue;
    const assignmentId = String(session.assignment_id);
    const current = activeByAssignment.get(assignmentId);
    if (!current || String(current.started_at).localeCompare(String(session.started_at)) < 0) {
      activeByAssignment.set(assignmentId, session);
    }
  }
  const overrideByTarget = new Map((data.scheduleOverrides || []).map((row) => [
    `${row.assignment_id}|${row.skill_code}`,
    row,
  ]));
  const priority = new Map(REVIEW_QUEUE_POLICY.priorityOrder.map((status, index) => [status, index]));
  const groups = new Map();
  for (const answer of data.answerRows || []) {
    if (answer.is_correct === true) continue;
    const question = questionById.get(String(answer.attempt_question_id));
    const attempt = attemptById.get(String(answer.attempt_id));
    if (!question || !attempt || String(question.attempt_id) !== String(attempt.id)) continue;
    const assignment = assignmentById.get(String(attempt.assignment_id));
    if (!assignment) continue;
    const evidence = dueEvidence(
      answer,
      question,
      attempt,
      historyByQuestion.get(String(question.id)) || []
    );
    if (!evidence || !evidence.skillCodes.length) continue;
    for (const skillCode of evidence.skillCodes) {
      const key = `${assignment.id}|${skillCode}`;
      if (!groups.has(key)) groups.set(key, {
        assignment,
        skillCode,
        evidence: [],
      });
      groups.get(key).evidence.push(evidence);
    }
  }

  return [...groups.values()].map((group) => {
    const evidence = [...group.evidence].sort((left, right) => (
      Number(timestamp(left.dueAt) > nowTime) - Number(timestamp(right.dueAt) > nowTime)
      || priority.get(left.status) - priority.get(right.status)
      || timestamp(left.dueAt) - timestamp(right.dueAt)
      || left.evidenceAt.localeCompare(right.evidenceAt)
    ));
    const stateCounts = Object.fromEntries(REVIEW_QUEUE_POLICY.priorityOrder.map((status) => [
      status,
      evidence.filter((item) => item.status === status).length,
    ]));
    const defaultDueAt = evidence[0].dueAt;
    const scheduleOverride = overrideByTarget.get(`${group.assignment.id}|${group.skillCode}`);
    const overrideDueAt = scheduleOverride?.override_due_at || null;
    const effectiveDueAt = overrideDueAt || defaultDueAt;
    const effectiveDue = timestamp(effectiveDueAt) <= nowTime;
    const dueQuestionCount = overrideDueAt
      ? (effectiveDue ? evidence.length : 0)
      : evidence.filter((item) => timestamp(item.dueAt) <= nowTime).length;
    const active = activeByAssignment.get(String(group.assignment.id));
    const unit = data.unitById.get(String(group.assignment.unit_id)) || {};
    const version = data.versionById.get(String(group.assignment.content_version_id)) || {};
    return {
      assignmentId: String(group.assignment.id),
      unit: {
        code: unit.unit_code || "",
        title: unit.display_title || "",
      },
      contentVersion: { number: Number(version.version_no || 0) },
      skill: {
        code: group.skillCode,
        name: data.skillNameByCode.get(group.skillCode) || group.skillCode,
      },
      questionCount: evidence.length,
      dueQuestionCount,
      due: effectiveDue,
      dueAt: effectiveDueAt,
      defaultDueAt,
      overrideDueAt,
      effectiveDueAt,
      scheduleSource: overrideDueAt ? "override" : "default",
      scheduleRevision: scheduleOverride ? Number(scheduleOverride.revision) : null,
      priorityStatus: evidence[0].status,
      stateCounts,
      action: active
        ? { type: "resume", reviewId: String(active.id) }
        : effectiveDue
          ? { type: "start", reviewId: null }
          : { type: "scheduled", reviewId: null },
    };
  }).sort((left, right) => (
    ({ resume: 0, start: 1, scheduled: 2 })[left.action.type]
      - ({ resume: 0, start: 1, scheduled: 2 })[right.action.type]
    || priority.get(left.priorityStatus) - priority.get(right.priorityStatus)
    || timestamp(left.effectiveDueAt) - timestamp(right.effectiveDueAt)
    || left.assignmentId.localeCompare(right.assignmentId)
    || left.skill.code.localeCompare(right.skill.code)
  ));
}

function buildReviewSummary(data, queue = []) {
  const attemptById = new Map((data.attempts || []).map((row) => [String(row.id), row]));
  const itemById = new Map((data.reviewItems || []).map((row) => [String(row.id), row]));
  const historyByQuestion = new Map();
  for (const answer of data.reviewAnswers || []) {
    const item = itemById.get(String(answer.review_item_id));
    if (!item) continue;
    const questionId = String(item.source_attempt_question_id);
    if (!historyByQuestion.has(questionId)) historyByQuestion.set(questionId, []);
    historyByQuestion.get(questionId).push({ ...answer, session_id: item.session_id });
  }
  const byAssignment = {};
  const ensure = (assignmentId) => {
    const key = String(assignmentId || "");
    byAssignment[key] ||= {
      historicalMistakes: 0,
      unresolvedMistakes: 0,
      resolvedMistakes: 0,
      queueCount: 0,
      dueQueueCount: 0,
      inProgressCount: 0,
      snoozedCount: 0,
      completedSessions: 0,
    };
    return byAssignment[key];
  };
  const seenQuestions = new Set();
  for (const answer of data.answerRows || []) {
    const questionId = String(answer.attempt_question_id || "");
    if (!questionId || seenQuestions.has(questionId)) continue;
    const attempt = attemptById.get(String(answer.attempt_id));
    if (!attempt) continue;
    seenQuestions.add(questionId);
    const summary = ensure(attempt.assignment_id);
    summary.historicalMistakes += 1;
    if (resolution(historyByQuestion.get(questionId) || []).status === "resolved") summary.resolvedMistakes += 1;
    else summary.unresolvedMistakes += 1;
  }
  for (const session of data.reviewSessions || []) {
    const summary = ensure(session.assignment_id);
    if (session.status === "completed") summary.completedSessions += 1;
  }
  for (const item of queue || []) {
    const summary = ensure(item.assignmentId);
    summary.queueCount += 1;
    if (["start", "resume"].includes(item.action?.type)) summary.dueQueueCount += 1;
    if (item.action?.type === "resume") summary.inProgressCount += 1;
    if (item.action?.type === "scheduled" && item.scheduleSource === "override") summary.snoozedCount += 1;
  }
  const totals = Object.values(byAssignment).reduce((result, summary) => {
    for (const key of Object.keys(result)) result[key] += Number(summary[key] || 0);
    return result;
  }, {
    historicalMistakes: 0,
    unresolvedMistakes: 0,
    resolvedMistakes: 0,
    queueCount: 0,
    dueQueueCount: 0,
    inProgressCount: 0,
    snoozedCount: 0,
    completedSessions: 0,
  });
  return { ...totals, byAssignment };
}

async function load(request) {
  const scope = await learning.assignmentReadScope(request);
  const family = encodeURIComponent(scope.claims.family);
  const child = encodeURIComponent(scope.assignedMemberId);
  const assignments = await learning.u.supabaseFetch(
    `learning_assignments?select=id,unit_id,content_version_id,status&family_id=eq.${family}&assigned_member_id=eq.${child}&order=assigned_at.desc&limit=${LIMITS.assignments}`
  ) || [];
  const empty = {
    scope,
    assignments,
    attempts: [],
    questionRows: [],
    answerRows: [],
    reviewSessions: [],
    reviewItems: [],
    reviewAnswers: [],
    scheduleOverrides: [],
    unitById: new Map(),
    versionById: new Map(),
    skillNameByCode: new Map(),
  };
  if (!assignments.length) return empty;
  const assignmentIds = learning.idList(assignments);
  const attempts = await learning.u.supabaseFetch(
    `learning_attempts?select=id,assignment_id,status,finalized_at&family_id=eq.${family}&assigned_member_id=eq.${child}&assignment_id=in.(${learning.inFilter(assignmentIds)})&status=in.(passed,failed)&order=finalized_at.desc,id.desc&limit=${LIMITS.attempts}`
  ) || [];
  if (!attempts.length) return empty;
  const attemptIds = learning.idList(attempts);
  const answerRows = await learning.u.supabaseFetch(
    `learning_attempt_answers?select=id,attempt_id,attempt_question_id,is_correct,submitted_at&attempt_id=in.(${learning.inFilter(attemptIds)})&is_correct=eq.false&order=submitted_at.desc&limit=${LIMITS.evidence}`
  ) || [];
  if (!answerRows.length) return { ...empty, attempts };
  const questionIds = learning.idList(answerRows, "attempt_question_id");
  const questionRows = await learning.u.supabaseFetch(
    `learning_attempt_questions?select=id,attempt_id,skill_codes_snapshot&id=in.(${learning.inFilter(questionIds)})&attempt_id=in.(${learning.inFilter(attemptIds)})&limit=${LIMITS.evidence}`
  ) || [];
  const reviewSessions = await learning.u.supabaseFetch(
    `learning_mistake_review_sessions?select=id,assignment_id,status,started_at&family_id=eq.${family}&assigned_member_id=eq.${child}&assignment_id=in.(${learning.inFilter(assignmentIds)})&order=started_at.desc&limit=${LIMITS.attempts}`
  ) || [];
  const sessionIds = learning.idList(reviewSessions);
  const reviewItems = sessionIds.length ? await learning.u.supabaseFetch(
    `learning_mistake_review_items?select=id,session_id,source_attempt_question_id&session_id=in.(${learning.inFilter(sessionIds)})&source_attempt_question_id=in.(${learning.inFilter(questionIds)})&limit=${LIMITS.evidence}`
  ) || [] : [];
  const itemIds = learning.idList(reviewItems);
  const reviewAnswers = itemIds.length ? await learning.u.supabaseFetch(
    `learning_mistake_review_answers?select=id,session_id,review_item_id,is_correct,submitted_at&session_id=in.(${learning.inFilter(sessionIds)})&review_item_id=in.(${learning.inFilter(itemIds)})&limit=${LIMITS.evidence}`
  ) || [] : [];
  const scheduleOverrides = await learning.u.supabaseFetch(
    `learning_review_schedule_overrides?select=assignment_id,skill_code,override_due_at,duration_days,revision&family_id=eq.${family}&assigned_member_id=eq.${child}&assignment_id=in.(${learning.inFilter(assignmentIds)})`
  ) || [];
  const skillCodes = [...new Set(questionRows.flatMap((row) => (
    Array.isArray(row.skill_codes_snapshot) ? row.skill_codes_snapshot : []
  )).filter((code) => typeof code === "string" && code))];
  const unitIds = learning.idList(assignments, "unit_id");
  const versionIds = learning.idList(assignments, "content_version_id");
  const [units, versions, definitions] = await Promise.all([
    learning.u.supabaseFetch(
      `learning_units?select=id,unit_code,display_title&id=in.(${learning.inFilter(unitIds)})`
    ) || [],
    learning.u.supabaseFetch(
      `learning_content_versions?select=id,version_no&id=in.(${learning.inFilter(versionIds)})`
    ) || [],
    skillCodes.length ? learning.u.supabaseFetch(
      `learning_skill_definitions?select=skill_code,display_name&skill_code=in.(${learning.inFilter(skillCodes)})`
    ) || [] : [],
  ]);
  return {
    scope,
    assignments,
    attempts,
    questionRows,
    answerRows,
    reviewSessions,
    reviewItems,
    reviewAnswers,
    scheduleOverrides,
    unitById: new Map(units.map((row) => [String(row.id), row])),
    versionById: new Map(versions.map((row) => [String(row.id), row])),
    skillNameByCode: new Map(definitions.map((row) => [String(row.skill_code), row.display_name])),
  };
}

module.exports = { REVIEW_QUEUE_POLICY, buildReviewQueue, buildReviewSummary, load, resolution };
