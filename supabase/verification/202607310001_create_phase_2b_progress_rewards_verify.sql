begin transaction read only;

-- Phase 2B-3A immediate post-migration verification.
-- Metadata and aggregate counts only; no business rows are returned.

with
relation_state as (
  select
    class.oid is not null as exists,
    owner.rolname as owner_name,
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
      where acl.grantee = 0
    ) as public_privilege_count,
    (
      select count(*)
      from aclexplode(coalesce(class.relacl, acldefault('r', class.relowner))) acl
      join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
      where grantee.rolname in ('anon', 'authenticated')
    ) as browser_privilege_count,
    has_table_privilege('service_role', class.oid, 'SELECT')
      as service_role_select,
    not has_table_privilege(
      'service_role',
      class.oid,
      'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN'
    ) as service_role_mutation_absent
  from pg_catalog.pg_class class
  join pg_catalog.pg_roles owner on owner.oid = class.relowner
  where class.oid = to_regclass('public.learning_stage_first_passes')
),
required_constraints(constraint_name, constraint_type) as (
  values
    ('learning_stage_first_passes_pkey', 'p'),
    ('learning_stage_first_passes_assigned_member_fk', 'f'),
    ('learning_stage_first_passes_assignment_scope_fk', 'f'),
    ('learning_stage_first_passes_stage_version_fk', 'f'),
    ('learning_stage_first_passes_attempt_scope_fk', 'f'),
    ('learning_stage_first_passes_reward_transaction_fk', 'f'),
    ('learning_stage_first_passes_assignment_stage_key', 'u'),
    ('learning_stage_first_passes_attempt_key', 'u'),
    ('learning_stage_first_passes_reward_transaction_key', 'u'),
    ('learning_stage_first_passes_reward_check', 'c'),
    ('learning_stage_first_passes_timestamp_check', 'c')
),
constraint_state as (
  select
    required.*,
    constraint_row.oid is not null as exists,
    constraint_row.convalidated as validated,
    pg_get_constraintdef(constraint_row.oid) as definition
  from required_constraints required
  left join pg_catalog.pg_constraint constraint_row
    on constraint_row.conrelid =
      to_regclass('public.learning_stage_first_passes')
   and constraint_row.conname = required.constraint_name
   and constraint_row.contype = required.constraint_type::"char"
),
trigger_state as (
  select
    trigger_row.oid is not null as exists,
    trigger_row.tgenabled = 'O' as enabled,
    trigger_row.tgtype as trigger_type,
    pg_get_triggerdef(trigger_row.oid) as definition
  from pg_catalog.pg_trigger trigger_row
  where trigger_row.tgrelid =
      to_regclass('public.learning_stage_first_passes')
    and trigger_row.tgname = 'learning_stage_first_passes_guard_change'
    and not trigger_row.tgisinternal
),
function_state as (
  select
    procedure.oid is not null as exists,
    owner.rolname as owner_name,
    procedure.prosecdef,
    procedure.proconfig,
    pg_get_function_result(procedure.oid) as result_type,
    pg_get_functiondef(procedure.oid) as definition,
    has_function_privilege('service_role', procedure.oid, 'EXECUTE')
      as service_role_execute,
    has_function_privilege('anon', procedure.oid, 'EXECUTE')
      as anon_execute,
    has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      as authenticated_execute,
    exists (
      select 1
      from aclexplode(
        coalesce(procedure.proacl, acldefault('f', procedure.proowner))
      ) acl
      where acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    ) as public_execute
  from pg_catalog.pg_proc procedure
  join pg_catalog.pg_roles owner on owner.oid = procedure.proowner
  where procedure.oid = to_regprocedure(
    'public.finalize_learning_stage_attempt(uuid,uuid,uuid)'
  )
),
helper_state as (
  select
    procedure.oid is not null as exists,
    owner.rolname as owner_name,
    not has_function_privilege('service_role', procedure.oid, 'EXECUTE')
      and not has_function_privilege('anon', procedure.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      and not exists (
        select 1
        from aclexplode(
          coalesce(procedure.proacl, acldefault('f', procedure.proowner))
        ) acl
        where acl.grantee = 0
          and acl.privilege_type = 'EXECUTE'
      ) as direct_execute_absent
  from pg_catalog.pg_proc procedure
  join pg_catalog.pg_roles owner on owner.oid = procedure.proowner
  where procedure.oid = to_regprocedure(
    'public.guard_learning_stage_first_pass_immutable()'
  )
),
publication_state as (
  select count(*) as publication_count
  from pg_catalog.pg_publication_tables publication
  where publication.schemaname = 'public'
    and publication.tablename = 'learning_stage_first_passes'
),
empty_state as (
  select
    (select count(*) from public.learning_stage_first_passes)
      as first_passes,
    (
      select count(*)
      from public.sticker_transactions transaction_row
      where transaction_row.source_type = 'learning_stage_first_pass'
    ) as reward_transactions
),
prerequisite_state as (
  select count(*) filter (where class.oid is not null) = 11
    as all_objects_present
  from (
    values
      ('sticker_transactions'),
      ('learning_assignments'),
      ('learning_stage_progress'),
      ('learning_stages'),
      ('learning_attempts'),
      ('learning_attempt_questions'),
      ('learning_attempt_answers'),
      ('learning_courses'),
      ('learning_units'),
      ('learning_content_versions'),
      ('learning_question_options')
  ) target(table_name)
  left join pg_catalog.pg_class class
    on class.oid = to_regclass('public.' || target.table_name)
),
checks(check_order, check_name, passed, result_data) as (
  select
    1,
    'first_pass_table_security_contract',
    relation.exists
      and relation.owner_name = 'postgres'
      and relation.rls_enabled
      and relation.rls_forced
      and relation.policy_count = 0
      and relation.public_privilege_count = 0
      and relation.browser_privilege_count = 0
      and relation.service_role_select
      and relation.service_role_mutation_absent,
    to_jsonb(relation)
  from relation_state relation

  union all

  select
    2,
    'first_pass_constraints_present_and_valid',
    count(*) = 11 and bool_and(constraint_row.exists and constraint_row.validated),
    jsonb_build_object(
      'required_count', count(*),
      'missing', coalesce(
        jsonb_agg(to_jsonb(constraint_row))
          filter (where not constraint_row.exists or not constraint_row.validated),
        '[]'::jsonb
      )
    )
  from constraint_state constraint_row

  union all

  select
    3,
    'first_pass_scope_and_reward_constraints',
    bool_and(
      case constraint_row.constraint_name
        when 'learning_stage_first_passes_assignment_scope_fk' then
          lower(constraint_row.definition) like
            '%foreign key (assignment_id, family_id, assigned_member_id, content_version_id)%'
        when 'learning_stage_first_passes_attempt_scope_fk' then
          lower(constraint_row.definition) like
            '%foreign key (attempt_id, family_id, assigned_member_id, assignment_id, stage_id)%'
        when 'learning_stage_first_passes_assignment_stage_key' then
          lower(constraint_row.definition) = 'unique (assignment_id, stage_id)'
        when 'learning_stage_first_passes_reward_check' then
          lower(constraint_row.definition) like '%difficulty%seed%reward_amount = 1%'
          and lower(constraint_row.definition) like '%difficulty%leaf%reward_amount = 2%'
          and lower(constraint_row.definition) like '%difficulty%tree%reward_amount = 3%'
          and lower(constraint_row.definition) like '%difficulty%crown%reward_amount = 5%'
        else true
      end
    ),
    jsonb_build_object('constraints', jsonb_agg(to_jsonb(constraint_row)))
  from constraint_state constraint_row

  union all

  select
    4,
    'first_pass_immutability_trigger',
    count(*) = 1
      and bool_and(trigger_row.exists and trigger_row.enabled)
      and bool_and((trigger_row.trigger_type & 2) = 2)
      and bool_and((trigger_row.trigger_type & 8) = 8)
      and bool_and((trigger_row.trigger_type & 16) = 16),
    coalesce(jsonb_agg(to_jsonb(trigger_row)), '[]'::jsonb)
  from trigger_state trigger_row

  union all

  select
    5,
    'finalize_function_security_and_return_contract',
    function_row.exists
      and function_row.owner_name = 'postgres'
      and function_row.prosecdef
      and function_row.proconfig @> array['search_path=pg_catalog, public']
      and function_row.service_role_execute
      and not function_row.anon_execute
      and not function_row.authenticated_execute
      and not function_row.public_execute
      and lower(function_row.result_type) like '%first_pass boolean%'
      and lower(function_row.result_type) like '%reward_granted boolean%'
      and lower(function_row.result_type) like '%reward_amount integer%'
      and lower(function_row.result_type) like '%unlocked_stage_id uuid%'
      and lower(function_row.result_type) like '%assignment_completed boolean%',
    to_jsonb(function_row) - 'definition'
  from function_state function_row

  union all

  select
    6,
    'finalize_atomic_progress_reward_contract',
    lower(function_row.definition) like '%for update%'
      and lower(function_row.definition) like
        '%insert into public.learning_stage_first_passes%'
      and lower(function_row.definition) like
        '%on conflict (assignment_id, stage_id) do nothing%'
      and lower(function_row.definition) like
        '%insert into public.sticker_transactions%'
      and lower(function_row.definition) like
        '%source_type%learning_stage_first_pass%'
      and lower(function_row.definition) like
        '%update public.learning_stage_progress%status = ''passed''%'
      and lower(function_row.definition) like
        '%update public.learning_assignments%status = ''completed''%'
      and lower(function_row.definition) like
        '%when ''seed'' then 1%when ''leaf'' then 2%when ''tree'' then 3%when ''crown'' then 5%',
    jsonb_build_object('contract_present', true)
  from function_state function_row

  union all

  select
    7,
    'immutability_helper_not_directly_executable',
    helper.exists
      and helper.owner_name = 'postgres'
      and helper.direct_execute_absent,
    to_jsonb(helper)
  from helper_state helper

  union all

  select
    8,
    'first_pass_not_in_realtime_publication',
    publication.publication_count = 0,
    to_jsonb(publication)
  from publication_state publication

  union all

  select
    9,
    'migration_created_empty_progress_reward_state',
    empty.first_passes = 0 and empty.reward_transactions = 0,
    to_jsonb(empty)
  from empty_state empty

  union all

  select
    10,
    'foundation_attempt_and_ledger_objects_preserved',
    prerequisite.all_objects_present,
    to_jsonb(prerequisite)
  from prerequisite_state prerequisite
)
select check_order, check_name, passed, result_data
from checks

union all

select
  999,
  'phase_2b_3a_verification_summary',
  bool_and(passed),
  jsonb_build_object(
    'total_checks', count(*),
    'passed_checks', count(*) filter (where passed),
    'failed_checks', count(*) filter (where not passed)
  )
from checks
order by check_order;

rollback;
