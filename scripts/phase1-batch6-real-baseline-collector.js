"use strict";

const crypto = require("node:crypto");

const REAL_FAMILIES = "(select id from public.families where family_key not like 'uat-%')";
const REAL_MEMBERS = "(select id from public.family_members where family_id in (select id from public.families where family_key not like 'uat-%'))";
const REAL_ATTEMPTS = "(select id from public.learning_attempts where family_id in (select id from public.families where family_key not like 'uat-%'))";
const REAL_REVIEW_SESSIONS = "(select id from public.learning_mistake_review_sessions where family_id in (select id from public.families where family_key not like 'uat-%'))";
const REAL_ASSIGNMENT_PLANS = "(select id from public.learning_assignment_plans where family_id in (select id from public.families where family_key not like 'uat-%'))";

const byFamily = (table, columns, options = {}) => ({
  table,
  order: options.order || ["id"],
  columns,
  timestamps: options.timestamps || [],
  where: "x.family_id in " + REAL_FAMILIES,
});

const TABLES = [
  { table: "families", order: ["id"], columns: ["id", "family_key", "display_name", "chat_notifications_enabled", "system_notifications_enabled"], where: "x.id in " + REAL_FAMILIES },
  byFamily("family_members", ["id", "family_id", "member_key", "display_name", "role", "avatar_emoji", "is_active", "notifications_enabled"]),
  byFamily("family_device_sessions", ["id", "family_id", "member_id", "member_key", "is_active", "revoked_at", "revoked_reason"], { timestamps: ["revoked_at"] }),
  byFamily("family_reward_settings", ["family_id", "target_stickers", "reward_name"], { order: ["family_id"] }),
  byFamily("academy_completion_history", ["id", "family_id", "member_id", "academy_schedule_id", "completed_date", "star_count"]),
  byFamily("academy_schedules", ["id", "family_id", "assigned_member_id", "created_by_member_id", "academy_name", "day_of_week", "start_time", "memo", "star_count"]),
  byFamily("book_plans", ["id", "family_id", "assigned_member_id", "created_by_member_id", "subject", "workbook", "chapter", "lesson", "content", "start_date", "study_weekdays", "start_page", "end_page", "pages_per_day", "goal", "memo", "expected_end_date"]),
  byFamily("completion_notifications", ["id", "family_id", "member_id", "study_plan_id", "title", "body", "delivered", "delivery_channel"]),
  byFamily("family_messages", ["id", "family_id", "sender_id", "message_type", "content", "related_type", "related_id", "client_message_id", "deleted_at"], { timestamps: ["deleted_at"] }),
  byFamily("family_notification_preferences", ["family_id", "member_key", "study_complete_enabled", "family_chat_enabled", "reward_request_enabled", "overdue_study_enabled"], { order: ["family_id", "member_key"] }),
  byFamily("family_push_subscriptions", ["id", "family_id", "member_id", "member_key", "device_id", "device_name", "role", "is_active"]),
  byFamily("hangul_daily_completions", ["id", "family_id", "member_id", "study_date", "target_count", "completed_count", "session_id", "result_summary", "sticker_count", "completed_at"], { timestamps: ["completed_at"] }),
  byFamily("learning_assignments", ["id", "family_id", "assigned_member_id", "created_by_member_id", "unit_id", "content_version_id", "status", "assigned_at", "completed_at", "cancelled_at"], { timestamps: ["assigned_at", "completed_at", "cancelled_at"] }),
  byFamily("learning_attempts", ["id", "family_id", "assigned_member_id", "assignment_id", "content_version_id", "stage_id", "attempt_no", "start_request_id", "status", "total_questions", "correct_answers", "required_correct_answers", "started_at", "finalized_at", "abandoned_at", "abandoned_by_member_id"], { timestamps: ["started_at", "finalized_at", "abandoned_at"] }),
  byFamily("learning_member_subject_profiles", ["id", "family_id", "member_id", "subject", "level_code", "source", "configured_by_member_id", "configured_at"], { timestamps: ["configured_at"] }),
  byFamily("learning_mistake_reveal_events", ["id", "family_id", "actor_member_id", "assigned_member_id", "assignment_id", "content_version_id", "attempt_id", "stage_id", "attempt_question_id", "request_id", "event_type", "revealed_at"], { timestamps: ["revealed_at"] }),
  byFamily("learning_mistake_review_sessions", ["id", "family_id", "assigned_member_id", "assignment_id", "content_version_id", "started_by_member_id", "status", "filter_status", "filter_stage_id", "filter_skill_code", "request_id", "started_at", "completed_at", "abandoned_at"], { timestamps: ["started_at", "completed_at", "abandoned_at"] }),
  byFamily("learning_review_schedule_overrides", ["id", "family_id", "assigned_member_id", "assignment_id", "content_version_id", "skill_code", "override_due_at", "duration_days", "revision", "created_by_member_id", "updated_by_member_id"], { timestamps: ["override_due_at"] }),
  byFamily("learning_review_schedule_events", ["id", "override_id", "family_id", "assigned_member_id", "assignment_id", "skill_code", "event_type", "prior_due_at", "new_due_at", "duration_days", "revision", "actor_member_id", "request_id"], { timestamps: ["prior_due_at", "new_due_at"] }),
  byFamily("learning_stage_first_passes", ["id", "family_id", "assigned_member_id", "assignment_id", "content_version_id", "stage_id", "attempt_id", "difficulty", "reward_amount", "reward_transaction_id", "passed_at"], { timestamps: ["passed_at"] }),
  byFamily("learning_stage_progress", ["id", "family_id", "assigned_member_id", "assignment_id", "content_version_id", "stage_id", "status", "unlocked_at", "passed_at"], { timestamps: ["unlocked_at", "passed_at"] }),
  byFamily("reading_plans", ["id", "family_id", "assigned_member_id", "created_by_member_id", "reading_mode", "book_title", "start_page", "end_page", "study_weekdays", "start_date", "end_date"]),
  byFamily("reward_exchange_history", ["id", "family_id", "request_id", "member_id", "product_id", "product_name", "product_emoji", "sticker_cost", "completed_at", "approved_by"], { timestamps: ["completed_at"] }),
  byFamily("reward_exchange_requests", ["id", "family_id", "member_id", "product_id", "product_name", "product_emoji", "sticker_cost", "status", "requested_at", "decided_at", "decided_by", "rejection_reason", "client_request_id"], { timestamps: ["requested_at", "decided_at"] }),
  byFamily("reward_products", ["id", "family_id", "name", "category", "sticker_cost", "stock", "sort_order", "emoji", "description", "image_url", "is_active", "available_from", "available_until"], { timestamps: ["available_from", "available_until"] }),
  byFamily("reward_wishlist", ["id", "family_id", "member_id", "product_id"]),
  byFamily("sticker_transactions", ["id", "family_id", "member_id", "amount", "transaction_type", "source_type", "source_id", "description", "metadata", "created_at"], { timestamps: ["created_at"] }),
  byFamily("study_plans", ["id", "family_id", "assigned_member_id", "created_by_member_id", "subject", "workbook", "chapter", "lesson", "study_date", "day_label", "content", "goal", "status", "book_plan_id", "sequence_no", "start_page", "end_page", "task_type", "note", "plan_group_id", "study_weekdays", "plan_sequence", "completed_date", "reading_plan_id"]),
  { table: "family_message_reads", order: ["id"], columns: ["id", "family_id", "message_id", "member_id", "read_at"], timestamps: ["read_at"], where: "x.member_id in " + REAL_MEMBERS },
  { table: "push_subscriptions", order: ["id"], columns: ["id", "family_member_id", "user_role", "child_name", "device_name", "is_active"], where: "x.family_member_id in " + REAL_MEMBERS },
  { table: "learning_attempt_questions", order: ["id"], columns: ["id", "attempt_id", "source_question_id", "display_order", "prompt_snapshot", "explanation_snapshot", "options_snapshot", "correct_option_id", "skill_codes_snapshot"], where: "x.attempt_id in " + REAL_ATTEMPTS },
  { table: "learning_attempt_answers", order: ["id"], columns: ["id", "attempt_id", "attempt_question_id", "selected_option_id", "is_correct", "client_request_id", "submitted_at"], timestamps: ["submitted_at"], where: "x.attempt_id in " + REAL_ATTEMPTS },
  { table: "learning_mistake_review_items", order: ["id"], columns: ["id", "session_id", "source_attempt_id", "source_attempt_question_id", "source_answer_id", "display_order", "family_id", "assigned_member_id", "assignment_id", "content_version_id", "source_stage_id"], where: "x.session_id in " + REAL_REVIEW_SESSIONS },
  { table: "learning_mistake_review_answers", order: ["id"], columns: ["id", "session_id", "review_item_id", "selected_option_id", "is_correct", "client_request_id", "submitted_at"], timestamps: ["submitted_at"], where: "x.session_id in " + REAL_REVIEW_SESSIONS },
  { table: "learning_mistake_review_events", order: ["id"], columns: ["id", "family_id", "session_id", "review_item_id", "actor_member_id", "event_type", "request_id"], where: "x.session_id in " + REAL_REVIEW_SESSIONS },
  byFamily("learning_assignment_plans", ["id", "assignment_id", "family_id", "assigned_member_id", "content_version_id", "planned_start_date", "target_completion_date", "timezone_name", "plan_state", "paused_at", "configured_by_member_id", "create_request_id", "revision"], { timestamps: ["paused_at"] }),
  { table: "learning_assignment_plan_revisions", order: ["id"], columns: ["id", "family_id", "plan_id", "revision", "operation", "changed_by_member_id", "planned_start_date", "target_completion_date", "timezone_name", "plan_state", "paused_at", "previous_snapshot", "stage_targets_snapshot", "request_id", "changed_at"], timestamps: ["paused_at", "changed_at"], where: "x.plan_id in " + REAL_ASSIGNMENT_PLANS },
  { table: "learning_assignment_stage_targets", order: ["plan_id", "stage_id"], columns: ["plan_id", "assignment_id", "stage_id", "display_order", "target_date"], where: "x.plan_id in " + REAL_ASSIGNMENT_PLANS },
];

const SENSITIVE_COLUMNS = new Set([
  "pin", "pin_hash", "token", "token_hash", "session_token", "access_token", "refresh_token",
  "secret", "credential", "authorization", "auth", "endpoint", "p256dh", "user_agent",
]);

function mismatch(message) {
  return Object.assign(new Error(message), { code: "BASELINE_SCHEMA_MISMATCH" });
}

function quoteIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw mismatch("unsafe identifier: " + value);
  return '"' + value + '"';
}

function validateDefinitions(definitions = TABLES) {
  if (definitions.length !== 38) throw mismatch("configured metric count is " + definitions.length + ", expected 38");
  if (new Set(definitions.map(({ table }) => table)).size !== definitions.length) throw mismatch("duplicate table definition");
  for (const definition of definitions) {
    if (!definition.table || !definition.order?.length || !definition.columns?.length || !definition.where) throw mismatch("incomplete collector definition: " + (definition.table || "unknown"));
    const columns = new Set(definition.columns);
    if (definition.order.some((column) => !columns.has(column))) throw mismatch("ordering key is not canonicalized: " + definition.table);
    if ((definition.timestamps || []).some((column) => !columns.has(column))) throw mismatch("timestamp is not canonicalized: " + definition.table);
    const sensitive = definition.columns.filter((column) => SENSITIVE_COLUMNS.has(column));
    if (sensitive.length) throw mismatch("sensitive columns included in " + definition.table + ": " + sensitive.join(","));
  }
  return true;
}

function sqlValue(definition, column) {
  const reference = "x." + quoteIdentifier(column);
  if ((definition.timestamps || []).includes(column)) return "case when " + reference + " is null then null else to_char(" + reference + " at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') end";
  return "to_jsonb(" + reference + ")";
}

function tableSelect(definition) {
  const values = definition.columns.map((column) => sqlValue(definition, column)).join(", ");
  const order = definition.order.map((column) => "x." + quoteIdentifier(column)).join(", ");
  return "select '" + definition.table + "'::text metric, count(*)::bigint rows, md5(coalesce(jsonb_agg(jsonb_build_array(" + values + ") order by " + order + ")::text, '[]')) digest from public." + quoteIdentifier(definition.table) + " x where " + definition.where;
}

function buildSchemaValidationSql(definitions = TABLES) {
  validateDefinitions(definitions);
  const expectedColumns = definitions.flatMap((definition) => definition.columns.map((column) => "('" + definition.table + "','" + column + "')"));
  const expectedOrder = definitions.flatMap((definition) => definition.order.map((column, index) => "('" + definition.table + "','" + column + "'," + (index + 1) + ")"));
  return "begin transaction read only;\n" +
    "with expected_columns(table_name,column_name) as (values " + expectedColumns.join(",") + "),\n" +
    "expected_order(table_name,column_name,ordinality) as (values " + expectedOrder.join(",") + "),\n" +
    "missing as (select e.table_name,e.column_name from expected_columns e left join information_schema.columns c on c.table_schema='public' and c.table_name=e.table_name and c.column_name=e.column_name where c.column_name is null),\n" +
    "actual_order as (select t.relname table_name,a.attname column_name,k.ord::integer ordinality from pg_catalog.pg_class t join pg_catalog.pg_namespace n on n.oid=t.relnamespace and n.nspname='public' join pg_catalog.pg_index i on i.indrelid=t.oid and i.indisprimary join unnest(i.indkey) with ordinality k(attnum,ord) on true join pg_catalog.pg_attribute a on a.attrelid=t.oid and a.attnum=k.attnum),\n" +
    "unstable as (select distinct table_name from ((select * from expected_order except select * from actual_order) union all (select * from actual_order where table_name in (select distinct table_name from expected_order) except select * from expected_order)) drift)\n" +
    "select jsonb_build_object('valid',not exists(select 1 from missing) and not exists(select 1 from unstable),'configuredMetrics'," + definitions.length + ",'missingColumns',coalesce((select jsonb_agg(jsonb_build_array(table_name,column_name) order by table_name,column_name) from missing),'[]'::jsonb),'unstableOrderTables',coalesce((select jsonb_agg(table_name order by table_name) from unstable),'[]'::jsonb)) result;\nrollback;";
}

function buildCollectorSql(definitions = TABLES) {
  validateDefinitions(definitions);
  return "begin transaction read only; with metrics as (" + definitions.map(tableSelect).join(" union all ") + ") select jsonb_agg(jsonb_build_object('table',metric,'count',rows,'digest',digest) order by metric) result from metrics; rollback;";
}

function assertSchemaResult(result) {
  if (result?.valid !== true || result?.configuredMetrics !== 38 || result?.missingColumns?.length || result?.unstableOrderTables?.length) {
    throw mismatch("Production baseline schema does not match the configured business contract");
  }
  return true;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object" && !(value instanceof Date)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function normalizeFixtureValue(definition, column, value) {
  if (value == null) return null;
  if ((definition.timestamps || []).includes(column)) return new Date(value).toISOString();
  return canonical(value);
}

function digestFixtureRows(definition, rows) {
  const ordered = [...rows].sort((left, right) => {
    for (const column of definition.order) {
      const comparison = JSON.stringify(canonical(left[column])).localeCompare(JSON.stringify(canonical(right[column])));
      if (comparison) return comparison;
    }
    return 0;
  });
  const payload = ordered.map((row) => definition.columns.map((column) => normalizeFixtureValue(definition, column, row[column])));
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function definitionFor(table) {
  const definition = TABLES.find((item) => item.table === table);
  if (!definition) throw mismatch("unknown table: " + table);
  return definition;
}

if (require.main === module) {
  if (process.argv[2] === "--schema-sql") process.stdout.write(buildSchemaValidationSql());
  else if (process.argv[2] === "--baseline-sql") process.stdout.write(buildCollectorSql());
  else {
    process.stderr.write("usage: node scripts/phase1-batch6-real-baseline-collector.js --schema-sql|--baseline-sql\n");
    process.exitCode = 2;
  }
}

module.exports = { TABLES, SENSITIVE_COLUMNS, assertSchemaResult, buildCollectorSql, buildSchemaValidationSql, definitionFor, digestFixtureRows, tableSelect, validateDefinitions };
