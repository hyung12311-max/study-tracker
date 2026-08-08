const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/202608080002_learning_mistake_review_foundation.sql"), "utf8");
const verification = fs.readFileSync(path.join(root, "supabase/verification/202608080002_learning_mistake_review_foundation_verify.sql"), "utf8");
const rollback = fs.readFileSync(path.join(root, "supabase/rollbacks/202608080002_rollback_learning_mistake_review_foundation.sql"), "utf8");
const fixture = fs.readFileSync(path.join(root, "test/fixtures/phase2e_mistake_review_foundation_fixture.sql"), "utf8");

test("Phase E foundation creates the four isolated review tables", () => {
  for (const table of ["sessions", "items", "answers", "events"]) {
    assert.match(migration, new RegExp(`create table public\\.learning_mistake_review_${table}`));
  }
  assert.equal((migration.match(/create table public\./g) || []).length, 4);
  assert.match(migration, /learning_mistake_review_sessions_active_uidx[\s\S]*where status = 'in_progress'/);
});

test("review source rows remain tied to terminal submitted incorrect official snapshots", () => {
  assert.match(migration, /attempt\.status in \('passed', 'failed'\)/);
  assert.match(migration, /answer\.attempt_question_id = question\.id[\s\S]*answer\.is_correct = false/);
  assert.match(migration, /attempt\.content_version_id = target_assignment\.content_version_id/);
  assert.match(migration, /source_attempt_question_id, source_attempt_id[\s\S]*learning_attempt_questions\(id, attempt_id\)/);
});

test("parent and self-child scope plus paused-plan start guard are server enforced", () => {
  assert.match(migration, /actor\.role = 'child' and actor\.id <> p_assigned_member_id/);
  assert.match(migration, /assignment\.family_id = p_family_id/);
  assert.match(migration, /assignment\.assigned_member_id = p_assigned_member_id/);
  assert.match(migration, /is_learning_assignment_plan_paused\(target_assignment\.id\)/);
  assert.match(migration, /LEARNING_PLAN_PAUSED/);
});

test("review start is request-id idempotent and filter-stable", () => {
  assert.match(migration, /unique \(family_id, started_by_member_id, request_id\)/);
  assert.match(migration, /prior_session\.filter_status <> p_status_filter/);
  assert.match(migration, /prior_session\.filter_stage_id is distinct from p_stage_id/);
  assert.match(migration, /prior_session\.filter_skill_code is distinct from p_skill_code/);
  assert.match(migration, /IDEMPOTENCY_CONFLICT/);
});

test("review rows are immutable FORCE RLS and service-read-only", () => {
  assert.equal((migration.match(/force row level security;/g) || []).length, 4);
  assert.match(migration, /learning_mistake_review_items_immutable/);
  assert.match(migration, /learning_mistake_review_answers_immutable/);
  assert.match(migration, /learning_mistake_review_events_immutable/);
  assert.match(migration, /grant select on table[\s\S]*to service_role/);
  assert.match(migration, /revoke all privileges on table[\s\S]*anon, authenticated, service_role/);
});

test("only the hardened service wrapper can create review sessions", () => {
  assert.match(migration, /create function public\.start_learning_mistake_review[\s\S]*security definer[\s\S]*set search_path = pg_catalog, public/);
  assert.match(migration, /grant execute on function public\.start_learning_mistake_review[\s\S]*to service_role/);
  assert.match(migration, /revoke all on function public\.start_learning_mistake_review[\s\S]*public, anon, authenticated, service_role/);
});

test("review start never mutates official progress scoring or rewards", () => {
  assert.doesNotMatch(migration, /insert into public\.(learning_stage_progress|learning_stage_first_passes|sticker_transactions)/i);
  assert.doesNotMatch(migration, /update public\.(learning_attempts|learning_assignments|learning_stage_progress)/i);
  assert.doesNotMatch(migration, /finalize_learning_stage_attempt\s*\(/i);
});

test("verification is read-only and covers ACL RLS hardening and Realtime", () => {
  assert.match(verification, /^begin transaction read only;/);
  assert.match(verification, /review tables force rls/);
  assert.match(verification, /browser review crud is absent/);
  assert.match(verification, /review start function is hardened/);
  assert.match(verification, /review tables are excluded from realtime/);
  assert.doesNotMatch(verification, /^\s*(?:insert|update|delete|alter|create|drop|truncate)\b/im);
});

test("rollback refuses to remove any persisted review data", () => {
  for (const table of ["sessions", "items", "answers", "events"]) {
    assert.match(rollback, new RegExp(`exists \\(select 1 from public\\.learning_mistake_review_${table}\\)`));
  }
  assert.match(rollback, /learning mistake review data is in use/);
});

test("fixture covers start idempotency scope empty paused ACL immutability and zero delta", () => {
  assert.match(fixture, /parent review start did not create the expected item/);
  assert.match(fixture, /child self review start failed/);
  assert.match(fixture, /other child review start/);
  assert.match(fixture, /reviewable mistakes were not found/);
  assert.match(fixture, /LEARNING_PLAN_PAUSED/);
  assert.match(fixture, /review session immutable scope/);
  assert.match(fixture, /review table ACL failed/);
  assert.match(fixture, /official progress or rewards changed/);
});
