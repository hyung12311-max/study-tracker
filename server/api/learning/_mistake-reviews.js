const learning = require("./_utils");

const SKILL_CODE_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const REVIEW_STATUSES = new Set(["all", "unreviewed", "reviewed"]);

function reviewFilters(value = {}) {
  const status = value.status === undefined ? "all" : value.status;
  if (!REVIEW_STATUSES.has(status)) {
    throw learning.u.err("오답 복습 상태를 확인해 주세요.", 400, "INVALID_REVIEW_STATUS");
  }
  const stageId = value.stageId === undefined || value.stageId === null
    ? null
    : learning.uuid(value.stageId, "INVALID_STAGE_ID");
  const skillCode = value.skillCode === undefined || value.skillCode === null
    ? null
    : value.skillCode;
  if (
    skillCode !== null
    && (
      typeof skillCode !== "string"
      || skillCode.length > 100
      || !SKILL_CODE_PATTERN.test(skillCode)
    )
  ) {
    throw learning.u.err("오답 복습 개념을 확인해 주세요.", 400, "INVALID_SKILL_CODE");
  }
  return { status, stageId, skillCode };
}

async function reviewScope(request, assignedMemberId) {
  const { claims, member } = await learning.activeMember(request);
  if (member.role === "child") {
    if (assignedMemberId !== undefined && assignedMemberId !== null) {
      throw learning.u.err(
        "자녀는 오답 복습 대상을 변경할 수 없습니다.",
        403,
        "CHILD_ASSIGNEE_OVERRIDE_NOT_ALLOWED"
      );
    }
    return { claims, member, assignedMemberId: String(claims.sub), viewerRole: "child" };
  }
  const childId = learning.uuid(
    assignedMemberId,
    assignedMemberId ? "INVALID_ASSIGNED_MEMBER" : "ASSIGNED_MEMBER_REQUIRED"
  );
  await learning.activeChild(claims.family, childId);
  return { claims, member, assignedMemberId: childId, viewerRole: "parent" };
}

function publicOptions(options, selectedOptionId) {
  if (!Array.isArray(options)) return [];
  return options.map((option) => ({
    id: String(option?.id || ""),
    order: Number(option?.displayOrder || 0),
    text: typeof option?.text === "string" ? option.text : "",
    selected: String(option?.id || "") === String(selectedOptionId || ""),
  }));
}

function selectedOptionText(options, selectedOptionId) {
  if (!Array.isArray(options)) return "";
  return options.find((option) => String(option?.id || "") === String(selectedOptionId || ""))?.text || "";
}

async function loadReviewForScope(scope, reviewId) {
  const family = encodeURIComponent(scope.claims.family);
  const childFilter = scope.member.role === "child"
    ? `&assigned_member_id=eq.${encodeURIComponent(scope.claims.sub)}`
    : "";
  const session = (await learning.u.supabaseFetch(
    `learning_mistake_review_sessions?select=id,assigned_member_id,assignment_id,content_version_id,status,filter_status,filter_stage_id,filter_skill_code,started_at,completed_at,abandoned_at&id=eq.${encodeURIComponent(reviewId)}&family_id=eq.${family}${childFilter}&limit=1`
  ))?.[0];
  if (!session) {
    throw learning.u.err("오답 복습을 찾을 수 없습니다.", 404, "MISTAKE_REVIEW_NOT_FOUND");
  }

  const items = await learning.u.supabaseFetch(
    `learning_mistake_review_items?select=id,session_id,source_attempt_id,source_attempt_question_id,source_answer_id,display_order&session_id=eq.${encodeURIComponent(reviewId)}&order=display_order.asc`
  ) || [];
  const dto = {
    id: String(session.id),
    assignmentId: String(session.assignment_id),
    assignedMemberId: String(session.assigned_member_id),
    status: session.status,
    filters: {
      status: session.filter_status,
      stageId: session.filter_stage_id ? String(session.filter_stage_id) : null,
      skillCode: session.filter_skill_code || null,
    },
    startedAt: session.started_at,
    completedAt: session.completed_at || null,
    abandonedAt: session.abandoned_at || null,
    items: [],
  };
  if (!items.length) return dto;

  const attemptIds = learning.idList(items, "source_attempt_id");
  const questionIds = learning.idList(items, "source_attempt_question_id");
  const answerIds = learning.idList(items, "source_answer_id");
  const itemIds = learning.idList(items);
  const [attempts, questions, officialAnswers, reviewAnswers] = await Promise.all([
    learning.u.supabaseFetch(
      `learning_attempts?select=id,stage_id,attempt_no,finalized_at&id=in.(${learning.inFilter(attemptIds)})&family_id=eq.${family}&assigned_member_id=eq.${encodeURIComponent(session.assigned_member_id)}&assignment_id=eq.${encodeURIComponent(session.assignment_id)}&content_version_id=eq.${encodeURIComponent(session.content_version_id)}&status=in.(passed,failed)`
    ),
    learning.u.supabaseFetch(
      `learning_attempt_questions?select=id,attempt_id,prompt_snapshot,options_snapshot,correct_option_id,explanation_snapshot,skill_codes_snapshot&id=in.(${learning.inFilter(questionIds)})&attempt_id=in.(${learning.inFilter(attemptIds)})`
    ),
    learning.u.supabaseFetch(
      `learning_attempt_answers?select=id,attempt_id,attempt_question_id,selected_option_id,submitted_at&id=in.(${learning.inFilter(answerIds)})&attempt_id=in.(${learning.inFilter(attemptIds)})&is_correct=eq.false`
    ),
    learning.u.supabaseFetch(
      `learning_mistake_review_answers?select=review_item_id,selected_option_id,is_correct,submitted_at&session_id=eq.${encodeURIComponent(reviewId)}&review_item_id=in.(${learning.inFilter(itemIds)})`
    ),
  ]);
  const stageIds = learning.idList(attempts, "stage_id");
  const skillCodes = [...new Set((questions || []).flatMap((row) => (
    Array.isArray(row.skill_codes_snapshot) ? row.skill_codes_snapshot : []
  )).filter((code) => typeof code === "string" && code))];
  const [stages, definitions] = await Promise.all([
    stageIds.length ? learning.u.supabaseFetch(
      `learning_stages?select=id,display_order,display_title&id=in.(${learning.inFilter(stageIds)})&content_version_id=eq.${encodeURIComponent(session.content_version_id)}`
    ) : [],
    skillCodes.length ? learning.u.supabaseFetch(
      `learning_skill_definitions?select=skill_code,display_name&skill_code=in.(${learning.inFilter(skillCodes)})`
    ) : [],
  ]);

  const historySessions = await learning.u.supabaseFetch(
    `learning_mistake_review_sessions?select=id&family_id=eq.${family}&assigned_member_id=eq.${encodeURIComponent(session.assigned_member_id)}&assignment_id=eq.${encodeURIComponent(session.assignment_id)}&content_version_id=eq.${encodeURIComponent(session.content_version_id)}`
  ) || [];
  const historySessionIds = learning.idList(historySessions);
  const historyItems = historySessionIds.length ? await learning.u.supabaseFetch(
    `learning_mistake_review_items?select=id,session_id,source_attempt_question_id&session_id=in.(${learning.inFilter(historySessionIds)})&source_attempt_question_id=in.(${learning.inFilter(questionIds)})`
  ) || [] : [];
  const historyItemIds = learning.idList(historyItems);
  const historyAnswers = historyItemIds.length ? await learning.u.supabaseFetch(
    `learning_mistake_review_answers?select=review_item_id,is_correct&review_item_id=in.(${learning.inFilter(historyItemIds)})`
  ) || [] : [];
  const historyItemById = new Map(historyItems.map((row) => [String(row.id), row]));
  const wrongRoundsByQuestion = new Map();
  for (const answer of historyAnswers) {
    if (answer.is_correct === true) continue;
    const item = historyItemById.get(String(answer.review_item_id));
    if (!item) continue;
    const questionId = String(item.source_attempt_question_id);
    if (!wrongRoundsByQuestion.has(questionId)) wrongRoundsByQuestion.set(questionId, new Set());
    wrongRoundsByQuestion.get(questionId).add(String(item.session_id || reviewId));
  }

  const attemptById = new Map((attempts || []).map((row) => [String(row.id), row]));
  const questionById = new Map((questions || []).map((row) => [String(row.id), row]));
  const answerById = new Map((officialAnswers || []).map((row) => [String(row.id), row]));
  const reviewAnswerByItem = new Map((reviewAnswers || []).map((row) => [String(row.review_item_id), row]));
  const stageById = new Map((stages || []).map((row) => [String(row.id), row]));
  const skillNameByCode = new Map((definitions || []).map((row) => [String(row.skill_code), row.display_name]));

  dto.items = items.flatMap((item) => {
    const attempt = attemptById.get(String(item.source_attempt_id));
    const question = questionById.get(String(item.source_attempt_question_id));
    const officialAnswer = answerById.get(String(item.source_answer_id));
    if (
      !attempt
      || !question
      || !officialAnswer
      || String(question.attempt_id) !== String(attempt.id)
      || String(officialAnswer.attempt_id) !== String(attempt.id)
      || String(officialAnswer.attempt_question_id) !== String(question.id)
    ) return [];
    const stage = stageById.get(String(attempt.stage_id));
    const reviewAnswer = reviewAnswerByItem.get(String(item.id));
    const wrongRoundCount = wrongRoundsByQuestion.get(String(question.id))?.size || 0;
    const resolutionStatus = !reviewAnswer
      ? "unreviewed"
      : reviewAnswer.is_correct === true
        ? "resolved"
        : wrongRoundCount >= 2 ? "repeated_wrong" : "retried_wrong";
    const codes = Array.isArray(question.skill_codes_snapshot)
      ? question.skill_codes_snapshot.filter((code) => typeof code === "string" && code)
      : [];
    return [{
      id: String(item.id),
      order: Number(item.display_order),
      attemptNumber: Number(attempt.attempt_no),
      completedAt: attempt.finalized_at,
      stage: {
        order: Number(stage?.display_order || 0),
        title: stage?.display_title || "단계",
      },
      prompt: question.prompt_snapshot,
      options: publicOptions(question.options_snapshot, officialAnswer.selected_option_id),
      selectedAnswer: { text: selectedOptionText(question.options_snapshot, officialAnswer.selected_option_id) },
      skills: codes.map((code) => ({ code, name: skillNameByCode.get(code) || code })),
      reviewAnswer: reviewAnswer ? {
        selectedAnswer: selectedOptionText(question.options_snapshot, reviewAnswer.selected_option_id),
        correct: reviewAnswer.is_correct === true,
        submittedAt: reviewAnswer.submitted_at,
      } : null,
      solution: reviewAnswer ? {
        correctAnswer: selectedOptionText(question.options_snapshot, question.correct_option_id),
        explanation: question.explanation_snapshot,
      } : null,
      resolutionStatus,
    }];
  });
  return dto;
}

function reviewError(response, error) {
  const message = String(error.supabaseMessage || "");
  const named = [
    ["IDEMPOTENCY_CONFLICT", "IDEMPOTENCY_CONFLICT", "같은 요청 ID가 다른 복습 작업에 사용되었습니다."],
    ["REVIEW_ANSWER_CONFLICT", "REVIEW_ANSWER_CONFLICT", "이미 답한 복습 문항입니다."],
    ["REVIEW_SESSION_COMPLETED", "REVIEW_SESSION_COMPLETED", "완료한 복습은 변경할 수 없습니다."],
    ["REVIEW_SESSION_ABANDONED", "REVIEW_SESSION_ABANDONED", "중단한 복습은 변경할 수 없습니다."],
  ].find(([token]) => message.includes(token));
  if (named) return learning.send(response, 409, { ok: false, code: named[1], error: named[2] });
  if (message.includes("LEARNING_PLAN_PAUSED")) {
    return learning.send(response, 409, {
      ok: false,
      code: "LEARNING_PLAN_PAUSED",
      error: "일시 중지된 계획에서는 새 오답 복습을 시작할 수 없습니다.",
    });
  }
  const mappings = {
    "22004": [400, "INVALID_REVIEW_REQUEST", "오답 복습 요청 값을 확인해 주세요."],
    "22023": [400, "INVALID_REVIEW_FILTER", "오답 복습 필터를 확인해 주세요."],
    "23514": [400, "INVALID_REVIEW_OPTION", "이 복습 문항의 답안을 선택해 주세요."],
    "42501": [403, "LEARNING_ACCESS_DENIED", "오답 복습에 접근할 권한이 없습니다."],
    "55000": [409, "REVIEW_STATE_CONFLICT", "현재 상태에서는 오답 복습을 시작할 수 없습니다."],
    P0002: [404, "REVIEWABLE_MISTAKES_NOT_FOUND", "복습할 오답을 찾을 수 없습니다."],
  };
  const mapping = mappings[error.supabaseCode];
  if (mapping) return learning.send(response, mapping[0], { ok: false, code: mapping[1], error: mapping[2] });
  if (!error.supabaseCode) return learning.safeError(response, error);
  console.error("[learning mistake review failed]", { status: 500, code: "DATABASE_ERROR" });
  return learning.send(response, 500, {
    ok: false,
    code: "MISTAKE_REVIEW_FAILED",
    error: "오답 복습 요청을 처리하지 못했습니다.",
  });
}

module.exports = {
  loadReviewForScope,
  reviewError,
  reviewFilters,
  reviewScope,
};
