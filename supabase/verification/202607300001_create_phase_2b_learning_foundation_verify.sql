begin transaction read only;

-- Phase 2B-1A immediate post-migration verification.
-- The final row summarizes every metadata and empty-foundation check.

with
target_tables(table_order, table_name) as (
  values
    (1, 'learning_courses'),
    (2, 'learning_units'),
    (3, 'learning_content_versions'),
    (4, 'learning_stages'),
    (5, 'learning_questions'),
    (6, 'learning_question_options'),
    (7, 'learning_assignments'),
    (8, 'learning_stage_progress')
),
relation_state as (
  select
    target.table_order,
    target.table_name,
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
    case
      when class.oid is null then false
      else has_table_privilege('service_role', class.oid, 'SELECT')
    end as service_role_select,
    case
      when class.oid is null then false
      else not has_table_privilege(
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
required_constraints(constraint_order, table_name, constraint_name, type) as (
  values
    (1, 'learning_courses', 'learning_courses_pkey', 'p'),
    (2, 'learning_courses', 'learning_courses_code_key', 'u'),
    (3, 'learning_courses', 'learning_courses_status_check', 'c'),
    (4, 'learning_units', 'learning_units_pkey', 'p'),
    (5, 'learning_units', 'learning_units_course_fk', 'f'),
    (6, 'learning_units', 'learning_units_course_code_key', 'u'),
    (7, 'learning_units', 'learning_units_course_order_key', 'u'),
    (8, 'learning_content_versions', 'learning_content_versions_pkey', 'p'),
    (9, 'learning_content_versions', 'learning_content_versions_unit_fk', 'f'),
    (10, 'learning_content_versions', 'learning_content_versions_unit_version_key', 'u'),
    (11, 'learning_content_versions', 'learning_content_versions_id_unit_key', 'u'),
    (12, 'learning_content_versions', 'learning_content_versions_status_check', 'c'),
    (13, 'learning_content_versions', 'learning_content_versions_timestamps_check', 'c'),
    (14, 'learning_stages', 'learning_stages_pkey', 'p'),
    (15, 'learning_stages', 'learning_stages_version_fk', 'f'),
    (16, 'learning_stages', 'learning_stages_version_order_key', 'u'),
    (17, 'learning_stages', 'learning_stages_id_version_key', 'u'),
    (18, 'learning_stages', 'learning_stages_difficulty_check', 'c'),
    (19, 'learning_questions', 'learning_questions_pkey', 'p'),
    (20, 'learning_questions', 'learning_questions_stage_fk', 'f'),
    (21, 'learning_questions', 'learning_questions_stage_order_key', 'u'),
    (22, 'learning_questions', 'learning_questions_prompt_check', 'c'),
    (23, 'learning_question_options', 'learning_question_options_pkey', 'p'),
    (24, 'learning_question_options', 'learning_question_options_question_fk', 'f'),
    (25, 'learning_question_options', 'learning_question_options_question_order_key', 'u'),
    (26, 'learning_question_options', 'learning_question_options_text_check', 'c'),
    (27, 'learning_assignments', 'learning_assignments_pkey', 'p'),
    (28, 'learning_assignments', 'learning_assignments_family_fk', 'f'),
    (29, 'learning_assignments', 'learning_assignments_assigned_member_fk', 'f'),
    (30, 'learning_assignments', 'learning_assignments_created_by_member_fk', 'f'),
    (31, 'learning_assignments', 'learning_assignments_unit_fk', 'f'),
    (32, 'learning_assignments', 'learning_assignments_version_unit_fk', 'f'),
    (33, 'learning_assignments', 'learning_assignments_scope_version_key', 'u'),
    (34, 'learning_assignments', 'learning_assignments_full_scope_key', 'u'),
    (35, 'learning_assignments', 'learning_assignments_status_check', 'c'),
    (36, 'learning_assignments', 'learning_assignments_timestamps_check', 'c'),
    (37, 'learning_stage_progress', 'learning_stage_progress_pkey', 'p'),
    (38, 'learning_stage_progress', 'learning_stage_progress_assigned_member_fk', 'f'),
    (39, 'learning_stage_progress', 'learning_stage_progress_assignment_scope_fk', 'f'),
    (40, 'learning_stage_progress', 'learning_stage_progress_stage_version_fk', 'f'),
    (41, 'learning_stage_progress', 'learning_stage_progress_assignment_stage_key', 'u'),
    (42, 'learning_stage_progress', 'learning_stage_progress_status_check', 'c'),
    (43, 'learning_stage_progress', 'learning_stage_progress_timestamps_check', 'c')
),
constraint_state as (
  select
    required.*,
    constraint_row.oid is not null as exists,
    constraint_row.convalidated as validated,
    pg_get_constraintdef(constraint_row.oid) as definition
  from required_constraints required
  left join pg_catalog.pg_constraint constraint_row
    on constraint_row.conrelid = to_regclass('public.' || required.table_name)
   and constraint_row.conname = required.constraint_name
   and constraint_row.contype = required.type::"char"
),
required_indexes(index_order, table_name, index_name, predicate_pattern) as (
  values
    (1, 'learning_question_options', 'learning_question_options_one_correct_uidx', 'is_correct'),
    (2, 'learning_assignments', 'learning_assignments_active_unit_uidx', 'status = ''active'''),
    (3, 'learning_courses', 'learning_courses_status_code_idx', null),
    (4, 'learning_units', 'learning_units_course_order_idx', null),
    (5, 'learning_content_versions', 'learning_content_versions_unit_status_idx', null),
    (6, 'learning_stages', 'learning_stages_version_order_idx', null),
    (7, 'learning_questions', 'learning_questions_stage_order_idx', null),
    (8, 'learning_question_options', 'learning_question_options_question_order_idx', null),
    (9, 'learning_assignments', 'learning_assignments_member_status_idx', null),
    (10, 'learning_assignments', 'learning_assignments_version_idx', null),
    (11, 'learning_assignments', 'learning_assignments_member_unit_idx', null),
    (12, 'learning_stage_progress', 'learning_stage_progress_member_status_idx', null)
),
index_state as (
  select
    required.*,
    index_row.indexrelid is not null as exists,
    index_row.indisunique as unique_index,
    pg_get_indexdef(index_row.indexrelid) as definition,
    pg_get_expr(index_row.indpred, index_row.indrelid) as predicate
  from required_indexes required
  left join pg_catalog.pg_class index_class
    on index_class.oid = to_regclass('public.' || required.index_name)
  left join pg_catalog.pg_index index_row
    on index_row.indexrelid = index_class.oid
   and index_row.indrelid = to_regclass('public.' || required.table_name)
),
target_functions(function_order, function_identity, service_execute) as (
  values
    (1, 'public.publish_learning_content_version(uuid)', true),
    (2, 'public.retire_learning_content_version(uuid)', true),
    (3, 'public.create_learning_assignment(uuid,uuid,uuid,uuid)', true),
    (4, 'public.cancel_learning_assignment(uuid,uuid,uuid,uuid)', true),
    (5, 'public.guard_learning_catalog_change()', false),
    (6, 'public.guard_learning_content_version_change()', false),
    (7, 'public.guard_learning_content_child_change()', false),
    (8, 'public.validate_learning_assignment_scope()', false)
),
function_state as (
  select
    target.*,
    procedure.oid is not null as exists,
    owner.rolname as owner_name,
    procedure.prosecdef as security_definer,
    procedure.proconfig as function_config,
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
required_triggers(trigger_order, table_name, trigger_name) as (
  values
    (1, 'learning_courses', 'learning_courses_guard_change'),
    (2, 'learning_units', 'learning_units_guard_change'),
    (3, 'learning_content_versions', 'learning_content_versions_guard_change'),
    (4, 'learning_stages', 'learning_stages_guard_change'),
    (5, 'learning_questions', 'learning_questions_guard_change'),
    (6, 'learning_question_options', 'learning_question_options_guard_change'),
    (7, 'learning_assignments', 'learning_assignments_validate_scope')
),
trigger_state as (
  select
    required.*,
    trigger_row.oid is not null as exists,
    trigger_row.tgenabled as enabled,
    pg_get_triggerdef(trigger_row.oid) as definition
  from required_triggers required
  left join pg_catalog.pg_trigger trigger_row
    on trigger_row.tgrelid = to_regclass('public.' || required.table_name)
   and trigger_row.tgname = required.trigger_name
   and not trigger_row.tgisinternal
),
publication_state as (
  select count(*) as publication_count
  from pg_catalog.pg_publication_tables publication
  join target_tables target
    on target.table_name = publication.tablename
  where publication.schemaname = 'public'
),
empty_foundation_state as (
  select
    (select count(*) from public.learning_courses) as courses,
    (select count(*) from public.learning_units) as units,
    (select count(*) from public.learning_content_versions) as versions,
    (select count(*) from public.learning_stages) as stages,
    (select count(*) from public.learning_questions) as questions,
    (select count(*) from public.learning_question_options) as options,
    (select count(*) from public.learning_assignments) as assignments,
    (select count(*) from public.learning_stage_progress) as progress
),
foundation_state as (
  select
    to_regclass('public.families') is not null as families_present,
    to_regclass('public.family_members') is not null as members_present,
    to_regclass('public.sticker_transactions') is not null
      as sticker_transactions_present,
    exists (
      select 1
      from pg_catalog.pg_roles role_row
      where role_row.rolname = 'service_role'
        and role_row.rolbypassrls
    ) as service_role_bypasses_rls
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
    20,
    'required_constraints_present_and_valid',
    bool_and(constraint_row.exists and constraint_row.validated),
    jsonb_build_object(
      'required_count', count(*),
      'missing', coalesce(
        jsonb_agg(to_jsonb(constraint_row) order by constraint_row.constraint_order)
          filter (where not constraint_row.exists or not constraint_row.validated),
        '[]'::jsonb
      )
    )
  from constraint_state constraint_row

  union all

  select
    21,
    'required_indexes_present',
    bool_and(
      index_row.exists
      and (
        index_row.predicate_pattern is null
        or replace(
          replace(lower(coalesce(index_row.predicate, '')), '(', ''),
          ')',
          ''
        ) like '%' || index_row.predicate_pattern || '%'
      )
      and (
        index_row.index_name not in (
          'learning_question_options_one_correct_uidx',
          'learning_assignments_active_unit_uidx'
        )
        or index_row.unique_index
      )
    ),
    jsonb_build_object(
      'required_count', count(*),
      'indexes', jsonb_agg(to_jsonb(index_row) order by index_row.index_order)
    )
  from index_state index_row

  union all

  select
    22,
    'function_security_contract',
    bool_and(
      function_row.exists
      and function_row.owner_name = 'postgres'
      and (
        (
          function_row.service_execute
          and
          function_row.security_definer
          and function_row.function_config
            @> array['search_path=pg_catalog, public']
          and function_row.service_role_execute
        )
        or (
          not function_row.service_execute
          and not function_row.service_role_execute
        )
      )
      and not function_row.anon_execute
      and not function_row.authenticated_execute
      and not function_row.public_execute
    ),
    jsonb_build_object(
      'functions',
      jsonb_agg(to_jsonb(function_row) order by function_row.function_order)
    )
  from function_state function_row

  union all

  select
    23,
    'immutability_and_scope_triggers_enabled',
    bool_and(trigger_row.exists and trigger_row.enabled = 'O'),
    jsonb_build_object(
      'triggers',
      jsonb_agg(to_jsonb(trigger_row) order by trigger_row.trigger_order)
    )
  from trigger_state trigger_row

  union all

  select
    24,
    'learning_tables_not_in_realtime_publication',
    publication.publication_count = 0,
    to_jsonb(publication)
  from publication_state publication

  union all

  select
    25,
    'migration_created_empty_learning_foundation',
    empty.courses = 0
      and empty.units = 0
      and empty.versions = 0
      and empty.stages = 0
      and empty.questions = 0
      and empty.options = 0
      and empty.assignments = 0
      and empty.progress = 0,
    to_jsonb(empty)
  from empty_foundation_state empty

  union all

  select
    26,
    'existing_foundation_dependencies_preserved',
    foundation.families_present
      and foundation.members_present
      and foundation.sticker_transactions_present
      and foundation.service_role_bypasses_rls,
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
  'phase_2b_1a_verification_summary',
  bool_and(passed),
  jsonb_build_object(
    'total_checks', count(*),
    'passed_checks', count(*) filter (where passed),
    'failed_checks', count(*) filter (where not passed)
  )
from checks
order by check_order;

rollback;
