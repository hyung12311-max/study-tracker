const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const migrationName = "202607300002_create_phase_2b_attempt_engine.sql";
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations", migrationName),
  "utf8",
);
const verification = fs.readFileSync(
  path.join(
    root,
    "supabase/verification/202607300002_create_phase_2b_attempt_engine_verify.sql",
  ),
  "utf8",
);
const rollback = fs.readFileSync(
  path.join(
    root,
    "supabase/rollbacks/202607300002_rollback_phase_2b_attempt_engine.sql",
  ),
  "utf8",
);
const fixture = fs.readFileSync(
  path.join(root, "test/fixtures/phase2b_attempt_engine_fixture.sql"),
  "utf8",
);

const tables = [
  "learning_attempts",
  "learning_attempt_questions",
  "learning_attempt_answers",
];

function normalizeSql(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function extractFunction(source, functionName) {
  const startPattern = new RegExp(
    `create(?:\\s+or\\s+replace)?\\s+function\\s+public\\.${functionName}\\s*\\(`,
    "i",
  );
  const startMatch = startPattern.exec(source);
  assert.ok(startMatch, `missing function ${functionName}`);
  const end = source.indexOf("\n$function$;", startMatch.index);
  assert.notEqual(end, -1, `unterminated function ${functionName}`);
  return source.slice(startMatch.index, end + "\n$function$;".length);
}

test("Phase 2B-2A is the last additive migration and creates only three attempt tables", () => {
  const migrationNames = fs
    .readdirSync(path.join(root, "supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.equal(migrationNames.at(-1), migrationName);

  const createdTables = [
    ...migration.matchAll(/^\s*create\s+table\s+public\.([a-z0-9_]+)/gim),
  ].map((match) => match[1]);
  assert.deepEqual(createdTables, tables);
  assert.doesNotMatch(
    migration,
    /\b(create|alter)\s+table\s+public\.(sticker_transactions|learning_stage_first_passes)\b/i,
  );
  assert.doesNotMatch(
    migration,
    /^\s*insert\s+into\s+public\.(learning_courses|learning_units|learning_content_versions|learning_stages|learning_questions|learning_question_options)\b/im,
  );
  assert.doesNotMatch(migration, /alter publication|create publication/i);
});

test("attempt, snapshot, and answer constraints preserve scope and immutable history", () => {
  assert.match(
    normalizeSql(migration),
    /constraint learning_attempts_assignment_scope_fk foreign key \( assignment_id, family_id, assigned_member_id, content_version_id \) references public\.learning_assignments\( id, family_id, assigned_member_id, content_version_id \) on delete restrict/i,
  );
  assert.match(
    normalizeSql(migration),
    /constraint learning_attempts_progress_fk foreign key \(assignment_id, stage_id\) references public\.learning_stage_progress\(assignment_id, stage_id\) on delete restrict/i,
  );
  assert.match(
    normalizeSql(migration),
    /constraint learning_attempts_assignment_stage_no_key unique \(assignment_id, stage_id, attempt_no\)/i,
  );
  assert.match(
    migration,
    /create unique index learning_attempts_active_stage_uidx[\s\S]*where status = 'in_progress';/i,
  );
  assert.match(
    normalizeSql(migration),
    /constraint learning_attempt_questions_attempt_order_key unique \(attempt_id, display_order\)/i,
  );
  assert.match(
    normalizeSql(migration),
    /constraint learning_attempt_answers_question_key unique \(attempt_id, attempt_question_id\)/i,
  );
  assert.match(
    normalizeSql(migration),
    /constraint learning_attempt_answers_request_key unique \(attempt_id, client_request_id\)/i,
  );
  assert.match(migration, /terminal learning attempts are immutable/i);
  assert.match(
    migration,
    /learning attempt snapshots and answers are immutable/i,
  );
});

test("start or resume snapshots released content atomically without client grading input", () => {
  const definition = normalizeSql(
    extractFunction(migration, "start_or_resume_learning_attempt"),
  );
  assert.match(
    definition,
    /where assignment\.id = p_assignment_id and assignment\.family_id = p_family_id and assignment\.assigned_member_id = p_assigned_member_id for update/i,
  );
  assert.match(
    definition,
    /actor\.role = 'parent' or \( actor\.role = 'child' and actor\.id = target_assignment\.assigned_member_id \)/i,
  );
  assert.match(definition, /child\.role = 'child' and child\.is_active = true/i);
  assert.match(
    definition,
    /version\.status in \('published', 'retired'\)/i,
  );
  assert.match(definition, /if target_progress\.status <> 'unlocked' then/i);
  assert.match(
    definition,
    /attempt\.status = 'in_progress' for update/i,
  );
  assert.match(
    definition,
    /ceil\(question_count \* 8 \/ 10\.0\)::integer/i,
  );
  assert.match(
    definition,
    /jsonb_build_object\( 'id', option\.id::text, 'displayorder', option\.display_order, 'text', option\.option_text \)/i,
  );
  assert.doesNotMatch(
    definition,
    /\bp_(correct|score|passed|reward|option_text|explanation)/i,
  );
});

test("answer submission grades only the next snapshot question and returns scoped feedback", () => {
  const definition = normalizeSql(
    extractFunction(migration, "submit_learning_attempt_answer"),
  );
  assert.match(
    definition,
    /actor\.id = target_assignment\.assigned_member_id and actor\.role = 'child' and actor\.is_active = true/i,
  );
  assert.match(
    definition,
    /question\.id = p_attempt_question_id and question\.attempt_id = target_attempt\.id for update/i,
  );
  assert.match(
    definition,
    /order by question\.display_order limit 1/i,
  );
  assert.match(
    definition,
    /jsonb_array_elements\(target_question\.options_snapshot\)/i,
  );
  assert.match(
    definition,
    /p_selected_option_id = target_question\.correct_option_id/i,
  );
  assert.match(
    definition,
    /existing_answer\.selected_option_id <> p_selected_option_id/i,
  );
  assert.match(
    definition,
    /from public\.finalize_learning_stage_attempt\(/i,
  );
  assert.doesNotMatch(definition, /learning_question_options/i);
  assert.doesNotMatch(definition, /\bp_is_correct\b|\bp_correct/i);
});

test("finalize is idempotent and stops before progress, unlock, first-pass, or reward work", () => {
  const definition = normalizeSql(
    extractFunction(migration, "finalize_learning_stage_attempt"),
  );
  assert.match(
    definition,
    /if target_attempt\.status in \('passed', 'failed'\) then/i,
  );
  assert.match(
    definition,
    /answer_count <> target_attempt\.total_questions/i,
  );
  assert.match(
    definition,
    /count\(\*\) filter \(where answer\.is_correct\)::integer/i,
  );
  assert.match(
    definition,
    /when computed_correct >= target_attempt\.required_correct_answers then 'passed' else 'failed'/i,
  );
  assert.doesNotMatch(
    definition,
    /\b(update|insert into)\s+public\.(learning_stage_progress|learning_assignments|learning_stage_first_passes|sticker_transactions)\b/i,
  );
  assert.doesNotMatch(
    migration,
    /\b(create table|insert into)\s+public\.learning_stage_first_passes\b/i,
  );
});

test("parent abandon and assignment cancellation serialize without deleting audit rows", () => {
  const abandon = normalizeSql(
    extractFunction(migration, "abandon_learning_attempt"),
  );
  assert.match(
    abandon,
    /actor\.role = 'parent' and actor\.is_active = true for update/i,
  );
  assert.match(
    abandon,
    /where attempt\.id = p_attempt_id and attempt\.assignment_id = target_assignment\.id and attempt\.family_id = target_assignment\.family_id and attempt\.assigned_member_id = target_assignment\.assigned_member_id for update/i,
  );
  assert.match(abandon, /if target_attempt\.status <> 'in_progress' then/i);
  assert.match(
    abandon,
    /set status = 'abandoned', abandoned_at = now\(\), abandoned_by_member_id = p_actor_member_id/i,
  );
  assert.doesNotMatch(abandon, /\bdelete\s+from\b/i);

  const cancel = normalizeSql(
    extractFunction(migration, "cancel_learning_assignment"),
  );
  assert.match(
    cancel,
    /update public\.learning_attempts set status = 'abandoned'/i,
  );
  assert.match(
    cancel,
    /where assignment_id = target_assignment\.id and family_id = target_assignment\.family_id and assigned_member_id = target_assignment\.assigned_member_id and status = 'in_progress'/i,
  );
});

test("all attempt objects are FORCE RLS and approved functions are service-role only", () => {
  for (const table of tables) {
    assert.match(
      migration,
      new RegExp(
        `alter table public\\.${table} enable row level security;\\s*`
          + `alter table public\\.${table} force row level security;`,
        "i",
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all privileges on table public\\.${table}\\s+`
          + "from public, anon, authenticated, service_role;",
        "i",
      ),
    );
  }
  assert.doesNotMatch(migration, /\bcreate\s+policy\b/i);
  assert.match(
    migration,
    /grant select on table[\s\S]*public\.learning_attempt_answers\s+to service_role;/i,
  );

  const approved = [
    "start_or_resume_learning_attempt",
    "submit_learning_attempt_answer",
    "finalize_learning_stage_attempt",
    "abandon_learning_attempt",
  ];
  for (const functionName of approved) {
    const definition = normalizeSql(extractFunction(migration, functionName));
    assert.match(
      definition,
      /security definer set search_path = pg_catalog, public/i,
    );
    assert.match(
      migration,
      new RegExp(
        `grant execute on function public\\.${functionName}\\s*\\(`,
        "i",
      ),
    );
  }
  assert.equal((migration.match(/\bsecurity definer\b/gi) || []).length, 5);
});

test("verification, rollback, and fixture cover empty safety and runtime contracts", () => {
  assert.match(verification, /^\s*begin transaction read only;/i);
  assert.match(verification, /phase_2b_2a_verification_summary/i);
  assert.match(verification, /migration_created_empty_attempt_engine/i);
  assert.match(verification, /attempt_tables_not_in_realtime_publication/i);
  assert.match(verification, /\brollback;\s*$/i);
  assert.doesNotMatch(
    verification,
    /^\s*(insert|update|delete|create|alter|drop|grant|revoke|truncate)\b/im,
  );

  assert.match(rollback, /rollback blocked: Phase 2B attempt data exists/i);
  assert.match(
    rollback,
    /drop table public\.learning_attempt_answers;[\s\S]*drop table public\.learning_attempt_questions;[\s\S]*drop table public\.learning_attempts;/i,
  );
  assert.match(
    rollback,
    /create or replace function public\.cancel_learning_assignment/i,
  );
  assert.doesNotMatch(
    rollback,
    /\bdrop table public\.(learning_courses|learning_assignments|sticker_transactions)\b/i,
  );

  assert.match(fixture, /4 of 5 answers did not auto-finalize as passed/i);
  assert.match(fixture, /3 of 5 answers did not auto-finalize as failed/i);
  assert.match(fixture, /same answer request was not idempotent/i);
  assert.match(fixture, /concurrent start returned different attempts/i);
  assert.match(
    fixture,
    /assignment cancellation did not abandon its active attempt atomically/i,
  );
  assert.match(
    fixture,
    /foreach role_name in array array\['anon', 'authenticated'\]/i,
  );
  assert.match(fixture, /execute format\('set local role %I', role_name\)/i);
  assert.match(fixture, /execute 'set local role service_role'/i);
  assert.match(fixture, /phase2b_attempt_engine_fixture_passed/i);
});
