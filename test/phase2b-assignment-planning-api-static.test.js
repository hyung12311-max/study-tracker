const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/202607310007_learning_assignment_planning_api_contract.sql");
const verification = read("supabase/verification/202607310007_learning_assignment_planning_api_contract_verify.sql");
const rollback = read("supabase/rollbacks/202607310007_rollback_learning_assignment_planning_api_contract.sql");

test("planning API migration adds one atomic wrapper with hardened ACL", () => {
  assert.match(migration, /create function public\.create_learning_assignment_with_plan\(/);
  assert.match(migration, /from public\.create_learning_assignment\(/);
  assert.match(migration, /from public\.create_learning_assignment_plan\(/);
  assert.match(migration, /security definer\s+set search_path = pg_catalog, public/);
  assert.match(migration, /revoke all on function public\.create_learning_assignment_with_plan[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(migration, /grant execute on function public\.create_learning_assignment_with_plan[\s\S]*to service_role/);
  assert.doesNotMatch(migration, /grant execute[\s\S]*to (public|anon|authenticated)/);
});

test("pause guard blocks only new official attempt rows", () => {
  assert.match(migration, /create function public\.guard_learning_attempt_plan_pause\(\)/);
  assert.match(migration, /before insert on public\.learning_attempts/);
  assert.match(migration, /is_learning_assignment_plan_paused\(new\.assignment_id\)/);
  assert.match(migration, /errcode = '55000', message = 'LEARNING_PLAN_PAUSED'/);
  assert.doesNotMatch(migration, /before update on public\.learning_attempts|learning_attempt_answers.*trigger/i);
});

test("verification preserves foundation security and empty state", () => {
  assert.match(verification, /begin read only;/);
  assert.match(verification, /planning tables remain empty/);
  assert.match(verification, /planning tables force rls/);
  assert.match(verification, /no browser planning table privileges/);
  assert.match(verification, /planning tables excluded from realtime/);
  assert.match(verification, /rollback;/);
});

test("rollback is data guarded and preserves the foundation", () => {
  assert.match(rollback, /errcode = '55000'/);
  assert.match(rollback, /planning data exists/);
  assert.match(rollback, /drop trigger if exists learning_attempts_guard_plan_pause/);
  assert.match(rollback, /drop function if exists public\.create_learning_assignment_with_plan/);
  assert.doesNotMatch(rollback, /drop table|learning_assignment_plans\s*;/i);
});
