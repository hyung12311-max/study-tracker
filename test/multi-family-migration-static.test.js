const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.join(
  __dirname,
  "../supabase/migrations/202607270001_multi_family_data_foundation.sql",
);
const verificationPath = path.join(
  __dirname,
  "../supabase/verification/202607270001_multi_family_data_foundation_verify.sql",
);
const migration = fs.readFileSync(migrationPath, "utf8");
const verification = fs.readFileSync(verificationPath, "utf8");

test("multi-family foundation remains additive and precedes the access-hardening migration", () => {
  const migrationNames = fs
    .readdirSync(path.join(__dirname, "../supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  assert.ok(migrationNames.includes("202607270001_multi_family_data_foundation.sql"));
  assert.ok(migrationNames.includes("202607280001_expand_study_plans_server_wrappers.sql"));
  assert.ok(
    migrationNames.indexOf("202607270001_multi_family_data_foundation.sql")
      < migrationNames.indexOf("202607280001_expand_study_plans_server_wrappers.sql"),
  );
  assert.match(migration, /^\s*--[\s\S]*\bbegin;/i);
  assert.match(migration, /\bcommit;\s*$/i);
  assert.doesNotMatch(migration, /^\s*(drop policy|revoke)\b/im);
  assert.doesNotMatch(migration, /\bcreate\s+or\s+replace\s+function\b/i);
});

test("preflight locks and enforces the verified bigint and uuid contracts", () => {
  assert.match(migration, /lock table[\s\S]*in share row exclusive mode;/i);
  assert.match(
    migration,
    /table_name = 'study_plans'[\s\S]*column_name = 'id'[\s\S]*data_type = 'bigint'[\s\S]*identity_generation = 'ALWAYS'/i,
  );
  assert.match(
    migration,
    /table_name = 'sticker_history'[\s\S]*column_name in \('id', 'study_plan_id'\)[\s\S]*data_type = 'bigint'/i,
  );
  assert.match(
    migration,
    /table_name = 'book_plans'[\s\S]*table_name = 'reading_plans'[\s\S]*data_type = 'uuid'/i,
  );
  assert.match(
    migration,
    /verified production row counts changed/i,
  );
  assert.match(migration, /raise exception using/g);
});

test("new ownership columns stay nullable for legacy write compatibility", () => {
  assert.match(
    migration,
    /alter table public\.study_plans\s+add column family_id uuid,\s+add column assigned_member_id uuid,\s+add column created_by_member_id uuid;/i,
  );
  assert.match(
    migration,
    /alter table public\.book_plans\s+add column family_id uuid,\s+add column assigned_member_id uuid,\s+add column created_by_member_id uuid;/i,
  );
  assert.match(
    migration,
    /alter table public\.reading_plans\s+add column assigned_member_id uuid;/i,
  );
  assert.match(
    migration,
    /alter table public\.academy_schedules\s+add column family_id uuid,\s+add column assigned_member_id uuid,\s+add column created_by_member_id uuid;/i,
  );
  assert.doesNotMatch(
    migration,
    /alter column (family_id|assigned_member_id|created_by_member_id) set not null/i,
  );
  assert.match(
    migration,
    /after browser CRUD and legacy RPCs write explicit ownership/i,
  );
});

test("backfill resolves Hagyeom only through the default family", () => {
  assert.match(
    migration,
    /from public\.families\s+join public\.family_members\s+on family_members\.family_id = families\.id\s+where families\.family_key = 'default'\s+and family_members\.member_key = 'hagyeom'\s+and family_members\.role = 'child'\s+and family_members\.is_active = true/i,
  );
  assert.doesNotMatch(
    migration,
    /from public\.family_members\s+where\s+(?:\w+\.)?member_key = 'hagyeom'/i,
  );
  assert.match(
    migration,
    /update public\.study_plans[\s\S]*family_id = owners\.family_id,[\s\S]*assigned_member_id = owners\.member_id/i,
  );
  assert.match(
    migration,
    /update public\.reading_plans[\s\S]*set assigned_member_id = family_members\.id/i,
  );
  assert.match(
    migration,
    /update public\.academy_schedules[\s\S]*from \([\s\S]*public\.academy_completion_history/i,
  );
  assert.doesNotMatch(
    migration,
    /set\s+created_by_member_id\s*=/i,
  );
});

test("family/member pairs are protected by a composite unique key and FKs", () => {
  assert.match(
    migration,
    /create unique index family_members_family_id_id_uidx[\s\S]*\(family_id, id\)/i,
  );
  for (const constraintName of [
    "study_plans_assigned_family_member_fk",
    "study_plans_created_by_family_member_fk",
    "book_plans_assigned_family_member_fk",
    "book_plans_created_by_family_member_fk",
    "reading_plans_assigned_family_member_fk",
    "academy_schedules_assigned_family_member_fk",
    "academy_schedules_created_by_family_member_fk",
  ]) {
    assert.match(migration, new RegExp(`constraint ${constraintName}\\b`, "i"));
  }
  assert.match(
    migration,
    /foreign key \(family_id, assigned_member_id\)\s+references public\.family_members\(family_id, id\)/i,
  );
});

test("legacy duplicate cleanup is fully guarded and preserves the ledger", () => {
  assert.match(
    migration,
    /where study_plan_id = 9[\s\S]*id in \(3, 4\)/i,
  );
  assert.match(
    migration,
    /family_key <> 'default'[\s\S]*member_key <> 'hagyeom'/i,
  );
  assert.match(
    migration,
    /source_type = 'study_complete'\s+and source_id = '9'/i,
  );
  assert.match(
    migration,
    /created_at is distinct from history_3_created_at/i,
  );
  assert.match(
    migration,
    /disable trigger sync_study_sticker_transaction;/i,
  );
  assert.match(
    migration,
    /delete from public\.sticker_history\s+where id = 4\s+and study_plan_id = 9;/i,
  );
  assert.match(
    migration,
    /get diagnostics deleted_count = row_count;[\s\S]*deleted_count <> 1/i,
  );
  assert.match(
    migration,
    /enable trigger sync_study_sticker_transaction;/i,
  );
  assert.match(
    migration,
    /study_complete transaction count changed[\s\S]*hagyeom ledger balance is not 47/i,
  );
  assert.match(
    migration,
    /postflight failed: sticker ledger changed/i,
  );
});

test("study history uniqueness is partial and ownership query indexes exist", () => {
  assert.match(
    migration,
    /create unique index sticker_history_study_plan_unique_idx\s+on public\.sticker_history \(study_plan_id\)\s+where study_plan_id is not null;/i,
  );
  for (const indexName of [
    "study_plans_family_assigned_date_idx",
    "study_plans_family_created_by_idx",
    "book_plans_family_assigned_idx",
    "reading_plans_family_assigned_idx",
    "academy_schedules_family_assigned_idx",
  ]) {
    assert.match(migration, new RegExp(`create index ${indexName}\\b`, "i"));
  }
});

test("legacy policies and grants are explicitly deferred without being changed", () => {
  assert.match(migration, /TODO\(phase 3\)/i);
  assert.match(migration, /unconditional RLS/i);
  assert.match(migration, /create_book_plan/i);
  assert.match(migration, /complete_study_plan_and_reschedule/i);
  assert.doesNotMatch(migration, /^\s*(drop policy|create policy|revoke|grant)\b/im);
});

test("post-migration verification is one read-only result set", () => {
  assert.match(verification, /^\s*begin transaction read only;/i);
  assert.match(verification, /with\s+verified_owner as/i);
  assert.match(
    verification,
    /select\s+check_rows\.check_order,[\s\S]*from check_rows\s+order by check_rows\.check_order;/i,
  );
  assert.match(verification, /rollback;\s*$/i);
  assert.doesNotMatch(
    verification,
    /^\s*(insert|update|delete|merge|create|alter|drop|truncate|grant|revoke|call|do|execute)\b/im,
  );
  assert.match(verification, /study_plans_backfilled_default_hagyeom/i);
  assert.match(verification, /sticker_history_duplicate_removed/i);
  assert.match(verification, /hagyeom_balance/i);
  assert.match(verification, /new_foreign_keys_present_and_valid/i);
  assert.match(verification, /hangul_constraints_preserved/i);
  assert.match(
    verification,
    /legacy_unconditional_policies_intentionally_retained/i,
  );
  assert.match(
    verification,
    /legacy_rpc_execute_grants_intentionally_retained/i,
  );
  assert.match(
    verification,
    /legacy_direct_table_grants_intentionally_retained/i,
  );
});

test("files contain no production execution or automatic apply commands", () => {
  const combined = `${migration}\n${verification}`;
  assert.doesNotMatch(
    combined,
    /\b(supabase\s+db\s+(push|reset)|psql|npx\s+supabase|seed\.sql)\b/i,
  );
  assert.doesNotMatch(combined, /https?:\/\/[^\s]+supabase\.co/i);
});
