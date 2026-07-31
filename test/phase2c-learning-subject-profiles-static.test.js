const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/202607310004_create_learning_subject_profiles.sql"), "utf8");
const verification = fs.readFileSync(path.join(root, "supabase/verification/202607310004_create_learning_subject_profiles_verify.sql"), "utf8");
const rollback = fs.readFileSync(path.join(root, "supabase/rollbacks/202607310004_rollback_learning_subject_profiles.sql"), "utf8");
const fixture = fs.readFileSync(path.join(root, "test/fixtures/phase2c_learning_subject_profiles_fixture.sql"), "utf8");

test("subject profiles have strong family scope, manual levels, and wrapper-only writes", () => {
  assert.match(migration, /create table public\.learning_member_subject_profiles/);
  assert.match(migration, /foreign key \(family_id, member_id\)[\s\S]*references public\.family_members\(family_id, id\)/);
  assert.match(migration, /unique \(member_id, subject\)/);
  assert.match(migration, /level_code in \('ready', 'elementary_1'[\s\S]*'elementary_6'\)/);
  assert.match(migration, /role = 'child' and m\.is_active = true/);
  assert.match(migration, /role = 'parent' and m\.is_active = true/);
  assert.match(migration, /create function public\.upsert_learning_member_subject_profile\([\s\S]*security definer[\s\S]*set search_path = pg_catalog, public/);
  assert.match(migration, /revoke all privileges on table public\.learning_member_subject_profiles[\s\S]*public, anon, authenticated, service_role/);
  assert.match(migration, /grant select on table[\s\S]*learning_member_subject_profiles[\s\S]*to service_role/);
  assert.match(migration, /grant execute on function public\.upsert_learning_member_subject_profile[\s\S]*to service_role/);
});

test("recommendation metadata is additive, content-derived, and not an assignment", () => {
  assert.match(migration, /create table public\.learning_unit_recommendation_metadata/);
  assert.match(migration, /51000000-0000-4000-8000-000000000002/);
  assert.match(migration, /'math', 'elementary_1', 'elementary_1', 1/);
  assert.doesNotMatch(migration, /insert into public\.(learning_assignments|learning_attempts|learning_stage_progress|learning_stage_first_passes|sticker_transactions)/i);
  assert.doesNotMatch(migration, /alter publication|add table/i);
});

test("verification is read-only and checks ACL, RLS, wrapper, seed, and Realtime exclusion", () => {
  assert.match(verification, /^begin transaction read only;/m);
  assert.match(verification, /total_checks/);
  assert.match(verification, /wrapper service-only/);
  assert.match(verification, /not realtime published/);
  assert.match(verification, /rollback;\s*$/);
});

test("rollback is pre-data only and fixture exercises isolation", () => {
  assert.match(rollback, /exists \(select 1 from public\.learning_member_subject_profiles\)/);
  assert.match(rollback, /errcode = '55000'/);
  assert.match(fixture, /inactive child was accepted/);
  assert.match(fixture, /other-family child was accepted/);
  assert.match(fixture, /profile idempotent update failed/);
});
