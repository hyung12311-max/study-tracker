const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/202608080004_learning_review_schedule_overrides.sql"), "utf8");
const verification = fs.readFileSync(path.join(root, "supabase/verification/202608080004_learning_review_schedule_overrides_verify.sql"), "utf8");
const rollback = fs.readFileSync(path.join(root, "supabase/rollbacks/202608080004_rollback_learning_review_schedule_overrides.sql"), "utf8");
const fixture = fs.readFileSync(path.join(root, "test/fixtures/phase2g_review_schedule_fixture.sql"), "utf8");

test("G-2 adds only override state and immutable schedule events", () => {
  assert.match(migration, /create table public\.learning_review_schedule_overrides/);
  assert.match(migration, /create table public\.learning_review_schedule_events/);
  assert.match(migration, /unique \(family_id, assigned_member_id, assignment_id, skill_code\)/);
  assert.match(migration, /event_type in \('override_created', 'override_changed', 'override_cleared'\)/);
  assert.doesNotMatch(migration, /create table public\.learning_(?:review_queue|mastery|priority)/);
});

test("default due priority and aggregate values are not persisted", () => {
  assert.doesNotMatch(migration, /default_due_at|effective_due_at|priority_status|status_count|due_question_count/);
  assert.match(migration, /override_due_at timestamptz/);
  assert.match(migration, /duration_days in \(1, 3, 7\)/);
});

test("schedule wrapper enforces parent child assignment skill and idempotency scope", () => {
  assert.match(migration, /actor\.role = 'parent' and actor\.is_active = true/);
  assert.match(migration, /child\.role = 'child' and child\.is_active = true/);
  assert.match(migration, /assignment\.family_id = p_family_id/);
  assert.match(migration, /p_skill_code = any\(question\.skill_codes_snapshot\)/);
  assert.match(migration, /unique \(actor_member_id, request_id\)/);
  assert.match(migration, /IDEMPOTENCY_CONFLICT/);
});

test("schedule wrapper changes no official or review result source", () => {
  const body = migration.slice(migration.indexOf("create function public.set_learning_review_schedule_override"));
  assert.doesNotMatch(body, /update public\.learning_attempts|learning_stage_progress|learning_stage_first_passes|sticker_transactions|update public\.learning_mistake_review_answers/);
});

test("schedule tables are FORCE RLS browser blocked and service read only", () => {
  assert.match(migration, /alter table public\.learning_review_schedule_overrides force row level security/);
  assert.match(migration, /alter table public\.learning_review_schedule_events force row level security/);
  assert.match(migration, /revoke all privileges on table[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(migration, /grant select on table[\s\S]*to service_role/);
  assert.match(migration, /grant execute on function public\.set_learning_review_schedule_override[\s\S]*to service_role/);
});

test("verification is read only and covers ACL boundary and realtime exclusion", () => {
  assert.match(verification, /^begin transaction read only;/);
  assert.match(verification, /browser roles cannot access schedule rows/);
  assert.match(verification, /service role is schedule read only/);
  assert.match(verification, /schedule tables remain outside realtime/);
  assert.match(verification, /rollback;\s*$/);
  assert.doesNotMatch(verification, /^(?:insert|update|delete|alter|drop|create)\b/im);
});

test("rollback refuses persisted schedule state before dropping G-2 objects", () => {
  assert.match(rollback, /if exists \(select 1 from public\.learning_review_schedule_overrides\)/);
  assert.match(rollback, /or exists \(select 1 from public\.learning_review_schedule_events\)/);
  assert.match(rollback, /errcode = '55000'/);
  assert.match(rollback, /drop function public\.set_learning_review_schedule_override/);
});

test("fixture covers lifecycle scope ACL immutability and zero delta", () => {
  for (const marker of [
    "idempotent snooze", "clear returns to default", "other child schedule",
    "schedule event immutable", "schedule ACL failed",
    "official or review state changed", "rollback guard with schedule data",
  ]) assert.match(fixture, new RegExp(marker));
  assert.match(fixture, /202608080004_learning_review_schedule_overrides\.sql/);
  assert.match(fixture, /202608080004_learning_review_schedule_overrides_verify\.sql/);
});
