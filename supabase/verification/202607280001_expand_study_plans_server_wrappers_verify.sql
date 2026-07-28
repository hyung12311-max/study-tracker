begin transaction read only;

-- Metadata-only EXPAND verification. It proves the new application can use the
-- wrappers while the currently deployed application retains its legacy access.
-- No Study Plus business rows are read and no project function is invoked.

with
wrapper_functions(function_order, function_identity) as (
  values
    (1, 'public.create_book_plan_for_member(uuid,uuid,uuid,text,text,text,text,text,date,integer,integer,integer,integer[],text,text)'),
    (2, 'public.create_reading_plan_for_member(uuid,uuid,uuid,text,text,integer,integer,integer[],date)'),
    (3, 'public.reflow_book_plan_for_family(uuid,uuid,uuid,date)'),
    (4, 'public.add_book_plan_review_for_family(uuid,uuid,uuid,integer,text)'),
    (5, 'public.update_book_plan_pages_for_family(uuid,uuid,uuid,integer)'),
    (6, 'public.delete_book_plan_task_for_family(uuid,uuid,text)'),
    (7, 'public.complete_study_plan_with_reward_for_member(uuid,uuid,bigint,date)')
),
required_functions(
  function_order,
  function_kind,
  function_identity,
  browser_execute_expected
) as (
  values
    (1, 'legacy_browser', 'public.create_book_plan(text,text,text,text,text,date,integer,integer,integer,integer[],text,text)', true),
    (2, 'legacy_browser', 'public.complete_study_plan_and_reschedule(bigint,date)', true),
    (3, 'existing_service', 'public.complete_study_plan_with_reward(uuid,uuid,bigint,date)', false),
    (4, 'existing_service', 'public.create_reading_plan(uuid,uuid,text,text,integer,integer,integer[],date)', false)
),
wrapper_state as (
  select
    wrapper.*,
    procedure.oid,
    procedure.prosecdef,
    procedure.proconfig,
    owner.rolname as owner_name,
    case when procedure.oid is null then null else
      pg_get_functiondef(procedure.oid)
    end as function_definition,
    case when procedure.oid is null then false else
      has_function_privilege('service_role', procedure.oid, 'EXECUTE')
    end as service_execute,
    case when procedure.oid is null then null else
      has_function_privilege('anon', procedure.oid, 'EXECUTE')
    end as anon_execute,
    case when procedure.oid is null then null else
      has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
    end as authenticated_execute,
    case when procedure.oid is null then null else exists (
      select 1
      from aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) acl
      where acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    ) end as public_execute
  from wrapper_functions wrapper
  left join pg_catalog.pg_proc procedure
    on procedure.oid = to_regprocedure(wrapper.function_identity)
  left join pg_catalog.pg_roles owner
    on owner.oid = procedure.proowner
),
required_state as (
  select
    required.*,
    procedure.oid,
    procedure.prosecdef,
    procedure.proconfig,
    owner.rolname as owner_name,
    case when procedure.oid is null then false else
      has_function_privilege('service_role', procedure.oid, 'EXECUTE')
    end as service_execute,
    case when procedure.oid is null then false else
      has_function_privilege('anon', procedure.oid, 'EXECUTE')
    end as anon_execute,
    case when procedure.oid is null then false else
      has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
    end as authenticated_execute,
    case when procedure.oid is null then null else exists (
      select 1
      from aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) acl
      where acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    ) end as public_execute
  from required_functions required
  left join pg_catalog.pg_proc procedure
    on procedure.oid = to_regprocedure(required.function_identity)
  left join pg_catalog.pg_roles owner
    on owner.oid = procedure.proowner
),
relation_state as (
  select
    class.relrowsecurity as rls_enabled,
    class.relforcerowsecurity as rls_forced,
    has_table_privilege('anon', class.oid, 'SELECT') as anon_select,
    has_table_privilege('anon', class.oid, 'INSERT') as anon_insert,
    has_table_privilege('anon', class.oid, 'UPDATE') as anon_update,
    has_table_privilege('anon', class.oid, 'DELETE') as anon_delete,
    has_table_privilege('authenticated', class.oid, 'SELECT') as authenticated_select,
    has_table_privilege('authenticated', class.oid, 'INSERT') as authenticated_insert,
    has_table_privilege('authenticated', class.oid, 'UPDATE') as authenticated_update,
    has_table_privilege('authenticated', class.oid, 'DELETE') as authenticated_delete
  from pg_catalog.pg_class class
  where class.oid = 'public.study_plans'::regclass
),
checks(check_order, check_name, passed, result_data) as (
  select
    wrapper.function_order,
    'expand_wrapper_' || wrapper.function_order,
    wrapper.oid is not null
      and wrapper.prosecdef
      and wrapper.proconfig @> array['search_path=pg_catalog, public']
      and wrapper.owner_name = 'postgres'
      and wrapper.service_execute
      and not wrapper.anon_execute
      and not wrapper.authenticated_execute
      and not wrapper.public_execute
      and position('public.reflow_book_plan(' in wrapper.function_definition) = 0
      and position('public.add_book_plan_review(' in wrapper.function_definition) = 0
      and position('public.update_book_plan_pages(' in wrapper.function_definition) = 0
      and position('public.delete_book_plan_task(' in wrapper.function_definition) = 0,
    jsonb_build_object(
      'function_identity', wrapper.function_identity,
      'exists', wrapper.oid is not null,
      'security_definer', wrapper.prosecdef,
      'search_path', wrapper.proconfig,
      'owner', wrapper.owner_name,
      'service_role_execute', wrapper.service_execute,
      'anon_execute', wrapper.anon_execute,
      'authenticated_execute', wrapper.authenticated_execute,
      'public_execute', wrapper.public_execute,
      'missing_legacy_dependency_free', (
        position('public.reflow_book_plan(' in wrapper.function_definition) = 0
        and position('public.add_book_plan_review(' in wrapper.function_definition) = 0
        and position('public.update_book_plan_pages(' in wrapper.function_definition) = 0
        and position('public.delete_book_plan_task(' in wrapper.function_definition) = 0
      )
    )
  from wrapper_state wrapper

  union all

  select
    7 + required.function_order,
    'required_function_' || required.function_order,
    required.oid is not null
      and required.prosecdef
      and required.proconfig @> array['search_path=public']
      and required.owner_name = 'postgres'
      and required.service_execute
      and required.anon_execute = required.browser_execute_expected
      and required.authenticated_execute = required.browser_execute_expected
      and not required.public_execute,
    jsonb_build_object(
      'function_identity', required.function_identity,
      'function_kind', required.function_kind,
      'exists', required.oid is not null,
      'security_definer', required.prosecdef,
      'search_path', required.proconfig,
      'owner', required.owner_name,
      'service_role_execute', required.service_execute,
      'browser_execute_expected', required.browser_execute_expected,
      'anon_execute', required.anon_execute,
      'authenticated_execute', required.authenticated_execute,
      'public_execute', required.public_execute
    )
  from required_state required

  union all

  select
    12,
    'legacy_table_access_unchanged_during_expand',
    not relation.rls_enabled
      and not relation.rls_forced
      and relation.anon_select
      and relation.anon_insert
      and relation.anon_update
      and relation.anon_delete
      and relation.authenticated_select
      and relation.authenticated_insert
      and relation.authenticated_update
      and relation.authenticated_delete,
    jsonb_build_object(
      'rls_enabled', relation.rls_enabled,
      'rls_forced', relation.rls_forced,
      'anon_crud_retained', (
        relation.anon_select and relation.anon_insert
        and relation.anon_update and relation.anon_delete
      ),
      'authenticated_crud_retained', (
        relation.authenticated_select and relation.authenticated_insert
        and relation.authenticated_update and relation.authenticated_delete
      ),
      'contract_not_yet_applied', true
    )
  from relation_state relation
)
select
  check_order,
  check_name,
  passed,
  result_data
from checks
order by check_order;

rollback;
