begin transaction read only;

with checks(name, passed) as (
  values
    ('skill tables exist',
      to_regclass('public.learning_skill_definitions') is not null
      and to_regclass('public.learning_question_skills') is not null),
    ('skill tables initially empty',
      (select count(*) = 0 from public.learning_skill_definitions)
      and (select count(*) = 0 from public.learning_question_skills)),
    ('skill definition constraints exist',
      (select count(*) = 5 from pg_catalog.pg_constraint constraint_row
       where constraint_row.conrelid = 'public.learning_skill_definitions'::regclass
         and constraint_row.conname in (
           'learning_skill_definitions_code_check',
           'learning_skill_definitions_subject_check',
           'learning_skill_definitions_display_name_check',
           'learning_skill_definitions_description_check',
           'learning_skill_definitions_curriculum_check'
         ))),
    ('question skill keys and indexes exist',
      (select count(*) = 3 from pg_catalog.pg_constraint constraint_row
       where constraint_row.conrelid = 'public.learning_question_skills'::regclass
         and constraint_row.conname in (
           'learning_question_skills_pkey',
           'learning_question_skills_question_fk',
           'learning_question_skills_skill_fk'
         ))
      and to_regclass('public.learning_question_skills_one_primary_uidx') is not null
      and to_regclass('public.learning_question_skills_skill_question_idx') is not null),
    ('attempt skill snapshot column is additive and empty',
      (select count(*) = 1 from information_schema.columns column_row
       where column_row.table_schema = 'public'
         and column_row.table_name = 'learning_attempt_questions'
         and column_row.column_name = 'skill_codes_snapshot'
         and column_row.data_type = 'ARRAY'
         and column_row.is_nullable = 'NO')
      and not exists (
        select 1 from public.learning_attempt_questions
        where cardinality(skill_codes_snapshot) <> 0
      )),
    ('published mapping and snapshot triggers exist',
      (select count(*) = 2 from pg_catalog.pg_trigger trigger_row
       where not trigger_row.tgisinternal
         and trigger_row.tgname in (
           'learning_question_skills_guard_change',
           'learning_attempt_questions_skill_snapshot'
         ))),
    ('snapshot helper is owned and hardened',
      exists (
        select 1 from pg_catalog.pg_proc procedure_row
        join pg_catalog.pg_roles role_row on role_row.oid = procedure_row.proowner
        where procedure_row.oid = 'public.snapshot_learning_attempt_question_skills()'::regprocedure
          and procedure_row.prosecdef
          and role_row.rolname = 'postgres'
          and procedure_row.proconfig @> array['search_path=pg_catalog, public']
      )),
    ('skill tables force rls',
      (select count(*) = 2 from pg_catalog.pg_class class_row
       where class_row.oid in (
         'public.learning_skill_definitions'::regclass,
         'public.learning_question_skills'::regclass
       ) and class_row.relrowsecurity and class_row.relforcerowsecurity)),
    ('browser direct crud absent',
      not has_table_privilege('anon','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('anon','public.learning_question_skills','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.learning_question_skills','SELECT,INSERT,UPDATE,DELETE')),
    ('service table acl select only',
      has_table_privilege('service_role','public.learning_skill_definitions','SELECT')
      and has_table_privilege('service_role','public.learning_question_skills','SELECT')
      and not has_table_privilege('service_role','public.learning_skill_definitions','INSERT,UPDATE,DELETE')
      and not has_table_privilege('service_role','public.learning_question_skills','INSERT,UPDATE,DELETE')),
    ('trigger helpers are not directly executable',
      not has_function_privilege('service_role','public.guard_learning_question_skill_change()','EXECUTE')
      and not has_function_privilege('service_role','public.snapshot_learning_attempt_question_skills()','EXECUTE')
      and not has_function_privilege('anon','public.snapshot_learning_attempt_question_skills()','EXECUTE')),
    ('skill tables excluded from realtime',
      not exists (
        select 1 from pg_catalog.pg_publication_tables publication_row
        where publication_row.schemaname = 'public'
          and publication_row.tablename in ('learning_skill_definitions','learning_question_skills')
      )),
    ('official learning functions preserved',
      to_regprocedure('public.start_or_resume_learning_attempt(uuid,uuid,uuid,uuid,uuid,uuid)') is not null
      and to_regprocedure('public.submit_learning_attempt_answer(uuid,uuid,uuid,uuid,uuid)') is not null
      and to_regprocedure('public.finalize_learning_stage_attempt(uuid,uuid,uuid)') is not null)
)
select name, passed from checks order by name;

with checks(passed) as (
  values
    (to_regclass('public.learning_skill_definitions') is not null),
    (to_regclass('public.learning_question_skills') is not null),
    ((select count(*) = 0 from public.learning_skill_definitions)),
    ((select count(*) = 0 from public.learning_question_skills)),
    (exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_attempt_questions' and column_name='skill_codes_snapshot')),
    (to_regprocedure('public.snapshot_learning_attempt_question_skills()') is not null),
    (not has_table_privilege('anon','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE')),
    (not has_table_privilege('authenticated','public.learning_question_skills','SELECT,INSERT,UPDATE,DELETE')),
    (has_table_privilege('service_role','public.learning_skill_definitions','SELECT')),
    (not has_table_privilege('service_role','public.learning_skill_definitions','INSERT,UPDATE,DELETE')),
    (not has_function_privilege('service_role','public.snapshot_learning_attempt_question_skills()','EXECUTE')),
    (not exists (select 1 from pg_catalog.pg_publication_tables where schemaname='public' and tablename in ('learning_skill_definitions','learning_question_skills'))),
    (to_regprocedure('public.finalize_learning_stage_attempt(uuid,uuid,uuid)') is not null)
)
select count(*)::integer total_checks,
  count(*) filter (where passed)::integer passed_checks,
  count(*) filter (where not passed)::integer failed_checks
from checks;

rollback;
