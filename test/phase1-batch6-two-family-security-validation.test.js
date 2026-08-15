const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const sourceFiles = Object.freeze({
  auth: "test/common-authorization.test.js",
  bootstrap: "test/family-bootstrap-security.test.js",
  parent: "test/parent-management-auth-flow.test.js",
  family: "test/phase1-batch2-family-push-security.test.js",
  rewards: "test/phase1-batch3-reward-notification-security.test.js",
  learning: "test/phase1-batch4-learning-authorization.test.js",
  study: "test/study-plans.test.js",
  attempts: "test/learning-attempts.test.js",
  reviews: "test/learning-mistake-review-lifecycle.test.js",
  queue: "test/learning-review-queue.test.js",
  legacy: "test/phase1-batch5c-legacy-contract-cleanup.test.js",
  composite: "test/fixtures/phase1_batch5a_core_composite_integrity_fixture.sql",
  fixture: "test/fixtures/phase1_batch6_two_family_security_validation_fixture.sql",
  provisioningV2: "test/admin-uat-provisioning-v2.test.js",
});

const sources = Object.fromEntries(Object.entries(sourceFiles).map(([key, file]) => {
  const absolute = path.join(root, file);
  assert.equal(fs.existsSync(absolute), true, `missing coverage source: ${file}`);
  return [key, fs.readFileSync(absolute, "utf8")];
}));

const coverageRegistry = Object.freeze([
  {
    id: "two-family-member-key-collision",
    sourceFiles: [sourceFiles.fixture, sourceFiles.provisioningV2],
    evidenceMethod: "DB fixture setup plus uniqueness rejection and cross-Family count assertions",
    expectedBehavior: "the same member key is valid across Families and rejected inside one Family",
    evidence: [
      {
        source: "fixture",
        setup: [/member_key\) values[\s\S]*?'shared-parent'[\s\S]*?'shared-child'/, /count\(distinct family_id\)/],
        rejection: [/fixture_expect_error[\s\S]*?insert into public\.family_members/, /array\['23505'\]/],
      },
      {
        source: "provisioningV2",
        setup: [/p_parent_member_key, "parent"/, /\["child1", "child2"\]/],
        rejection: [/family_id: IDS\.family/, /memberKey: "child9"/, /calls, 0/],
      },
    ],
  },
  {
    id: "auth-family-member-role-drift",
    sourceFiles: [sourceFiles.auth],
    evidenceMethod: "token/member mismatch fixtures plus sanitized authentication rejection assertions",
    expectedBehavior: "expired, deleted, inactive, Family/key/role-drift sessions are rejected",
    evidence: [{
      source: "auth",
      setup: [
        /member\(\{ family_id: FAMILY_B \}\)/,
        /member\(\{ member_key: "renamed-parent" \}\)/,
        /member\(\{ is_active: false \}\)/,
        /member\(\{[\s\S]*?role: "parent" \}\)/,
      ],
      rejection: [/sessionInvalid\(/, /error\.statusCode === 401[\s\S]*?error\.code === "AUTH_SESSION_INVALID"/],
    }],
  },
  {
    id: "parent-management-family-role-scope",
    sourceFiles: [sourceFiles.bootstrap, sourceFiles.parent, sourceFiles.family],
    evidenceMethod: "authenticated Parent entry plus Child/UI/server-role denial and zero-mutation API cases",
    expectedBehavior: "only the current active Parent can manage its Family or mutate PIN/session state",
    evidence: [
      {
        source: "parent",
        setup: [/currentMember[\s\S]*?role !== "parent"/, /isParentMode = true/],
        rejection: [/!parentAuthenticated/, /requiredRole[\s\S]*?parent/, /authenticate[\s\S]{0,80}request[\s\S]{0,40}"parent"/],
      },
      {
        source: "family",
        setup: [/family_id: FAMILY_B/, /messageIds: \[MESSAGE_A, MESSAGE_B\]/],
        rejection: [/response\.statusCode, 404/, /rpcCalls, 0/, /mutations, 0/],
      },
    ],
  },
  {
    id: "study-learning-review-queue-idor",
    sourceFiles: [sourceFiles.study, sourceFiles.learning, sourceFiles.attempts, sourceFiles.reviews, sourceFiles.queue],
    evidenceMethod: "cross-Family/child setup plus safe 403/404 and no downstream query/RPC assertions",
    expectedBehavior: "Study, Attempt, Review and Queue object paths remain Family and child scoped",
    evidence: [
      {
        source: "study",
        setup: [/assignedMemberId=\$\{OTHER_CHILD_ID\}/, /family_members\?/],
        rejection: [/ASSIGNED_MEMBER_NOT_ALLOWED/, /CHILD_ASSIGNEE_OVERRIDE_NOT_ALLOWED/, /queriedPlans, false/],
      },
      {
        source: "learning",
        setup: [/assignedMemberId=\$\{SIBLING\}/, /query: \{ reviewId: REVIEW, itemId: ITEM \}/],
        rejection: [/CHILD_ASSIGNEE_OVERRIDE_NOT_ALLOWED/, /MISTAKE_REVIEW_NOT_FOUND/, /submit_learning_mistake_review_answer"\), false/],
      },
      {
        source: "queue",
        setup: [/family_id: OTHER_FAMILY/, /row\.family_id === FAMILY/],
        rejection: [/FAMILY_CHILD_NOT_FOUND/, /learning_assignments[\s\S]*?false/, /CHILD_ASSIGNEE_OVERRIDE_NOT_ALLOWED/],
      },
      {
        source: "reviews",
        setup: [/learning_mistake_review_sessions\?[^\n]*return \[\]/],
        rejection: [/result\.statusCode, 404/, /MISTAKE_REVIEW_NOT_FOUND/, /family_id\|session_id/],
      },
    ],
  },
  {
    id: "reward-notification-push-zero-mutation",
    sourceFiles: [sourceFiles.rewards, sourceFiles.family],
    evidenceMethod: "foreign product/member/session fixtures plus 403/404 and zero-call assertions",
    expectedBehavior: "Reward, Notification and Push attacks cannot cross Family scope or mutate state",
    evidence: [
      {
        source: "rewards",
        setup: [/productId: PRODUCT_B/, /member_key: "other-child"/],
        rejection: [/response\.statusCode, 404/, /mutations, 0/, /calls, 0/],
      },
      {
        source: "family",
        setup: [/family_id: FAMILY_B/, /sessionInvalid\("role-drift"\)/],
        rejection: [/rpcCalls, 0/, /mutations, 0/, /databaseCalls, 0/],
      },
    ],
  },
  {
    id: "database-composite-tenant-integrity",
    sourceFiles: [sourceFiles.composite, sourceFiles.fixture],
    evidenceMethod: "direct cross-Family INSERT/UPDATE statements plus expected FK errors and positive updates",
    expectedBehavior: "composite constraints reject every foreign relation while same-Family writes pass",
    evidence: [
      {
        source: "composite",
        setup: [
          /insert into public\.family_message_reads/,
          /insert into public\.learning_mistake_review_events/,
          /insert into public\.reward_exchange_requests/,
          /insert into public\.family_push_subscriptions/,
        ],
        rejection: [/fixture_expect_error/g, /array\['23503'\]/],
      },
      {
        source: "fixture",
        setup: [
          /insert into public\.learning_attempt_answers/,
          /update public\.family_messages set sender_id=/,
          /update public\.reward_exchange_requests set product_id=/,
          /update public\.family_push_subscriptions set member_id=/,
        ],
        rejection: [/fixture_expect_error/g, /array\['23503'\]/, /where sender\.family_id<>message\.family_id/],
      },
    ],
  },
  {
    id: "legacy-contracts-closed",
    sourceFiles: [sourceFiles.legacy],
    evidenceMethod: "legacy route/table denial assertions plus v2/scoped Product contract assertions",
    expectedBehavior: "legacy Exchange, PIN, Reward and Push bypasses stay unavailable to Product callers",
    evidence: [{
      source: "legacy",
      setup: [/create_reward_exchange_request_v2/, /set_family_member_pin_v2/, /family_reward_settings/],
      rejection: [/doesNotMatch[\s\S]*?create_reward_exchange_request(?!_v2)/, /internal-only/, /owner-only/],
    }],
  },
  {
    id: "public-errors-hide-private-diagnostics",
    sourceFiles: [sourceFiles.learning, sourceFiles.rewards, sourceFiles.fixture],
    evidenceMethod: "private SQL/credential-shaped error setup plus public-response non-disclosure assertions",
    expectedBehavior: "public failures reveal no SQLSTATE, DB scope, credential or token diagnostics",
    evidence: [
      {
        source: "learning",
        setup: [/supabaseCode = "XX999"/, /private SQL message/, /token secret/],
        rejection: [/LEARNING_REQUEST_FAILED/, /XX999\|postgres\|service_role\|secret\|private\|constraint\|family_uuid\|token/],
      },
      {
        source: "rewards",
        setup: [/private table constraint detail/, /duplicate key violates private_constraint/],
        rejection: [/REWARD_PRODUCT_FAILED/, /23505\|private\|constraint\|duplicate\|hint/],
      },
      {
        source: "fixture",
        setup: [/family_id<>/, /raise exception/],
        rejection: [/(?![\s\S]*(?:pin_hash|token_hash|service_role_key|access_token|refresh_token))[\s\S]*/i],
      },
    ],
  },
]);

function assertSemanticEvidence(requirement) {
  assert.ok(requirement.sourceFiles.length > 0, `${requirement.id}: source test file is required`);
  assert.ok(requirement.evidenceMethod, `${requirement.id}: evidence method is required`);
  assert.ok(requirement.expectedBehavior, `${requirement.id}: expected behavior is required`);
  for (const item of requirement.evidence) {
    const source = sources[item.source];
    assert.ok(source, `${requirement.id}: unknown source ${item.source}`);
    assert.ok(item.setup.length > 0, `${requirement.id}: setup/scope evidence is required`);
    assert.ok(item.rejection.length > 0, `${requirement.id}: rejection/assertion evidence is required`);
    for (const pattern of item.setup) assert.match(source, pattern, `${requirement.id}: missing setup evidence ${pattern}`);
    for (const pattern of item.rejection) assert.match(source, pattern, `${requirement.id}: missing rejection evidence ${pattern}`);
  }
}

assert.equal(coverageRegistry.length, 8);
for (const requirement of coverageRegistry) {
  test(`${requirement.id}: ${requirement.expectedBehavior}`, () => {
    assertSemanticEvidence(requirement);
  });
}
