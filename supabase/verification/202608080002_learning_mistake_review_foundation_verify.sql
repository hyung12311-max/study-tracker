begin transaction read only;

with checks(name, passed) as (
  values
    ('review tables exist',
      to_regclass('public.learning_mistake_review_sessions') is not null
      and to_regclass('public.learning_mistake_review_items') is not null
      and to_regclass('public.learning_mistake_review_answers') is not null
      and to_regclass('public.learning_mistake_review_events') is not null),
    ('review start function exists',
      to_regprocedure('public.start_learning_mistake_review(uuid,uuid,uuid,uuid,text,uuid,text,uuid)') is not null),
    ('one active review is enforced',
      to_regclass('public.learning_mistake_review_sessions_active_uidx') is not null),
    ('session and item scope constraints exist',
      (select count(*) = 8 from pg_catalog.pg_constraint constraint_row
       where constraint_row.conname in (
         'learning_mistake_review_sessions_assignee_fk',
         'learning_mistake_review_sessions_actor_fk',
         'learning_mistake_review_sessions_assignment_fk',
         'learning_mistake_review_sessions_actor_request_key',
         'learning_mistake_review_items_session_fk',
         'learning_mistake_review_items_question_fk',
         'learning_mistake_review_items_answer_fk',
         'learning_mistake_review_items_session_answer_key'
       ))),
    ('review rows are immutable',
      (select count(*) = 4 from pg_catalog.pg_trigger trigger_row
       where not trigger_row.tgisinternal
         and trigger_row.tgname in (
           'learning_mistake_review_sessions_guard',
           'learning_mistake_review_items_immutable',
           'learning_mistake_review_answers_immutable',
           'learning_mistake_review_events_immutable'
         ))),
    ('review tables force rls',
      (select count(*) = 4 from pg_catalog.pg_class class_row
       where class_row.oid in (
         'public.learning_mistake_review_sessions'::regclass,
         'public.learning_mistake_review_items'::regclass,
         'public.learning_mistake_review_answers'::regclass,
         'public.learning_mistake_review_events'::regclass
       ) and class_row.relrowsecurity and class_row.relforcerowsecurity)),
    ('browser review crud is absent',
      not has_table_privilege('anon','public.learning_mistake_review_sessions','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.learning_mistake_review_sessions','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('anon','public.learning_mistake_review_items','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.learning_mistake_review_items','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('anon','public.learning_mistake_review_answers','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.learning_mistake_review_answers','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('anon','public.learning_mistake_review_events','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.learning_mistake_review_events','SELECT,INSERT,UPDATE,DELETE')),
    ('service role review tables are read only',
      has_table_privilege('service_role','public.learning_mistake_review_sessions','SELECT')
      and not has_table_privilege('service_role','public.learning_mistake_review_sessions','INSERT,UPDATE,DELETE')
      and has_table_privilege('service_role','public.learning_mistake_review_items','SELECT')
      and not has_table_privilege('service_role','public.learning_mistake_review_items','INSERT,UPDATE,DELETE')
      and has_table_privilege('service_role','public.learning_mistake_review_answers','SELECT')
      and not has_table_privilege('service_role','public.learning_mistake_review_answers','INSERT,UPDATE,DELETE')
      and has_table_privilege('service_role','public.learning_mistake_review_events','SELECT')
      and not has_table_privilege('service_role','public.learning_mistake_review_events','INSERT,UPDATE,DELETE')),
    ('review start function is hardened',
      exists (
        select 1 from pg_catalog.pg_proc procedure_row
        join pg_catalog.pg_roles owner_role on owner_role.oid = procedure_row.proowner
        where procedure_row.oid = 'public.start_learning_mistake_review(uuid,uuid,uuid,uuid,text,uuid,text,uuid)'::regprocedure
          and procedure_row.prosecdef
          and owner_role.rolname = 'postgres'
          and procedure_row.proconfig @> array['search_path=pg_catalog, public']
      )),
    ('only service role can start reviews',
      has_function_privilege('service_role','public.start_learning_mistake_review(uuid,uuid,uuid,uuid,text,uuid,text,uuid)','EXECUTE')
      and not has_function_privilege('anon','public.start_learning_mistake_review(uuid,uuid,uuid,uuid,text,uuid,text,uuid)','EXECUTE')
      and not has_function_privilege('authenticated','public.start_learning_mistake_review(uuid,uuid,uuid,uuid,text,uuid,text,uuid)','EXECUTE')),
    ('review tables are excluded from realtime',
      not exists (
        select 1 from pg_catalog.pg_publication_tables publication_row
        where publication_row.schemaname = 'public'
          and publication_row.tablename in (
            'learning_mistake_review_sessions',
            'learning_mistake_review_items',
            'learning_mistake_review_answers',
            'learning_mistake_review_events'
          )
      )),
    ('official progress and reward functions remain separate',
      to_regprocedure('public.finalize_learning_stage_attempt(uuid,uuid,uuid)') is not null
      and pg_get_functiondef(
        'public.start_learning_mistake_review(uuid,uuid,uuid,uuid,text,uuid,text,uuid)'::regprocedure
      ) !~ 'learning_stage_progress|learning_stage_first_passes|sticker_transactions')
)
select name, passed from checks order by name;

with checks(passed) as (
  values
    (to_regclass('public.learning_mistake_review_sessions') is not null),
    (to_regclass('public.learning_mistake_review_items') is not null),
    (to_regclass('public.learning_mistake_review_answers') is not null),
    (to_regclass('public.learning_mistake_review_events') is not null),
    (to_regprocedure('public.start_learning_mistake_review(uuid,uuid,uuid,uuid,text,uuid,text,uuid)') is not null),
    (has_function_privilege('service_role','public.start_learning_mistake_review(uuid,uuid,uuid,uuid,text,uuid,text,uuid)','EXECUTE')),
    (not has_function_privilege('authenticated','public.start_learning_mistake_review(uuid,uuid,uuid,uuid,text,uuid,text,uuid)','EXECUTE')),
    (not exists (
      select 1 from pg_catalog.pg_publication_tables
      where schemaname = 'public' and tablename like 'learning_mistake_review_%'
    ))
)
select count(*)::integer total_checks,
  count(*) filter (where passed)::integer passed_checks,
  count(*) filter (where not passed)::integer failed_checks
from checks;

rollback;
