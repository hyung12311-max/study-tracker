select
  'server' as inventory_section,
  current_database() as database_name,
  current_setting('server_version') as server_version,
  current_user as connected_role;

select
  'table' as inventory_section,
  requested.schema_name,
  requested.table_name,
  to_regclass(format('%I.%I', requested.schema_name, requested.table_name)) is not null as exists
from (values
  ('public', 'families'),
  ('public', 'family_members'),
  ('public', 'sticker_transactions'),
  ('public', 'hangul_daily_completions'),
  ('supabase_migrations', 'schema_migrations')
) as requested(schema_name, table_name)
order by requested.schema_name, requested.table_name;

select
  'column' as inventory_section,
  columns.table_schema,
  columns.table_name,
  columns.ordinal_position,
  columns.column_name,
  columns.data_type,
  columns.udt_schema,
  columns.udt_name,
  columns.is_nullable,
  columns.column_default,
  columns.is_identity
from information_schema.columns as columns
where columns.table_schema = 'public'
  and columns.table_name in ('families', 'family_members', 'sticker_transactions', 'hangul_daily_completions')
order by columns.table_name, columns.ordinal_position;

select
  'constraint' as inventory_section,
  namespace.nspname as schema_name,
  relation.relname as table_name,
  constraints.conname as constraint_name,
  constraints.contype as constraint_type,
  pg_get_constraintdef(constraints.oid, true) as constraint_definition,
  referenced_namespace.nspname as referenced_schema,
  referenced_relation.relname as referenced_table,
  constraints.confupdtype as foreign_key_update_action,
  constraints.confdeltype as foreign_key_delete_action
from pg_catalog.pg_constraint as constraints
join pg_catalog.pg_class as relation on relation.oid = constraints.conrelid
join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
left join pg_catalog.pg_class as referenced_relation on referenced_relation.oid = constraints.confrelid
left join pg_catalog.pg_namespace as referenced_namespace on referenced_namespace.oid = referenced_relation.relnamespace
where namespace.nspname = 'public'
  and relation.relname in ('families', 'family_members', 'sticker_transactions', 'hangul_daily_completions')
order by relation.relname, constraints.contype, constraints.conname;

select
  'index' as inventory_section,
  indexes.schemaname as schema_name,
  indexes.tablename as table_name,
  indexes.indexname as index_name,
  indexes.indexdef as index_definition
from pg_catalog.pg_indexes as indexes
where indexes.schemaname = 'public'
  and indexes.tablename in ('families', 'family_members', 'sticker_transactions', 'hangul_daily_completions')
order by indexes.tablename, indexes.indexname;

select
  'rls' as inventory_section,
  namespace.nspname as schema_name,
  relation.relname as table_name,
  relation.relrowsecurity as rls_enabled,
  relation.relforcerowsecurity as rls_forced
from pg_catalog.pg_class as relation
join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and relation.relname in ('families', 'family_members', 'sticker_transactions', 'hangul_daily_completions')
order by relation.relname;

select
  'policy' as inventory_section,
  policies.schemaname as schema_name,
  policies.tablename as table_name,
  policies.policyname as policy_name,
  policies.permissive,
  policies.roles,
  policies.cmd,
  policies.qual as using_expression,
  policies.with_check as with_check_expression
from pg_catalog.pg_policies as policies
where policies.schemaname = 'public'
  and policies.tablename in ('families', 'family_members', 'sticker_transactions', 'hangul_daily_completions')
order by policies.tablename, policies.policyname;

select
  'table_privilege' as inventory_section,
  privileges.table_schema,
  privileges.table_name,
  privileges.grantee,
  privileges.privilege_type,
  privileges.is_grantable
from information_schema.role_table_grants as privileges
where privileges.table_schema = 'public'
  and privileges.table_name in ('families', 'family_members', 'sticker_transactions', 'hangul_daily_completions')
  and privileges.grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
order by privileges.table_name, privileges.grantee, privileges.privilege_type;

select
  'function' as inventory_section,
  namespace.nspname as schema_name,
  procedures.proname as function_name,
  pg_get_function_identity_arguments(procedures.oid) as identity_arguments,
  pg_get_function_result(procedures.oid) as result_type,
  procedures.prosecdef as security_definer,
  procedures.proconfig as function_configuration,
  procedures.proacl as access_control_list
from pg_catalog.pg_proc as procedures
join pg_catalog.pg_namespace as namespace on namespace.oid = procedures.pronamespace
where namespace.nspname = 'public'
  and procedures.proname in ('complete_hangul_daily_with_reward', 'complete_study_plan_with_reward')
order by procedures.proname, identity_arguments;

select
  'function_privilege' as inventory_section,
  routines.routine_schema,
  routines.routine_name,
  routines.specific_name,
  privileges.grantee,
  privileges.privilege_type,
  privileges.is_grantable
from information_schema.routines as routines
join information_schema.role_routine_grants as privileges
  on privileges.specific_schema = routines.specific_schema
 and privileges.specific_name = routines.specific_name
where routines.routine_schema = 'public'
  and routines.routine_name in ('complete_hangul_daily_with_reward', 'complete_study_plan_with_reward')
  and privileges.grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
order by routines.routine_name, routines.specific_name, privileges.grantee;

select
  'ledger_function' as inventory_section,
  namespace.nspname as schema_name,
  procedures.proname as function_name,
  pg_get_function_identity_arguments(procedures.oid) as identity_arguments,
  pg_get_function_result(procedures.oid) as result_type,
  procedures.prosecdef as security_definer,
  procedures.proconfig as function_configuration,
  pg_get_functiondef(procedures.oid) as function_definition
from pg_catalog.pg_proc as procedures
join pg_catalog.pg_namespace as namespace on namespace.oid = procedures.pronamespace
where namespace.nspname = 'public'
  and procedures.prokind = 'f'
  and (
    procedures.proname = 'complete_study_plan_with_reward'
    or pg_get_functiondef(procedures.oid) ilike '%sticker_transactions%'
  )
order by procedures.proname, identity_arguments;

select
  'extension' as inventory_section,
  extensions.extname as extension_name,
  extensions.extversion as extension_version,
  namespace.nspname as installed_schema
from pg_catalog.pg_extension as extensions
join pg_catalog.pg_namespace as namespace on namespace.oid = extensions.extnamespace
where extensions.extname = 'pgcrypto'
order by extensions.extname;

select
  'feature' as inventory_section,
  to_regprocedure('gen_random_uuid()')::text as gen_random_uuid_signature,
  to_regclass('supabase_migrations.schema_migrations')::text as migration_history_relation,
  exists (
    select 1
    from pg_catalog.pg_proc as procedures
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedures.pronamespace
    where namespace.nspname = 'public'
      and procedures.proname = 'complete_hangul_daily_with_reward'
  ) as hangul_function_name_exists;

select
  'dayul_member' as inventory_section,
  members.id,
  members.family_id,
  members.member_key,
  members.display_name,
  members.role,
  members.is_active
from public.family_members as members
where members.member_key = 'dayul'
order by members.is_active desc, members.id;

select
  'sticker_source_count' as inventory_section,
  transactions.source_type,
  count(*) as transaction_count
from public.sticker_transactions as transactions
group by transactions.source_type
order by transactions.source_type;
