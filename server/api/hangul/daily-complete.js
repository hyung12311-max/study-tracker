const u = require("../rewards/_utils");

const MAX_BODY_BYTES = 128 * 1024;
const SESSION_ID_PATTERN = /^[A-Za-z0-9._:+-]{16,160}$/;
const QUESTION_ID_PATTERN = /^[a-z0-9-]+:(first-letter|last-letter|middle-letter|full-word)$/;

function seoulDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function bad(message, code = "INVALID_HANGUL_COMPLETION", status = 400) {
  throw u.err(message, status, code);
}

function unique(values) {
  return new Set(values).size === values.length;
}

function validateOccurrenceId(value, index) {
  if (typeof value !== "string" || !value.startsWith(`${index}:`)) return null;
  const questionId = value.slice(String(index).length + 1);
  return QUESTION_ID_PATTERN.test(questionId) ? questionId : null;
}

function validatePayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) bad("올바른 한글 완료 정보가 필요합니다.");
  if ((body.mode || body.playMode) !== "daily") bad("자유 놀이는 학습 스티커 지급 대상이 아닙니다.", "HANGUL_DAILY_MODE_REQUIRED");
  if (body.studyDate !== seoulDate()) bad("한국시간 기준 오늘 학습만 완료할 수 있습니다.", "HANGUL_STUDY_DATE_NOT_TODAY", 409);
  if (Number(body.targetCount) !== 20) bad("하루 목표가 20문제인 학습만 스티커 지급 대상입니다.", "HANGUL_TARGET_NOT_ELIGIBLE");
  if (Number(body.completedCount) !== 20) bad("20문제를 모두 완료해야 합니다.", "HANGUL_COMPLETION_INCOMPLETE");
  if (!SESSION_ID_PATTERN.test(String(body.sessionId || ""))) bad("학습 세션 식별자가 올바르지 않습니다.", "HANGUL_SESSION_INVALID");

  const questionIds = body.questionIds;
  const completedQuestionIds = body.completedQuestionIds;
  const results = body.results;
  if (!Array.isArray(questionIds) || questionIds.length !== 20) bad("문제 ID 20개가 필요합니다.", "HANGUL_QUESTION_COUNT_INVALID");
  if (!Array.isArray(completedQuestionIds) || completedQuestionIds.length !== 20) bad("완료 문제 ID 20개가 필요합니다.", "HANGUL_COMPLETED_COUNT_INVALID");
  if (!Array.isArray(results) || results.length !== 20) bad("문제 결과 20개가 필요합니다.", "HANGUL_RESULT_COUNT_INVALID");
  if (!unique(questionIds)) bad("문제 ID가 중복되었습니다.", "HANGUL_QUESTION_DUPLICATE");
  if (!unique(completedQuestionIds)) bad("완료 문제 ID가 중복되었습니다.", "HANGUL_COMPLETED_DUPLICATE");

  const normalizedResults = [];
  let totalWrongAttempts = 0;
  const questionTypeCounts = {};
  for (let index = 0; index < 20; index += 1) {
    const plannedId = validateOccurrenceId(questionIds[index], index);
    const completedId = validateOccurrenceId(completedQuestionIds[index], index);
    if (!plannedId || !completedId || questionIds[index] !== completedQuestionIds[index] || plannedId !== completedId) {
      bad("계획한 문제와 완료한 문제가 일치하지 않습니다.", "HANGUL_QUESTION_MISMATCH");
    }
    const result = results[index];
    if (!result || typeof result !== "object" || Array.isArray(result) || result.id !== plannedId || result.correct !== true) {
      bad("문제 결과가 완료 문제와 일치하지 않습니다.", "HANGUL_RESULT_MISMATCH");
    }
    const separator = plannedId.lastIndexOf(":");
    const wordId = plannedId.slice(0, separator);
    const questionType = plannedId.slice(separator + 1);
    if (result.wordId !== wordId || result.questionType !== questionType || Number.isNaN(Date.parse(result.completedAt))) {
      bad("문제 결과 세부 정보가 올바르지 않습니다.", "HANGUL_RESULT_INVALID");
    }
    const wrongAttempts = Number(result.wrongAttempts || 0);
    if (!Number.isInteger(wrongAttempts) || wrongAttempts < 0 || wrongAttempts > 100) bad("오답 횟수가 올바르지 않습니다.", "HANGUL_RESULT_INVALID");
    totalWrongAttempts += wrongAttempts;
    questionTypeCounts[questionType] = (questionTypeCounts[questionType] || 0) + 1;
    normalizedResults.push({ questionId: plannedId, questionType, wrongAttempts, completedAt: result.completedAt });
  }

  return {
    studyDate: body.studyDate,
    targetCount: 20,
    completedCount: 20,
    sessionId: body.sessionId,
    resultSummary: {
      questionCount: 20,
      completedQuestionIds: [...completedQuestionIds],
      uniqueContentCount: new Set(normalizedResults.map((result) => result.questionId)).size,
      totalWrongAttempts,
      questionTypeCounts,
      firstCompletedAt: normalizedResults[0].completedAt,
      lastCompletedAt: normalizedResults.at(-1).completedAt,
    },
  };
}

function publicFailure(error) {
  if (error.statusCode === 401) return { status: 401, code: error.code || "AUTH_REQUIRED", error: "로그인이 필요하거나 만료되었습니다." };
  if (error.statusCode === 403 || error.supabaseCode === "42501") return { status: 403, code: error.code || "DAYUL_PERMISSION_REQUIRED", error: "다율이 자녀 계정만 사용할 수 있습니다." };
  if (error.statusCode === 409) return { status: 409, code: error.code || "HANGUL_COMPLETION_CONFLICT", error: error.message };
  if (error.statusCode === 400) return { status: 400, code: error.code || "INVALID_HANGUL_COMPLETION", error: error.message };
  if (error.supabaseCode === "PGRST202") return { status: 500, code: "HANGUL_COMPLETION_RPC_MISSING", error: "한글 완료 서버 구성이 누락되었습니다." };
  if (error.supabaseCode === "22023") return { status: 400, code: "INVALID_HANGUL_COMPLETION", error: "한글 완료 정보가 올바르지 않습니다." };
  return { status: 500, code: "HANGUL_COMPLETION_FAILED", error: "한글 완료 보상을 처리하지 못했습니다." };
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);
  try {
    const contentLength = Number(request.headers?.["content-length"] || 0);
    if (contentLength > MAX_BODY_BYTES) bad("요청 데이터가 너무 큽니다.", "HANGUL_BODY_TOO_LARGE");
    const claims = u.authenticate(request);
    const member = await u.memberInFamily(claims.sub, claims.family);
    if (claims.role !== "child" || claims.key !== "dayul" || member?.role !== "child" || member?.member_key !== "dayul" || member?.is_active === false) {
      throw u.err("Dayul child permission is required.", 403, "DAYUL_PERMISSION_REQUIRED");
    }
    const completion = validatePayload(await u.readJson(request));
    const rows = await u.supabaseFetch("rpc/complete_hangul_daily_with_reward", {
      method: "POST",
      body: JSON.stringify({
        p_family_id: claims.family,
        p_member_id: claims.sub,
        p_study_date: completion.studyDate,
        p_target_count: completion.targetCount,
        p_completed_count: completion.completedCount,
        p_session_id: completion.sessionId,
        p_result_summary: completion.resultSummary,
      }),
    });
    const row = rows?.[0];
    if (!row?.completion_id) throw u.err("Hangul completion result is unavailable.", 500, "HANGUL_COMPLETION_RESULT_MISSING");
    return u.json(response, 200, {
      ok: true,
      completion: {
        success: Boolean(row.success),
        alreadyCompleted: Boolean(row.already_completed),
        completionId: row.completion_id,
        stickerAwarded: Number(row.sticker_awarded || 0),
        studyDate: row.study_date,
      },
    });
  } catch (error) {
    const failure = publicFailure(error);
    console.error("[hangul daily complete failed]", {
      status: failure.status,
      code: failure.code,
      supabaseStatus: error.supabaseStatus || null,
      supabaseCode: error.supabaseCode || null,
    });
    return u.json(response, failure.status, { ok: false, code: failure.code, error: failure.error });
  }
};

module.exports.validatePayload = validatePayload;
