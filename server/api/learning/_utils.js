const u = require("../rewards/_utils");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBJECT_CODES = Object.freeze({ "수학": "math" });
const SUBJECT_LABELS = Object.freeze({ math: "수학" });
const LEVEL_CODES = Object.freeze({
  "준비": "ready",
  "초등 1": "elementary_1",
  "초등 2": "elementary_2",
  "초등 3": "elementary_3",
  "초등 4": "elementary_4",
  "초등 5": "elementary_5",
  "초등 6": "elementary_6",
});
const LEVEL_LABELS = Object.freeze(Object.fromEntries(
  Object.entries(LEVEL_CODES).map(([label, code]) => [code, label])
));

function uuid(value, code = "INVALID_LEARNING_ID") {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw u.err("문제풀이 학습 요청을 확인해 주세요.", 400, code);
  }
  return value;
}

function date(value, code = "INVALID_PLAN_DATE") {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw u.err("학습 계획 날짜를 확인해 주세요.", 400, code);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw u.err("학습 계획 날짜를 확인해 주세요.", 400, code);
  }
  return value;
}

function timezone(value) {
  if (typeof value !== "string" || !value || value.length > 100 || value.trim() !== value) {
    throw u.err("학습 계획 시간대를 확인해 주세요.", 400, "INVALID_PLAN_TIMEZONE");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
  } catch {
    throw u.err("학습 계획 시간대를 확인해 주세요.", 400, "INVALID_PLAN_TIMEZONE");
  }
  return value;
}

function revision(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw u.err("학습 계획 revision을 확인해 주세요.", 400, "INVALID_PLAN_REVISION");
  }
  return value;
}

function stageTargets(value, plannedStartDate, targetCompletionDate) {
  if (!Array.isArray(value) || value.length < 1) {
    throw u.err("단계별 목표일을 모두 입력해 주세요.", 400, "INVALID_STAGE_TARGETS");
  }
  return value.map((target, index) => {
    exactBody(target, new Set(["stageId", "displayOrder", "targetDate"]));
    const displayOrder = target.displayOrder;
    if (!Number.isSafeInteger(displayOrder) || displayOrder < 1 || displayOrder !== index + 1) {
      throw u.err("단계 순서를 확인해 주세요.", 400, "INVALID_STAGE_TARGETS");
    }
    const targetDate = date(target.targetDate, "INVALID_STAGE_TARGET_DATE");
    if (targetDate < plannedStartDate || targetDate > targetCompletionDate) {
      throw u.err("단계 목표일 범위를 확인해 주세요.", 400, "INVALID_STAGE_TARGET_DATE");
    }
    return {
      stage_id: uuid(target.stageId, "INVALID_STAGE_ID"),
      display_order: displayOrder,
      target_date: targetDate,
    };
  });
}

function exactBody(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw u.err("문제풀이 학습 요청 형식이 올바르지 않습니다.", 400, "INVALID_LEARNING_REQUEST");
  }
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw u.err("허용되지 않은 문제풀이 학습 입력이 있습니다.", 400, "LEARNING_FIELD_NOT_ALLOWED");
  }
  return value;
}

async function activeMember(request, role) {
  let claims;
  const foundation = u.createAuthorizationFoundation({
    authenticate: (value) => {
      claims = u.authenticate(value);
      return claims;
    },
    supabaseFetch: async () => {
      const member = await u.memberInFamily(claims.sub, claims.family);
      return member ? [member] : [];
    },
  });
  const context = await foundation.authenticateActiveMember(
    request,
    role ? { requiredRole: role } : { allowRoles: ["parent", "child"] }
  );
  return { claims: context.claims, member: context.member, context };
}

async function activeChild(context, assignedMemberId) {
  const foundation = u.createAuthorizationFoundation({
    authenticate: () => context.claims,
    supabaseFetch: (...args) => u.supabaseFetch(...args),
  });
  const child = await foundation.resolveActiveFamilyChild(context, assignedMemberId);
  return String(child.id);
}

async function parentScope(request, assignedMemberId) {
  const { claims, member, context } = await activeMember(request, "parent");
  const childId = uuid(
    assignedMemberId,
    assignedMemberId ? "INVALID_ASSIGNED_MEMBER" : "ASSIGNED_MEMBER_REQUIRED"
  );
  await activeChild(context, childId);
  return { claims, member, context, assignedMemberId: childId };
}

async function assignmentReadScope(request) {
  const { claims, member, context } = await activeMember(request);
  const url = new URL(request.url || "/api/learning/assignments", "http://localhost");
  const requested = url.searchParams.get("assignedMemberId");
  if (member.role === "child") {
    if (requested) {
      throw u.err(
        "자녀는 배정 조회 대상을 변경할 수 없습니다.",
        403,
        "CHILD_ASSIGNEE_OVERRIDE_NOT_ALLOWED"
      );
    }
    return { claims, member, context, assignedMemberId: u.childSelfScope(context), viewerRole: "child" };
  }
  const scope = await parentScope(request, requested);
  return { ...scope, viewerRole: "parent" };
}

function requireMutationGuard(request) {
  if (String(request.headers["content-type"] || "").split(";")[0].trim().toLowerCase() !== "application/json") {
    throw u.err("JSON 요청만 허용됩니다.", 415, "JSON_REQUIRED");
  }
  if (request.headers["x-study-csrf"] !== "1") {
    throw u.err("요청 검증 정보가 없습니다.", 403, "CSRF_REQUIRED");
  }
  const origin = String(request.headers.origin || "");
  const host = String(request.headers["x-forwarded-host"] || request.headers.host || "").split(",")[0].trim();
  const forwardedProto = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    throw u.err("요청 출처를 확인할 수 없습니다.", 403, "ORIGIN_NOT_ALLOWED");
  }
  if (!host || parsed.host !== host || (forwardedProto && parsed.protocol !== `${forwardedProto}:`)) {
    throw u.err("허용되지 않은 요청 출처입니다.", 403, "ORIGIN_NOT_ALLOWED");
  }
}

function send(response, status, body) {
  response.setHeader("Cache-Control", "no-store");
  return u.json(response, status, body);
}

function allow(response, methods) {
  response.setHeader("Cache-Control", "no-store");
  return u.allow(response, methods);
}

function safeError(response, error) {
  const authorizationFailure = u.publicAuthorizationError(error);
  if (authorizationFailure.status !== 500) {
    return send(response, authorizationFailure.status, authorizationFailure.body);
  }
  const databaseCode = error.supabaseCode;
  if (databaseCode === "23505") {
    return send(response, 409, {
      ok: false,
      error: "이미 이 자녀에게 배정된 단원입니다.",
      code: "ASSIGNMENT_EXISTS",
    });
  }
  if (databaseCode === "P0002") {
    return send(response, 404, {
      ok: false,
      error: "문제풀이 학습 대상을 찾을 수 없습니다.",
      code: "LEARNING_NOT_FOUND",
    });
  }
  if (databaseCode === "55000") {
    return send(response, 409, {
      ok: false,
      error: "현재 상태에서는 요청을 처리할 수 없습니다.",
      code: "ASSIGNMENT_STATE_CONFLICT",
    });
  }
  if (databaseCode === "42501") {
    return send(response, 403, {
      ok: false,
      error: "문제풀이 학습에 접근할 권한이 없습니다.",
      code: "LEARNING_ACCESS_DENIED",
    });
  }
  const isPublic = Boolean(error.statusCode >= 400 && error.statusCode < 500 && !databaseCode);
  const controlledInternal = Boolean(error.statusCode === 500 && error.code && !databaseCode);
  console.error("[learning API failed]", {
    status: error.statusCode || 500,
    code: databaseCode || error.code || null,
  });
  return send(response, isPublic ? error.statusCode : 500, {
    ok: false,
    error: isPublic ? error.message : "문제풀이 학습 요청을 처리하지 못했습니다.",
    code: (isPublic || controlledInternal) && error.code ? error.code : "LEARNING_REQUEST_FAILED",
  });
}

function planningError(response, error) {
  const message = String(error.supabaseMessage || "");
  const named = [
    ["PLAN_LOCKED_AFTER_COMPLETION", 409, "PLAN_LOCKED_AFTER_COMPLETION", "완료된 단원의 계획은 변경할 수 없습니다."],
    ["PLAN_REVISION_CONFLICT", 409, "PLAN_REVISION_CONFLICT", "학습 계획이 변경되었습니다. 다시 확인해 주세요."],
    ["IDEMPOTENCY_CONFLICT", 409, "IDEMPOTENCY_CONFLICT", "같은 요청 ID가 다른 내용으로 사용되었습니다."],
    ["LEARNING_PLAN_PAUSED", 409, "LEARNING_PLAN_PAUSED", "일시 중지된 계획에서는 새 문제풀이를 시작할 수 없습니다."],
  ].find(([token]) => message.includes(token));
  if (named) return send(response, named[1], { ok: false, code: named[2], error: named[3] });
  const mappings = {
    "22004": [400, "INVALID_PLAN_REQUEST", "학습 계획 요청 값을 확인해 주세요."],
    "22023": [400, "INVALID_PLAN_REQUEST", "학습 계획 날짜 또는 시간대를 확인해 주세요."],
    "23505": [409, "PLAN_EXISTS", "이미 학습 계획이 있거나 활성 배정이 존재합니다."],
    "23514": [400, "INVALID_STAGE_TARGETS", "단계별 목표일을 확인해 주세요."],
    "40001": [409, "PLAN_REVISION_CONFLICT", "학습 계획이 변경되었습니다. 다시 확인해 주세요."],
    "42501": [403, "LEARNING_ACCESS_DENIED", "학습 계획에 접근할 권한이 없습니다."],
    "55000": [409, "PLAN_STATE_CONFLICT", "현재 상태에서는 학습 계획을 변경할 수 없습니다."],
    P0002: [404, "PLAN_NOT_FOUND", "학습 계획 또는 배정을 찾을 수 없습니다."],
  };
  const mapping = mappings[error.supabaseCode];
  if (mapping) return send(response, mapping[0], { ok: false, code: mapping[1], error: mapping[2] });
  return safeError(response, error);
}

function idList(rows, key = "id") {
  return [...new Set((rows || []).map((row) => String(row[key])).filter(Boolean))];
}

function inFilter(ids) {
  return ids.join(",");
}

function subjectCode(label) {
  if (typeof label !== "string" || !SUBJECT_CODES[label]) {
    throw u.err("지원하는 과목을 선택해 주세요.", 400, "INVALID_LEARNING_SUBJECT");
  }
  return SUBJECT_CODES[label];
}

function levelCode(label) {
  if (typeof label !== "string" || !LEVEL_CODES[label]) {
    throw u.err("학습 기준을 선택해 주세요.", 400, "INVALID_LEARNING_LEVEL");
  }
  return LEVEL_CODES[label];
}

function profileDto(row) {
  if (!row) return null;
  const subject = SUBJECT_LABELS[row.subject];
  const level = LEVEL_LABELS[row.level_code];
  if (!subject || !level) return null;
  return { subject, level };
}

function attemptError(response, error, fallbackCode = "ATTEMPT_STATE_CONFLICT") {
  if (error.supabaseCode === "55000" && String(error.supabaseMessage || "").includes("LEARNING_PLAN_PAUSED")) {
    return send(response, 409, {
      ok: false,
      error: "일시 중지된 계획에서는 새 문제풀이를 시작할 수 없습니다.",
      code: "LEARNING_PLAN_PAUSED",
    });
  }
  const mappings = {
    "22004": [400, "INVALID_ATTEMPT_REQUEST", "문제풀이 요청 값을 확인해 주세요."],
    "23505": [409, "ANSWER_CONFLICT", "이미 제출한 답안과 요청 내용이 다릅니다."],
    "23514": [400, "INVALID_ATTEMPT_OPTION", "선택한 답안을 확인해 주세요."],
    "40001": [409, "ATTEMPT_CONFLICT", "응시 상태가 변경되었습니다. 다시 확인해 주세요."],
    "42501": [403, "LEARNING_ACCESS_DENIED", "문제풀이에 접근할 권한이 없습니다."],
    "55000": [409, fallbackCode, "현재 응시 상태에서는 요청을 처리할 수 없습니다."],
    P0002: [404, "LEARNING_NOT_FOUND", "문제풀이 대상을 찾을 수 없습니다."],
  };
  const mapping = mappings[error.supabaseCode];
  if (mapping) {
    return send(response, mapping[0], { ok: false, error: mapping[2], code: mapping[1] });
  }
  return safeError(response, error);
}

module.exports = {
  activeChild,
  activeMember,
  allow,
  attemptError,
  assignmentReadScope,
  date,
  exactBody,
  idList,
  inFilter,
  levelCode,
  parentScope,
  planningError,
  profileDto,
  requireMutationGuard,
  revision,
  safeError,
  send,
  stageTargets,
  subjectCode,
  timezone,
  u,
  uuid,
};
