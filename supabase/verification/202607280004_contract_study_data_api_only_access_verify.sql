begin transaction read only;

-- Metadata-only CONTRACT verification for 202607280004 after the pending
-- contract SQL has been promoted and applied. No business rows are read.

with
target_functions(function_order, function_kind, function_identity) as (
  values
    (1, 'wrapper', 'public.create_book_plan_for_member(uuid,uuid,uuid,text,text,text,text,text,date,integer,integer,integer,integer[],text,text)'),
    (2, 'wrapper', 'public.create_reading_plan_for_member(uuid,uuid,uuid,text,text,integer,integer,integer[],date)'),
    (3, 'wrapper', 'public.complete_study_plan_with_reward_for_member(uuid,uuid,bigint,date)'),
    (4, 'v1_wrapper', 'public.reflow_book_plan_for_family(uuid,uuid,uuid,date)'),
    (5, 'v1_wrapper', 'public.add_book_plan_review_for_family(uuid,uuid,uuid,integer,text)'),
    (6, 'v1_wrapper', 'public.update_book_plan_pages_for_family(uuid,uuid,uuid,integer)'),
    (7, 'v1_wrapper', 'public.delete_book_plan_task_for_family(uuid,uuid,text)'),
    (8, 'v2_wrapper', 'public.reflow_book_plan_for_assignee(uuid,uuid,uuid,uuid,date)'),
    (9, 'v2_wrapper', 'public.add_book_plan_review_for_assignee(uuid,uuid,uuid,uuid,integer,text)'),
    (10, 'v2_wrapper', 'public.update_book_plan_pages_for_assignee(uuid,uuid,uuid,uuid,integer)'),
    (11, 'v2_wrapper', 'public.delete_book_plan_task_for_assignee(uuid,uuid,uuid,text)'),
    (12, 'academy_wrapper', 'public.create_academy_schedule_for_assignee(uuid,uuid,uuid,text,integer,time without time zone,text,integer)'),
    (13, 'academy_wrapper', 'public.update_academy_schedule_for_assignee(uuid,uuid,uuid,uuid,text,integer,time without time zone,text,integer)'),
    (14, 'academy_wrapper', 'public.delete_academy_schedule_for_assignee(uuid,uuid,uuid,uuid)'),
    (15, 'academy_wrapper', 'public.complete_academy_schedule_for_assignee(uuid,uuid,uuid,uuid,date)'),
    (16, 'legacy_browser', 'public.create_book_plan(text,text,text,text,text,date,integer,integer,integer,integer[],text,text)'),
    (17, 'legacy_browser', 'public.complete_study_plan_and_reschedule(bigint,date)'),
    (18, 'legacy_service', 'public.complete_academy_schedule(uuid,uuid,uuid,date)')
),
function_state as (
  select
    target.*,
    procedure.oid as function_oid,
    procedure.prosecdef as security_definer,
    procedure.proconfig as function_config,
    owner.rolname as owner_name,
    case when procedure.oid is null then false else
      has_function_privilege('service_role', procedure.oid, 'EXECUTE')
    end as service_role_execute,
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
  from target_functions target
  left join pg_catalog.pg_proc procedure
    on procedure.oid = to_regprocedure(target.function_identity)
  left join pg_catalog.pg_roles owner
    on owner.oid = procedure.proowner
),
relation_state as (
  select
    target.table_order,
    target.table_name,
    class.relrowsecurity as rls_enabled,
    class.relforcerowsecurity as rls_forced,
    (
      select count(*)
      from pg_catalog.pg_policy policy
      where policy.polrelid = class.oid
    ) as policy_count,
    (
      select count(*)
      from aclexplode(coalesce(class.relacl, acldefault('r', class.relowner))) acl
      join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
      where grantee.rolname in ('anon', 'authenticated')
    ) as browser_privilege_count,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'role', grantee.rolname,
            'privilege', acl.privilege_type,
            'grantable', acl.is_grantable
          )
          order by grantee.rolname, acl.privilege_type
        ),
        '[]'::jsonb
      )
      from aclexplode(coalesce(class.relacl, acldefault('r', class.relowner))) acl
      join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
      where grantee.rolname in ('anon', 'authenticated')
    ) as browser_privileges,
    (
      select count(*)
      from aclexplode(coalesce(class.relacl, acldefault('r', class.relowner))) acl
      where acl.grantee = 0
    ) as public_privilege_count,
    has_table_privilege('service_role', class.oid, 'SELECT') as service_role_select,
    has_table_privilege('service_role', class.oid, 'INSERT') as service_role_insert,
    has_table_privilege('service_role', class.oid, 'UPDATE') as service_role_update,
    has_table_privilege('service_role', class.oid, 'DELETE') as service_role_delete
  from (
    values
      (1, 'study_plans'),
      (2, 'book_plans'),
      (3, 'academy_schedules'),
      (4, 'academy_completion_history')
  ) target(table_order, table_name)
  join pg_catalog.pg_class class
    on class.oid = to_regclass('public.' || target.table_name)
),
service_role_state as (
  select role.rolbypassrls
  from pg_catalog.pg_roles role
  where role.rolname = 'service_role'
),
publication_state as (
  select
    count(*) filter (
      where publication.schemaname = 'public'
        and publication.tablename = 'academy_completion_history'
    ) as academy_completion_publication_count
  from pg_catalog.pg_publication_tables publication
),
checks(check_order, check_name, passed, result_data) as (
  select
    relation.table_order,
    relation.table_name || '_default_deny',
    relation.rls_enabled
      and not relation.rls_forced
      and relation.policy_count = 0
      and relation.browser_privilege_count = 0
      and relation.public_privilege_count = 0,
    to_jsonb(relation)
  from relation_state relation

  union all

  select
    5,
    'service_role_server_crud_retained',
    bool_and(
      relation.service_role_select
      and relation.service_role_insert
      and relation.service_role_update
      and relation.service_role_delete
    ) and service_role.rolbypassrls,
    jsonb_build_object(
      'relations', jsonb_agg(to_jsonb(relation) order by relation.table_order),
      'bypass_rls', service_role.rolbypassrls
    )
  from relation_state relation
  cross join service_role_state service_role
  group by service_role.rolbypassrls

  union all

  select
    5 + function.function_order,
    function.function_kind || '_function_' || function.function_order,
    function.function_oid is not null
      and function.security_definer
      and function.owner_name = 'postgres'
      and (
        function.function_config @> array['search_path=pg_catalog, public']
        or function.function_config @> array['search_path=public']
      )
      and function.service_role_execute
      and not function.anon_execute
      and not function.authenticated_execute
      and not function.public_execute,
    jsonb_build_object(
      'function_identity', function.function_identity,
      'function_kind', function.function_kind,
      'exists', function.function_oid is not null,
      'security_definer', function.security_definer,
      'owner', function.owner_name,
      'search_path', function.function_config,
      'service_role_execute', function.service_role_execute,
      'anon_execute', function.anon_execute,
      'authenticated_execute', function.authenticated_execute,
      'public_execute', function.public_execute
    )
  from function_state function

  union all

  select
    24,
    'academy_completion_realtime_publication_unchanged',
    publication.academy_completion_publication_count = 0,
    to_jsonb(publication)
  from publication_state publication
)
select check_order, check_name, passed, result_data
from checks

union all

select
  999,
  'contract_verification_summary',
  bool_and(passed),
  jsonb_build_object(
    'total_checks', count(*),
    'passed_checks', count(*) filter (where passed),
    'failed_checks', count(*) filter (where not passed)
  )
from checks
order by check_order;

rollback;
