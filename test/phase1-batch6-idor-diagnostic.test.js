"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  IDOR_CONTRACTS,
  diagnoseIdorResponse,
  runIdorMatrix,
} = require("../scripts/phase1-batch6-idor-diagnostic");

const root = path.join(__dirname, "..");

test("canonical IDOR contracts use symbolic routes and source/test evidence", () => {
  assert.equal(IDOR_CONTRACTS.length, 18);
  assert.equal(new Set(IDOR_CONTRACTS.map(({ routeId }) => routeId)).size, IDOR_CONTRACTS.length);
  for (const item of IDOR_CONTRACTS) {
    assert.match(item.routeId, /^[a-z0-9]+(?:-[a-z0-9]+)+$/);
    assert.ok(["GET", "POST", "PATCH"].includes(item.method));
    assert.ok(item.expectedStatuses.length > 0);
    assert.ok(item.expectedStatuses.every((status) => status === 403 || status === 404));
    assert.ok(item.expectedCodes.length > 0);
    assert.equal(item.payloadExposure, 0);
    assert.equal(item.mutationExpected, 0);
    assert.doesNotMatch(item.routeId, /[0-9a-f]{8}-[0-9a-f-]{27,}/i);
    for (const file of [...item.evidence.source, ...item.evidence.tests]) {
      assert.equal(fs.existsSync(path.join(root, file)), true, `${item.routeId}: missing ${file}`);
    }
  }
});

test("notification #17 contract requires a foreign-only member key", () => {
  const definition = IDOR_CONTRACTS.find(({ routeId }) => routeId === "notification-target-cross-family");
  assert.equal(definition.attack, "foreign-only-family-member-key");
  assert.match(definition.routeTemplate, /foreignOnlyMemberKey/);
  assert.deepEqual(definition.expectedStatuses, [404]);
  assert.deepEqual(definition.expectedCodes, ["FAMILY_CHILD_NOT_FOUND"]);
});

test("route-specific 403 and 404 contracts pass without widening status sets", () => {
  const notFound = diagnoseIdorResponse("learning-assignment-cross-family-child", {
    status: 404,
    contentType: "application/json; charset=utf-8",
    body: { ok: false, error: "safe", code: "FAMILY_CHILD_NOT_FOUND" },
  });
  assert.equal(notFound.pass, true);

  const forbidden = diagnoseIdorResponse("queue-sibling-override", {
    status: 403,
    contentType: "application/json",
    body: { ok: false, error: "safe", code: "CHILD_ASSIGNEE_OVERRIDE_NOT_ALLOWED" },
  });
  assert.equal(forbidden.pass, true);
});

test("unexpected 401 preserves exact safe first-failure metadata", () => {
  const result = diagnoseIdorResponse("review-session-cross-family", {
    status: 401,
    contentType: "application/json; charset=utf-8",
    body: {
      ok: false,
      code: "AUTH_SESSION_INVALID",
      error: "must not be copied",
      token: "must not be copied",
      family_id: "must not be copied",
    },
  });
  assert.equal(result.pass, false);
  assert.equal(result.failure, "STATUS_UNEXPECTED");
  assert.deepEqual(result.diagnostic, {
    stage: "idor",
    routeId: "review-session-cross-family",
    method: "GET",
    actor: "parent-a",
    attack: "foreign-family-review-session-id",
    expectedStatuses: [404],
    actualStatus: 401,
    publicCode: "AUTH_SESSION_INVALID",
    contentType: "application/json",
    bodyShape: ["code", "error", "family_id", "ok", "token"],
    mutationCount: 0,
  });
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /must not be copied/);
});

test("unexpected 2xx is always security-critical", () => {
  const result = diagnoseIdorResponse("message-read-cross-family", {
    status: 200,
    contentType: "application/json",
    body: { ok: true, count: 0 },
  });
  assert.equal(result.pass, false);
  assert.equal(result.severity, "security-critical");
  assert.equal(result.failure, "UNEXPECTED_2XX");
  assert.equal(result.diagnostic.actualStatus, 200);
});

test("HTTP 500 is fatal and exposes only public code and body shape", () => {
  const result = diagnoseIdorResponse("reward-product-cross-family", {
    status: 500,
    contentType: "text/html; charset=utf-8",
    body: { code: "REWARD_PRODUCT_FAILED", error: "private SQL detail", stack: "private stack" },
  });
  assert.equal(result.pass, false);
  assert.equal(result.severity, "fatal");
  assert.equal(result.failure, "HTTP_FATAL");
  assert.equal(result.diagnostic.publicCode, "REWARD_PRODUCT_FAILED");
  assert.deepEqual(result.diagnostic.bodyShape, ["code", "error", "stack"]);
  assert.doesNotMatch(JSON.stringify(result), /private SQL detail|private stack/);
});

test("an allowed status with a wrong public code still fails", () => {
  const result = diagnoseIdorResponse("study-plan-cross-family-child", {
    status: 403,
    contentType: "application/json",
    body: { code: "AUTH_ROLE_REQUIRED" },
  });
  assert.equal(result.pass, false);
  assert.equal(result.failure, "PUBLIC_CODE_UNEXPECTED");
});

test("any cross-family mutation fails even when status and code are allowed", () => {
  const result = diagnoseIdorResponse("notification-target-cross-family", {
    status: 404,
    contentType: "application/json",
    body: { code: "FAMILY_CHILD_NOT_FOUND" },
  }, 1);
  assert.equal(result.pass, false);
  assert.equal(result.severity, "security-critical");
  assert.equal(result.failure, "CROSS_FAMILY_MUTATION");
  assert.equal(result.diagnostic.mutationCount, 1);
});

test("diagnostics never include route templates, raw bodies, URLs, or credentials", () => {
  const result = diagnoseIdorResponse("reward-request-cross-family", {
    status: 404,
    contentType: "application/json",
    body: {
      code: "FAMILY_OBJECT_NOT_FOUND",
      authorization: "Bearer private-token",
      cookie: "private-cookie",
      message: "private UUID 11111111-1111-4111-8111-111111111111",
    },
  });
  const serialized = JSON.stringify(result);
  assert.equal(result.pass, true);
  assert.doesNotMatch(serialized, /\/api\/|Bearer|private-token|private-cookie|11111111/);
});

test("matrix execution stops after the first failure and preserves its symbolic diagnostic", async () => {
  const selected = IDOR_CONTRACTS.slice(0, 3);
  const calls = [];
  const result = await runIdorMatrix(async (definition) => {
    calls.push(definition.routeId);
    if (calls.length === 1) {
      return {
        response: {
          status: definition.expectedStatuses[0],
          contentType: "application/json",
          body: { code: definition.expectedCodes[0] },
        },
        mutationCount: 0,
      };
    }
    return {
      response: {
        status: 401,
        contentType: "application/json",
        body: { code: "AUTH_SESSION_INVALID", error: "raw response is not retained" },
      },
      mutationCount: 0,
    };
  }, selected);

  assert.equal(result.pass, false);
  assert.deepEqual(calls, selected.slice(0, 2).map(({ routeId }) => routeId));
  assert.deepEqual(result.completedRouteIds, calls);
  assert.equal(result.firstFailure.failure, "STATUS_UNEXPECTED");
  assert.equal(result.firstFailure.diagnostic.routeId, selected[1].routeId);
  assert.doesNotMatch(JSON.stringify(result), /raw response is not retained/);
});
