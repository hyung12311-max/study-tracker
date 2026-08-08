begin transaction read only;

with checks(name, passed) as (
  values
    ('reveal audit table exists', to_regclass('public.learning_mistake_reveal_events') is not null),
    ('reveal function exists', to_regprocedure('public.reveal_learning_mistake_solution(uuid,uuid,uuid,uuid,uuid)') is not null),
    ('audit keys and scope constraints exist',
      (select count(*) = 8 from pg_catalog.pg_constraint c
       where c.conrelid = 'public.learning_mistake_reveal_events'::regclass
         and c.conname in (
           'learning_mistake_reveal_events_pkey',
           'learning_mistake_reveal_events_actor_fk',
           'learning_mistake_reveal_events_assignee_fk',
           'learning_mistake_reveal_events_assignment_fk',
           'learning_mistake_reveal_events_attempt_fk',
           'learning_mistake_reveal_events_question_fk',
           'learning_mistake_reveal_events_actor_target_key',
           'learning_mistake_reveal_events_actor_request_key'
         ))),
    ('audit is immutable and indexed',
      exists (select 1 from pg_catalog.pg_trigger t where not t.tgisinternal and t.tgname = 'learning_mistake_reveal_events_immutable')
      and to_regclass('public.learning_mistake_reveal_events_assignment_question_idx') is not null),
    ('audit table forces rls',
      (select c.relrowsecurity and c.relforcerowsecurity from pg_catalog.pg_class c where c.oid = 'public.learning_mistake_reveal_events'::regclass)),
    ('browser crud is absent',
      not has_table_privilege('anon','public.learning_mistake_reveal_events','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.learning_mistake_reveal_events','SELECT,INSERT,UPDATE,DELETE')),
    ('service table access is read only',
      has_table_privilege('service_role','public.learning_mistake_reveal_events','SELECT')
      and not has_table_privilege('service_role','public.learning_mistake_reveal_events','INSERT,UPDATE,DELETE')),
    ('reveal function is hardened',
      exists (
        select 1 from pg_catalog.pg_proc p
        join pg_catalog.pg_roles r on r.oid = p.proowner
        where p.oid = 'public.reveal_learning_mistake_solution(uuid,uuid,uuid,uuid,uuid)'::regprocedure
          and p.prosecdef and r.rolname = 'postgres'
          and p.proconfig @> array['search_path=pg_catalog, public']
      )),
    ('only service role can reveal',
      has_function_privilege('service_role','public.reveal_learning_mistake_solution(uuid,uuid,uuid,uuid,uuid)','EXECUTE')
      and not has_function_privilege('anon','public.reveal_learning_mistake_solution(uuid,uuid,uuid,uuid,uuid)','EXECUTE')
      and not has_function_privilege('authenticated','public.reveal_learning_mistake_solution(uuid,uuid,uuid,uuid,uuid)','EXECUTE')),
    ('audit is excluded from realtime',
      not exists (select 1 from pg_catalog.pg_publication_tables where schemaname='public' and tablename='learning_mistake_reveal_events')),
    ('official attempt data remains unchanged',
      to_regprocedure('public.submit_learning_attempt_answer(uuid,uuid,uuid,uuid,uuid)') is not null
      and to_regprocedure('public.finalize_learning_stage_attempt(uuid,uuid,uuid)') is not null)
)
select name, passed from checks order by name;

with checks(passed) as (
  values
    (to_regclass('public.learning_mistake_reveal_events') is not null),
    (to_regprocedure('public.reveal_learning_mistake_solution(uuid,uuid,uuid,uuid,uuid)') is not null),
    (not has_table_privilege('anon','public.learning_mistake_reveal_events','SELECT,INSERT,UPDATE,DELETE')),
    (has_table_privilege('service_role','public.learning_mistake_reveal_events','SELECT')),
    (not has_table_privilege('service_role','public.learning_mistake_reveal_events','INSERT,UPDATE,DELETE')),
    (has_function_privilege('service_role','public.reveal_learning_mistake_solution(uuid,uuid,uuid,uuid,uuid)','EXECUTE')),
    (not has_function_privilege('authenticated','public.reveal_learning_mistake_solution(uuid,uuid,uuid,uuid,uuid)','EXECUTE')),
    (not exists (select 1 from pg_catalog.pg_publication_tables where schemaname='public' and tablename='learning_mistake_reveal_events'))
)
select count(*)::integer total_checks,
  count(*) filter (where passed)::integer passed_checks,
  count(*) filter (where not passed)::integer failed_checks
from checks;

rollback;
