const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const expandMigration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "202607280001_expand_study_plans_server_wrappers.sql"),
  "utf8"
);
const assigneeExpandMigration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "202607280002_expand_book_plan_assignee_wrappers.sql"),
  "utf8"
);
const academyExpandMigration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "202607280003_expand_academy_schedule_assignee_access.sql"),
  "utf8"
);
const contractMigration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "202607280004_contract_study_data_api_only_access.sql"),
  "utf8"
);
const expandVerification = fs.readFileSync(
  path.join(root, "supabase", "verification", "202607280001_expand_study_plans_server_wrappers_verify.sql"),
  "utf8"
);
const assigneeExpandVerification = fs.readFileSync(
  path.join(root, "supabase", "verification", "202607280002_expand_book_plan_assignee_wrappers_verify.sql"),
  "utf8"
);
const academyExpandVerification = fs.readFileSync(
  path.join(root, "supabase", "verification", "202607280003_expand_academy_schedule_assignee_access_verify.sql"),
  "utf8"
);
const contractVerification = fs.readFileSync(
  path.join(root, "supabase", "verification", "202607280004_contract_study_data_api_only_access_verify.sql"),
  "utf8"
);
const expandRollback = fs.readFileSync(
  path.join(root, "supabase", "rollback", "202607280001_expand_study_plans_server_wrappers_rollback.sql"),
  "utf8"
);
const assigneeExpandRollback = fs.readFileSync(
  path.join(root, "supabase", "rollback", "202607280002_expand_book_plan_assignee_wrappers_rollback.sql"),
  "utf8"
);
const academyExpandRollback = fs.readFileSync(
  path.join(root, "supabase", "rollback", "202607280003_expand_academy_schedule_assignee_access_rollback.sql"),
  "utf8"
);
const contractRollback = fs.readFileSync(
  path.join(root, "supabase", "rollback", "202607280004_contract_study_data_api_only_access_emergency_rollback.sql"),
  "utf8"
);
const serverBoundarySources = [
  "completion-notifications.js",
  path.join("family", "messages.js"),
  path.join("notifications", "study-complete.js"),
  path.join("push", "send.js"),
  path.join("rewards", "study-complete.js"),
].map((file) => fs.readFileSync(path.join(root, "server", "api", file), "utf8")).join("\n");

test("expand migration adds wrappers without changing legacy access", () => {
  assert.match(expandMigration, /EXPAND phase/i);
  assert.match(expandMigration, /^\s*--[\s\S]*\bbegin;/i);
  assert.doesNotMatch(expandMigration, /alter table public\.study_plans (?:enable|disable|force|no force) row level security/i);
  assert.doesNotMatch(expandMigration, /revoke all privileges on table public\.study_plans/i);
  assert.doesNotMatch(expandMigration, /drop policy/i);
  assert.doesNotMatch(
    expandMigration,
    /revoke all on function public\.(?:create_book_plan|reflow_book_plan|add_book_plan_review|delete_book_plan_task|update_book_plan_pages|complete_study_plan_and_reschedule)\b/i
  );
  assert.match(expandMigration, /commit;\s*$/i);
});

test("expand wrappers are fixed-search-path and service-role only", () => {
  for (const name of [
    "create_book_plan_for_member",
    "reflow_book_plan_for_family",
    "add_book_plan_review_for_family",
    "delete_book_plan_task_for_family",
    "update_book_plan_pages_for_family",
    "complete_study_plan_with_reward_for_member",
    "create_reading_plan_for_member",
  ]) {
    assert.match(expandMigration, new RegExp(`create or replace function public\\.${name}`, "i"));
    assert.match(expandMigration, new RegExp(`alter function public\\.${name}[\\s\\S]*owner to postgres`, "i"));
    assert.match(expandMigration, new RegExp(`grant execute on function public\\.${name}[\\s\\S]*to service_role`, "i"));
  }
  assert.match(expandMigration, /set search_path = pg_catalog, public/gi);
  assert.match(expandMigration, /family_id = p_family_id[\s\S]*role = 'parent'[\s\S]*is_active = true/i);
  assert.match(expandMigration, /assigned_member_id = p_member_id/i);
});

test("book mutation wrappers do not depend on absent legacy helpers", () => {
  for (const name of [
    "reflow_book_plan",
    "add_book_plan_review",
    "delete_book_plan_task",
    "update_book_plan_pages",
  ]) {
    assert.doesNotMatch(expandMigration, new RegExp(`public\\.${name}\\(`, "i"));
    assert.doesNotMatch(contractMigration, new RegExp(`public\\.${name}\\(`, "i"));
    assert.doesNotMatch(contractRollback, new RegExp(`public\\.${name}\\(`, "i"));
    assert.doesNotMatch(
      expandVerification,
      new RegExp(`\\(\\d+,\\s*'public\\.${name}\\(`, "i")
    );
    assert.doesNotMatch(
      contractVerification,
      new RegExp(`\\(\\d+,\\s*'[^']*',\\s*'public\\.${name}\\(`, "i")
    );
  }
  assert.match(expandVerification, /missing_legacy_dependency_free/i);
});

test("book mutation wrappers enforce family ownership and serialize mutations", () => {
  assert.match(expandMigration, /from public\.book_plans[\s\S]*family_id = p_family_id[\s\S]*for update/i);
  assert.match(expandMigration, /role = 'parent'[\s\S]*is_active = true/gi);
  assert.match(expandMigration, /role = 'child'[\s\S]*is_active = true/gi);
  assert.match(expandMigration, /book plan task ownership is inconsistent/i);
  assert.match(expandMigration, /family_id is distinct from p_family_id/i);
  assert.match(expandMigration, /assigned_member_id is distinct from project\.assigned_member_id/i);
  assert.match(expandMigration, /created_by_member_id is distinct from project\.created_by_member_id/i);
  assert.match(
    expandMigration,
    /insert into public\.study_plans[\s\S]*family_id,[\s\S]*assigned_member_id,[\s\S]*created_by_member_id[\s\S]*p_family_id,[\s\S]*project\.assigned_member_id,[\s\S]*project\.created_by_member_id/i
  );
  assert.match(expandMigration, /status in \('완료', 'done'\)/i);
  assert.match(expandMigration, /status not in \('완료', 'done'\)/i);
  assert.match(expandMigration, /duplicate review request/i);
  assert.match(expandMigration, /review insertion point is stale/i);
  assert.match(expandMigration, /book task changed during deletion/i);
  assert.match(expandMigration, /pages per day is outside the supported range/i);
  assert.doesNotMatch(expandMigration, /^\s*execute\b/im);
});

test("follow-up expand atomically binds every book mutation to the selected child", () => {
  for (const name of [
    "reflow_book_plan_for_assignee",
    "add_book_plan_review_for_assignee",
    "update_book_plan_pages_for_assignee",
    "delete_book_plan_task_for_assignee",
  ]) {
    assert.match(assigneeExpandMigration, new RegExp(`create or replace function public\\.${name}`, "i"));
    assert.match(assigneeExpandMigration, new RegExp(`alter function public\\.${name}[\\s\\S]*owner to postgres`, "i"));
    assert.match(assigneeExpandMigration, new RegExp(`grant execute on function public\\.${name}[\\s\\S]*to service_role`, "i"));
    assert.match(assigneeExpandMigration, new RegExp(`revoke all on function public\\.${name}[\\s\\S]*from public, anon, authenticated`, "i"));
  }
  assert.match(
    assigneeExpandMigration,
    /where plan\.id = p_book_plan_id[\s\S]*plan\.family_id = p_family_id[\s\S]*plan\.assigned_member_id = p_assigned_member_id[\s\S]*for update/gi
  );
  assert.match(
    assigneeExpandMigration,
    /task\.id = study_plan_id_value[\s\S]*task\.family_id = p_family_id[\s\S]*task\.assigned_member_id = p_assigned_member_id[\s\S]*for update/i
  );
  assert.match(assigneeExpandMigration, /same lock order as the v1 wrappers/i);
  assert.doesNotMatch(assigneeExpandMigration, /alter table .* row level security/i);
  assert.doesNotMatch(assigneeExpandMigration, /(?:grant|revoke) .* on table/i);
  assert.doesNotMatch(assigneeExpandMigration, /(?:create|drop|alter) policy/i);
  assert.match(assigneeExpandMigration, /commit;\s*$/i);
});

test("promoted contract migration closes table and legacy RPC access", () => {
  const automaticMigrationNames = fs
    .readdirSync(path.join(root, "supabase", "migrations"))
    .filter((name) => name.endsWith(".sql"));
  assert.ok(automaticMigrationNames.includes("202607280002_expand_book_plan_assignee_wrappers.sql"));
  assert.ok(automaticMigrationNames.includes("202607280003_expand_academy_schedule_assignee_access.sql"));
  assert.deepEqual(
    automaticMigrationNames.filter((name) => name.startsWith("202607280004")),
    ["202607280004_contract_study_data_api_only_access.sql"],
  );
  assert.match(contractMigration, /alter table public\.study_plans enable row level security;/i);
  assert.match(contractMigration, /alter table public\.study_plans no force row level security;/i);
  assert.match(contractMigration, /revoke all privileges on table public\.study_plans from anon, authenticated;/i);
  assert.match(contractMigration, /drop policy if exists "single user study plans access"/i);
  assert.doesNotMatch(contractMigration, /create policy[\s\S]*using\s*\(\s*true\s*\)/i);
  assert.match(contractMigration, /grant select, insert, update, delete on table public\.study_plans to service_role;/i);
  assert.match(contractMigration, /drop policy "book_plans_existing_app_access" on public\.book_plans;/i);
  assert.match(contractMigration, /revoke all privileges on table public\.book_plans from anon, authenticated;/i);
  assert.match(contractMigration, /grant select, insert, update, delete on table public\.book_plans to service_role;/i);
  assert.match(contractMigration, /drop policy "academy_schedules_existing_app_access"[\s\S]*on public\.academy_schedules/i);
  assert.match(contractMigration, /revoke all privileges on table public\.academy_schedules[\s\S]*from anon, authenticated/i);
  assert.match(contractMigration, /grant select, insert, update, delete on table public\.academy_schedules[\s\S]*to service_role/i);
  assert.match(contractMigration, /drop policy "academy_completion_family_select"[\s\S]*on public\.academy_completion_history/i);
  assert.match(contractMigration, /revoke all privileges on table public\.academy_completion_history[\s\S]*from anon, authenticated/i);
  assert.match(contractMigration, /grant select, insert, update, delete on table public\.academy_completion_history[\s\S]*to service_role/i);
  for (const table of ["study_plans", "book_plans", "academy_schedules"]) {
    assert.match(
      contractMigration,
      new RegExp(`'${table}', 'anon', array\\['DELETE','INSERT','MAINTAIN','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE'\\]`, "i"),
    );
    assert.match(
      contractMigration,
      new RegExp(`'${table}', 'authenticated', array\\['DELETE','INSERT','MAINTAIN','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE'\\]`, "i"),
    );
  }
  assert.match(contractMigration, /'academy_completion_history', 'anon', array\['MAINTAIN','REFERENCES','SELECT','TRIGGER','TRUNCATE'\]/i);
  assert.match(contractMigration, /'academy_completion_history', 'authenticated', array\['MAINTAIN','REFERENCES','SELECT','TRIGGER','TRUNCATE'\]/i);
  assert.match(contractMigration, /academy_completion_publication state changed|academy completion publication state changed/i);
  assert.match(contractMigration, /browser table ACL baseline changed/i);
  assert.doesNotMatch(contractMigration, /^\s*(insert|update|delete|truncate)\b/im);
  assert.doesNotMatch(contractMigration, /alter publication/i);
  for (const name of [
    "create_book_plan",
    "complete_study_plan_and_reschedule",
  ]) {
    assert.match(contractMigration, new RegExp(`revoke all on function public\\.${name}[\\s\\S]*from public, anon, authenticated`, "i"));
  }
  assert.match(contractMigration, /unexpected study_plans policy/i);
  assert.match(contractMigration, /browser table ACL baseline changed/i);
  assert.match(contractMigration, /legacy compatibility grant changed/i);
});

test("academy expand adds atomic selected-child wrappers without changing legacy access", () => {
  for (const name of [
    "create_academy_schedule_for_assignee",
    "update_academy_schedule_for_assignee",
    "delete_academy_schedule_for_assignee",
    "complete_academy_schedule_for_assignee",
  ]) {
    assert.match(academyExpandMigration, new RegExp(`create or replace function public\\.${name}`, "i"));
    assert.match(academyExpandMigration, new RegExp(`alter function public\\.${name}[\\s\\S]*owner to postgres`, "i"));
    assert.match(academyExpandMigration, new RegExp(`revoke all on function public\\.${name}[\\s\\S]*from public, anon, authenticated`, "i"));
    assert.match(academyExpandMigration, new RegExp(`grant execute on function public\\.${name}[\\s\\S]*to service_role`, "i"));
  }
  assert.match(academyExpandMigration, /set search_path = pg_catalog, public/gi);
  assert.match(academyExpandMigration, /where schedules\.id = p_schedule_id[\s\S]*schedules\.family_id = p_family_id[\s\S]*schedules\.assigned_member_id = p_assigned_member_id[\s\S]*for update/gi);
  assert.match(academyExpandMigration, /completed academy schedule cannot be deleted/i);
  assert.match(academyExpandMigration, /from public\.complete_academy_schedule\(/i);
  assert.doesNotMatch(academyExpandMigration, /set\s+(?:family_id|assigned_member_id|created_by_member_id)\s*=/i);
  assert.doesNotMatch(academyExpandMigration, /alter table .* row level security/i);
  assert.doesNotMatch(academyExpandMigration, /(?:grant|revoke) .* on table/i);
  assert.match(academyExpandMigration, /commit;\s*$/i);
});

test("expand and contract verification express the compatibility matrix", () => {
  assert.match(expandVerification, /^begin transaction read only;/i);
  assert.match(expandVerification, /required_function_/i);
  assert.match(expandVerification, /legacy_browser/i);
  assert.match(expandVerification, /existing_service/i);
  assert.match(expandVerification, /legacy_table_access_unchanged_during_expand/i);
  assert.match(expandVerification, /contract_not_yet_applied/i);
  assert.match(contractVerification, /^begin transaction read only;/i);
  assert.match(assigneeExpandVerification, /^begin transaction read only;/i);
  assert.match(assigneeExpandVerification, /v2_wrapper_presence_and_signatures/i);
  assert.match(contractVerification, /relation\.table_name \|\| '_default_deny'/i);
  assert.match(contractVerification, /\(3, 'academy_schedules'\)/i);
  assert.match(contractVerification, /\(4, 'academy_completion_history'\)/i);
  assert.match(contractVerification, /browser_privilege_count = 0/i);
  assert.match(contractVerification, /academy_completion_realtime_publication_unchanged/i);
  assert.match(contractVerification, /contract_verification_summary/i);
  assert.match(contractVerification, /service_role_server_crud_retained/i);
  assert.match(academyExpandVerification, /legacy_academy_access_unchanged_during_expand/i);
  assert.match(academyExpandVerification, /verified_legacy_academy_rows_unchanged/i);
  for (const verification of [expandVerification, assigneeExpandVerification, academyExpandVerification, contractVerification]) {
    assert.doesNotMatch(verification, /^\s*(insert|update|delete|alter|create|drop|grant|revoke|call)\b/im);
    assert.match(verification, /rollback;\s*$/i);
  }
});

test("expand and contract rollback have distinct safety contracts", () => {
  assert.match(expandRollback, /contract migration has not been applied/i);
  assert.match(expandRollback, /new application has not been deployed/i);
  assert.doesNotMatch(expandRollback, /disable row level security/i);
  assert.match(assigneeExpandRollback, /v2 application has not been deployed/i);
  assert.doesNotMatch(assigneeExpandRollback, /reflow_book_plan_for_family\s*\(/i);
  assert.match(academyExpandRollback, /Academy API application has not been deployed/i);
  assert.doesNotMatch(academyExpandRollback, /alter table/i);
  assert.match(contractRollback, /CONTRACT emergency recovery only/i);
  assert.match(contractRollback, /reopens (?:the )?direct REST risk/i);
  assert.match(contractRollback, /alter table public\.study_plans disable row level security;/i);
  assert.match(contractRollback, /create policy "book_plans_existing_app_access"/i);
  assert.match(contractRollback, /create policy "academy_schedules_existing_app_access"/i);
  assert.match(contractRollback, /create policy "academy_completion_family_select"/i);
  for (const table of ["study_plans", "book_plans", "academy_schedules"]) {
    assert.match(
      contractRollback,
      new RegExp(`grant all privileges on table public\\.${table}[\\s\\S]*to anon, authenticated`, "i"),
    );
  }
  assert.match(
    contractRollback,
    /grant select, truncate, references, trigger, maintain[\s\S]*on table public\.academy_completion_history[\s\S]*to anon, authenticated/i,
  );
  assert.doesNotMatch(
    contractRollback,
    /grant[\s\S]{0,80}(?:insert|update|delete)[\s\S]{0,80}on table public\.academy_completion_history[\s\S]{0,80}to anon, authenticated/i,
  );
  assert.match(contractRollback, /TRUNCATE\/REFERENCES\/TRIGGER\/MAINTAIN privileges on all four relations/i);
  assert.match(contractRollback, /exact browser ACL baseline was not restored/i);
  assert.match(contractRollback, /emergency rollback preflight failed/i);
  assert.doesNotMatch(contractRollback, /drop function if exists public\./i);
  assert.match(contractRollback, /commit;\s*$/i);
});

test("service-role routes scope study plan lookups and updates to the authenticated family", () => {
  assert.doesNotMatch(
    serverBoundarySources,
    /study_plans\?(?:select=[^`]*&)?id=eq\.\$\{encodeURIComponent\([^)]*(?:planId|relatedId|plan\.id)[^)]*\)\}(?![^`]*family_id=eq\.)/
  );
  assert.match(serverBoundarySources, /family_id=eq\.\$\{encodeURIComponent\(claims\.family\)\}/);
  assert.match(serverBoundarySources, /assigned_member_id=eq\.\$\{encodeURIComponent\(claims\.sub\)\}/);
  assert.match(serverBoundarySources, /const claims=family\.authenticate\(request\)|const claims = u\.authenticate\(request\)/);
});
