const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/202607310008_learning_skill_metadata_foundation.sql"), "utf8");
const verification = fs.readFileSync(path.join(root, "supabase/verification/202607310008_learning_skill_metadata_foundation_verify.sql"), "utf8");
const rollback = fs.readFileSync(path.join(root, "supabase/rollbacks/202607310008_rollback_learning_skill_metadata_foundation.sql"), "utf8");
const fixture = fs.readFileSync(path.join(root, "test/fixtures/phase2c_learning_skill_metadata_fixture.sql"), "utf8");

test("skill foundation is additive, scoped to analysis metadata, and wrapper-only", () => {
  assert.match(migration, /create table public\.learning_skill_definitions/);
  assert.match(migration, /create table public\.learning_question_skills/);
  assert.match(migration, /primary key \(question_id, skill_code\)/);
  assert.match(migration, /learning_question_skills_one_primary_uidx[\s\S]*where is_primary/);
  assert.match(migration, /add column skill_codes_snapshot text\[\] not null default '\{\}'::text\[\]/);
  assert.match(migration, /version\.status <> 'draft'[\s\S]*published learning question skills are immutable/);
  assert.match(migration, /before insert on public\.learning_attempt_questions[\s\S]*snapshot_learning_attempt_question_skills/);
  assert.doesNotMatch(migration, /(?:insert|update|delete)\s+(?:into\s+|from\s+)?public\.(?:learning_attempt_answers|learning_attempts|learning_stage_progress|learning_stage_first_passes|sticker_transactions)/i);
});

test("skill metadata is service-read-only, forced RLS, and excluded from Realtime", () => {
  assert.match(migration, /force row level security/g);
  assert.match(migration, /revoke all privileges on table public\.learning_skill_definitions[\s\S]*public, anon, authenticated, service_role/);
  assert.match(migration, /grant select on table public\.learning_skill_definitions[\s\S]*to service_role/);
  assert.match(migration, /revoke all on function public\.snapshot_learning_attempt_question_skills\(\)[\s\S]*service_role/);
  assert.doesNotMatch(migration, /alter publication|create policy/i);
});

test("verification is read-only and checks schema, ACL, RLS, triggers, and official functions", () => {
  assert.match(verification, /^begin transaction read only;/m);
  assert.match(verification, /skill tables initially empty/);
  assert.match(verification, /browser direct crud absent/);
  assert.match(verification, /skill tables excluded from realtime/);
  assert.match(verification, /official learning functions preserved/);
  assert.match(verification, /total_checks/);
  assert.match(verification, /rollback;\s*$/);
});

test("rollback is blocked after mapping or snapshot use", () => {
  assert.match(rollback, /exists \(select 1 from public\.learning_question_skills\)/);
  assert.match(rollback, /cardinality\(skill_codes_snapshot\) <> 0/);
  assert.match(rollback, /errcode = '55000'/);
  assert.match(rollback, /drop column skill_codes_snapshot/);
});

test("fixture exercises published immutability, one primary skill, and ACL", () => {
  assert.match(fixture, /published question skill update was accepted/);
  assert.match(fixture, /published question skill delete was accepted/);
  assert.match(fixture, /second primary skill was accepted/);
  assert.match(fixture, /skill metadata ACL failed/);
});
