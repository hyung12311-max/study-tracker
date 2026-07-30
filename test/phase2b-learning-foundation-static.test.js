const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const migrationName =
  "202607300001_create_phase_2b_learning_foundation.sql";
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations", migrationName),
  "utf8",
);
const verification = fs.readFileSync(
  path.join(
    root,
    "supabase/verification/202607300001_create_phase_2b_learning_foundation_verify.sql",
  ),
  "utf8",
);
const rollback = fs.readFileSync(
  path.join(
    root,
    "supabase/rollbacks/202607300001_rollback_phase_2b_learning_foundation.sql",
  ),
  "utf8",
);
const fixture = fs.readFileSync(
  path.join(root, "test/fixtures/phase2b_learning_foundation_fixture.sql"),
  "utf8",
);

const tables = [
  "learning_courses",
  "learning_units",
  "learning_content_versions",
  "learning_stages",
  "learning_questions",
  "learning_question_options",
  "learning_assignments",
  "learning_stage_progress",
];

function normalizeSql(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeFunctionStatement(value) {
  return normalizeSql(value)
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s*,\s*/g, ", ")
    .toLowerCase();
}

function extractFunction(source, functionName) {
  const startPattern = new RegExp(
    `create function public\\.${functionName}\\s*\\(`,
    "i",
  );
  const startMatch = startPattern.exec(source);
  assert.ok(startMatch, `missing function ${functionName}`);
  const end = source.indexOf("\n$function$;", startMatch.index);
  assert.notEqual(end, -1, `unterminated function ${functionName}`);
  return source.slice(startMatch.index, end + "\n$function$;".length);
}

function extractStatement(source, startPattern, label) {
  const startMatch = startPattern.exec(source);
  assert.ok(startMatch, `missing ${label}`);
  const end = source.indexOf(";", startMatch.index);
  assert.notEqual(end, -1, `unterminated ${label}`);
  return source.slice(startMatch.index, end + 1);
}

test("Phase 2B-1A migration is ordered last and creates only the eight approved tables", () => {
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
    /\b(create table|alter table)\s+public\.(learning_attempts|learning_attempt_answers|learning_reward_awards|sticker_transactions)\b/i,
  );
  assert.match(migration, /^\s*--[\s\S]*\bbegin;/i);
  assert.match(migration, /\bcommit;\s*$/i);
});

test("content model enforces immutable published versions and valid publish structure", () => {
  assert.match(
    normalizeSql(migration),
    /constraint learning_stages_difficulty_check check \( difficulty in \('seed', 'leaf', 'tree', 'crown'\) \)/i,
  );
  assert.match(
    migration,
    /learning_question_options_one_correct_uidx[\s\S]*where is_correct;/i,
  );
  const publishFunction = normalizeSql(
    extractFunction(migration, "publish_learning_content_version"),
  );
  assert.match(
    publishFunction,
    /from public\.learning_content_versions version where version\.id = p_content_version_id for update/i,
  );
  assert.match(publishFunction, /if not found then/i);
  assert.match(
    publishFunction,
    /if target_version\.status <> 'draft' then/i,
  );
  assert.match(
    publishFunction,
    /from public\.learning_stages stage where stage\.content_version_id = target_version\.id/i,
  );
  assert.match(publishFunction, /if stage_count < 1 then/i);
  assert.match(
    publishFunction,
    /min\(stage\.display_order\) <> 1 or max\(stage\.display_order\) <> count\(\*\)/i,
  );
  assert.match(
    publishFunction,
    /from public\.learning_questions question where question\.stage_id = stage\.id \) < 1/i,
  );
  assert.match(
    publishFunction,
    /min\(question\.display_order\) <> 1 or max\(question\.display_order\) <> count\(\*\)/i,
  );
  assert.match(
    publishFunction,
    /from public\.learning_question_options option where option\.question_id = question\.id \) < 2/i,
  );
  assert.match(
    publishFunction,
    /where option\.question_id = question\.id and option\.is_correct \) <> 1/i,
  );
  assert.match(
    publishFunction,
    /min\(option\.display_order\) <> 1 or max\(option\.display_order\) <> count\(\*\)/i,
  );
  assert.match(
    publishFunction,
    /update public\.learning_content_versions set status = 'published', published_at = now\(\) where id = target_version\.id/i,
  );
  assert.match(
    migration,
    /published or retired learning content is immutable/i,
  );
  assert.match(
    migration,
    /released learning catalog rows are immutable/i,
  );
  assert.doesNotMatch(
    migration,
    /^\s*insert\s+into\s+public\.(learning_courses|learning_units|learning_content_versions|learning_stages|learning_questions|learning_question_options)\b/im,
  );
});

test("assignment scope and active logical-unit uniqueness include family and child", () => {
  assert.match(
    migration,
    /constraint learning_assignments_scope_version_key\s+unique \(id, family_id, assigned_member_id, content_version_id\)/i,
  );
  assert.match(
    migration,
    /foreign key \(\s*assignment_id,\s*family_id,\s*assigned_member_id,\s*content_version_id\s*\)\s*references public\.learning_assignments\(\s*id,\s*family_id,\s*assigned_member_id,\s*content_version_id\s*\)/i,
  );
  const activeIndex = normalizeSql(
    extractStatement(
      migration,
      /create unique index learning_assignments_active_unit_uidx/i,
      "active assignment unique index",
    ),
  );
  assert.equal(
    activeIndex.toLowerCase(),
    "create unique index learning_assignments_active_unit_uidx "
      + "on public.learning_assignments "
      + "( family_id, assigned_member_id, unit_id ) "
      + "where status = 'active';",
  );
  assert.doesNotMatch(activeIndex, /content_version_id/i);
  const assignmentFunction = normalizeSql(
    extractFunction(migration, "create_learning_assignment"),
  );
  assert.match(
    assignmentFunction,
    /from public\.families family where family\.id = p_family_id for key share/i,
  );
  assert.match(
    assignmentFunction,
    /from public\.family_members actor where actor\.id = p_actor_member_id and actor\.family_id = p_family_id and actor\.role = 'parent' and actor\.is_active = true for update/i,
  );
  assert.match(
    assignmentFunction,
    /from public\.family_members child where child\.id = p_assigned_member_id and child\.family_id = p_family_id and child\.role = 'child' and child\.is_active = true for update/i,
  );
  assert.match(
    assignmentFunction,
    /from public\.learning_content_versions version where version\.id = p_content_version_id and version\.status = 'published' for key share/i,
  );
  assert.match(
    assignmentFunction,
    /values \( p_family_id, p_assigned_member_id, p_actor_member_id, target_version\.unit_id, target_version\.id, 'active' \)/i,
  );
  assert.match(assignmentFunction, /when unique_violation then/i);
  assert.match(
    assignmentFunction,
    /insert into public\.learning_stage_progress[\s\S]*when stage\.id = first_stage then 'unlocked' else 'locked'/i,
  );
  const cancelFunction = normalizeSql(
    extractFunction(migration, "cancel_learning_assignment"),
  );
  assert.match(
    cancelFunction,
    /from public\.learning_assignments assignment where assignment\.id = p_assignment_id and assignment\.family_id = p_family_id and assignment\.assigned_member_id = p_assigned_member_id for update/i,
  );
  assert.match(
    cancelFunction,
    /if target_assignment\.status <> 'active' then/i,
  );
  assert.match(
    cancelFunction,
    /update public\.learning_assignments set status = 'cancelled', cancelled_at = now\(\), updated_at = now\(\) where id = target_assignment\.id and status = 'active'/i,
  );
  assert.doesNotMatch(
    cancelFunction,
    /\b(delete from|insert into|update)\s+public\.learning_stage_progress\b/i,
  );
  assert.doesNotMatch(
    cancelFunction,
    /\bdelete from\s+public\.learning_assignments\b/i,
  );

  const normalizedFixture = normalizeSql(fixture);
  assert.match(
    normalizedFixture,
    /select count\(\*\) = 2 from public\.learning_stage_progress where assignment_id = :'assignment_one'/i,
  );
  assert.match(
    normalizedFixture,
    /select public\.cancel_learning_assignment\([\s\S]*?:'assignment_one' \); select assignment_id as assignment_two from public\.create_learning_assignment\([\s\S]*?'40000000-0000-4000-8000-000000000002' \) \\gset/i,
  );
  assert.match(
    normalizedFixture,
    /select status = 'cancelled' from public\.learning_assignments where id = :'assignment_one' \) and \( select count\(\*\) = 2 from public\.learning_stage_progress where assignment_id = :'assignment_one' \) and exists \( select 1 from public\.learning_assignments where id = :'assignment_two' and status = 'active' and content_version_id = '40000000-0000-4000-8000-000000000002'/i,
  );
  assert.match(
    assignmentFunction,
    /insert into public\.learning_stage_progress[\s\S]*created_assignment\.id[\s\S]*where stage\.content_version_id = created_assignment\.content_version_id/i,
  );
});

test("all eight tables are FORCE RLS default-deny and browser roles receive no access", () => {
  for (const table of tables) {
    assert.match(
      migration,
      new RegExp(
        `alter table public\\.${table} enable row level security;\\s*alter table public\\.${table} force row level security;`,
        "i",
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all privileges on table public\\.${table}\\s+from public, anon, authenticated, service_role;`,
        "i",
      ),
    );
  }
  assert.doesNotMatch(migration, /\bcreate\s+policy\b/i);
  assert.match(
    migration,
    /grant select on table[\s\S]*public\.learning_stage_progress\s+to service_role;/i,
  );
  assert.doesNotMatch(
    migration,
    /alter publication|create publication|drop publication/i,
  );
});

test("four server mutation functions are fixed-path SECURITY DEFINER and service-role only", () => {
  const functions = new Map([
    [
      "publish_learning_content_version",
      {
        arguments: "p_content_version_id uuid",
        identity: "uuid",
      },
    ],
    [
      "retire_learning_content_version",
      {
        arguments: "p_content_version_id uuid",
        identity: "uuid",
      },
    ],
    [
      "create_learning_assignment",
      {
        arguments:
          "p_family_id uuid, p_actor_member_id uuid, "
          + "p_assigned_member_id uuid, p_content_version_id uuid",
        identity: "uuid, uuid, uuid, uuid",
      },
    ],
    [
      "cancel_learning_assignment",
      {
        arguments:
          "p_family_id uuid, p_actor_member_id uuid, "
          + "p_assigned_member_id uuid, p_assignment_id uuid",
        identity: "uuid, uuid, uuid, uuid",
      },
    ],
  ]);
  const helpers = [
    "guard_learning_catalog_change",
    "guard_learning_content_version_change",
    "guard_learning_content_child_change",
    "validate_learning_assignment_scope",
  ];

  assert.equal((migration.match(/\bsecurity definer\b/gi) || []).length, 4);

  for (const [functionName, contract] of functions) {
    const definition = normalizeSql(extractFunction(migration, functionName));
    const headerMatch = definition.match(
      new RegExp(
        `^create function public\\.${functionName}\\s*\\((.*?)\\)\\s*returns`,
        "i",
      ),
    );
    assert.ok(headerMatch, `missing signature for ${functionName}`);
    assert.equal(normalizeSql(headerMatch[1]), contract.arguments);
    assert.match(
      definition,
      /\bsecurity definer set search_path = pg_catalog, public\b/i,
    );

    const owner = normalizeFunctionStatement(
      extractStatement(
        migration,
        new RegExp(`alter function public\\.${functionName}\\s*\\(`, "i"),
        `${functionName} owner`,
      ),
    );
    assert.equal(
      owner,
      `alter function public.${functionName}(${contract.identity}) owner to postgres;`,
    );

    const revoke = normalizeFunctionStatement(
      extractStatement(
        migration,
        new RegExp(`revoke all on function public\\.${functionName}\\s*\\(`, "i"),
        `${functionName} revoke`,
      ),
    );
    assert.equal(
      revoke,
      `revoke all on function public.${functionName}(${contract.identity}) `
        + "from public, anon, authenticated, service_role;",
    );

    const grant = normalizeFunctionStatement(
      extractStatement(
        migration,
        new RegExp(
          `grant execute on function public\\.${functionName}\\s*\\(`,
          "i",
        ),
        `${functionName} grant`,
      ),
    );
    assert.equal(
      grant,
      `grant execute on function public.${functionName}(${contract.identity}) `
        + "to service_role;",
    );
  }

  for (const helper of helpers) {
    const definition = normalizeSql(extractFunction(migration, helper));
    assert.doesNotMatch(definition, /\bsecurity definer\b/i);
    assert.match(definition, /\bset search_path = pg_catalog, public\b/i);

    const owner = normalizeFunctionStatement(
      extractStatement(
        migration,
        new RegExp(`alter function public\\.${helper}\\s*\\(\\)`, "i"),
        `${helper} owner`,
      ),
    );
    assert.equal(
      owner,
      `alter function public.${helper}() owner to postgres;`,
    );

    const revoke = normalizeFunctionStatement(
      extractStatement(
        migration,
        new RegExp(`revoke all on function public\\.${helper}\\s*\\(\\)`, "i"),
        `${helper} revoke`,
      ),
    );
    assert.equal(
      revoke,
      `revoke all on function public.${helper}() `
        + "from public, anon, authenticated, service_role;",
    );
    assert.doesNotMatch(
      migration,
      new RegExp(
        `grant execute on function public\\.${helper}\\s*\\(\\)`,
        "i",
      ),
    );
  }
});

test("verification is one read-only report and checks empty additive state", () => {
  assert.match(verification, /^\s*begin transaction read only;/i);
  assert.match(verification, /\brollback;\s*$/i);
  assert.match(
    verification,
    /with\s+target_tables[\s\S]*checks\(check_order, check_name, passed, result_data\) as \([\s\S]*select\s+check_order,[\s\S]*from checks[\s\S]*union all[\s\S]*phase_2b_1a_verification_summary[\s\S]*from checks\s+order by check_order;\s*rollback;/i,
  );
  assert.match(verification, /migration_created_empty_learning_foundation/i);
  assert.match(verification, /learning_tables_not_in_realtime_publication/i);
  assert.match(verification, /public_privilege_count = 0/i);
  assert.match(verification, /browser_privilege_count = 0/i);
  assert.match(verification, /service_role_mutation_absent/i);
  assert.match(verification, /function_security_contract/i);
  assert.match(verification, /total_checks/i);
  assert.doesNotMatch(
    verification,
    /^\s*(insert|update|delete|create|alter|drop|grant|revoke|truncate|call)\b/im,
  );
});

test("rollback is pre-data only and drops the foundation in reverse dependency order", () => {
  assert.match(rollback, /^\s*--[\s\S]*\bbegin;/i);
  assert.match(rollback, /\bcommit;\s*$/i);
  assert.match(
    rollback,
    /rollback blocked: Phase 2B learning data exists/i,
  );
  assert.match(
    rollback,
    /drop table public\.learning_stage_progress;[\s\S]*drop table public\.learning_assignments;[\s\S]*drop table public\.learning_question_options;[\s\S]*drop table public\.learning_courses;/i,
  );
  assert.doesNotMatch(
    rollback,
    /\b(study_plans|book_plans|reading_plans|academy_schedules|sticker_transactions)\b/i,
  );
});

test("disposable fixture covers publishing, scope, ACL, lifecycle, and concurrency", () => {
  assert.match(fixture, /\\ir \.\.\/\.\.\/supabase\/migrations\/202607300001/i);
  assert.match(fixture, /stage-less version publish[\s\S]*array\['23514'\]/i);
  assert.match(fixture, /question-less stage publish[\s\S]*array\['23514'\]/i);
  assert.match(fixture, /one-option question publish[\s\S]*array\['23514'\]/i);
  assert.match(fixture, /zero-correct question publish[\s\S]*array\['23514'\]/i);
  assert.match(fixture, /second correct option[\s\S]*array\['23505'\]/i);
  assert.match(fixture, /cross-family child assignment/i);
  assert.match(fixture, /inactive child/i);
  assert.match(fixture, /retired version assignment/i);
  assert.match(fixture, /cancel did not preserve progress or allow a new version assignment/i);
  assert.match(fixture, /set local role authenticated/i);
  assert.match(fixture, /set local role anon/i);
  assert.match(fixture, /set local role service_role/i);
  assert.match(fixture, /service_role %s on %s returned %s instead of 42501/i);
  const concurrencyBlock = normalizeSql(
    fixture.match(/do \$concurrency_test\$[\s\S]*?\$concurrency_test\$;/i)[0],
  );
  assert.match(concurrencyBlock, /\bdblink_connect\b/i);
  assert.match(concurrencyBlock, /\bdblink_send_query\b/i);
  assert.match(concurrencyBlock, /\bdblink_get_result\b/i);
  assert.match(concurrencyBlock, /\bdblink_disconnect\b/i);
  assert.match(
    concurrencyBlock,
    /duplicate_state is distinct from '23505'/i,
  );
  assert.match(
    normalizeSql(fixture),
    /different version of active unit[\s\S]*?array\['23505'\]/i,
  );
  assert.match(
    normalizeSql(fixture),
    /select count\(\*\) = 1 from public\.learning_assignments where family_id = '10000000-0000-4000-8000-000000000001' and assigned_member_id = '20000000-0000-4000-8000-000000000007' and unit_id = '30000000-0000-4000-8000-000000000004' and status = 'active'/i,
  );
  assert.match(fixture, /phase2b_learning_foundation_fixture_passed/i);
  assert.doesNotMatch(fixture, /\b(study_attempts|reward_awards)\b/i);
});
