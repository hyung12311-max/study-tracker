const u = require("../rewards/_utils");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(value, code = "INVALID_LEARNING_ID") {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw u.err("문제풀이 학습 요청을 확인해 주세요.", 400, code);
  }
  return value;
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
  const claims = u.authenticate(request, role);
  const member = await u.memberInFamily(claims.sub, claims.family);
  if (
    !member
    || String(member.id) !== String(claims.sub)
    || String(member.family_id) !== String(claims.family)
    || member.is_active !== true
    || member.role !== claims.role
    || (role && member.role !== role)
  ) {
    throw u.err(
      role === "parent" ? "활성 부모 권한이 필요합니다." : "활성 가족 구성원 인증이 필요합니다.",
      403,
      role === "parent" ? "ACTIVE_PARENT_REQUIRED" : "ACTIVE_MEMBER_REQUIRED"
    );
  }
  return { claims, member };
}

async function activeChild(familyId, assignedMemberId) {
  const child = (await u.supabaseFetch(
    `family_members?select=id,family_id,role,is_active&id=eq.${encodeURIComponent(assignedMemberId)}&family_id=eq.${encodeURIComponent(familyId)}&role=eq.child&is_active=eq.true&limit=1`
  ))?.[0];
  if (!child) {
    throw u.err("배정 대상을 찾을 수 없습니다.", 404, "LEARNING_TARGET_NOT_FOUND");
  }
  return String(child.id);
}

async function parentScope(request, assignedMemberId) {
  const { claims, member } = await activeMember(request, "parent");
  const childId = uuid(
    assignedMemberId,
    assignedMemberId ? "INVALID_ASSIGNED_MEMBER" : "ASSIGNED_MEMBER_REQUIRED"
  );
  await activeChild(claims.family, childId);
  return { claims, member, assignedMemberId: childId };
}

async function assignmentReadScope(request) {
  const { claims, member } = await activeMember(request);
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
    return { claims, member, assignedMemberId: String(claims.sub), viewerRole: "child" };
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
  const isPublic = Boolean(error.statusCode && !databaseCode);
  console.error("[learning API failed]", {
    status: error.statusCode || 500,
    code: databaseCode || error.code || null,
  });
  return send(response, isPublic ? error.statusCode : 500, {
    ok: false,
    error: isPublic ? error.message : "문제풀이 학습 요청을 처리하지 못했습니다.",
    code: error.code || databaseCode || "LEARNING_REQUEST_FAILED",
  });
}

function idList(rows, key = "id") {
  return [...new Set((rows || []).map((row) => String(row[key])).filter(Boolean))];
}

function inFilter(ids) {
  return ids.join(",");
}

function attemptError(response, error, fallbackCode = "ATTEMPT_STATE_CONFLICT") {
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
  exactBody,
  idList,
  inFilter,
  parentScope,
  requireMutationGuard,
  safeError,
  send,
  u,
  uuid,
};
