begin transaction read only;

-- Metadata-only CONTRACT verification for 202607280004 after the pending
-- contract SQL has been promoted and applied. No business rows are read.

with
target_functions(function_order, function_kind, function_identity) as (
  values
    (1, 'wrapper', 'public.create_book_plan_for_member(uuid,uuid,uuid,text,text,text,text,text,date,integer,integer,integer,integer[],text,text)'),
    (2, 'wrapper', 'public.create_reading_plan_for_member(uuid,uuid,uuid,text,text,integer,integer,integer[],date)'),
    (3, 'wrapper', 'public.complete_study_plan_with_reward_for_member(uuid,uuid,bigint,date)'),
    (4, 'v2_wrapper', 'public.reflow_book_plan_for_assignee(uuid,uuid,uuid,uuid,date)'),
    (5, 'v2_wrapper', 'public.add_book_plan_review_for_assignee(uuid,uuid,uuid,uuid,integer,text)'),
    (6, 'v2_wrapper', 'public.update_book_plan_pages_for_assignee(uuid,uuid,uuid,uuid,integer)'),
    (7, 'v2_wrapper', 'public.delete_book_plan_task_for_assignee(uuid,uuid,uuid,text)'),
    (8, 'academy_wrapper', 'public.create_academy_schedule_for_assignee(uuid,uuid,uuid,text,integer,time without time zone,text,integer)'),
    (9, 'academy_wrapper', 'public.update_academy_schedule_for_assignee(uuid,uuid,uuid,uuid,text,integer,time without time zone,text,integer)'),
    (10, 'academy_wrapper', 'public.delete_academy_schedule_for_assignee(uuid,uuid,uuid,uuid)'),
    (11, 'academy_wrapper', 'public.complete_academy_schedule_for_assignee(uuid,uuid,uuid,uuid,date)'),
    (12, 'legacy_browser', 'public.create_book_plan(text,text,text,text,text,date,integer,integer,integer,integer[],text,text)'),
    (13, 'legacy_browser', 'public.complete_study_plan_and_reschedule(bigint,date)'),
    (14, 'legacy_service', 'public.complete_academy_schedule(uuid,uuid,uuid,date)')
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
    has_table_privilege('anon', class.oid, 'SELECT') as anon_select,
    has_table_privilege('anon', class.oid, 'INSERT') as anon_insert,
    has_table_privilege('anon', class.oid, 'UPDATE') as anon_update,
    has_table_privilege('anon', class.oid, 'DELETE') as anon_delete,
    has_table_privilege('authenticated', class.oid, 'SELECT') as authenticated_select,
    has_table_privilege('authenticated', class.oid, 'INSERT') as authenticated_insert,
    has_table_privilege('authenticated', class.oid, 'UPDATE') as authenticated_update,
    has_table_privilege('authenticated', class.oid, 'DELETE') as authenticated_delete,
    has_table_privilege('service_role', class.oid, 'SELECT') as service_role_select,
    has_table_privilege('service_role', class.oid, 'INSERT') as service_role_insert,
    has_table_privilege('service_role', class.oid, 'UPDATE') as service_role_update,
    has_table_privilege('service_role', class.oid, 'DELETE') as service_role_delete
  from (
    values
      (1, 'study_plans'),
      (2, 'book_plans'),
      (3, 'academy_schedules')
  ) target(table_order, table_name)
  join pg_catalog.pg_class class
    on class.oid = to_regclass('public.' || target.table_name)
),
service_role_state as (
  select role.rolbypassrls
  from pg_catalog.pg_roles role
  where role.rolname = 'service_role'
),
checks(check_order, check_name, passed, result_data) as (
  select
    relation.table_order,
    relation.table_name || '_default_deny',
    relation.rls_enabled
      and not relation.rls_forced
      and relation.policy_count = 0
      and not (
        relation.anon_select or relation.anon_insert
        or relation.anon_update or relation.anon_delete
        or relation.authenticated_select or relation.authenticated_insert
        or relation.authenticated_update or relation.authenticated_delete
      ),
    to_jsonb(relation)
  from relation_state relation

  union all

  select
    4,
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
    4 + function.function_order,
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
)
select check_order, check_name, passed, result_data
from checks
order by check_order;

rollback;
