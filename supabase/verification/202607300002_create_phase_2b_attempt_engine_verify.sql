begin transaction read only;

-- Phase 2B-2A immediate post-migration verification.
-- One metadata-only result set plus empty-table counts.

with
target_tables(table_order, table_name) as (
  values
    (1, 'learning_attempts'),
    (2, 'learning_attempt_questions'),
    (3, 'learning_attempt_answers')
),
relation_state as (
  select
    target.*,
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
      from aclexplode(
        coalesce(class.relacl, acldefault('r', class.relowner))
      ) acl
      where acl.grantee = 0
    ) as public_privilege_count,
    (
      select count(*)
      from aclexplode(
        coalesce(class.relacl, acldefault('r', class.relowner))
      ) acl
      join pg_catalog.pg_roles grantee
        on grantee.oid = acl.grantee
      where grantee.rolname in ('anon', 'authenticated')
    ) as browser_privilege_count,
    case when class.oid is null then false else
      has_table_privilege('service_role', class.oid, 'SELECT')
    end as service_role_select,
    case when class.oid is null then false else
      not has_table_privilege(
        'service_role',
        class.oid,
        'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN'
      )
    end as service_role_mutation_absent
  from target_tables target
  left join pg_catalog.pg_class class
    on class.oid = to_regclass('public.' || target.table_name)
  left join pg_catalog.pg_roles owner
    on owner.oid = class.relowner
),
required_constraints(table_name, constraint_name, type) as (
  values
    ('learning_attempts', 'learning_attempts_pkey', 'p'),
    ('learning_attempts', 'learning_attempts_assigned_member_fk', 'f'),
    ('learning_attempts', 'learning_attempts_assignment_scope_fk', 'f'),
    ('learning_attempts', 'learning_attempts_stage_version_fk', 'f'),
    ('learning_attempts', 'learning_attempts_progress_fk', 'f'),
    ('learning_attempts', 'learning_attempts_abandoned_by_fk', 'f'),
    ('learning_attempts', 'learning_attempts_scope_key', 'u'),
    ('learning_attempts', 'learning_attempts_assignment_stage_no_key', 'u'),
    ('learning_attempts', 'learning_attempts_member_request_key', 'u'),
    ('learning_attempts', 'learning_attempts_status_check', 'c'),
    ('learning_attempts', 'learning_attempts_counts_check', 'c'),
    ('learning_attempts', 'learning_attempts_terminal_check', 'c'),
    ('learning_attempt_questions', 'learning_attempt_questions_pkey', 'p'),
    ('learning_attempt_questions', 'learning_attempt_questions_attempt_fk', 'f'),
    ('learning_attempt_questions', 'learning_attempt_questions_source_fk', 'f'),
    ('learning_attempt_questions', 'learning_attempt_questions_attempt_order_key', 'u'),
    ('learning_attempt_questions', 'learning_attempt_questions_attempt_source_key', 'u'),
    ('learning_attempt_questions', 'learning_attempt_questions_id_attempt_key', 'u'),
    ('learning_attempt_questions', 'learning_attempt_questions_options_check', 'c'),
    ('learning_attempt_answers', 'learning_attempt_answers_pkey', 'p'),
    ('learning_attempt_answers', 'learning_attempt_answers_attempt_fk', 'f'),
    ('learning_attempt_answers', 'learning_attempt_answers_question_attempt_fk', 'f'),
    ('learning_attempt_answers', 'learning_attempt_answers_question_key', 'u'),
    ('learning_attempt_answers', 'learning_attempt_answers_request_key', 'u')
),
constraint_state as (
  select
    required.*,
    constraint_row.oid is not null as exists,
    constraint_row.convalidated as validated
  from required_constraints required
  left join pg_catalog.pg_constraint constraint_row
    on constraint_row.conrelid = to_regclass('public.' || required.table_name)
   and constraint_row.conname = required.constraint_name
   and constraint_row.contype = required.type::"char"
),
required_indexes(table_name, index_name, unique_required, predicate_text) as (
  values
    (
      'learning_attempts',
      'learning_attempts_active_stage_uidx',
      true,
      'status = ''in_progress'''
    ),
    (
      'learning_attempts',
      'learning_attempts_member_status_idx',
      false,
      null
    ),
    (
      'learning_attempts',
      'learning_attempts_assignment_stage_idx',
      false,
      null
    ),
    (
      'learning_attempt_questions',
      'learning_attempt_questions_attempt_order_idx',
      false,
      null
    ),
    (
      'learning_attempt_answers',
      'learning_attempt_answers_attempt_submitted_idx',
      false,
      null
    )
),
index_state as (
  select
    required.*,
    index_row.indexrelid is not null as exists,
    index_row.indisunique,
    pg_get_expr(index_row.indpred, index_row.indrelid) as predicate
  from required_indexes required
  left join pg_catalog.pg_class index_class
    on index_class.oid = to_regclass('public.' || required.index_name)
  left join pg_catalog.pg_index index_row
    on index_row.indexrelid = index_class.oid
   and index_row.indrelid = to_regclass('public.' || required.table_name)
),
required_triggers(table_name, trigger_name) as (
  values
    ('learning_attempts', 'learning_attempts_guard_change'),
    (
      'learning_attempt_questions',
      'learning_attempt_questions_validate_snapshot'
    ),
    (
      'learning_attempt_questions',
      'learning_attempt_questions_guard_change'
    ),
    ('learning_attempt_answers', 'learning_attempt_answers_guard_change')
),
trigger_state as (
  select
    required.*,
    trigger_row.oid is not null as exists,
    trigger_row.tgenabled as enabled
  from required_triggers required
  left join pg_catalog.pg_trigger trigger_row
    on trigger_row.tgrelid = to_regclass('public.' || required.table_name)
   and trigger_row.tgname = required.trigger_name
   and not trigger_row.tgisinternal
),
target_functions(function_identity, service_execute, security_definer) as (
  values
    (
      'public.start_or_resume_learning_attempt(uuid,uuid,uuid,uuid,uuid,uuid)',
      true,
      true
    ),
    (
      'public.submit_learning_attempt_answer(uuid,uuid,uuid,uuid,uuid)',
      true,
      true
    ),
    (
      'public.finalize_learning_stage_attempt(uuid,uuid,uuid)',
      true,
      true
    ),
    (
      'public.abandon_learning_attempt(uuid,uuid,uuid,uuid,uuid)',
      true,
      true
    ),
    ('public.guard_learning_attempt_change()', false, false),
    (
      'public.validate_learning_attempt_question_snapshot()',
      false,
      false
    ),
    ('public.guard_learning_attempt_child_immutable()', false, false)
),
function_state as (
  select
    target.*,
    procedure.oid is not null as exists,
    owner.rolname as owner_name,
    procedure.prosecdef,
    procedure.proconfig,
    case when procedure.oid is null then false else
      has_function_privilege('service_role', procedure.oid, 'EXECUTE')
    end as service_role_execute,
    case when procedure.oid is null then false else
      has_function_privilege('anon', procedure.oid, 'EXECUTE')
    end as anon_execute,
    case when procedure.oid is null then false else
      has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
    end as authenticated_execute,
    case when procedure.oid is null then false else exists (
      select 1
      from aclexplode(
        coalesce(procedure.proacl, acldefault('f', procedure.proowner))
      ) acl
      where acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    ) end as public_execute
  from target_functions target
  left join pg_catalog.pg_proc procedure
    on procedure.oid = to_regprocedure(target.function_identity)
  left join pg_catalog.pg_roles owner
    on owner.oid = procedure.proowner
),
cancel_function_state as (
  select
    procedure.oid is not null as exists,
    owner.rolname as owner_name,
    procedure.prosecdef,
    procedure.proconfig,
    has_function_privilege('service_role', procedure.oid, 'EXECUTE')
      as service_role_execute,
    not has_function_privilege('anon', procedure.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      as browser_execute_absent,
    position(
      'update public.learning_attempts'
      in lower(pg_get_functiondef(procedure.oid))
    ) > 0 as abandons_active_attempt
  from pg_catalog.pg_proc procedure
  join pg_catalog.pg_roles owner
    on owner.oid = procedure.proowner
  where procedure.oid = to_regprocedure(
    'public.cancel_learning_assignment(uuid,uuid,uuid,uuid)'
  )
),
publication_state as (
  select count(*) as publication_count
  from pg_catalog.pg_publication_tables publication
  join target_tables target
    on target.table_name = publication.tablename
  where publication.schemaname = 'public'
),
empty_state as (
  select
    (select count(*) from public.learning_attempts) as attempts,
    (
      select count(*)
      from public.learning_attempt_questions
    ) as questions,
    (select count(*) from public.learning_attempt_answers) as answers
),
foundation_state as (
  select
    count(*) filter (
      where class.oid is not null
    ) = 8 as all_eight_tables_present,
    to_regclass('public.sticker_transactions') is not null
      as sticker_transactions_present
  from (
    values
      ('learning_courses'),
      ('learning_units'),
      ('learning_content_versions'),
      ('learning_stages'),
      ('learning_questions'),
      ('learning_question_options'),
      ('learning_assignments'),
      ('learning_stage_progress')
  ) target(table_name)
  left join pg_catalog.pg_class class
    on class.oid = to_regclass('public.' || target.table_name)
),
checks(check_order, check_name, passed, result_data) as (
  select
    relation.table_order,
    relation.table_name || '_security_contract',
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
    10,
    'required_constraints_present_and_valid',
    bool_and(constraint_row.exists and constraint_row.validated),
    jsonb_build_object(
      'required_count',
      count(*),
      'missing',
      coalesce(
        jsonb_agg(to_jsonb(constraint_row))
          filter (
            where not constraint_row.exists
               or not constraint_row.validated
          ),
        '[]'::jsonb
      )
    )
  from constraint_state constraint_row

  union all

  select
    11,
    'required_indexes_present',
    bool_and(
      index_row.exists
      and (
        not index_row.unique_required
        or index_row.indisunique
      )
      and (
        index_row.predicate_text is null
        or replace(
          replace(lower(coalesce(index_row.predicate, '')), '(', ''),
          ')',
          ''
        ) like '%' || index_row.predicate_text || '%'
      )
    ),
    jsonb_build_object('indexes', jsonb_agg(to_jsonb(index_row)))
  from index_state index_row

  union all

  select
    12,
    'immutability_and_snapshot_triggers_enabled',
    bool_and(trigger_row.exists and trigger_row.enabled = 'O'),
    jsonb_build_object('triggers', jsonb_agg(to_jsonb(trigger_row)))
  from trigger_state trigger_row

  union all

  select
    13,
    'function_security_contract',
    bool_and(
      function_row.exists
      and function_row.owner_name = 'postgres'
      and function_row.prosecdef = function_row.security_definer
      and (
        not function_row.security_definer
        or function_row.proconfig
          @> array['search_path=pg_catalog, public']
      )
      and function_row.service_role_execute = function_row.service_execute
      and not function_row.anon_execute
      and not function_row.authenticated_execute
      and not function_row.public_execute
    ),
    jsonb_build_object('functions', jsonb_agg(to_jsonb(function_row)))
  from function_state function_row

  union all

  select
    14,
    'assignment_cancel_abandons_active_attempt',
    cancel_state.exists
      and cancel_state.owner_name = 'postgres'
      and cancel_state.prosecdef
      and cancel_state.proconfig
        @> array['search_path=pg_catalog, public']
      and cancel_state.service_role_execute
      and cancel_state.browser_execute_absent
      and cancel_state.abandons_active_attempt,
    to_jsonb(cancel_state)
  from cancel_function_state cancel_state

  union all

  select
    15,
    'attempt_tables_not_in_realtime_publication',
    publication.publication_count = 0,
    to_jsonb(publication)
  from publication_state publication

  union all

  select
    16,
    'migration_created_empty_attempt_engine',
    empty.attempts = 0
      and empty.questions = 0
      and empty.answers = 0,
    to_jsonb(empty)
  from empty_state empty

  union all

  select
    17,
    'phase_2b_1a_and_ledger_objects_preserved',
    foundation.all_eight_tables_present
      and foundation.sticker_transactions_present,
    to_jsonb(foundation)
  from foundation_state foundation
)
select
  check_order,
  check_name,
  passed,
  result_data
from checks

union all

select
  999,
  'phase_2b_2a_verification_summary',
  bool_and(passed),
  jsonb_build_object(
    'total_checks', count(*),
    'passed_checks', count(*) filter (where passed),
    'failed_checks', count(*) filter (where not passed)
  )
from checks
order by check_order;

rollback;
