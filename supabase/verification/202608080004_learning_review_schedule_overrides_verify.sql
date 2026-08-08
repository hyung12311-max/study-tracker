begin transaction read only;

with checks(name, passed) as (
  values
    ('schedule tables exist',
      to_regclass('public.learning_review_schedule_overrides') is not null
      and to_regclass('public.learning_review_schedule_events') is not null),
    ('schedule function exists',
      to_regprocedure('public.set_learning_review_schedule_override(uuid,uuid,uuid,uuid,text,text,integer,uuid)') is not null),
    ('schedule function is hardened',
      exists (
        select 1 from pg_catalog.pg_proc procedure_row
        join pg_catalog.pg_roles owner_role on owner_role.oid = procedure_row.proowner
        where procedure_row.oid = 'public.set_learning_review_schedule_override(uuid,uuid,uuid,uuid,text,text,integer,uuid)'::regprocedure
          and procedure_row.prosecdef and owner_role.rolname = 'postgres'
          and procedure_row.proconfig @> array['search_path=pg_catalog, public']
      )),
    ('schedule rows are force rls',
      (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid = 'public.learning_review_schedule_overrides'::regclass)
      and (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid = 'public.learning_review_schedule_events'::regclass)),
    ('browser roles cannot access schedule rows',
      not has_table_privilege('anon','public.learning_review_schedule_overrides','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.learning_review_schedule_overrides','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('anon','public.learning_review_schedule_events','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.learning_review_schedule_events','SELECT,INSERT,UPDATE,DELETE')),
    ('service role is schedule read only',
      has_table_privilege('service_role','public.learning_review_schedule_overrides','SELECT')
      and not has_table_privilege('service_role','public.learning_review_schedule_overrides','INSERT,UPDATE,DELETE')
      and has_table_privilege('service_role','public.learning_review_schedule_events','SELECT')
      and not has_table_privilege('service_role','public.learning_review_schedule_events','INSERT,UPDATE,DELETE')),
    ('only service role can execute schedule function',
      has_function_privilege('service_role','public.set_learning_review_schedule_override(uuid,uuid,uuid,uuid,text,text,integer,uuid)','EXECUTE')
      and not has_function_privilege('anon','public.set_learning_review_schedule_override(uuid,uuid,uuid,uuid,text,text,integer,uuid)','EXECUTE')
      and not has_function_privilege('authenticated','public.set_learning_review_schedule_override(uuid,uuid,uuid,uuid,text,text,integer,uuid)','EXECUTE')),
    ('schedule events are immutable',
      exists (select 1 from pg_catalog.pg_trigger where not tgisinternal and tgname = 'learning_review_schedule_events_immutable')),
    ('schedule function preserves official and review state',
      pg_get_functiondef('public.set_learning_review_schedule_override(uuid,uuid,uuid,uuid,text,text,integer,uuid)'::regprocedure)
        !~ 'update public.learning_attempts|learning_stage_progress|learning_stage_first_passes|sticker_transactions|learning_mistake_review_answers'),
    ('schedule tables remain outside realtime',
      not exists (
        select 1 from pg_catalog.pg_publication_tables
        where schemaname = 'public' and tablename in (
          'learning_review_schedule_overrides', 'learning_review_schedule_events'
        )
      ))
)
select name, passed from checks order by name;

with checks(passed) as (
  values
    (to_regclass('public.learning_review_schedule_overrides') is not null),
    (to_regclass('public.learning_review_schedule_events') is not null),
    (to_regprocedure('public.set_learning_review_schedule_override(uuid,uuid,uuid,uuid,text,text,integer,uuid)') is not null),
    (has_function_privilege('service_role','public.set_learning_review_schedule_override(uuid,uuid,uuid,uuid,text,text,integer,uuid)','EXECUTE')),
    (not has_function_privilege('authenticated','public.set_learning_review_schedule_override(uuid,uuid,uuid,uuid,text,text,integer,uuid)','EXECUTE')),
    (has_table_privilege('service_role','public.learning_review_schedule_overrides','SELECT')),
    (not has_table_privilege('service_role','public.learning_review_schedule_overrides','INSERT,UPDATE,DELETE')),
    (not exists (
      select 1 from pg_catalog.pg_publication_tables
      where schemaname = 'public' and tablename in (
        'learning_review_schedule_overrides', 'learning_review_schedule_events'
      )
    ))
)
select count(*)::integer total_checks,
  count(*) filter (where passed)::integer passed_checks,
  count(*) filter (where not passed)::integer failed_checks
from checks;

rollback;
