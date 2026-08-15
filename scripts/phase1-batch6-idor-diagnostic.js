"use strict";

const PUBLIC_CODE = /^[A-Z][A-Z0-9_]{1,80}$/;
const SAFE_KEY = /^[A-Za-z][A-Za-z0-9_]{0,79}$/;
const OPAQUE_MEMBER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_MEMBER_FIELDS = Object.freeze(new Set([
  "family_id",
  "member_key",
  "pin",
  "pin_hash",
  "failed_attempts",
  "locked_until",
]));

const contract = (definition) => Object.freeze({
  ...definition,
  expectedStatuses: Object.freeze([...definition.expectedStatuses]),
  expectedCodes: Object.freeze([...definition.expectedCodes]),
  payloadExposure: 0,
  mutationExpected: 0,
  evidence: Object.freeze({
    source: Object.freeze([...definition.evidence.source]),
    tests: Object.freeze([...definition.evidence.tests]),
  }),
});

// These are symbolic contracts. A Production harness must substitute identifiers in
// memory and must never place an expanded URL, UUID, token, cookie, or PIN in reports.
const IDOR_CONTRACTS = Object.freeze([
  contract({
    routeId: "family-child-resolver-cross-family",
    method: "GET",
    actor: "parent-a",
    attack: "foreign-family-child-selection",
    routeTemplate: "/api/rewards?memberId=:foreignChild",
    authHelper: "authenticateActiveMember + resolveActiveFamilyChild",
    expectedStatuses: [404],
    expectedCodes: ["FAMILY_CHILD_NOT_FOUND"],
    evidence: {
      source: ["server/api/_authorization.js", "server/api/rewards/index.js"],
      tests: ["test/common-authorization.test.js"],
    },
  }),
  contract({
    routeId: "study-plan-cross-family-child",
    method: "GET",
    actor: "parent-a",
    attack: "foreign-family-assignee-selection",
    routeTemplate: "/api/study/plans?assignedMemberId=:foreignChild",
    authHelper: "requireActiveMember + requireActiveChild",
    expectedStatuses: [403],
    expectedCodes: ["ASSIGNED_MEMBER_NOT_ALLOWED"],
    evidence: {
      source: ["server/api/study/plans.js"],
      tests: ["test/study-plans.test.js"],
    },
  }),
  contract({
    routeId: "study-plan-cross-family-object",
    method: "PATCH",
    actor: "parent-a",
    attack: "foreign-family-plan-id-with-local-assignee",
    routeTemplate: "/api/study/plans",
    authHelper: "requireActiveMember + requireActiveChild + ownedPlans",
    expectedStatuses: [404],
    expectedCodes: ["PLAN_NOT_FOUND"],
    evidence: {
      source: ["server/api/study/plans.js"],
      tests: ["test/study-plans.test.js"],
    },
  }),
  contract({
    routeId: "learning-assignment-cross-family-child",
    method: "GET",
    actor: "parent-a",
    attack: "foreign-family-assignee-selection",
    routeTemplate: "/api/learning/assignments?assignedMemberId=:foreignChild",
    authHelper: "activeMember + parentScope + activeChild",
    expectedStatuses: [404],
    expectedCodes: ["FAMILY_CHILD_NOT_FOUND"],
    evidence: {
      source: ["server/api/learning/_utils.js", "server/api/learning/assignments.js"],
      tests: ["test/phase1-batch4-learning-authorization.test.js"],
    },
  }),
  contract({
    routeId: "learning-assignment-cross-family-object",
    method: "POST",
    actor: "parent-a",
    attack: "foreign-family-assignment-id-with-local-assignee",
    routeTemplate: "/api/learning/assignments/:foreignAssignment/cancel",
    authHelper: "activeMember(parent) + parentScope + family-scoped assignment lookup",
    expectedStatuses: [404],
    expectedCodes: ["LEARNING_NOT_FOUND"],
    evidence: {
      source: ["server/api/learning/assignments/[assignmentId]/cancel.js"],
      tests: ["test/learning-assignments.test.js"],
    },
  }),
  contract({
    routeId: "learning-assignment-sibling-override",
    method: "GET",
    actor: "child-a1",
    attack: "same-family-sibling-assignee-override",
    routeTemplate: "/api/learning/assignments?assignedMemberId=:sibling",
    authHelper: "activeMember + assignmentReadScope",
    expectedStatuses: [403],
    expectedCodes: ["CHILD_ASSIGNEE_OVERRIDE_NOT_ALLOWED"],
    evidence: {
      source: ["server/api/learning/_utils.js", "server/api/learning/assignments.js"],
      tests: ["test/phase1-batch4-learning-authorization.test.js"],
    },
  }),
  contract({
    routeId: "learning-plan-cross-family-object",
    method: "GET",
    actor: "parent-a",
    attack: "foreign-family-plan-id-with-local-assignee",
    routeTemplate: "/api/learning/plans/:foreignPlan?assignedMemberId=:localChild",
    authHelper: "activeMember + parentScope + scoped plan result",
    expectedStatuses: [404],
    expectedCodes: ["PLAN_NOT_FOUND"],
    evidence: {
      source: ["server/api/learning/plans.js"],
      tests: ["test/learning-plans.test.js"],
    },
  }),
  contract({
    routeId: "learning-attempt-cross-family",
    method: "GET",
    actor: "child-a1",
    attack: "foreign-family-attempt-id",
    routeTemplate: "/api/learning/attempts/:foreignAttempt",
    authHelper: "activeMember(child) + scopedAttempt",
    expectedStatuses: [404],
    expectedCodes: ["LEARNING_NOT_FOUND"],
    evidence: {
      source: ["server/api/learning/attempts/_shared.js", "server/api/learning/attempts/[attemptId].js"],
      tests: ["test/learning-attempts.test.js"],
    },
  }),
  contract({
    routeId: "review-session-cross-family",
    method: "GET",
    actor: "parent-a",
    attack: "foreign-family-review-session-id",
    routeTemplate: "/api/learning/mistake-reviews/:foreignReview",
    authHelper: "activeMember + scopedReviewSession",
    expectedStatuses: [404],
    expectedCodes: ["MISTAKE_REVIEW_NOT_FOUND"],
    evidence: {
      source: ["server/api/learning/_mistake-reviews.js", "server/api/learning/mistake-reviews/[reviewId].js"],
      tests: ["test/learning-mistake-review-lifecycle.test.js", "test/phase1-batch4-learning-authorization.test.js"],
    },
  }),
  contract({
    routeId: "queue-cross-family-child",
    method: "GET",
    actor: "parent-a",
    attack: "foreign-family-queue-assignee",
    routeTemplate: "/api/learning/review-queue?assignedMemberId=:foreignChild",
    authHelper: "assignmentReadScope + activeChild",
    expectedStatuses: [404],
    expectedCodes: ["FAMILY_CHILD_NOT_FOUND"],
    evidence: {
      source: ["server/api/learning/_utils.js", "server/api/learning/_review-queue.js"],
      tests: ["test/learning-review-queue.test.js"],
    },
  }),
  contract({
    routeId: "queue-sibling-override",
    method: "GET",
    actor: "child-a1",
    attack: "same-family-sibling-queue-override",
    routeTemplate: "/api/learning/review-queue?assignedMemberId=:sibling",
    authHelper: "assignmentReadScope",
    expectedStatuses: [403],
    expectedCodes: ["CHILD_ASSIGNEE_OVERRIDE_NOT_ALLOWED"],
    evidence: {
      source: ["server/api/learning/_utils.js", "server/api/learning/_review-queue.js"],
      tests: ["test/learning-review-queue.test.js"],
    },
  }),
  contract({
    routeId: "reward-product-cross-family",
    method: "PATCH",
    actor: "parent-a",
    attack: "foreign-family-product-id",
    routeTemplate: "/api/rewards/products",
    authHelper: "authenticateActiveMember(parent) + buildFamilyScopedObjectPath",
    expectedStatuses: [404],
    expectedCodes: ["FAMILY_OBJECT_NOT_FOUND"],
    evidence: {
      source: ["server/api/rewards/products.js", "server/api/_authorization.js"],
      tests: ["test/phase1-batch3-reward-notification-security.test.js"],
    },
  }),
  contract({
    routeId: "reward-request-cross-family",
    method: "PATCH",
    actor: "parent-a",
    attack: "foreign-family-reward-request-id",
    routeTemplate: "/api/rewards/exchange",
    authHelper: "authenticateActiveMember(parent) + pendingRequest",
    expectedStatuses: [404],
    expectedCodes: ["FAMILY_OBJECT_NOT_FOUND"],
    evidence: {
      source: ["server/api/rewards/exchange.js", "server/api/_authorization.js"],
      tests: ["test/phase1-batch3-reward-notification-security.test.js"],
    },
  }),
  contract({
    routeId: "reward-sibling-override",
    method: "GET",
    actor: "child-a1",
    attack: "same-family-sibling-wallet-override",
    routeTemplate: "/api/rewards?memberId=:sibling",
    authHelper: "authenticateActiveMember + childSelfScope",
    expectedStatuses: [403],
    expectedCodes: ["AUTH_ROLE_REQUIRED"],
    evidence: {
      source: ["server/api/rewards/index.js", "server/api/_authorization.js"],
      tests: ["test/common-authorization.test.js"],
    },
  }),
  contract({
    routeId: "reward-wishlist-cross-family-product",
    method: "POST",
    actor: "child-a1",
    attack: "foreign-family-product-id",
    routeTemplate: "/api/rewards/wishlist",
    authHelper: "authenticateActiveMember + buildFamilyScopedObjectPath",
    expectedStatuses: [404],
    expectedCodes: ["FAMILY_OBJECT_NOT_FOUND"],
    evidence: {
      source: ["server/api/rewards/wishlist.js", "server/api/_authorization.js"],
      tests: ["test/phase1-batch3-reward-notification-security.test.js"],
    },
  }),
  contract({
    routeId: "message-read-cross-family",
    method: "POST",
    actor: "parent-a",
    attack: "foreign-family-message-id",
    routeTemplate: "/api/family/read",
    authHelper: "authenticateActiveMember + family-scoped message preflight",
    expectedStatuses: [404],
    expectedCodes: ["FAMILY_OBJECT_NOT_FOUND"],
    evidence: {
      source: ["server/api/family/read.js", "server/api/_authorization.js"],
      tests: ["test/phase1-batch2-family-push-security.test.js"],
    },
  }),
  contract({
    routeId: "notification-target-cross-family",
    method: "PATCH",
    actor: "parent-a",
    attack: "foreign-only-family-member-key",
    routeTemplate: "/api/notifications/preferences member_key=:foreignOnlyMemberKey",
    authHelper: "authenticateActiveMember + family-scoped member lookup",
    expectedStatuses: [404],
    expectedCodes: ["FAMILY_CHILD_NOT_FOUND"],
    evidence: {
      source: ["server/api/notifications/preferences.js", "server/api/_authorization.js"],
      tests: ["test/phase1-batch3-reward-notification-security.test.js"],
    },
  }),
  contract({
    routeId: "notification-sibling-override",
    method: "PATCH",
    actor: "child-a1",
    attack: "same-family-sibling-member-key",
    routeTemplate: "/api/notifications/preferences",
    authHelper: "authenticateActiveMember + childSelfScope",
    expectedStatuses: [403],
    expectedCodes: ["AUTH_ROLE_REQUIRED"],
    evidence: {
      source: ["server/api/notifications/preferences.js", "server/api/_authorization.js"],
      tests: ["test/phase1-batch3-reward-notification-security.test.js"],
    },
  }),
]);

const CONTRACT_BY_ID = new Map(IDOR_CONTRACTS.map((item) => [item.routeId, item]));

function contentType(value) {
  const normalized = String(value || "").split(";", 1)[0].trim().toLowerCase();
  if (["application/json", "text/html", "text/plain"].includes(normalized)) return normalized;
  return normalized ? "other" : null;
}

function publicCode(body) {
  return typeof body?.code === "string" && PUBLIC_CODE.test(body.code) ? body.code : null;
}

function bodyShape(body) {
  if (body === null) return "null";
  if (Array.isArray(body)) return "array";
  if (!body || typeof body !== "object") return typeof body;
  return Object.keys(body).filter((key) => SAFE_KEY.test(key)).sort().slice(0, 20);
}

function diagnoseIdorResponse(routeId, response, mutationCount = 0) {
  const definition = CONTRACT_BY_ID.get(routeId);
  if (!definition) throw new TypeError("Unknown symbolic IDOR route.");
  const actualStatus = Number(response?.status);
  if (!Number.isInteger(actualStatus) || actualStatus < 100 || actualStatus > 599) {
    throw new TypeError("HTTP status is invalid.");
  }
  if (!Number.isSafeInteger(mutationCount) || mutationCount < 0) {
    throw new TypeError("Mutation count is invalid.");
  }

  const code = publicCode(response?.body);
  const diagnostic = Object.freeze({
    stage: "idor",
    routeId: definition.routeId,
    method: definition.method,
    actor: definition.actor,
    attack: definition.attack,
    expectedStatuses: [...definition.expectedStatuses],
    actualStatus,
    publicCode: code,
    contentType: contentType(response?.contentType),
    bodyShape: bodyShape(response?.body),
    mutationCount,
  });

  if (mutationCount > 0) {
    return { pass: false, severity: "security-critical", failure: "CROSS_FAMILY_MUTATION", diagnostic };
  }
  if (actualStatus >= 200 && actualStatus < 300) {
    return { pass: false, severity: "security-critical", failure: "UNEXPECTED_2XX", diagnostic };
  }
  if (actualStatus >= 500) {
    return { pass: false, severity: "fatal", failure: "HTTP_FATAL", diagnostic };
  }
  if (!definition.expectedStatuses.includes(actualStatus)) {
    return { pass: false, severity: "contract", failure: "STATUS_UNEXPECTED", diagnostic };
  }
  if (!definition.expectedCodes.includes(code)) {
    return { pass: false, severity: "contract", failure: "PUBLIC_CODE_UNEXPECTED", diagnostic };
  }
  return { pass: true, severity: null, failure: null, diagnostic };
}

async function runIdorMatrix(execute, contracts = IDOR_CONTRACTS) {
  if (typeof execute !== "function") throw new TypeError("IDOR executor is required.");
  const completedRouteIds = [];
  for (const definition of contracts) {
    if (CONTRACT_BY_ID.get(definition?.routeId) !== definition) {
      throw new TypeError("IDOR matrix contains an unknown contract.");
    }
    const observation = await execute(definition);
    const result = diagnoseIdorResponse(
      definition.routeId,
      observation?.response,
      observation?.mutationCount ?? 0
    );
    completedRouteIds.push(definition.routeId);
    if (!result.pass) {
      return Object.freeze({
        pass: false,
        completedRouteIds: Object.freeze([...completedRouteIds]),
        firstFailure: result,
      });
    }
  }
  return Object.freeze({
    pass: true,
    completedRouteIds: Object.freeze([...completedRouteIds]),
    firstFailure: null,
  });
}

function diagnosePublicMemberScope({
  expectedMemberIds,
  actualMembers,
  foreignMemberIds = [],
  expectedRoles = { parent: 1, child: 2 },
}) {
  if (!Array.isArray(expectedMemberIds) || !Array.isArray(actualMembers) || !Array.isArray(foreignMemberIds)) {
    throw new TypeError("Member scope inputs must be arrays.");
  }
  if (!expectedRoles || typeof expectedRoles !== "object" || Array.isArray(expectedRoles)) {
    throw new TypeError("Expected member roles must be an object.");
  }

  const expected = new Set(expectedMemberIds);
  const actualIds = actualMembers.map((member) => member?.id);
  const actual = new Set(actualIds);
  const foreign = new Set(foreignMemberIds);
  if (expected.size !== expectedMemberIds.length
    || expectedMemberIds.some((id) => !OPAQUE_MEMBER_ID.test(id || ""))
    || foreign.size !== foreignMemberIds.length
    || foreignMemberIds.some((id) => !OPAQUE_MEMBER_ID.test(id || ""))) {
    throw new TypeError("Expected member identity sets are invalid.");
  }

  const missingCount = [...expected].filter((id) => !actual.has(id)).length;
  const unexpectedCount = [...actual].filter((id) => !expected.has(id)).length;
  const foreignIntersectionCount = [...actual].filter((id) => foreign.has(id)).length;
  const invalidIdentityCount = actualIds.filter((id) => !OPAQUE_MEMBER_ID.test(id || "")).length;
  const duplicateIdentityCount = actualIds.length - actual.size;
  const forbiddenFieldCount = actualMembers.reduce((count, member) => {
    if (!member || typeof member !== "object" || Array.isArray(member)) return count + 1;
    return count + Object.keys(member).filter(
      (key) => PRIVATE_MEMBER_FIELDS.has(key) || /(?:^|_)(?:token|session)(?:_|$)/i.test(key)
    ).length;
  }, 0);
  const roleCounts = Object.fromEntries(Object.keys(expectedRoles).map((role) => [
    role,
    actualMembers.filter((member) => member?.role === role).length,
  ]));
  const roleMismatchCount = Object.entries(expectedRoles).filter(
    ([role, count]) => roleCounts[role] !== count
  ).length;

  const diagnostic = Object.freeze({
    expectedCount: expected.size,
    actualCount: actualMembers.length,
    missingCount,
    unexpectedCount,
    foreignIntersectionCount,
    invalidIdentityCount,
    duplicateIdentityCount,
    forbiddenFieldCount,
    roleCounts: Object.freeze({ ...roleCounts }),
    roleMismatchCount,
  });
  const failure = forbiddenFieldCount > 0 ? "PRIVATE_MEMBER_FIELD_EXPOSED"
    : invalidIdentityCount > 0 ? "PUBLIC_MEMBER_ID_INVALID"
      : duplicateIdentityCount > 0 ? "PUBLIC_MEMBER_ID_DUPLICATED"
        : missingCount > 0 ? "EXPECTED_MEMBER_MISSING"
          : unexpectedCount > 0 ? "UNEXPECTED_MEMBER_EXPOSED"
            : foreignIntersectionCount > 0 ? "FOREIGN_MEMBER_EXPOSED"
              : roleMismatchCount > 0 ? "MEMBER_ROLE_SHAPE_UNEXPECTED"
                : null;
  return Object.freeze({ pass: failure === null, failure, diagnostic });
}

module.exports = {
  IDOR_CONTRACTS,
  PRIVATE_MEMBER_FIELDS,
  diagnoseIdorResponse,
  diagnosePublicMemberScope,
  runIdorMatrix,
};
