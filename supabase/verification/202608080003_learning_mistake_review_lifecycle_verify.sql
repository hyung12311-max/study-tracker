begin transaction read only;

with checks(name, passed) as (
  values
    ('review answer function exists',
      to_regprocedure('public.submit_learning_mistake_review_answer(uuid,uuid,uuid,uuid,uuid,uuid)') is not null),
    ('review abandon function exists',
      to_regprocedure('public.abandon_learning_mistake_review(uuid,uuid,uuid,uuid)') is not null),
    ('answer function is hardened',
      exists (
        select 1 from pg_catalog.pg_proc procedure_row
        join pg_catalog.pg_roles owner_role on owner_role.oid = procedure_row.proowner
        where procedure_row.oid = 'public.submit_learning_mistake_review_answer(uuid,uuid,uuid,uuid,uuid,uuid)'::regprocedure
          and procedure_row.prosecdef and owner_role.rolname = 'postgres'
          and procedure_row.proconfig @> array['search_path=pg_catalog, public']
      )),
    ('abandon function is hardened',
      exists (
        select 1 from pg_catalog.pg_proc procedure_row
        join pg_catalog.pg_roles owner_role on owner_role.oid = procedure_row.proowner
        where procedure_row.oid = 'public.abandon_learning_mistake_review(uuid,uuid,uuid,uuid)'::regprocedure
          and procedure_row.prosecdef and owner_role.rolname = 'postgres'
          and procedure_row.proconfig @> array['search_path=pg_catalog, public']
      )),
    ('only service role can submit review answers',
      has_function_privilege('service_role','public.submit_learning_mistake_review_answer(uuid,uuid,uuid,uuid,uuid,uuid)','EXECUTE')
      and not has_function_privilege('anon','public.submit_learning_mistake_review_answer(uuid,uuid,uuid,uuid,uuid,uuid)','EXECUTE')
      and not has_function_privilege('authenticated','public.submit_learning_mistake_review_answer(uuid,uuid,uuid,uuid,uuid,uuid)','EXECUTE')),
    ('only service role can abandon reviews',
      has_function_privilege('service_role','public.abandon_learning_mistake_review(uuid,uuid,uuid,uuid)','EXECUTE')
      and not has_function_privilege('anon','public.abandon_learning_mistake_review(uuid,uuid,uuid,uuid)','EXECUTE')
      and not has_function_privilege('authenticated','public.abandon_learning_mistake_review(uuid,uuid,uuid,uuid)','EXECUTE')),
    ('review answer stays separate from official state',
      pg_get_functiondef('public.submit_learning_mistake_review_answer(uuid,uuid,uuid,uuid,uuid,uuid)'::regprocedure)
        !~ 'learning_stage_progress|learning_stage_first_passes|sticker_transactions|update public.learning_attempts'),
    ('review abandon stays separate from official state',
      pg_get_functiondef('public.abandon_learning_mistake_review(uuid,uuid,uuid,uuid)'::regprocedure)
        !~ 'learning_stage_progress|learning_stage_first_passes|sticker_transactions|learning_attempts'),
    ('answer and abandon records remain immutable',
      exists (select 1 from pg_catalog.pg_trigger where not tgisinternal and tgname = 'learning_mistake_review_answers_immutable')
      and exists (select 1 from pg_catalog.pg_trigger where not tgisinternal and tgname = 'learning_mistake_review_events_immutable')),
    ('review lifecycle remains outside realtime',
      not exists (
        select 1 from pg_catalog.pg_publication_tables
        where schemaname = 'public' and tablename like 'learning_mistake_review_%'
      ))
)
select name, passed from checks order by name;

with checks(passed) as (
  values
    (to_regprocedure('public.submit_learning_mistake_review_answer(uuid,uuid,uuid,uuid,uuid,uuid)') is not null),
    (to_regprocedure('public.abandon_learning_mistake_review(uuid,uuid,uuid,uuid)') is not null),
    (has_function_privilege('service_role','public.submit_learning_mistake_review_answer(uuid,uuid,uuid,uuid,uuid,uuid)','EXECUTE')),
    (has_function_privilege('service_role','public.abandon_learning_mistake_review(uuid,uuid,uuid,uuid)','EXECUTE')),
    (not has_function_privilege('authenticated','public.submit_learning_mistake_review_answer(uuid,uuid,uuid,uuid,uuid,uuid)','EXECUTE')),
    (not has_function_privilege('authenticated','public.abandon_learning_mistake_review(uuid,uuid,uuid,uuid)','EXECUTE')),
    (has_table_privilege('service_role','public.learning_mistake_review_answers','SELECT')),
    (not has_table_privilege('service_role','public.learning_mistake_review_answers','INSERT,UPDATE,DELETE'))
)
select count(*)::integer total_checks,
  count(*) filter (where passed)::integer passed_checks,
  count(*) filter (where not passed)::integer failed_checks
from checks;

rollback;
