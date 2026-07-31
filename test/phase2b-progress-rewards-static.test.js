const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const migration = read(
  "supabase/migrations/202607310001_create_phase_2b_progress_rewards.sql",
);
const verification = read(
  "supabase/verification/202607310001_create_phase_2b_progress_rewards_verify.sql",
);
const rollback = read(
  "supabase/rollbacks/202607310001_rollback_phase_2b_progress_rewards.sql",
);
const fixture = read("test/fixtures/phase2b_progress_rewards_fixture.sql");

function normalizeSql(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function extractFunction(source, functionName) {
  const start = new RegExp(
    `create(?:\\s+or\\s+replace)?\\s+function\\s+public\\.${functionName}\\s*\\(`,
    "i",
  ).exec(source);
  assert.ok(start, `missing function ${functionName}`);
  const end = source.indexOf("\n$function$;", start.index);
  assert.notEqual(end, -1, `unterminated function ${functionName}`);
  return source.slice(start.index, end + "\n$function$;".length);
}

test("Phase 2B-3A is additive and creates only the first-pass table", () => {
  const migrationNames = fs
    .readdirSync(path.join(root, "supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.equal(
    migrationNames.at(-1),
    "202607310001_create_phase_2b_progress_rewards.sql",
  );
  const createdTables = [
    ...migration.matchAll(/^\s*create\s+table\s+public\.([a-z0-9_]+)/gim),
  ].map((match) => match[1]);
  assert.deepEqual(createdTables, ["learning_stage_first_passes"]);
  assert.doesNotMatch(migration, /alter publication|create publication/i);
  assert.doesNotMatch(
    migration,
    /\b(create|alter|drop)\s+table\s+public\.sticker_transactions\b/i,
  );
});

test("first-pass rows use strongest scope keys and immutable uniqueness", () => {
  const sql = normalizeSql(migration);
  assert.match(
    sql,
    /foreign key \( assignment_id, family_id, assigned_member_id, content_version_id \) references public\.learning_assignments\( id, family_id, assigned_member_id, content_version_id \) on delete restrict/i,
  );
  assert.match(
    sql,
    /foreign key \( attempt_id, family_id, assigned_member_id, assignment_id, stage_id \) references public\.learning_attempts\( id, family_id, assigned_member_id, assignment_id, stage_id \) on delete restrict/i,
  );
  assert.match(sql, /unique \(assignment_id, stage_id\)/i);
  assert.match(sql, /unique \(attempt_id\)/i);
  assert.match(sql, /unique \(reward_transaction_id\)/i);
  assert.match(
    sql,
    /difficulty = 'seed' and reward_amount = 1[\s\S]*difficulty = 'leaf' and reward_amount = 2[\s\S]*difficulty = 'tree' and reward_amount = 3[\s\S]*difficulty = 'crown' and reward_amount = 5/i,
  );
  assert.match(
    migration,
    /create trigger learning_stage_first_passes_guard_change\s+before update or delete/i,
  );
});

test("finalize preserves scope and fixed lock ordering", () => {
  const definition = normalizeSql(
    extractFunction(migration, "finalize_learning_stage_attempt"),
  );
  const assignmentLock = definition.indexOf("select assignment.*");
  const actorLock = definition.indexOf("from public.family_members actor");
  const attemptLock = definition.indexOf("select attempt.*", assignmentLock + 1);
  const progressLock = definition.indexOf("select progress.*");
  const firstPassInsert = definition.indexOf(
    "insert into public.learning_stage_first_passes",
  );
  assert.ok(assignmentLock < actorLock);
  assert.ok(actorLock < attemptLock);
  assert.ok(attemptLock < progressLock);
  assert.ok(progressLock < firstPassInsert);
  assert.match(
    definition,
    /actor\.id = p_actor_member_id and actor\.family_id = target_assignment\.family_id and actor\.id = target_assignment\.assigned_member_id and actor\.role = 'child' and actor\.is_active = true/i,
  );
  assert.match(
    definition,
    /attempt\.family_id = target_assignment\.family_id and attempt\.assigned_member_id = target_assignment\.assigned_member_id and attempt\.assignment_id = target_assignment\.id/i,
  );
});

test("passed finalize atomically records one reward and advances progress", () => {
  const definition = normalizeSql(
    extractFunction(migration, "finalize_learning_stage_attempt"),
  );
  assert.match(
    definition,
    /on conflict \(assignment_id, stage_id\) do nothing returning \* into first_pass_row/i,
  );
  assert.match(
    definition,
    /if created_first_pass then insert into public\.sticker_transactions/i,
  );
  assert.match(definition, /'learning_stage_first_pass'/i);
  assert.match(
    definition,
    /update public\.learning_stage_progress set status = 'passed'/i,
  );
  assert.match(
    definition,
    /update public\.learning_stage_progress set status = 'unlocked'/i,
  );
  assert.match(
    definition,
    /update public\.learning_assignments set status = 'completed'/i,
  );
  assert.match(
    definition,
    /when 'seed' then 1 when 'leaf' then 2 when 'tree' then 3 when 'crown' then 5/i,
  );
});

test("failed and repeated finalize return stable ownership without extra mutations", () => {
  const definition = normalizeSql(
    extractFunction(migration, "finalize_learning_stage_attempt"),
  );
  const failedBranches = definition.match(/if target_attempt\.status = 'failed' then/g) || [];
  assert.equal(failedBranches.length, 2);
  assert.match(
    definition,
    /first_pass_row\.attempt_id = target_attempt\.id, first_pass_row\.attempt_id = target_attempt\.id and ledger_exists/i,
  );
  assert.match(
    definition,
    /when first_pass_row\.attempt_id = target_attempt\.id then first_pass_row\.reward_amount else 0/i,
  );
  assert.doesNotMatch(definition, /\bp_(difficulty|reward|passed|family_id)\b/i);
});

test("first-pass ACL is default deny and finalize is service-role only", () => {
  assert.match(
    migration,
    /alter table public\.learning_stage_first_passes enable row level security;\s*alter table public\.learning_stage_first_passes force row level security;/i,
  );
  assert.doesNotMatch(migration, /\bcreate\s+policy\b/i);
  assert.match(
    migration,
    /revoke all privileges on table public\.learning_stage_first_passes\s+from public, anon, authenticated, service_role;\s*grant select on table public\.learning_stage_first_passes\s+to service_role;/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.finalize_learning_stage_attempt\([\s\S]*?from public, anon, authenticated, service_role;\s*grant execute on function public\.finalize_learning_stage_attempt\([\s\S]*?to service_role;/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.guard_learning_stage_first_pass_immutable\(\)\s+from public, anon, authenticated, service_role;/i,
  );
});

test("verification and rollback preserve read-only and pre-data contracts", () => {
  assert.match(verification, /^\s*begin transaction read only;/i);
  assert.match(verification, /phase_2b_3a_verification_summary/i);
  assert.match(verification, /migration_created_empty_progress_reward_state/i);
  assert.match(verification, /first_pass_not_in_realtime_publication/i);
  assert.match(verification, /\brollback;\s*$/i);
  assert.doesNotMatch(
    verification,
    /^\s*(insert|update|delete|create|alter|drop|grant|revoke|truncate)\b/im,
  );

  assert.match(rollback, /PRE-DATA ONLY rollback/i);
  assert.match(rollback, /errcode = '55000'/i);
  assert.match(rollback, /Phase 2B progress or reward data exists/i);
  assert.match(
    rollback,
    /drop function public\.finalize_learning_stage_attempt[\s\S]*drop table public\.learning_stage_first_passes[\s\S]*create function public\.finalize_learning_stage_attempt/i,
  );
  assert.match(
    normalizeSql(rollback),
    /returns table \( attempt_id uuid, attempt_status text, total_questions integer, correct_answers integer, required_correct_answers integer, passed boolean, finalized_at timestamptz \)/i,
  );
  assert.doesNotMatch(
    rollback,
    /\bdrop table public\.(learning_assignments|learning_attempts|sticker_transactions)\b/i,
  );
});

test("fixture covers rewards, idempotency, concurrency, ACL, and rollback guards", () => {
  for (const expected of [
    "seed first pass did not award exactly 1 sticker",
    "leaf first pass did not award exactly 2 stickers",
    "tree first pass did not award exactly 3 stickers",
    "crown first pass did not award exactly 5 stickers",
    "failed attempt changed progress, unlock, first-pass, or rewards",
    "same attempt finalize replay changed its stable result",
    "different attempt awarded the same stage twice",
    "concurrent same-attempt finalize was not idempotent",
    "concurrent distinct-attempt finalize created duplicate rewards",
    "new content version did not receive an independent first-pass reward",
    "phase2b_progress_rewards_fixture_passed",
  ]) {
    assert.match(fixture, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  assert.match(fixture, /foreach role_name in array array\['anon', 'authenticated'\]/i);
  assert.match(fixture, /execute 'set local role service_role'/i);
  assert.match(fixture, /dblink_send_query/i);
  assert.match(fixture, /learning_stage_first_passes.*55000/is);
});
