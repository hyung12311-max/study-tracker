const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/202608080001_learning_mistake_reveal_audit.sql"), "utf8");
const verification = fs.readFileSync(path.join(root, "supabase/verification/202608080001_learning_mistake_reveal_audit_verify.sql"), "utf8");
const rollback = fs.readFileSync(path.join(root, "supabase/rollbacks/202608080001_rollback_learning_mistake_reveal_audit.sql"), "utf8");
const fixture = fs.readFileSync(path.join(root, "test/fixtures/phase2d_mistake_reveal_fixture.sql"), "utf8");

test("Phase D adds one minimal immutable reveal audit table", () => {
  const tableDefinition = migration.match(/create table public\.learning_mistake_reveal_events \([\s\S]*?\n\);/)?.[0] || "";
  assert.match(migration, /create table public\.learning_mistake_reveal_events/);
  assert.equal((migration.match(/create table public\./g) || []).length, 1);
  assert.match(migration, /before update or delete on public\.learning_mistake_reveal_events/);
  assert.doesNotMatch(tableDefinition, /correct_answer|explanation/);
});

test("reveal validates terminal submitted incorrect snapshot scope on the server", () => {
  assert.match(migration, /attempt\.status in \('passed', 'failed'\)/);
  assert.match(migration, /answer\.attempt_question_id = question\.id[\s\S]*answer\.is_correct = false/);
  assert.match(migration, /attempt\.content_version_id = assignment\.content_version_id/);
  assert.match(migration, /assignment\.family_id = p_family_id/);
  assert.match(migration, /actor\.role = 'parent' or assignment\.assigned_member_id = p_actor_member_id/);
});

test("solution comes only from the matched immutable question snapshot", () => {
  assert.match(migration, /jsonb_array_elements\(target\.options_snapshot\)/);
  assert.match(migration, /target\.correct_option_id::text/);
  assert.match(migration, /target\.explanation_snapshot/);
  assert.doesNotMatch(migration, /learning_questions[\s\S]*correct_option/i);
});

test("actor-target and actor-request uniqueness make reveal idempotent", () => {
  assert.match(migration, /unique \(family_id, actor_member_id, assignment_id, attempt_question_id\)/);
  assert.match(migration, /unique \(family_id, actor_member_id, request_id\)/);
  assert.match(migration, /IDEMPOTENCY_CONFLICT/);
  assert.match(migration, /on conflict \(family_id, actor_member_id, assignment_id, attempt_question_id\) do nothing/);
});

test("audit table is FORCE RLS and service-read-only", () => {
  assert.match(migration, /enable row level security;[\s\S]*force row level security/);
  assert.match(migration, /grant select on table public\.learning_mistake_reveal_events to service_role/);
  assert.match(migration, /revoke all privileges on table public\.learning_mistake_reveal_events[\s\S]*anon, authenticated, service_role/);
});

test("only the hardened service function can create reveal events", () => {
  assert.match(migration, /security definer[\s\S]*set search_path = pg_catalog, public/);
  assert.match(migration, /grant execute on function public\.reveal_learning_mistake_solution[\s\S]*to service_role/);
  assert.match(migration, /revoke all on function public\.reveal_learning_mistake_solution[\s\S]*public, anon, authenticated, service_role/);
});

test("verification is read-only and checks ACL RLS function and Realtime", () => {
  assert.match(verification, /^begin transaction read only;/);
  assert.match(verification, /browser crud is absent/);
  assert.match(verification, /reveal function is hardened/);
  assert.match(verification, /audit is excluded from realtime/);
  assert.doesNotMatch(verification, /^\s*(?:insert|update|delete|alter|create|drop|truncate)\b/im);
});

test("rollback refuses to remove persisted audit events", () => {
  assert.match(rollback, /exists \(select 1 from public\.learning_mistake_reveal_events\)/);
  assert.match(rollback, /learning mistake reveal audit is in use/);
  assert.match(rollback, /drop table public\.learning_mistake_reveal_events/);
});

test("disposable fixture covers parent child idempotency scope ACL and immutability", () => {
  assert.match(fixture, /parent reveal did not return the immutable snapshot solution/);
  assert.match(fixture, /parent and self-child reveal audit ownership was not preserved/);
  assert.match(fixture, /other child reveal/);
  assert.match(fixture, /correct answer reveal/);
  assert.match(fixture, /request id reused for another target/);
  assert.match(fixture, /immutable reveal event update/);
  assert.match(fixture, /reveal audit table ACL failed/);
});
