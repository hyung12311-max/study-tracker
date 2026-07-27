begin transaction read only;

-- Narrow post-migration policy diagnosis.
-- This statement reads metadata only and does not inspect application rows.

with
target_tables (
  table_order,
  table_name,
  preflight_rls_enabled
) as (
  values
    (1, 'study_plans', false),
    (2, 'book_plans', true),
    (3, 'academy_schedules', true),
    (4, 'reward_settings', false),
    (5, 'sticker_history', false)
),
verifier_expected_policies (
  policy_order,
  table_name,
  policy_name
) as (
  values
    (1, 'study_plans', 'single user study plans access'),
    (2, 'book_plans', 'book_plans_existing_app_access'),
    (3, 'academy_schedules', 'single user academy schedules access')
),
preflight_confirmed_policies (
  policy_order,
  table_name,
  policy_name
) as (
  values
    (1, 'book_plans', 'book_plans_existing_app_access'),
    (2, 'academy_schedules', 'academy_schedules_existing_app_access')
),
relation_state as (
  select
    targets.table_order,
    targets.table_name,
    targets.preflight_rls_enabled,
    relations.oid as relation_id,
    relations.relrowsecurity as rls_enabled,
    relations.relforcerowsecurity as rls_forced
  from target_tables targets
  left join pg_catalog.pg_namespace namespaces
    on namespaces.nspname = 'public'
  left join pg_catalog.pg_class relations
    on relations.relnamespace = namespaces.oid
   and relations.relname = targets.table_name
   and relations.relkind in ('r', 'p')
),
actual_policies as (
  select
    targets.table_order,
    policies.tablename as table_name,
    policies.policyname as policy_name,
    policies.cmd as command,
    policies.roles::text[] as roles,
    policies.permissive,
    policies.qual as using_expression,
    policies.with_check as with_check_expression,
    (
      lower(coalesce(policies.qual, '')) in ('true', '(true)')
      and lower(coalesce(policies.with_check, '')) in ('true', '(true)')
    ) as unconditional,
    (
      policies.cmd = 'ALL'
      and cardinality(policies.roles) = 2
      and policies.roles::text[] @> array['anon', 'authenticated']::text[]
      and lower(coalesce(policies.qual, '')) in ('true', '(true)')
      and lower(coalesce(policies.with_check, '')) in ('true', '(true)')
    ) as legacy_access_contract_matches
  from pg_catalog.pg_policies policies
  join target_tables targets on targets.table_name = policies.tablename
  where policies.schemaname = 'public'
),
preflight_policy_matches as (
  select
    expected.policy_order,
    expected.table_name,
    expected.policy_name,
    actual.policy_name is not null as currently_exists,
    coalesce(actual.legacy_access_contract_matches, false)
      as current_condition_matches
  from preflight_confirmed_policies expected
  left join actual_policies actual
    on actual.table_name = expected.table_name
   and actual.policy_name = expected.policy_name
),
assessment as (
  select
    (select count(*)::bigint from actual_policies where unconditional)
      as actual_unconditional_policy_count,
    (select count(*)::bigint from verifier_expected_policies)
      as verifier_expected_policy_count,
    (select count(*)::bigint from preflight_confirmed_policies)
      as preflight_confirmed_policy_count,
    0::bigint as migration_policy_rls_grant_statement_count,
    (
      not exists (
        select 1
        from relation_state relations
        where relations.relation_id is null
           or relations.rls_enabled is distinct from relations.preflight_rls_enabled
      )
      and not exists (
        select 1
        from preflight_policy_matches matches
        where not matches.currently_exists
           or not matches.current_condition_matches
      )
      and not exists (
        select 1
        from actual_policies actual
        left join preflight_confirmed_policies expected
          on expected.table_name = actual.table_name
         and expected.policy_name = actual.policy_name
        where expected.policy_name is null
      )
      and (select count(*) from actual_policies)
        = (select count(*) from preflight_confirmed_policies)
    ) as pre_post_policy_and_rls_state_matches
),
result_rows as (
  select
    '38_target_rls_status'::text as section,
    relations.table_order::bigint as item_order,
    jsonb_build_object(
      'table_name', relations.table_name,
      'table_exists', relations.relation_id is not null,
      'rls_enabled', relations.rls_enabled,
      'rls_forced', relations.rls_forced,
      'preflight_rls_enabled', relations.preflight_rls_enabled,
      'matches_preflight', (
        relations.relation_id is not null
        and relations.rls_enabled is not distinct from relations.preflight_rls_enabled
      ),
      'anon_authenticated_direct_grants', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'role', grants.grantee,
              'privilege', grants.privilege_type
            )
            order by grants.grantee, grants.privilege_type
          )
          from information_schema.role_table_grants grants
          where grants.table_schema = 'public'
            and grants.table_name = relations.table_name
            and grants.grantee in ('anon', 'authenticated')
        ),
        '[]'::jsonb
      )
    ) as result_data
  from relation_state relations

  union all

  select
    '39_actual_policies'::text,
    row_number() over (
      order by actual.table_order, actual.policy_name
    )::bigint,
    jsonb_build_object(
      'table_name', actual.table_name,
      'policy_name', actual.policy_name,
      'command', actual.command,
      'roles', to_jsonb(actual.roles),
      'permissive', actual.permissive,
      'using_expression', actual.using_expression,
      'with_check_expression', actual.with_check_expression,
      'unconditional', actual.unconditional,
      'legacy_access_contract_matches', actual.legacy_access_contract_matches
    )
  from actual_policies actual

  union all

  select
    '40_expected_policy_comparison'::text,
    expected.policy_order::bigint,
    jsonb_build_object(
      'expected_table', expected.table_name,
      'expected_policy_name', expected.policy_name,
      'verifier_expected_command', 'ALL',
      'verifier_expected_roles', jsonb_build_array('anon', 'authenticated'),
      'verifier_expected_using', 'true',
      'verifier_expected_with_check', 'true',
      'verifier_expected_rls_enabled', true,
      'currently_exists', actual.policy_name is not null,
      'current_condition_matches', coalesce(
        actual.legacy_access_contract_matches,
        false
      ),
      'confirmed_in_section_1_preflight', confirmed.policy_name is not null,
      'migration_changes_this_policy', false
    )
  from verifier_expected_policies expected
  left join actual_policies actual
    on actual.table_name = expected.table_name
   and actual.policy_name = expected.policy_name
  left join preflight_confirmed_policies confirmed
    on confirmed.table_name = expected.table_name
   and confirmed.policy_name = expected.policy_name

  union all

  select
    '41_policy_assessment'::text,
    1::bigint,
    jsonb_build_object(
      'check_name', 'legacy_policy_pre_post_assessment',
      'actual_unconditional_policy_count',
      assessment.actual_unconditional_policy_count,
      'verifier_expected_policy_count',
      assessment.verifier_expected_policy_count,
      'section_1_preflight_confirmed_policy_count',
      assessment.preflight_confirmed_policy_count,
      'migration_policy_rls_grant_statement_count',
      assessment.migration_policy_rls_grant_statement_count,
      'pre_post_policy_and_rls_state_matches',
      assessment.pre_post_policy_and_rls_state_matches,
      'security_regression', case
        when assessment.pre_post_policy_and_rls_state_matches then false
        else null
      end,
      'verifier_false_positive', (
        assessment.pre_post_policy_and_rls_state_matches
        and assessment.actual_unconditional_policy_count = 2
        and assessment.verifier_expected_policy_count = 3
      ),
      'verifier_minimal_fix_candidate', (
        assessment.pre_post_policy_and_rls_state_matches
        and assessment.actual_unconditional_policy_count = 2
      ),
      'production_change_needed', case
        when assessment.pre_post_policy_and_rls_state_matches then false
        else null
      end,
      'phase_3_unconditional_policies_to_remove', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'table_name', actual.table_name,
              'policy_name', actual.policy_name
            )
            order by actual.table_order, actual.policy_name
          )
          from actual_policies actual
          where actual.unconditional
        ),
        '[]'::jsonb
      ),
      'phase_3_rls_disabled_tables_to_address', coalesce(
        (
          select jsonb_agg(relations.table_name order by relations.table_order)
          from relation_state relations
          where relations.relation_id is not null
            and not relations.rls_enabled
        ),
        '[]'::jsonb
      ),
      'assessment_limit',
      'A null security_regression or production_change_needed requires manual review; this query never changes policy, RLS, or grants.'
    )
  from assessment
)
select
  section,
  item_order,
  result_data
from result_rows
order by section, item_order;

rollback;
