begin read only;

with checks(name, passed) as (
  values
    ('atomic wrapper exists',
      to_regprocedure('public.create_learning_assignment_with_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)') is not null),
    ('pause guard exists',
      to_regprocedure('public.guard_learning_attempt_plan_pause()') is not null),
    ('pause trigger exists',
      exists (select 1 from pg_catalog.pg_trigger trigger_row
        where trigger_row.tgrelid = 'public.learning_attempts'::regclass
          and trigger_row.tgname = 'learning_attempts_guard_plan_pause'
          and not trigger_row.tgisinternal)),
    ('atomic wrapper hardened',
      exists (select 1 from pg_catalog.pg_proc procedure_row
        join pg_catalog.pg_roles role_row on role_row.oid = procedure_row.proowner
        where procedure_row.oid = 'public.create_learning_assignment_with_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)'::regprocedure
          and procedure_row.prosecdef and role_row.rolname = 'postgres'
          and procedure_row.proconfig @> array['search_path=pg_catalog, public'])),
    ('pause guard hardened',
      exists (select 1 from pg_catalog.pg_proc procedure_row
        join pg_catalog.pg_roles role_row on role_row.oid = procedure_row.proowner
        where procedure_row.oid = 'public.guard_learning_attempt_plan_pause()'::regprocedure
          and procedure_row.prosecdef and role_row.rolname = 'postgres'
          and procedure_row.proconfig @> array['search_path=pg_catalog, public'])),
    ('service role has atomic execute only',
      has_function_privilege('service_role','public.create_learning_assignment_with_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)','EXECUTE')
      and not has_function_privilege('anon','public.create_learning_assignment_with_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)','EXECUTE')
      and not has_function_privilege('authenticated','public.create_learning_assignment_with_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)','EXECUTE')),
    ('pause guard is internal',
      not has_function_privilege('service_role','public.guard_learning_attempt_plan_pause()','EXECUTE')),
    ('planning foundation preserved',
      to_regclass('public.learning_assignment_plans') is not null
      and to_regclass('public.learning_assignment_stage_targets') is not null
      and to_regclass('public.learning_assignment_plan_revisions') is not null),
    ('planning wrappers preserved',
      to_regprocedure('public.create_learning_assignment_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)') is not null
      and to_regprocedure('public.update_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,date,date,text,jsonb,uuid)') is not null
      and to_regprocedure('public.pause_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)') is not null
      and to_regprocedure('public.resume_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)') is not null
      and to_regprocedure('public.is_learning_assignment_plan_paused(uuid)') is not null),
    ('planning tables force rls',
      (select count(*) = 3 from pg_catalog.pg_class class_row
       where class_row.oid in (
         'public.learning_assignment_plans'::regclass,
         'public.learning_assignment_stage_targets'::regclass,
         'public.learning_assignment_plan_revisions'::regclass
       ) and class_row.relrowsecurity and class_row.relforcerowsecurity)),
    ('planning tables remain empty',
      (select count(*) = 0 from public.learning_assignment_plans)
      and (select count(*) = 0 from public.learning_assignment_stage_targets)
      and (select count(*) = 0 from public.learning_assignment_plan_revisions)),
    ('planning tables excluded from realtime',
      not exists (select 1 from pg_catalog.pg_publication_tables publication_row
       where publication_row.schemaname = 'public'
         and publication_row.tablename like 'learning_assignment_plan%')),
    ('existing attempt mutation functions preserved',
      to_regprocedure('public.start_or_resume_learning_attempt(uuid,uuid,uuid,uuid,uuid,uuid)') is not null
      and to_regprocedure('public.submit_learning_attempt_answer(uuid,uuid,uuid,uuid,uuid)') is not null
      and to_regprocedure('public.finalize_learning_stage_attempt(uuid,uuid,uuid)') is not null),
    ('pause guard calls canonical predicate',
      pg_catalog.pg_get_functiondef('public.guard_learning_attempt_plan_pause()'::regprocedure)
        like '%is_learning_assignment_plan_paused(new.assignment_id)%'),
    ('no browser planning table privileges',
      not has_table_privilege('anon','public.learning_assignment_plans','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.learning_assignment_plans','SELECT,INSERT,UPDATE,DELETE'))
)
select name, passed from checks order by name;

with checks(passed) as (
  values
    (to_regprocedure('public.create_learning_assignment_with_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)') is not null),
    (to_regprocedure('public.guard_learning_attempt_plan_pause()') is not null),
    (exists (select 1 from pg_catalog.pg_trigger where tgrelid='public.learning_attempts'::regclass and tgname='learning_attempts_guard_plan_pause' and not tgisinternal)),
    (has_function_privilege('service_role','public.create_learning_assignment_with_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)','EXECUTE')),
    (not has_function_privilege('anon','public.create_learning_assignment_with_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)','EXECUTE')),
    ((select count(*) = 3 from pg_catalog.pg_class where oid in ('public.learning_assignment_plans'::regclass,'public.learning_assignment_stage_targets'::regclass,'public.learning_assignment_plan_revisions'::regclass) and relrowsecurity and relforcerowsecurity)),
    ((select count(*) = 0 from public.learning_assignment_plans)),
    ((select count(*) = 0 from public.learning_assignment_stage_targets)),
    ((select count(*) = 0 from public.learning_assignment_plan_revisions)),
    (not exists (select 1 from pg_catalog.pg_publication_tables where schemaname='public' and tablename like 'learning_assignment_plan%'))
)
select count(*)::integer total_checks,
  count(*) filter (where passed)::integer passed_checks,
  count(*) filter (where not passed)::integer failed_checks
from checks;

rollback;
