const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const smoke = require("../scripts/validate-learning-production-smoke");

const contract = smoke.loadContract();
const router = fs.readFileSync(path.join(__dirname, "../api/[...path].js"), "utf8");
const validatorSource = fs.readFileSync(path.join(__dirname, "../scripts/validate-learning-production-smoke.js"), "utf8");

function clone() {
  return structuredClone(contract);
}

test("smoke configuration validates without performing a network request", () => {
  assert.equal(contract.version, "phase-f-v1");
  assert.equal(contract.unitTestsPerformNetworkRequests, false);
  assert.doesNotMatch(validatorSource, /\bfetch\s*\(|https?\.request|Invoke-WebRequest|curl(?:\.exe)?/i);
});

test("base URL contract requires one HTTPS HTML 200 smoke with Phase F markers", () => {
  assert.equal(new URL(contract.productionBaseUrl).protocol, "https:");
  assert.equal(contract.base.method, "GET");
  assert.deepEqual(contract.base.expectedStatuses, [200]);
  assert.ok(contract.base.contentTypes.includes("text/html"));
  for (const marker of ["learningAnalysisSection", "learningMistakesSection", "learningReviewWorkspace"]) {
    assert.ok(contract.base.markers.includes(marker));
  }
});

test("asset inventory covers the deployed learning shell analysis and review modules", () => {
  assert.deepEqual(contract.assets.map((asset) => asset.path), [
    "/css/styles.css",
    "/js/app.js",
    "/js/learning.js",
    "/js/learning-analysis.js",
    "/js/learning-mistakes.js",
  ]);
  assert.ok(contract.assets.every((asset) => asset.markers.length > 0));
});

test("read-only contract covers planning analysis mistakes and review GET routes", () => {
  assert.deepEqual(contract.readOnlyEndpoints.map((endpoint) => endpoint.name), [
    "planning", "scores", "attempt-history", "skills", "recommendations", "mistakes", "mistake-review",
  ]);
  assert.ok(contract.readOnlyEndpoints.every((endpoint) => endpoint.method === "GET"));
  for (const route of ["learning/plans", "learning/scores", "learning/attempt-history", "learning/skills", "learning/recommendations"]) {
    assert.match(router, new RegExp(route.replace("/", "\\/")));
  }
  assert.match(router, /mistakesMatch/);
  assert.match(router, /reviewMatch/);
});

test("mutation routes are guard-only declarations with no executable payload", () => {
  assert.deepEqual(contract.mutationEndpoints.map((endpoint) => endpoint.name), [
    "reveal", "review-start", "review-answer", "review-abandon",
  ]);
  for (const endpoint of contract.mutationEndpoints) {
    assert.equal(endpoint.method, "POST");
    assert.equal(endpoint.guardOnly, true);
    assert.equal(endpoint.execute, false);
    assert.equal(endpoint.payload, null);
  }
});

test("unauthenticated responses require auth and prohibit private payloads", () => {
  assert.deepEqual(contract.unauthenticatedExpectation.statuses, [401, 403]);
  assert.ok(contract.unauthenticatedExpectation.codes.includes("AUTH_REQUIRED"));
  assert.equal(contract.unauthenticatedExpectation.privatePayloadAllowed, false);
});

test("private response denylist covers solutions scope database and credential details", () => {
  for (const field of [
    "correctAnswer", "explanation", "family_id", "source_attempt_id", "service_role",
    "sqlstate", "stack", "connection string", "access_token", "refresh_token",
  ]) assert.ok(contract.privateResponseDenylist.includes(field));
});

test("production mutation budget remains zero and real identifiers are forbidden", () => {
  assert.equal(contract.productionMutationBudget, 0);
  assert.equal(contract.mutationEndpoints.filter((endpoint) => endpoint.execute).length, 0);
  assert.equal(contract.placeholderPolicy.actualProductionIdentifiersAllowed, false);
  assert.equal(contract.placeholderPolicy.zeroUuidAllowed, false);
  assert.equal(contract.placeholderPolicy.nonNilUuidRequired, true);
});

test("authenticated UI UAT remains an optional credential-free backlog", () => {
  assert.deepEqual(contract.authenticatedUiUat, {
    required: false,
    blocking: false,
    acquireCredentials: false,
    backlogWhenSessionUnavailable: true,
  });
});

test("validator rejects network execution mutation and weakened privacy variants", () => {
  for (const mutate of [
    (value) => { value.unitTestsPerformNetworkRequests = true; },
    (value) => { value.productionMutationBudget = 1; },
    (value) => { value.mutationEndpoints[0].execute = true; },
    (value) => { value.mutationEndpoints[0].payload = {}; },
    (value) => { value.unauthenticatedExpectation.privatePayloadAllowed = true; },
    (value) => { value.privateResponseDenylist = value.privateResponseDenylist.filter((field) => field !== "correctAnswer"); },
    (value) => { value.authenticatedUiUat.acquireCredentials = true; },
  ]) {
    const value = clone();
    mutate(value);
    assert.throws(() => smoke.validateContract(value), /Invalid Phase F production smoke contract/);
  }
});
