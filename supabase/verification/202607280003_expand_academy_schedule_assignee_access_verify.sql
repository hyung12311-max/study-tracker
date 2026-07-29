begin transaction read only;

-- Read-only EXPAND verification. Business rows are reduced to non-identifying
-- counts; no schedule content, UUID, member name, or completion date is output.

with target_functions(function_order, function_identity) as (
  values
    (1, 'public.create_academy_schedule_for_assignee(uuid,uuid,uuid,text,integer,time without time zone,text,integer)'),
    (2, 'public.update_academy_schedule_for_assignee(uuid,uuid,uuid,uuid,text,integer,time without time zone,text,integer)'),
    (3, 'public.delete_academy_schedule_for_assignee(uuid,uuid,uuid,uuid)'),
    (4, 'public.complete_academy_schedule_for_assignee(uuid,uuid,uuid,uuid,date)')
),
function_state as (
  select
    targets.function_order,
    targets.function_identity,
    procedures.oid,
    procedures.prosecdef as security_definer,
    procedures.proconfig as function_config,
    owners.rolname as owner_name,
    case when procedures.oid is null then false else
      has_function_privilege('service_role', procedures.oid, 'EXECUTE')
    end as service_role_execute,
    case when procedures.oid is null then null else
      has_function_privilege('anon', procedures.oid, 'EXECUTE')
    end as anon_execute,
    case when procedures.oid is null then null else
      has_function_privilege('authenticated', procedures.oid, 'EXECUTE')
    end as authenticated_execute,
    case when procedures.oid is null then null else exists (
      select 1
      from aclexplode(coalesce(
        procedures.proacl,
        acldefault('f', procedures.proowner)
      )) acl
      where acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    ) end as public_execute
  from target_functions targets
  left join pg_catalog.pg_proc procedures
    on procedures.oid = to_regprocedure(targets.function_identity)
  left join pg_catalog.pg_roles owners
    on owners.oid = procedures.proowner
),
academy_relation_state as (
  select
    relations.relrowsecurity as rls_enabled,
    relations.relforcerowsecurity as rls_forced,
    (
      select count(*)::bigint
      from pg_catalog.pg_policy policies
      where policies.polrelid = relations.oid
    ) as policy_count,
    exists (
      select 1
      from pg_catalog.pg_policies policies
      where policies.schemaname = 'public'
        and policies.tablename = 'academy_schedules'
        and policies.policyname = 'academy_schedules_existing_app_access'
        and policies.cmd = 'ALL'
        and policies.roles @> array['anon', 'authenticated']::name[]
        and trim(coalesce(policies.qual, '')) in ('true', '(true)')
        and trim(coalesce(policies.with_check, '')) in ('true', '(true)')
    ) as legacy_policy_present,
    has_table_privilege(
      'anon', relations.oid, 'SELECT, INSERT, UPDATE, DELETE'
    ) as anon_crud,
    has_table_privilege(
      'authenticated', relations.oid, 'SELECT, INSERT, UPDATE, DELETE'
    ) as authenticated_crud
  from pg_catalog.pg_class relations
  where relations.oid = 'public.academy_schedules'::regclass
),
legacy_data_state as (
  select
    count(*)::bigint as schedule_count,
    count(*) filter (
      where schedules.family_id is not null
        and schedules.assigned_member_id is not null
        and schedules.created_by_member_id is null
    )::bigint as legacy_creator_null_count,
    count(*) filter (
      where members.id is null
         or members.role is distinct from 'child'
         or members.is_active is distinct from true
    )::bigint as invalid_assignee_count
  from public.academy_schedules schedules
  left join public.family_members members
    on members.id = schedules.assigned_member_id
   and members.family_id = schedules.family_id
),
existing_wrapper_state as (
  select count(*)::bigint as present_count
  from (
    values
      ('public.create_book_plan_for_member(uuid,uuid,uuid,text,text,text,text,text,date,integer,integer,integer,integer[],text,text)'),
      ('public.complete_study_plan_with_reward_for_member(uuid,uuid,bigint,date)'),
      ('public.reflow_book_plan_for_assignee(uuid,uuid,uuid,uuid,date)'),
      ('public.add_book_plan_review_for_assignee(uuid,uuid,uuid,uuid,integer,text)'),
      ('public.update_book_plan_pages_for_assignee(uuid,uuid,uuid,uuid,integer)'),
      ('public.delete_book_plan_task_for_assignee(uuid,uuid,uuid,text)')
  ) expected(function_identity)
  where to_regprocedure(expected.function_identity) is not null
),
checks(check_order, check_name, passed, result_data) as (
  select
    functions.function_order,
    'academy_wrapper_' || functions.function_order,
    functions.oid is not null
      and functions.security_definer
      and functions.owner_name = 'postgres'
      and functions.function_config
        @> array['search_path=pg_catalog, public']
      and functions.service_role_execute
      and not functions.anon_execute
      and not functions.authenticated_execute
      and not functions.public_execute,
    jsonb_build_object(
      'function_identity', functions.function_identity,
      'exists', functions.oid is not null,
      'security_definer', functions.security_definer,
      'owner', functions.owner_name,
      'search_path', functions.function_config,
      'service_role_execute', functions.service_role_execute,
      'anon_execute', functions.anon_execute,
      'authenticated_execute', functions.authenticated_execute,
      'public_execute', functions.public_execute
    )
  from function_state functions

  union all

  select
    5,
    'legacy_academy_access_unchanged_during_expand',
    relation.rls_enabled
      and not relation.rls_forced
      and relation.policy_count = 1
      and relation.legacy_policy_present
      and relation.anon_crud
      and relation.authenticated_crud,
    to_jsonb(relation)
  from academy_relation_state relation

  union all

  select
    6,
    'verified_legacy_academy_rows_unchanged',
    data.schedule_count = 2
      and data.legacy_creator_null_count = 2
      and data.invalid_assignee_count = 0,
    to_jsonb(data)
  from legacy_data_state data

  union all

  select
    7,
    'existing_phase_2a_wrappers_unchanged',
    wrappers.present_count = 6,
    jsonb_build_object(
      'expected_count', 6,
      'present_count', wrappers.present_count
    )
  from existing_wrapper_state wrappers

  union all

  select
    8,
    'contract_not_yet_applied',
    relation.legacy_policy_present
      and relation.anon_crud
      and relation.authenticated_crud,
    jsonb_build_object(
      'legacy_policy_present', relation.legacy_policy_present,
      'anon_crud', relation.anon_crud,
      'authenticated_crud', relation.authenticated_crud
    )
  from academy_relation_state relation
)
select check_order, check_name, passed, result_data
from checks
order by check_order;

rollback;
