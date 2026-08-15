"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { diagnosePublicMemberScope } = require("../scripts/phase1-batch6-idor-diagnostic");

const A = Object.freeze([
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
]);
const B = Object.freeze([
  "20000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
  "20000000-0000-4000-8000-000000000003",
]);
const members = (ids = A) => ids.map((id, index) => ({
  id,
  display_name: `UAT member ${index + 1}`,
  role: index === 0 ? "parent" : "child",
  avatar_emoji: "test",
  ...(index === 0 ? { is_active: true, notifications_enabled: true, device_count: 0 } : {}),
}));
const diagnose = (actualMembers, options = {}) => diagnosePublicMemberScope({
  expectedMemberIds: A,
  actualMembers,
  foreignMemberIds: B,
  ...options,
});

test("public DTO omits private tenant and authentication fields", () => {
  const result = diagnose(members());
  assert.equal(result.pass, true);
  assert.equal(result.diagnostic.forbiddenFieldCount, 0);
  assert.equal(Object.hasOwn(members()[0], "family_id"), false);
});

test("exact expected opaque member set passes", () => {
  const result = diagnose(members([A[2], A[0], A[1]]));
  assert.equal(result.pass, true);
  assert.deepEqual(result.diagnostic, {
    expectedCount: 3,
    actualCount: 3,
    missingCount: 0,
    unexpectedCount: 0,
    foreignIntersectionCount: 0,
    invalidIdentityCount: 0,
    duplicateIdentityCount: 0,
    forbiddenFieldCount: 0,
    roleCounts: { parent: 1, child: 2 },
    roleMismatchCount: 0,
  });
});

test("missing expected member fails without exposing an identifier", () => {
  const result = diagnose(members().slice(0, 2));
  assert.equal(result.pass, false);
  assert.equal(result.failure, "EXPECTED_MEMBER_MISSING");
  assert.equal(result.diagnostic.missingCount, 1);
  assert.doesNotMatch(JSON.stringify(result), /10000000-/);
});

test("unexpected member fails", () => {
  const result = diagnose([...members(), { ...members(B)[0], id: "30000000-0000-4000-8000-000000000001" }]);
  assert.equal(result.pass, false);
  assert.equal(result.failure, "UNEXPECTED_MEMBER_EXPOSED");
  assert.equal(result.diagnostic.unexpectedCount, 1);
});

test("A/B member intersection fails", () => {
  const result = diagnose(members([A[0], A[1], B[0]]), { expectedMemberIds: [A[0], A[1], B[0]] });
  assert.equal(result.pass, false);
  assert.equal(result.failure, "FOREIGN_MEMBER_EXPOSED");
  assert.equal(result.diagnostic.foreignIntersectionCount, 1);
});

test("forbidden private member field fails", () => {
  for (const field of ["family_id", "member_key", "pin", "pin_hash", "failed_attempts", "locked_until", "session_token", "access_token"]) {
    const exposed = members();
    exposed[0][field] = "private";
    const result = diagnose(exposed);
    assert.equal(result.pass, false, field);
    assert.equal(result.failure, "PRIVATE_MEMBER_FIELD_EXPOSED", field);
  }
});

test("one Parent and two Child public roles pass", () => {
  const result = diagnose(members());
  assert.equal(result.pass, true);
  assert.deepEqual(result.diagnostic.roleCounts, { parent: 1, child: 2 });
  assert.equal(result.diagnostic.roleMismatchCount, 0);
});
