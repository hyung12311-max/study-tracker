begin transaction read only;

with expected_functions(function_order, identity, expected_result) as (
  values
    (1, 'public.reflow_book_plan_for_assignee(uuid,uuid,uuid,uuid,date)', 'integer'),
    (2, 'public.add_book_plan_review_for_assignee(uuid,uuid,uuid,uuid,integer,text)', 'text'),
    (3, 'public.update_book_plan_pages_for_assignee(uuid,uuid,uuid,uuid,integer)', 'void'),
    (4, 'public.delete_book_plan_task_for_assignee(uuid,uuid,uuid,text)', 'void')
),
function_checks as (
  select
    expected.function_order,
    expected.identity,
    procedure.oid is not null as exists,
    coalesce(procedure.prosecdef, false) as security_definer,
    coalesce(procedure.proowner = 'postgres'::regrole, false) as owner_postgres,
    coalesce(procedure.proconfig @> array['search_path=pg_catalog, public'], false) as fixed_search_path,
    coalesce(pg_catalog.pg_get_function_result(procedure.oid) = expected.expected_result, false) as return_type_matches,
    coalesce(has_function_privilege('service_role', procedure.oid, 'EXECUTE'), false) as service_role_execute,
    coalesce(exists (
      select 1
      from aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) acl
      where acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    ), false) as public_execute,
    coalesce(has_function_privilege('anon', procedure.oid, 'EXECUTE'), false) as anon_execute,
    coalesce(has_function_privilege('authenticated', procedure.oid, 'EXECUTE'), false) as authenticated_execute
  from expected_functions expected
  left join pg_catalog.pg_proc procedure
    on procedure.oid = to_regprocedure(expected.identity)
),
results(check_order, check_name, passed, result_data) as (
  select
    1,
    'v2_wrapper_presence_and_signatures',
    count(*) = 4 and bool_and(exists and return_type_matches),
    jsonb_agg(
      jsonb_build_object(
        'identity', identity,
        'exists', exists,
        'return_type_matches', return_type_matches
      )
      order by function_order
    )
  from function_checks

  union all

  select
    2,
    'v2_wrapper_security_contract',
    count(*) = 4
      and bool_and(
        security_definer
        and owner_postgres
        and fixed_search_path
        and service_role_execute
        and not public_execute
        and not anon_execute
        and not authenticated_execute
      ),
    jsonb_agg(
      jsonb_build_object(
        'identity', identity,
        'security_definer', security_definer,
        'owner_postgres', owner_postgres,
        'fixed_search_path', fixed_search_path,
        'service_role_execute', service_role_execute,
        'public_execute', public_execute,
        'anon_execute', anon_execute,
        'authenticated_execute', authenticated_execute
      )
      order by function_order
    )
  from function_checks

  union all

  select
    3,
    'v1_wrappers_retained',
    bool_and(to_regprocedure(identity) is not null),
    jsonb_agg(jsonb_build_object('identity', identity, 'exists', to_regprocedure(identity) is not null))
  from unnest(array[
    'public.reflow_book_plan_for_family(uuid,uuid,uuid,date)',
    'public.add_book_plan_review_for_family(uuid,uuid,uuid,integer,text)',
    'public.update_book_plan_pages_for_family(uuid,uuid,uuid,integer)',
    'public.delete_book_plan_task_for_family(uuid,uuid,text)'
  ]) identity

  union all

  select
    4,
    'expand_keeps_legacy_table_state',
    not (
      select class.relforcerowsecurity
      from pg_catalog.pg_class class
      where class.oid = 'public.book_plans'::regclass
    )
      and has_table_privilege('anon', 'public.book_plans', 'SELECT')
      and has_table_privilege('authenticated', 'public.book_plans', 'SELECT'),
    jsonb_build_object(
      'book_plans_rls_enabled', (
        select class.relrowsecurity
        from pg_catalog.pg_class class
        where class.oid = 'public.book_plans'::regclass
      ),
      'anon_select', has_table_privilege('anon', 'public.book_plans', 'SELECT'),
      'authenticated_select', has_table_privilege('authenticated', 'public.book_plans', 'SELECT')
    )

  union all

  select
    5,
    'legacy_book_policy_retained',
    exists (
      select 1
      from pg_catalog.pg_policy policy
      where policy.polrelid = 'public.book_plans'::regclass
        and policy.polname = 'book_plans_existing_app_access'
    ),
    jsonb_build_object(
      'policy_name', 'book_plans_existing_app_access',
      'exists', exists (
        select 1
        from pg_catalog.pg_policy policy
        where policy.polrelid = 'public.book_plans'::regclass
          and policy.polname = 'book_plans_existing_app_access'
      )
    )
)
select check_order, check_name, passed, result_data
from results
order by check_order;

rollback;
