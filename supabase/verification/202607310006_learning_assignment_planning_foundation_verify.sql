begin transaction read only;

with checks(name, passed) as (
  values
    ('three planning tables exist',
      to_regclass('public.learning_assignment_plans') is not null
      and to_regclass('public.learning_assignment_stage_targets') is not null
      and to_regclass('public.learning_assignment_plan_revisions') is not null),
    ('planning tables initially empty',
      (select count(*) = 0 from public.learning_assignment_plans)
      and (select count(*) = 0 from public.learning_assignment_stage_targets)
      and (select count(*) = 0 from public.learning_assignment_plan_revisions)),
    ('plan date and timezone columns exact',
      (select count(*) = 3 from information_schema.columns column_row
       where column_row.table_schema = 'public'
         and column_row.table_name = 'learning_assignment_plans'
         and ((column_row.column_name in ('planned_start_date','target_completion_date')
               and column_row.data_type = 'date' and column_row.is_nullable = 'NO')
           or (column_row.column_name = 'timezone_name'
               and column_row.data_type = 'text' and column_row.is_nullable = 'NO')))),
    ('plan scope and idempotency constraints exist',
      (select count(*) = 3 from pg_catalog.pg_constraint constraint_row
       where constraint_row.conrelid = 'public.learning_assignment_plans'::regclass
         and constraint_row.conname in (
           'learning_assignment_plans_assignment_key',
           'learning_assignment_plans_request_key',
           'learning_assignment_plans_assignment_scope_fk'
         ))),
    ('plan checks exist',
      (select count(*) = 5 from pg_catalog.pg_constraint constraint_row
       where constraint_row.conrelid = 'public.learning_assignment_plans'::regclass
         and constraint_row.contype = 'c'
         and constraint_row.conname in (
           'learning_assignment_plans_date_check',
           'learning_assignment_plans_timezone_check',
           'learning_assignment_plans_state_check',
           'learning_assignment_plans_pause_check',
           'learning_assignment_plans_revision_check'
         ))),
    ('stage target key and scope constraints exist',
      (select count(*) = 4 from pg_catalog.pg_constraint constraint_row
       where constraint_row.conrelid = 'public.learning_assignment_stage_targets'::regclass
         and constraint_row.conname in (
           'learning_assignment_stage_targets_pkey',
           'learning_assignment_stage_targets_assignment_order_key',
           'learning_assignment_stage_targets_plan_assignment_fk',
           'learning_assignment_stage_targets_stage_fk'
         ))),
    ('revision audit constraints exist',
      (select count(*) = 7 from pg_catalog.pg_constraint constraint_row
       where constraint_row.conrelid = 'public.learning_assignment_plan_revisions'::regclass
         and constraint_row.conname in (
           'learning_assignment_plan_revisions_plan_revision_key',
           'learning_assignment_plan_revisions_plan_request_key',
           'learning_assignment_plan_revisions_operation_check',
           'learning_assignment_plan_revisions_date_check',
           'learning_assignment_plan_revisions_state_check',
           'learning_assignment_plan_revisions_previous_snapshot_check',
           'learning_assignment_plan_revisions_stage_snapshot_check'
         ))),
    ('planning indexes exist',
      to_regclass('public.learning_assignment_plans_family_member_state_idx') is not null
      and to_regclass('public.learning_assignment_stage_targets_assignment_date_idx') is not null
      and to_regclass('public.learning_assignment_plan_revisions_plan_changed_idx') is not null),
    ('target validation triggers exist',
      (select count(*) = 4 from pg_catalog.pg_trigger trigger_row
       where not trigger_row.tgisinternal
         and trigger_row.tgname in (
           'learning_assignment_plans_guard_row',
           'learning_assignment_stage_targets_guard_row',
           'learning_assignment_plans_validate_targets',
           'learning_assignment_stage_targets_validate_set'
         ))),
    ('revision immutable trigger exists',
      exists (select 1 from pg_catalog.pg_trigger trigger_row
       where trigger_row.tgrelid = 'public.learning_assignment_plan_revisions'::regclass
         and trigger_row.tgname = 'learning_assignment_plan_revisions_guard_change'
         and not trigger_row.tgisinternal)),
    ('four planning wrapper signatures exist',
      to_regprocedure('public.create_learning_assignment_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)') is not null
      and to_regprocedure('public.update_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,date,date,text,jsonb,uuid)') is not null
      and to_regprocedure('public.pause_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)') is not null
      and to_regprocedure('public.resume_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)') is not null),
    ('canonical pause predicate exists',
      to_regprocedure('public.is_learning_assignment_plan_paused(uuid)') is not null),
    ('wrappers owned and hardened',
      (select count(*) = 4 from pg_catalog.pg_proc procedure_row
       join pg_catalog.pg_roles role_row on role_row.oid = procedure_row.proowner
       where procedure_row.oid in (
         'public.create_learning_assignment_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)'::regprocedure,
         'public.update_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,date,date,text,jsonb,uuid)'::regprocedure,
         'public.pause_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)'::regprocedure,
         'public.resume_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)'::regprocedure
       ) and procedure_row.prosecdef and role_row.rolname = 'postgres'
         and procedure_row.proconfig @> array['search_path=pg_catalog, public'])),
    ('service role has wrapper execute only',
      has_function_privilege('service_role','public.create_learning_assignment_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)','EXECUTE')
      and has_function_privilege('service_role','public.update_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,date,date,text,jsonb,uuid)','EXECUTE')
      and has_function_privilege('service_role','public.pause_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)','EXECUTE')
      and has_function_privilege('service_role','public.resume_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)','EXECUTE')
      and not has_function_privilege('anon','public.create_learning_assignment_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)','EXECUTE')
      and not has_function_privilege('authenticated','public.create_learning_assignment_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)','EXECUTE')),
    ('internal helpers are not directly executable',
      not has_function_privilege('service_role','public.is_learning_assignment_plan_paused(uuid)','EXECUTE')
      and not has_function_privilege('service_role','public.set_learning_assignment_plan_state(uuid,uuid,uuid,uuid,integer,uuid,text)','EXECUTE')
      and not has_function_privilege('service_role','public.normalize_learning_assignment_plan_targets(uuid,date,date,jsonb)','EXECUTE')),
    ('all planning tables force rls',
      (select count(*) = 3 from pg_catalog.pg_class class_row
       where class_row.oid in (
         'public.learning_assignment_plans'::regclass,
         'public.learning_assignment_stage_targets'::regclass,
         'public.learning_assignment_plan_revisions'::regclass
       ) and class_row.relrowsecurity and class_row.relforcerowsecurity)),
    ('browser direct crud absent',
      not has_table_privilege('anon','public.learning_assignment_plans','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.learning_assignment_plans','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('anon','public.learning_assignment_stage_targets','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.learning_assignment_stage_targets','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('anon','public.learning_assignment_plan_revisions','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.learning_assignment_plan_revisions','SELECT,INSERT,UPDATE,DELETE')),
    ('service table acl select only',
      has_table_privilege('service_role','public.learning_assignment_plans','SELECT')
      and has_table_privilege('service_role','public.learning_assignment_stage_targets','SELECT')
      and has_table_privilege('service_role','public.learning_assignment_plan_revisions','SELECT')
      and not has_table_privilege('service_role','public.learning_assignment_plans','INSERT,UPDATE,DELETE')
      and not has_table_privilege('service_role','public.learning_assignment_stage_targets','INSERT,UPDATE,DELETE')
      and not has_table_privilege('service_role','public.learning_assignment_plan_revisions','INSERT,UPDATE,DELETE')),
    ('planning tables excluded from realtime',
      not exists (select 1 from pg_catalog.pg_publication_tables publication_row
       where publication_row.schemaname = 'public'
         and publication_row.tablename in (
           'learning_assignment_plans',
           'learning_assignment_stage_targets',
           'learning_assignment_plan_revisions'
         ))),
    ('existing assignment functions preserved',
      to_regprocedure('public.create_learning_assignment(uuid,uuid,uuid,uuid)') is not null
      and to_regprocedure('public.cancel_learning_assignment(uuid,uuid,uuid,uuid)') is not null
      and to_regprocedure('public.start_or_resume_learning_attempt(uuid,uuid,uuid,uuid,uuid,uuid)') is not null
      and to_regprocedure('public.finalize_learning_stage_attempt(uuid,uuid,uuid)') is not null),
    ('existing learning data objects preserved',
      to_regclass('public.learning_assignments') is not null
      and to_regclass('public.learning_attempts') is not null
      and to_regclass('public.learning_stage_progress') is not null
      and to_regclass('public.learning_stage_first_passes') is not null
      and to_regclass('public.sticker_transactions') is not null)
)
select name, passed from checks order by name;

with checks(passed) as (
  values
    (to_regclass('public.learning_assignment_plans') is not null),
    (to_regclass('public.learning_assignment_stage_targets') is not null),
    (to_regclass('public.learning_assignment_plan_revisions') is not null),
    ((select count(*) = 0 from public.learning_assignment_plans)),
    ((select count(*) = 0 from public.learning_assignment_stage_targets)),
    ((select count(*) = 0 from public.learning_assignment_plan_revisions)),
    (to_regprocedure('public.create_learning_assignment_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)') is not null),
    (to_regprocedure('public.update_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,date,date,text,jsonb,uuid)') is not null),
    (to_regprocedure('public.pause_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)') is not null),
    (to_regprocedure('public.resume_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)') is not null),
    (to_regprocedure('public.is_learning_assignment_plan_paused(uuid)') is not null),
    ((select count(*) = 3 from pg_catalog.pg_class class_row where class_row.oid in (
      'public.learning_assignment_plans'::regclass,
      'public.learning_assignment_stage_targets'::regclass,
      'public.learning_assignment_plan_revisions'::regclass
    ) and class_row.relrowsecurity and class_row.relforcerowsecurity)),
    (not has_table_privilege('anon','public.learning_assignment_plans','SELECT,INSERT,UPDATE,DELETE')),
    (not has_table_privilege('authenticated','public.learning_assignment_plans','SELECT,INSERT,UPDATE,DELETE')),
    (has_table_privilege('service_role','public.learning_assignment_plans','SELECT')),
    (not has_table_privilege('service_role','public.learning_assignment_plans','INSERT,UPDATE,DELETE')),
    (has_function_privilege('service_role','public.create_learning_assignment_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)','EXECUTE')),
    (not has_function_privilege('anon','public.create_learning_assignment_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)','EXECUTE')),
    (not has_function_privilege('service_role','public.is_learning_assignment_plan_paused(uuid)','EXECUTE')),
    (not exists (select 1 from pg_catalog.pg_publication_tables publication_row
      where publication_row.schemaname='public' and publication_row.tablename like 'learning_assignment_plan%')),
    (to_regprocedure('public.create_learning_assignment(uuid,uuid,uuid,uuid)') is not null)
)
select count(*)::integer total_checks,
  count(*) filter (where passed)::integer passed_checks,
  count(*) filter (where not passed)::integer failed_checks
from checks;

rollback;
