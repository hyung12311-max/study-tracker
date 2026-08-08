const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/202608080003_learning_mistake_review_lifecycle.sql"), "utf8");
const verification = fs.readFileSync(path.join(root, "supabase/verification/202608080003_learning_mistake_review_lifecycle_verify.sql"), "utf8");
const rollback = fs.readFileSync(path.join(root, "supabase/rollbacks/202608080003_rollback_learning_mistake_review_lifecycle.sql"), "utf8");

test("review lifecycle uses hardened service-only answer and abandon functions", () => {
  assert.match(migration, /create function public\.submit_learning_mistake_review_answer[\s\S]*security definer[\s\S]*set search_path = pg_catalog, public/);
  assert.match(migration, /create function public\.abandon_learning_mistake_review[\s\S]*security definer[\s\S]*set search_path = pg_catalog, public/);
  assert.equal((migration.match(/grant execute on function public\.(?:submit|abandon)_learning_mistake_review/g) || []).length, 2);
  assert.match(migration, /revoke all on function public\.submit_learning_mistake_review_answer[\s\S]*public, anon, authenticated, service_role/);
});

test("answer grading uses the immutable attempt-question snapshot", () => {
  assert.match(migration, /from public\.learning_attempt_questions question/);
  assert.match(migration, /jsonb_array_elements\(target_question\.options_snapshot\)/);
  assert.match(migration, /p_selected_option_id = target_question\.correct_option_id/);
  assert.match(migration, /target_question\.explanation_snapshot/);
  assert.doesNotMatch(migration, /learning_questions[\s\S]*correct_option/i);
});

test("review answer idempotency and terminal state guards are explicit", () => {
  assert.match(migration, /answer\.client_request_id = p_request_id/);
  assert.match(migration, /IDEMPOTENCY_CONFLICT/);
  assert.match(migration, /REVIEW_ANSWER_CONFLICT/);
  assert.match(migration, /REVIEW_SESSION_COMPLETED/);
  assert.match(migration, /REVIEW_SESSION_ABANDONED/);
  assert.match(migration, /submitted_total = item_total[\s\S]*status = 'completed'/);
});

test("parent and child self scope are enforced inside both lifecycle functions", () => {
  assert.equal((migration.match(/session\.family_id = p_family_id/g) || []).length, 2);
  assert.equal((migration.match(/actor\.role = 'parent' or session\.assigned_member_id = p_actor_member_id/g) || []).length, 2);
  assert.equal((migration.match(/member\.role in \('parent', 'child'\)/g) || []).length, 2);
});

test("review lifecycle never mutates official scoring progress or rewards", () => {
  assert.doesNotMatch(migration, /(?:insert into|update|delete from) public\.(?:learning_attempts|learning_attempt_answers|learning_stage_progress|learning_stage_first_passes|sticker_transactions|reward_)/i);
  assert.doesNotMatch(migration, /finalize_learning_stage_attempt\s*\(/i);
});

test("verification is read-only and covers isolation ACL and realtime", () => {
  assert.match(verification, /^begin transaction read only;/);
  assert.match(verification, /review answer stays separate from official state/);
  assert.match(verification, /only service role can submit review answers/);
  assert.match(verification, /review lifecycle remains outside realtime/);
  assert.doesNotMatch(verification, /^\s*(?:insert|update|delete|alter|create|drop|truncate)\b/im);
});

test("rollback refuses lifecycle removal after answer abandon or terminal data", () => {
  assert.match(rollback, /exists \(select 1 from public\.learning_mistake_review_answers\)/);
  assert.match(rollback, /event_type = 'session_abandoned'/);
  assert.match(rollback, /status <> 'in_progress'/);
  assert.match(rollback, /learning mistake review lifecycle data is in use/);
});
