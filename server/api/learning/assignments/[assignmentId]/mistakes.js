const learning = require("../../_utils");

const SKILL_CODE_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const TERMINAL_ATTEMPT_LIMIT = 100;
const MISTAKE_LIMIT = 500;

function filtersFrom(request) {
  const url = new URL(request.url || "/api/learning/assignments/mistakes", "http://localhost");
  const status = url.searchParams.get("status") || null;
  if (status && !["unreviewed", "reviewed"].includes(status)) {
    throw learning.u.err("오답 상태 필터를 확인해 주세요.", 400, "INVALID_MISTAKE_STATUS");
  }
  const stageValue = url.searchParams.get("stageId");
  const skillCode = url.searchParams.get("skillCode");
  if (skillCode && (!SKILL_CODE_PATTERN.test(skillCode) || skillCode.length > 100)) {
    throw learning.u.err("개념 필터를 확인해 주세요.", 400, "INVALID_SKILL_CODE");
  }
  return {
    status,
    stageId: stageValue ? learning.uuid(stageValue, "INVALID_STAGE_ID") : null,
    skillCode: skillCode || null,
  };
}

function optionText(options, selectedOptionId) {
  if (!Array.isArray(options)) return "";
  const selected = options.find((option) => String(option?.id || "") === String(selectedOptionId));
  return typeof selected?.text === "string" ? selected.text : "";
}

function publicOptions(options, selectedOptionId) {
  if (!Array.isArray(options)) return [];
  return options.map((option) => ({
    order: Number(option?.displayOrder || 0),
    text: typeof option?.text === "string" ? option.text : "",
    selected: String(option?.id || "") === String(selectedOptionId),
  }));
}

async function loadMistakes(request) {
  const assignmentId = learning.uuid(request.query?.assignmentId || "", "INVALID_ASSIGNMENT_ID");
  const filters = filtersFrom(request);
  const scope = await learning.assignmentReadScope(request);
  const family = encodeURIComponent(scope.claims.family);
  const member = encodeURIComponent(scope.assignedMemberId);
  const assignment = (await learning.u.supabaseFetch(
    `learning_assignments?select=id,unit_id,content_version_id,status&id=eq.${encodeURIComponent(assignmentId)}&family_id=eq.${family}&assigned_member_id=eq.${member}&limit=1`
  ))?.[0];
  if (!assignment) {
    throw learning.u.err("오답노트 대상을 찾을 수 없습니다.", 404, "ASSIGNMENT_NOT_FOUND");
  }

  const stageFilter = filters.stageId ? `&stage_id=eq.${encodeURIComponent(filters.stageId)}` : "";
  const attempts = await learning.u.supabaseFetch(
    `learning_attempts?select=id,stage_id,attempt_no,status,finalized_at&assignment_id=eq.${encodeURIComponent(assignmentId)}&content_version_id=eq.${encodeURIComponent(assignment.content_version_id)}&family_id=eq.${family}&assigned_member_id=eq.${member}&status=in.(passed,failed)${stageFilter}&order=finalized_at.desc,attempt_no.desc,id.desc&limit=${TERMINAL_ATTEMPT_LIMIT}`
  ) || [];
  if (!attempts.length) return { scope, assignment, filters, mistakes: [] };

  const attemptIds = learning.idList(attempts);
  const answers = await learning.u.supabaseFetch(
    `learning_attempt_answers?select=attempt_id,attempt_question_id,selected_option_id,submitted_at&attempt_id=in.(${learning.inFilter(attemptIds)})&is_correct=eq.false&order=submitted_at.desc&limit=${MISTAKE_LIMIT}`
  ) || [];
  if (!answers.length) return { scope, assignment, filters, mistakes: [] };

  const questionIds = learning.idList(answers, "attempt_question_id");
  const questions = await learning.u.supabaseFetch(
    `learning_attempt_questions?select=id,attempt_id,display_order,prompt_snapshot,options_snapshot,skill_codes_snapshot&id=in.(${learning.inFilter(questionIds)})&attempt_id=in.(${learning.inFilter(attemptIds)})&order=attempt_id.asc,display_order.asc&limit=${MISTAKE_LIMIT}`
  ) || [];
  const questionById = new Map(questions.map((row) => [String(row.id), row]));
  const attemptById = new Map(attempts.map((row) => [String(row.id), row]));
  const stageIds = learning.idList(attempts, "stage_id");
  const stages = stageIds.length ? await learning.u.supabaseFetch(
    `learning_stages?select=id,display_order,display_title&content_version_id=eq.${encodeURIComponent(assignment.content_version_id)}&id=in.(${learning.inFilter(stageIds)})`
  ) || [] : [];
  const stageById = new Map(stages.map((row) => [String(row.id), row]));
  const skillCodes = [...new Set(questions.flatMap((row) => (
    Array.isArray(row.skill_codes_snapshot) ? row.skill_codes_snapshot : []
  )).filter((code) => typeof code === "string" && code))];
  const definitions = skillCodes.length ? await learning.u.supabaseFetch(
    `learning_skill_definitions?select=skill_code,display_name&skill_code=in.(${learning.inFilter(skillCodes)})`
  ) || [] : [];
  const skillNameByCode = new Map(definitions.map((row) => [String(row.skill_code), row.display_name]));
  const revealEvents = await learning.u.supabaseFetch(
    `learning_mistake_reveal_events?select=attempt_question_id&family_id=eq.${family}&assigned_member_id=eq.${member}&assignment_id=eq.${encodeURIComponent(assignmentId)}&attempt_question_id=in.(${learning.inFilter(questionIds)})`
  ) || [];
  const reviewedQuestions = new Set(revealEvents.map((row) => String(row.attempt_question_id)));

  const mistakes = answers.flatMap((answer) => {
    const question = questionById.get(String(answer.attempt_question_id));
    const attempt = attemptById.get(String(answer.attempt_id));
    if (!question || !attempt || String(question.attempt_id) !== String(attempt.id)) return [];
    const codes = Array.isArray(question.skill_codes_snapshot)
      ? question.skill_codes_snapshot.filter((code) => typeof code === "string" && code)
      : [];
    if (filters.skillCode && !codes.includes(filters.skillCode)) return [];
    const stage = stageById.get(String(attempt.stage_id));
    const status = reviewedQuestions.has(String(question.id)) ? "reviewed" : "unreviewed";
    if (filters.status && status !== filters.status) return [];
    return [{
      attemptId: String(attempt.id),
      attemptQuestionId: String(question.id),
      attemptNumber: Number(attempt.attempt_no),
      completedAt: attempt.finalized_at,
      stage: {
        id: String(attempt.stage_id),
        order: Number(stage?.display_order || 0),
        title: stage?.display_title || "단계",
      },
      questionOrder: Number(question.display_order),
      prompt: question.prompt_snapshot,
      options: publicOptions(question.options_snapshot, answer.selected_option_id),
      selectedAnswer: { text: optionText(question.options_snapshot, answer.selected_option_id) },
      submittedAt: answer.submitted_at,
      skills: codes.map((code) => ({ code, name: skillNameByCode.get(code) || code })),
      status,
      solutionAvailable: true,
    }];
  });
  return { scope, assignment, filters, mistakes };
}

function sendError(response, error) {
  if (!error.supabaseCode) return learning.safeError(response, error);
  console.error("[learning mistakes failed]", { status: 500, code: "DATABASE_ERROR" });
  return learning.send(response, 500, {
    ok: false,
    error: "오답노트를 불러오지 못했습니다.",
    code: "LEARNING_MISTAKES_FAILED",
  });
}

module.exports = async function learningMistakes(request, response) {
  if (request.method !== "GET") return learning.allow(response, ["GET"]);
  try {
    const data = await loadMistakes(request);
    return learning.send(response, 200, {
      ok: true,
      assignmentId: String(data.assignment.id),
      assignedMemberId: data.scope.assignedMemberId,
      viewerRole: data.scope.viewerRole,
      filters: data.filters,
      mistakes: data.mistakes,
    });
  } catch (error) {
    return sendError(response, error);
  }
};

module.exports.filtersFrom = filtersFrom;
module.exports.loadMistakes = loadMistakes;
