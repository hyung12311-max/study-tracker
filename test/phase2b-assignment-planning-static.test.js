const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const migration = read("supabase/migrations/202607310006_learning_assignment_planning_foundation.sql");
const verification = read("supabase/verification/202607310006_learning_assignment_planning_foundation_verify.sql");
const rollback = read("supabase/rollbacks/202607310006_rollback_learning_assignment_planning_foundation.sql");
const fixture = read("test/fixtures/phase2b_assignment_planning_fixture.sql");

test("Phase B-1 adds only the three optional planning tables", () => {
  assert.deepEqual(
    [...migration.matchAll(/create table public\.([a-z_]+)/g)].map((match) => match[1]),
    [
      "learning_assignment_plans",
      "learning_assignment_stage_targets",
      "learning_assignment_plan_revisions",
    ],
  );
  assert.match(migration, /unique \(assignment_id\)/);
  assert.match(migration, /foreign key \(assignment_id, family_id, assigned_member_id, content_version_id\)[\s\S]*references public\.learning_assignments/);
  assert.doesNotMatch(migration, /insert into public\.learning_assignments|update public\.learning_assignments|delete from public\.learning_assignments/i);
  assert.doesNotMatch(migration, /alter table public\.(learning_assignments|learning_stage_progress|learning_attempts|learning_stage_first_passes)/i);
});

test("date, timezone, target ordering, completion lock, and pause contracts are explicit", () => {
  assert.match(migration, /planned_start_date date not null/);
  assert.match(migration, /target_completion_date date not null/);
  assert.match(migration, /default 'Asia\/Seoul'/);
  assert.match(migration, /pg_catalog\.pg_timezone_names/);
  assert.match(migration, /previous_date > ordered_target\.target_date/);
  assert.match(migration, /PLAN_LOCKED_AFTER_COMPLETION/g);
  assert.match(migration, /create function public\.is_learning_assignment_plan_paused\(p_assignment_id uuid\)/);
  assert.doesNotMatch(migration, /create or replace function public\.(start_or_resume_learning_attempt|create_learning_assignment|cancel_learning_assignment)/i);
});

test("four wrappers enforce revisions and idempotency with fixed security boundaries", () => {
  for (const name of [
    "create_learning_assignment_plan",
    "update_learning_assignment_plan",
    "pause_learning_assignment_plan",
    "resume_learning_assignment_plan",
  ]) {
    assert.match(migration, new RegExp(`create function public\\.${name}\\(`));
  }
  assert.match(migration, /security definer[\s\S]*set search_path = pg_catalog, public/g);
  assert.match(migration, /IDEMPOTENCY_CONFLICT/g);
  assert.match(migration, /PLAN_REVISION_CONFLICT/g);
  assert.match(migration, /for update/g);
  assert.match(migration, /grant execute on function public\.create_learning_assignment_plan[\s\S]*to service_role/);
  assert.match(migration, /revoke all on function public\.create_learning_assignment_plan[\s\S]*public, anon, authenticated, service_role/);
  assert.doesNotMatch(migration, /execute\s+format|execute\s+p_/i);
});

test("planning tables force RLS, allow service reads only, and stay outside Realtime", () => {
  for (const tableName of [
    "learning_assignment_plans",
    "learning_assignment_stage_targets",
    "learning_assignment_plan_revisions",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${tableName} enable row level security`));
    assert.match(migration, new RegExp(`alter table public\\.${tableName} force row level security`));
  }
  assert.match(migration, /revoke all privileges on table public\.learning_assignment_plans,[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(migration, /grant select on table public\.learning_assignment_plans,[\s\S]*to service_role/);
  assert.doesNotMatch(migration, /alter publication|add table/i);
});

test("revisions preserve canonical stage snapshots and reject mutation", () => {
  assert.match(migration, /previous_snapshot jsonb/);
  assert.match(migration, /stage_targets_snapshot jsonb not null/);
  assert.match(migration, /unique \(plan_id, revision\)/);
  assert.match(migration, /unique \(plan_id, request_id\)/);
  assert.match(migration, /learning_assignment_plan_revisions_guard_change/);
  assert.match(migration, /learning assignment plan revisions are immutable/);
  assert.match(fixture, /count\(distinct revision\) = 6/);
});

test("verification, fixture, and rollback cover behavior and safe removal", () => {
  assert.match(verification, /^begin transaction read only;/m);
  assert.match(verification, /four planning wrapper signatures exist/);
  assert.match(verification, /planning tables excluded from realtime/);
  assert.match(verification, /rollback;\s*$/);
  assert.match(fixture, /concurrent update contract failed/);
  assert.match(fixture, /pause or resume changed assignment learning data/);
  assert.match(fixture, /completed plan update/);
  assert.match(fixture, /plan-less legacy completed assignment was not preserved/);
  assert.match(rollback, /errcode = '55000'/);
  assert.match(rollback, /learning assignment planning data exists/);
  assert.doesNotMatch(rollback, /drop table public\.(learning_assignments|learning_attempts|learning_stage_progress|learning_stage_first_passes)/i);
});

test("frozen Phase A, content, package, and vendor files are untouched", () => {
  const changed = require("node:child_process")
    .execFileSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).replaceAll("\\", "/"));
  assert.deepEqual(changed.sort(), [
    "supabase/migrations/202607310006_learning_assignment_planning_foundation.sql",
    "supabase/rollbacks/202607310006_rollback_learning_assignment_planning_foundation.sql",
    "supabase/verification/202607310006_learning_assignment_planning_foundation_verify.sql",
    "test/fixtures/phase2b_assignment_planning_fixture.sql",
    "test/phase2b-assignment-planning-static.test.js",
  ].sort());

  const frozen = [
    "supabase/migrations/202607310005_seed_grade2_three_digit_numbers_learning_content.sql",
    "api/[...path].js",
    "server/api/learning/roadmap.js",
    "js/learning.js",
    "package.json",
    "js/vendor/supabase-js.js",
  ];
  for (const relativePath of frozen) {
    const comparison = require("node:child_process")
      .spawnSync("git", ["diff", "--quiet", "HEAD", "--", relativePath], { cwd: root });
    assert.equal(comparison.status, 0, `${relativePath} changed`);
  }
});
