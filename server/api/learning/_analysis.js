const learning = require("./_utils");

const HISTORY_LIMIT = 50;
const WEAK_SKILL_POLICY = Object.freeze({
  version: "official-terminal-v1",
  minimumQuestions: 3,
  minimumAttempts: 2,
  minimumIncorrect: 2,
  maximumAccuracyPercent: 60,
  latestAttemptMustIncludeIncorrect: true,
});

function accuracyPercent(correct, total) {
  return total > 0 ? Math.round((correct * 1000) / total) / 10 : null;
}

function terminalAttempts(rows) {
  return (rows || []).filter((row) => ["passed", "failed"].includes(row.status));
}

function compareAttempts(left, right) {
  const finalized = String(left.finalized_at).localeCompare(String(right.finalized_at));
  if (finalized) return finalized;
  const attemptNumber = Number(left.attempt_no) - Number(right.attempt_no);
  if (attemptNumber) return attemptNumber;
  return String(left.id).localeCompare(String(right.id));
}

function scorePoint(attempt, firstPasses = new Set(), codesByAttempt = new Map()) {
  const total = Number(attempt.total_questions);
  const correct = Number(attempt.correct_answers);
  const skillCodes = [...(codesByAttempt.get(String(attempt.id)) || [])].sort();
  return {
    attemptId: String(attempt.id),
    status: attempt.status,
    correct,
    incorrect: total - correct,
    total,
    accuracyPercent: accuracyPercent(correct, total),
    startedAt: attempt.started_at,
    completedAt: attempt.finalized_at,
    firstPass: firstPasses.has(String(attempt.id)),
    skillCodes,
    hasSkillSnapshot: skillCodes.length > 0,
  };
}

function bestAttempt(attempts) {
  return [...attempts].sort((left, right) => {
    const ratio = Number(right.correct_answers) * Number(left.total_questions)
      - Number(left.correct_answers) * Number(right.total_questions);
    if (ratio) return ratio;
    const correct = Number(right.correct_answers) - Number(left.correct_answers);
    if (correct) return correct;
    return compareAttempts(left, right);
  })[0];
}

function contentDto(assignment, unitById, versionById) {
  const unit = unitById.get(String(assignment.unit_id)) || {};
  const version = versionById.get(String(assignment.content_version_id)) || {};
  return {
    unitId: String(assignment.unit_id),
    unitCode: unit.unit_code || "",
    unitTitle: unit.display_title || "",
    contentVersionId: String(assignment.content_version_id),
    contentVersionNumber: Number(version.version_no || 0),
  };
}

function scoreSummaries(data) {
  const codesByAttempt = snapshotCodesByAttempt(data.questionRows);
  const groups = new Map();
  for (const attempt of terminalAttempts(data.attempts)) {
    const key = [attempt.assignment_id, attempt.content_version_id, attempt.stage_id].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(attempt);
  }
  return [...groups.values()].map((attempts) => {
    const ordered = [...attempts].sort(compareAttempts);
    const first = ordered[0];
    const latest = ordered[ordered.length - 1];
    const best = bestAttempt(ordered);
    const assignment = data.assignmentById.get(String(first.assignment_id));
    return {
      assignmentId: String(first.assignment_id),
      stageId: String(first.stage_id),
      ...contentDto(assignment, data.unitById, data.versionById),
      attemptCount: ordered.length,
      first: scorePoint(first, data.firstPasses, codesByAttempt),
      latest: scorePoint(latest, data.firstPasses, codesByAttempt),
      best: scorePoint(best, data.firstPasses, codesByAttempt),
      changePercentagePoints: Math.round((
        accuracyPercent(Number(latest.correct_answers), Number(latest.total_questions))
        - accuracyPercent(Number(first.correct_answers), Number(first.total_questions))
      ) * 10) / 10,
    };
  }).sort((left, right) => String(right.latest.completedAt).localeCompare(String(left.latest.completedAt)));
}

function snapshotCodesByAttempt(questionRows) {
  const result = new Map();
  for (const question of questionRows || []) {
    const attemptId = String(question.attempt_id);
    if (!result.has(attemptId)) result.set(attemptId, new Set());
    for (const code of Array.isArray(question.skill_codes_snapshot) ? question.skill_codes_snapshot : []) {
      if (typeof code === "string" && code) result.get(attemptId).add(code);
    }
  }
  return result;
}

function attemptHistory(data) {
  const codesByAttempt = snapshotCodesByAttempt(data.questionRows);
  return terminalAttempts(data.attempts)
    .sort((left, right) => compareAttempts(right, left))
    .map((attempt) => {
      const assignment = data.assignmentById.get(String(attempt.assignment_id));
      const codes = [...(codesByAttempt.get(String(attempt.id)) || [])].sort();
      return {
        ...scorePoint(attempt, data.firstPasses, codesByAttempt),
        assignmentId: String(attempt.assignment_id),
        stageId: String(attempt.stage_id),
        ...contentDto(assignment, data.unitById, data.versionById),
        skillCodes: codes,
        hasSkillSnapshot: codes.length > 0,
      };
    });
}

function skillSummaries(data) {
  const answerByQuestion = new Map((data.answerRows || []).map((answer) => [
    String(answer.attempt_question_id),
    answer.is_correct === true,
  ]));
  const attemptById = new Map(terminalAttempts(data.attempts).map((attempt) => [String(attempt.id), attempt]));
  const observations = new Map();
  for (const question of data.questionRows || []) {
    const attemptId = String(question.attempt_id);
    if (!attemptById.has(attemptId) || !answerByQuestion.has(String(question.id))) continue;
    const codes = Array.isArray(question.skill_codes_snapshot) ? question.skill_codes_snapshot : [];
    for (const skillCode of codes) {
      if (typeof skillCode !== "string" || !skillCode) continue;
      if (!observations.has(skillCode)) observations.set(skillCode, new Map());
      const attempts = observations.get(skillCode);
      if (!attempts.has(attemptId)) attempts.set(attemptId, { correct: 0, questions: 0 });
      const summary = attempts.get(attemptId);
      summary.questions += 1;
      if (answerByQuestion.get(String(question.id))) summary.correct += 1;
    }
  }

  return [...observations.entries()].map(([skillCode, attempts]) => {
    const perAttempt = [...attempts.entries()].map(([attemptId, counts]) => ({
      attempt: attemptById.get(attemptId),
      ...counts,
    })).sort((left, right) => compareAttempts(left.attempt, right.attempt));
    const questions = perAttempt.reduce((sum, item) => sum + item.questions, 0);
    const correct = perAttempt.reduce((sum, item) => sum + item.correct, 0);
    const incorrect = questions - correct;
    const latest = perAttempt[perAttempt.length - 1];
    const weak = questions >= WEAK_SKILL_POLICY.minimumQuestions
      && perAttempt.length >= WEAK_SKILL_POLICY.minimumAttempts
      && incorrect >= WEAK_SKILL_POLICY.minimumIncorrect
      && correct * 100 <= questions * WEAK_SKILL_POLICY.maximumAccuracyPercent
      && latest.questions - latest.correct > 0;
    return {
      skillCode,
      skillName: data.skillNameByCode.get(skillCode) || skillCode,
      attemptedQuestions: questions,
      attemptCount: perAttempt.length,
      correct,
      incorrect,
      accuracyPercent: accuracyPercent(correct, questions),
      latest: {
        attemptId: String(latest.attempt.id),
        attemptedQuestions: latest.questions,
        correct: latest.correct,
        incorrect: latest.questions - latest.correct,
        accuracyPercent: accuracyPercent(latest.correct, latest.questions),
        completedAt: latest.attempt.finalized_at,
      },
      weak,
    };
  }).sort((left, right) => Number(right.weak) - Number(left.weak)
    || left.accuracyPercent - right.accuracyPercent
    || left.skillCode.localeCompare(right.skillCode));
}

async function load(request) {
  const url = new URL(request.url || "/api/learning/scores", "http://localhost");
  const scope = await learning.parentScope(request, url.searchParams.get("assignedMemberId"));
  const family = encodeURIComponent(scope.claims.family);
  const child = encodeURIComponent(scope.assignedMemberId);
  const assignments = await learning.u.supabaseFetch(
    `learning_assignments?select=id,unit_id,content_version_id,status&family_id=eq.${family}&assigned_member_id=eq.${child}&order=assigned_at.desc&limit=100`
  ) || [];
  const assignmentById = new Map(assignments.map((row) => [String(row.id), row]));
  const empty = {
    ...scope,
    attempts: [], questionRows: [], answerRows: [], firstPasses: new Set(), assignmentById,
    unitById: new Map(), versionById: new Map(), skillNameByCode: new Map(),
  };
  if (!assignments.length) return empty;

  const assignmentIds = learning.idList(assignments);
  const attempts = await learning.u.supabaseFetch(
    `learning_attempts?select=id,assignment_id,content_version_id,stage_id,attempt_no,status,total_questions,correct_answers,started_at,finalized_at&family_id=eq.${family}&assigned_member_id=eq.${child}&assignment_id=in.(${learning.inFilter(assignmentIds)})&status=in.(passed,failed)&order=finalized_at.desc,attempt_no.desc,id.desc&limit=${HISTORY_LIMIT}`
  ) || [];
  if (!attempts.length) return empty;

  const attemptIds = learning.idList(attempts);
  const unitIds = learning.idList(assignments, "unit_id");
  const versionIds = learning.idList(assignments, "content_version_id");
  const questionRows = await learning.u.supabaseFetch(
    `learning_attempt_questions?select=id,attempt_id,display_order,skill_codes_snapshot&attempt_id=in.(${learning.inFilter(attemptIds)})&order=attempt_id.asc,display_order.asc&limit=5000`
  ) || [];
  const answerRows = await learning.u.supabaseFetch(
    `learning_attempt_answers?select=attempt_id,attempt_question_id,is_correct&attempt_id=in.(${learning.inFilter(attemptIds)})&limit=5000`
  ) || [];
  const firstPassRows = await learning.u.supabaseFetch(
    `learning_stage_first_passes?select=attempt_id&family_id=eq.${family}&assigned_member_id=eq.${child}&assignment_id=in.(${learning.inFilter(assignmentIds)})&attempt_id=in.(${learning.inFilter(attemptIds)})`
  ) || [];
  const units = await learning.u.supabaseFetch(
    `learning_units?select=id,unit_code,display_title&id=in.(${learning.inFilter(unitIds)})`
  ) || [];
  const versions = await learning.u.supabaseFetch(
    `learning_content_versions?select=id,unit_id,version_no&id=in.(${learning.inFilter(versionIds)})`
  ) || [];
  const skillCodes = [...new Set(questionRows.flatMap((row) => (
    Array.isArray(row.skill_codes_snapshot) ? row.skill_codes_snapshot : []
  )).filter((code) => typeof code === "string" && code))];
  const definitions = skillCodes.length ? await learning.u.supabaseFetch(
    `learning_skill_definitions?select=skill_code,display_name&skill_code=in.(${learning.inFilter(skillCodes)})`
  ) || [] : [];
  return {
    ...scope,
    attempts,
    questionRows,
    answerRows,
    firstPasses: new Set(firstPassRows.map((row) => String(row.attempt_id))),
    assignmentById,
    unitById: new Map(units.map((row) => [String(row.id), row])),
    versionById: new Map(versions.map((row) => [String(row.id), row])),
    skillNameByCode: new Map(definitions.map((row) => [String(row.skill_code), row.display_name])),
  };
}

function sendError(response, error) {
  if (!error.supabaseCode) return learning.safeError(response, error);
  console.error("[learning analysis failed]", { status: 500, code: "DATABASE_ERROR" });
  return learning.send(response, 500, {
    ok: false,
    error: "학습 분석 정보를 불러오지 못했습니다.",
    code: "LEARNING_ANALYSIS_FAILED",
  });
}

module.exports = {
  HISTORY_LIMIT,
  WEAK_SKILL_POLICY,
  accuracyPercent,
  attemptHistory,
  bestAttempt,
  load,
  sendError,
  scoreSummaries,
  skillSummaries,
};
