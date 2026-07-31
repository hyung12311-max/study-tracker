begin transaction read only;

with checks(name, passed) as (
  values
    ('profile table exists', to_regclass('public.learning_member_subject_profiles') is not null),
    ('metadata table exists', to_regclass('public.learning_unit_recommendation_metadata') is not null),
    ('profile empty', (select count(*) = 0 from public.learning_member_subject_profiles)),
    ('make-ten metadata exact', (select count(*) = 1 from public.learning_unit_recommendation_metadata
      where unit_id = '51000000-0000-4000-8000-000000000002'::uuid and subject = 'math'
        and recommended_start_level_code = 'elementary_1'
        and recommended_end_level_code = 'elementary_1' and parent_sort_order = 1)),
    ('profile rls forced', (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class
      where oid = 'public.learning_member_subject_profiles'::regclass)),
    ('metadata rls forced', (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class
      where oid = 'public.learning_unit_recommendation_metadata'::regclass)),
    ('browser table acl absent', not has_table_privilege('anon','public.learning_member_subject_profiles','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.learning_member_subject_profiles','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('anon','public.learning_unit_recommendation_metadata','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.learning_unit_recommendation_metadata','SELECT,INSERT,UPDATE,DELETE')),
    ('service table acl select-only', has_table_privilege('service_role','public.learning_member_subject_profiles','SELECT')
      and not has_table_privilege('service_role','public.learning_member_subject_profiles','INSERT,UPDATE,DELETE')
      and has_table_privilege('service_role','public.learning_unit_recommendation_metadata','SELECT')
      and not has_table_privilege('service_role','public.learning_unit_recommendation_metadata','INSERT,UPDATE,DELETE')),
    ('wrapper signature exists', to_regprocedure('public.upsert_learning_member_subject_profile(uuid,uuid,uuid,text,text)') is not null),
    ('wrapper security contract', (select p.prosecdef and r.rolname = 'postgres'
      and p.proconfig @> array['search_path=pg_catalog, public']
      from pg_catalog.pg_proc p join pg_catalog.pg_roles r on r.oid = p.proowner
      where p.oid = 'public.upsert_learning_member_subject_profile(uuid,uuid,uuid,text,text)'::regprocedure)),
    ('wrapper service-only', has_function_privilege('service_role','public.upsert_learning_member_subject_profile(uuid,uuid,uuid,text,text)','EXECUTE')
      and not has_function_privilege('anon','public.upsert_learning_member_subject_profile(uuid,uuid,uuid,text,text)','EXECUTE')
      and not has_function_privilege('authenticated','public.upsert_learning_member_subject_profile(uuid,uuid,uuid,text,text)','EXECUTE')),
    ('helper not executable', not has_function_privilege('service_role','public.validate_learning_member_subject_profile()','EXECUTE')),
    ('scope trigger exists', exists (select 1 from pg_catalog.pg_trigger
      where tgrelid = 'public.learning_member_subject_profiles'::regclass
        and tgname = 'learning_member_subject_profiles_scope_trigger' and not tgisinternal)),
    ('not realtime published', not exists (select 1 from pg_catalog.pg_publication_tables
      where schemaname = 'public' and tablename in ('learning_member_subject_profiles','learning_unit_recommendation_metadata'))),
    ('existing learning objects preserved', to_regclass('public.learning_assignments') is not null
      and to_regprocedure('public.finalize_learning_stage_attempt(uuid,uuid,uuid)') is not null)
), summary as (
  select count(*)::integer total_checks,
    count(*) filter (where passed)::integer passed_checks,
    count(*) filter (where not passed)::integer failed_checks
  from checks
)
select * from checks order by name;

with checks(passed) as (
  values
    (to_regclass('public.learning_member_subject_profiles') is not null),
    (to_regclass('public.learning_unit_recommendation_metadata') is not null),
    ((select count(*) = 0 from public.learning_member_subject_profiles)),
    ((select count(*) = 1 from public.learning_unit_recommendation_metadata where unit_id = '51000000-0000-4000-8000-000000000002'::uuid)),
    ((select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid = 'public.learning_member_subject_profiles'::regclass)),
    ((select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid = 'public.learning_unit_recommendation_metadata'::regclass)),
    (not has_table_privilege('anon','public.learning_member_subject_profiles','SELECT,INSERT,UPDATE,DELETE')),
    (has_table_privilege('service_role','public.learning_member_subject_profiles','SELECT') and not has_table_privilege('service_role','public.learning_member_subject_profiles','INSERT,UPDATE,DELETE')),
    (to_regprocedure('public.upsert_learning_member_subject_profile(uuid,uuid,uuid,text,text)') is not null),
    (has_function_privilege('service_role','public.upsert_learning_member_subject_profile(uuid,uuid,uuid,text,text)','EXECUTE')),
    (not has_function_privilege('anon','public.upsert_learning_member_subject_profile(uuid,uuid,uuid,text,text)','EXECUTE')),
    (not has_function_privilege('service_role','public.validate_learning_member_subject_profile()','EXECUTE')),
    (exists (select 1 from pg_catalog.pg_trigger where tgrelid = 'public.learning_member_subject_profiles'::regclass and tgname = 'learning_member_subject_profiles_scope_trigger' and not tgisinternal)),
    (not exists (select 1 from pg_catalog.pg_publication_tables where schemaname='public' and tablename in ('learning_member_subject_profiles','learning_unit_recommendation_metadata'))),
    (to_regclass('public.learning_assignments') is not null)
)
select count(*)::integer total_checks,
  count(*) filter (where passed)::integer passed_checks,
  count(*) filter (where not passed)::integer failed_checks
from checks;

rollback;
