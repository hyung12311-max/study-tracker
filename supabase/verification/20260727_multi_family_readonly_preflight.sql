begin transaction read only;

-- Study Plus Multi Family preflight — SECTION 1 only.
-- Run this whole file in Supabase Dashboard > SQL Editor.
-- The single row-returning statement below combines sections 01 through 11.
-- It reads PostgreSQL catalogs and information_schema only.
-- It does not read Study Plus business rows and does not invoke project functions.

with
target_tables(table_order, table_name) as (
  values
    (1, 'families'),
    (2, 'family_members'),
    (3, 'family_device_sessions'),
    (4, 'family_messages'),
    (5, 'family_message_reads'),
    (6, 'family_push_subscriptions'),
    (7, 'family_notification_preferences'),
    (8, 'study_plans'),
    (9, 'book_plans'),
    (10, 'reading_plans'),
    (11, 'reward_settings'),
    (12, 'sticker_reward_settings'),
    (13, 'reward_milestones'),
    (14, 'sticker_history'),
    (15, 'sticker_transactions'),
    (16, 'reward_products'),
    (17, 'reward_exchange_requests'),
    (18, 'reward_exchange_history'),
    (19, 'reward_wishlist'),
    (20, 'academy_schedules'),
    (21, 'academy_completion_history'),
    (22, 'completion_notifications'),
    (23, 'hangul_daily_completions'),
    (24, 'push_subscriptions')
),
target_functions(function_order, function_name) as (
  values
    (1, 'verify_family_member_pin'),
    (2, 'set_family_member_pin'),
    (3, 'create_book_plan'),
    (4, 'complete_study_plan_and_reschedule'),
    (5, 'complete_study_plan_with_reward'),
    (6, 'create_reading_plan'),
    (7, 'complete_academy_schedule'),
    (8, 'complete_hangul_daily_with_reward'),
    (9, 'create_reward_exchange_request'),
    (10, 'approve_reward_exchange'),
    (11, 'default_reward_member'),
    (12, 'sync_study_sticker_transaction')
),
target_relations as (
  select
    target_tables.table_order,
    classes.oid as relation_id,
    classes.relname as table_name
  from pg_catalog.pg_class classes
  join pg_catalog.pg_namespace namespaces
    on namespaces.oid = classes.relnamespace
  join target_tables
    on target_tables.table_name = classes.relname
  where namespaces.nspname = 'public'
    and classes.relkind in ('r', 'p')
),
actual_functions as (
  select distinct procedures.proname
  from pg_catalog.pg_proc procedures
  join pg_catalog.pg_namespace namespaces
    on namespaces.oid = procedures.pronamespace
  where namespaces.nspname = 'public'
),
section_01 as (
  select
    '01_server_context'::text as section,
    1::bigint as item_order,
    jsonb_build_object(
      'postgres_version', version(),
      'current_database', current_database(),
      'current_user', current_user,
      'transaction_read_only', current_setting('transaction_read_only'),
      'search_path', current_setting('search_path'),
      'public_schema_exists', (to_regnamespace('public') is not null)
    ) as result_data
),
section_02 as (
  select
    '02_migration_history_relation'::text as section,
    1::bigint as item_order,
    jsonb_build_object(
      'relation_exists',
      (to_regclass('supabase_migrations.schema_migrations') is not null),
      'relation_columns',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'ordinal_position', columns.ordinal_position,
              'column_name', columns.column_name,
              'data_type', columns.data_type,
              'udt_name', columns.udt_name,
              'is_nullable', columns.is_nullable
            )
            order by columns.ordinal_position
          )
          from information_schema.columns
          where columns.table_schema = 'supabase_migrations'
            and columns.table_name = 'schema_migrations'
        ),
        '[]'::jsonb
      ),
      'next_action',
      'If relation_exists is true, return this result to Codex before querying migration rows.'
    ) as result_data
),
section_03 as (
  select
    '03_table_presence'::text as section,
    row_number() over (order by target_tables.table_order)::bigint as item_order,
    jsonb_build_object(
      'table_name', target_tables.table_name,
      'table_exists', (tables.table_name is not null),
      'table_type', tables.table_type
    ) as result_data
  from target_tables
  left join information_schema.tables tables
    on tables.table_schema = 'public'
   and tables.table_name = target_tables.table_name
),
section_04 as (
  select
    '04_columns'::text as section,
    row_number() over (
      order by target_tables.table_order, columns.ordinal_position
    )::bigint as item_order,
    jsonb_build_object(
      'table_name', columns.table_name,
      'ordinal_position', columns.ordinal_position,
      'column_name', columns.column_name,
      'data_type', columns.data_type,
      'udt_name', columns.udt_name,
      'is_nullable', columns.is_nullable,
      'has_default', (columns.column_default is not null),
      'is_identity', columns.is_identity,
      'identity_generation', columns.identity_generation,
      'is_generated', columns.is_generated
    ) as result_data
  from information_schema.columns columns
  join target_tables
    on target_tables.table_name = columns.table_name
  where columns.table_schema = 'public'
),
section_05 as (
  select
    '05_constraints'::text as section,
    row_number() over (
      order by
        target_relations.table_order,
        case constraints.contype
          when 'p' then 1
          when 'f' then 2
          when 'u' then 3
          when 'c' then 4
          else 5
        end,
        constraints.conname
    )::bigint as item_order,
    jsonb_build_object(
      'table_name', target_relations.table_name,
      'constraint_name', constraints.conname,
      'constraint_type',
      case constraints.contype
        when 'p' then 'PRIMARY KEY'
        when 'f' then 'FOREIGN KEY'
        when 'u' then 'UNIQUE'
        when 'c' then 'CHECK'
        when 'x' then 'EXCLUSION'
        else constraints.contype::text
      end,
      'local_columns',
      coalesce(
        (
          select jsonb_agg(attributes.attname order by keys.position)
          from unnest(constraints.conkey)
            with ordinality keys(attribute_number, position)
          join pg_catalog.pg_attribute attributes
            on attributes.attrelid = constraints.conrelid
           and attributes.attnum = keys.attribute_number
        ),
        '[]'::jsonb
      ),
      'referenced_schema', referenced_namespaces.nspname,
      'referenced_table', referenced_classes.relname,
      'referenced_columns',
      coalesce(
        (
          select jsonb_agg(attributes.attname order by keys.position)
          from unnest(constraints.confkey)
            with ordinality keys(attribute_number, position)
          join pg_catalog.pg_attribute attributes
            on attributes.attrelid = constraints.confrelid
           and attributes.attnum = keys.attribute_number
        ),
        '[]'::jsonb
      ),
      'on_delete',
      case constraints.confdeltype
        when 'a' then 'NO ACTION'
        when 'r' then 'RESTRICT'
        when 'c' then 'CASCADE'
        when 'n' then 'SET NULL'
        when 'd' then 'SET DEFAULT'
        else null
      end,
      'is_deferrable', constraints.condeferrable,
      'initially_deferred', constraints.condeferred,
      'is_validated', constraints.convalidated
    ) as result_data
  from target_relations
  join pg_catalog.pg_constraint constraints
    on constraints.conrelid = target_relations.relation_id
  left join pg_catalog.pg_class referenced_classes
    on referenced_classes.oid = constraints.confrelid
  left join pg_catalog.pg_namespace referenced_namespaces
    on referenced_namespaces.oid = referenced_classes.relnamespace
),
section_06 as (
  select
    '06_indexes'::text as section,
    row_number() over (
      order by target_relations.table_order, index_classes.relname
    )::bigint as item_order,
    jsonb_build_object(
      'table_name', target_relations.table_name,
      'index_name', index_classes.relname,
      'is_primary', indexes.indisprimary,
      'is_unique', indexes.indisunique,
      'is_valid', indexes.indisvalid,
      'is_ready', indexes.indisready,
      'is_partial', (indexes.indpred is not null),
      'key_columns',
      coalesce(
        (
          select jsonb_agg(
            pg_catalog.pg_get_indexdef(
              indexes.indexrelid,
              positions.position,
              true
            )
            order by positions.position
          )
          from generate_series(1, indexes.indnkeyatts) positions(position)
        ),
        '[]'::jsonb
      ),
      'partial_predicate',
      case
        when indexes.indpred is null then null
        else pg_catalog.pg_get_expr(indexes.indpred, indexes.indrelid)
      end
    ) as result_data
  from target_relations
  join pg_catalog.pg_index indexes
    on indexes.indrelid = target_relations.relation_id
  join pg_catalog.pg_class index_classes
    on index_classes.oid = indexes.indexrelid
),
section_07 as (
  select
    '07_rls_status'::text as section,
    row_number() over (order by target_relations.table_order)::bigint
      as item_order,
    jsonb_build_object(
      'table_name', classes.relname,
      'rls_enabled', classes.relrowsecurity,
      'rls_forced', classes.relforcerowsecurity
    ) as result_data
  from target_relations
  join pg_catalog.pg_class classes
    on classes.oid = target_relations.relation_id
),
section_08 as (
  select
    '08_policies'::text as section,
    row_number() over (
      order by target_tables.table_order, policies.policyname
    )::bigint as item_order,
    jsonb_build_object(
      'table_name', policies.tablename,
      'policy_name', policies.policyname,
      'command', policies.cmd,
      'roles', to_jsonb(policies.roles),
      'permissive', policies.permissive,
      'using_expression', policies.qual,
      'with_check_expression', policies.with_check,
      'using_is_unconditional',
      (lower(coalesce(policies.qual, '')) in ('true', '(true)')),
      'with_check_is_unconditional',
      (lower(coalesce(policies.with_check, '')) in ('true', '(true)'))
    ) as result_data
  from pg_catalog.pg_policies policies
  join target_tables
    on target_tables.table_name = policies.tablename
  where policies.schemaname = 'public'
),
section_09 as (
  select
    '09_table_grants'::text as section,
    row_number() over (
      order by
        target_tables.table_order,
        grants.grantee,
        grants.privilege_type
    )::bigint as item_order,
    jsonb_build_object(
      'table_name', grants.table_name,
      'grantee', grants.grantee,
      'privilege_type', grants.privilege_type,
      'is_grantable', grants.is_grantable
    ) as result_data
  from information_schema.role_table_grants grants
  join target_tables
    on target_tables.table_name = grants.table_name
  where grants.table_schema = 'public'
    and grants.grantee in ('anon', 'authenticated', 'service_role')
    and grants.privilege_type in (
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER'
    )
),
section_10_source as (
  select
    target_functions.function_order,
    namespaces.nspname as function_schema,
    procedures.proname as function_name,
    pg_catalog.pg_get_function_identity_arguments(procedures.oid)
      as identity_arguments,
    pg_catalog.pg_get_function_result(procedures.oid) as result_type,
    procedures.prosecdef as security_definer,
    case procedures.provolatile
      when 'i' then 'IMMUTABLE'
      when 's' then 'STABLE'
      when 'v' then 'VOLATILE'
    end as volatility,
    owners.rolname as owner,
    coalesce(
      (
        select jsonb_agg(settings.setting order by settings.setting)
        from unnest(coalesce(procedures.proconfig, array[]::text[]))
          settings(setting)
        where settings.setting like 'search_path=%'
      ),
      '[]'::jsonb
    ) as search_path_config,
    pg_catalog.has_function_privilege(
      pg_catalog.to_regrole('anon'),
      procedures.oid,
      'EXECUTE'
    ) as anon_can_execute,
    pg_catalog.has_function_privilege(
      pg_catalog.to_regrole('authenticated'),
      procedures.oid,
      'EXECUTE'
    ) as authenticated_can_execute,
    pg_catalog.has_function_privilege(
      pg_catalog.to_regrole('service_role'),
      procedures.oid,
      'EXECUTE'
    ) as service_role_can_execute
  from pg_catalog.pg_proc procedures
  join pg_catalog.pg_namespace namespaces
    on namespaces.oid = procedures.pronamespace
  join pg_catalog.pg_roles owners
    on owners.oid = procedures.proowner
  join target_functions
    on target_functions.function_name = procedures.proname
  where namespaces.nspname = 'public'
),
section_10 as (
  select
    '10_function_metadata'::text as section,
    row_number() over (
      order by function_order, identity_arguments
    )::bigint as item_order,
    jsonb_build_object(
      'function_schema', function_schema,
      'function_name', function_name,
      'identity_arguments', identity_arguments,
      'result_type', result_type,
      'security_definer', security_definer,
      'volatility', volatility,
      'owner', owner,
      'search_path_config', search_path_config,
      'anon_can_execute', anon_can_execute,
      'authenticated_can_execute', authenticated_can_execute,
      'service_role_can_execute', service_role_can_execute
    ) as result_data
  from section_10_source
),
section_11 as (
  select
    '11_function_presence'::text as section,
    row_number() over (
      order by target_functions.function_order
    )::bigint as item_order,
    jsonb_build_object(
      'function_name', target_functions.function_name,
      'function_exists', (actual_functions.proname is not null)
    ) as result_data
  from target_functions
  left join actual_functions
    on actual_functions.proname = target_functions.function_name
),
unified_results as (
  select section, item_order, result_data from section_01
  union all
  select section, item_order, result_data from section_02
  union all
  select section, item_order, result_data from section_03
  union all
  select section, item_order, result_data from section_04
  union all
  select section, item_order, result_data from section_05
  union all
  select section, item_order, result_data from section_06
  union all
  select section, item_order, result_data from section_07
  union all
  select section, item_order, result_data from section_08
  union all
  select section, item_order, result_data from section_09
  union all
  select section, item_order, result_data from section_10
  union all
  select section, item_order, result_data from section_11
)
select
  section,
  item_order,
  result_data
from unified_results
order by section, item_order;

rollback;
