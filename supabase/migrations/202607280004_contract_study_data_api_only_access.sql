-- CONTRACT phase for the Phase 2A study data security rollout.
--
-- This file is intentionally outside supabase/migrations so `supabase db push`
-- cannot apply it in the same batch as the expand migration. Promote this exact
-- file to supabase/migrations only after:
--   1. 202607280001, 202607280002, and 202607280003 expand verification passes,
--   2. the new application is deployed, and
--   3. parent and every active child regression check passes.
--
-- reading_plans is intentionally not changed here. The application no longer
-- has a browser table path for it, but its exact Production table grants and
-- policies were not part of the verified legacy metadata contract. A future
-- read-only inventory must precede any destructive reading_plans change.
--
-- academy_schedules and academy_completion_history are both closed here.
-- Their complete Production ACL and policy baselines were verified after the
-- Academy API deployment. This contract changes access metadata only.

begin;

lock table
  public.study_plans,
  public.book_plans,
  public.academy_schedules,
  public.academy_completion_history
in share row exclusive mode;

do $preflight$
declare
  function_name text;
begin
  if to_regclass('public.study_plans') is null then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: study_plans is missing';
  end if;

  if to_regclass('public.book_plans') is null then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: book_plans is missing';
  end if;

  if to_regclass('public.academy_schedules') is null then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: academy_schedules is missing';
  end if;

  if to_regclass('public.academy_completion_history') is null then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: academy_completion_history is missing';
  end if;

  if not (
    select class.relforcerowsecurity
      = false and class.relrowsecurity = false
    from pg_catalog.pg_class class
    where class.oid = 'public.study_plans'::regclass
  ) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: unexpected study_plans RLS state';
  end if;

  if not (
    select class.relrowsecurity and not class.relforcerowsecurity
    from pg_catalog.pg_class class
    where class.oid = 'public.book_plans'::regclass
  ) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: unexpected book_plans RLS state';
  end if;

  if not (
    select class.relrowsecurity and not class.relforcerowsecurity
    from pg_catalog.pg_class class
    where class.oid = 'public.academy_schedules'::regclass
  ) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: unexpected academy_schedules RLS state';
  end if;

  if not (
    select class.relrowsecurity and not class.relforcerowsecurity
    from pg_catalog.pg_class class
    where class.oid = 'public.academy_completion_history'::regclass
  ) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: unexpected academy completion RLS state';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'book_plans'
      and policy.policyname = 'book_plans_existing_app_access'
      and policy.permissive = 'PERMISSIVE'
      and policy.cmd = 'ALL'
      and policy.roles @> array['anon', 'authenticated']::name[]
      and cardinality(policy.roles) = 2
      and trim(coalesce(policy.qual, '')) in ('true', '(true)')
      and trim(coalesce(policy.with_check, '')) in ('true', '(true)')
  ) or exists (
    select 1
    from pg_catalog.pg_policy policy
    where policy.polrelid = 'public.book_plans'::regclass
      and policy.polname <> 'book_plans_existing_app_access'
  ) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: unexpected book_plans policy';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'academy_schedules'
      and policy.policyname = 'academy_schedules_existing_app_access'
      and policy.permissive = 'PERMISSIVE'
      and policy.cmd = 'ALL'
      and policy.roles @> array['anon', 'authenticated']::name[]
      and cardinality(policy.roles) = 2
      and trim(coalesce(policy.qual, '')) in ('true', '(true)')
      and trim(coalesce(policy.with_check, '')) in ('true', '(true)')
  ) or exists (
    select 1
    from pg_catalog.pg_policy policy
    where policy.polrelid = 'public.academy_schedules'::regclass
      and policy.polname <> 'academy_schedules_existing_app_access'
  ) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: unexpected academy_schedules policy';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'academy_completion_history'
      and policy.policyname = 'academy_completion_family_select'
      and policy.permissive = 'PERMISSIVE'
      and policy.cmd = 'SELECT'
      and policy.roles = array['authenticated']::name[]
      and policy.with_check is null
      and position(
        'viewer.id=auth.uid'
        in replace(regexp_replace(lower(policy.qual), '[[:space:]()]', '', 'g'), '::text', '')
      ) > 0
      and position(
        'viewer.family_id=academy_completion_history.family_id'
        in replace(regexp_replace(lower(policy.qual), '[[:space:]()]', '', 'g'), '::text', '')
      ) > 0
      and position(
        'viewer.is_active=true'
        in replace(regexp_replace(lower(policy.qual), '[[:space:]()]', '', 'g'), '::text', '')
      ) > 0
      and position(
        'viewer.role=''parent'''
        in replace(regexp_replace(lower(policy.qual), '[[:space:]()]', '', 'g'), '::text', '')
      ) > 0
      and position(
        'viewer.id=academy_completion_history.member_id'
        in replace(regexp_replace(lower(policy.qual), '[[:space:]()]', '', 'g'), '::text', '')
      ) > 0
      and position(
        'ortrue'
        in replace(regexp_replace(lower(policy.qual), '[[:space:]()]', '', 'g'), '::text', '')
      ) = 0
  ) or exists (
    select 1
    from pg_catalog.pg_policy policy
    where policy.polrelid = 'public.academy_completion_history'::regclass
      and policy.polname <> 'academy_completion_family_select'
  ) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: unexpected academy completion policy';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policy policy
    where policy.polrelid = 'public.study_plans'::regclass
  ) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: unexpected study_plans policy';
  end if;

  if exists (
    with expected(table_name, role_name, privilege_types) as (
      values
        ('study_plans', 'anon', array['DELETE','INSERT','MAINTAIN','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE']::text[]),
        ('study_plans', 'authenticated', array['DELETE','INSERT','MAINTAIN','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE']::text[]),
        ('book_plans', 'anon', array['DELETE','INSERT','MAINTAIN','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE']::text[]),
        ('book_plans', 'authenticated', array['DELETE','INSERT','MAINTAIN','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE']::text[]),
        ('academy_schedules', 'anon', array['DELETE','INSERT','MAINTAIN','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE']::text[]),
        ('academy_schedules', 'authenticated', array['DELETE','INSERT','MAINTAIN','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE']::text[]),
        ('academy_completion_history', 'anon', array['MAINTAIN','REFERENCES','SELECT','TRIGGER','TRUNCATE']::text[]),
        ('academy_completion_history', 'authenticated', array['MAINTAIN','REFERENCES','SELECT','TRIGGER','TRUNCATE']::text[])
    ),
    actual as (
      select
        class.relname as table_name,
        grantee.rolname as role_name,
        array_agg(acl.privilege_type order by acl.privilege_type)::text[] as privilege_types,
        bool_or(acl.is_grantable) as has_grant_option
      from pg_catalog.pg_class class
      cross join lateral aclexplode(coalesce(
        class.relacl,
        acldefault('r', class.relowner)
      )) acl
      join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
      where class.oid in (
        'public.study_plans'::regclass,
        'public.book_plans'::regclass,
        'public.academy_schedules'::regclass,
        'public.academy_completion_history'::regclass
      )
        and grantee.rolname in ('anon', 'authenticated')
      group by class.relname, grantee.rolname
    )
    select 1
    from expected
    left join actual using (table_name, role_name)
    where coalesce(actual.privilege_types, array[]::text[])
            is distinct from expected.privilege_types
       or coalesce(actual.has_grant_option, false)
  ) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: browser table ACL baseline changed';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class class
    cross join lateral aclexplode(coalesce(class.relacl, acldefault('r', class.relowner))) acl
    where class.oid in (
      'public.study_plans'::regclass,
      'public.book_plans'::regclass,
      'public.academy_schedules'::regclass,
      'public.academy_completion_history'::regclass
    )
      and acl.grantee = 0
  ) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: unexpected PUBLIC table privilege';
  end if;

  if not coalesce((
    select role.rolbypassrls
    from pg_catalog.pg_roles role
    where role.rolname = 'service_role'
  ), false) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: service_role must bypass RLS';
  end if;

  if not (
    has_table_privilege('service_role', 'public.study_plans', 'SELECT, INSERT, UPDATE, DELETE')
    and has_table_privilege('service_role', 'public.book_plans', 'SELECT, INSERT, UPDATE, DELETE')
    and has_table_privilege('service_role', 'public.academy_schedules', 'SELECT, INSERT, UPDATE, DELETE')
    and has_table_privilege('service_role', 'public.academy_completion_history', 'SELECT, INSERT, UPDATE, DELETE')
  ) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: service_role table contract changed';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_publication_tables publication
    where publication.schemaname = 'public'
      and publication.tablename = 'academy_completion_history'
  ) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: academy completion publication state changed';
  end if;

  foreach function_name in array array[
    'public.create_book_plan_for_member(uuid,uuid,uuid,text,text,text,text,text,date,integer,integer,integer,integer[],text,text)',
    'public.create_reading_plan_for_member(uuid,uuid,uuid,text,text,integer,integer,integer[],date)',
    'public.reflow_book_plan_for_family(uuid,uuid,uuid,date)',
    'public.add_book_plan_review_for_family(uuid,uuid,uuid,integer,text)',
    'public.update_book_plan_pages_for_family(uuid,uuid,uuid,integer)',
    'public.delete_book_plan_task_for_family(uuid,uuid,text)',
    'public.complete_study_plan_with_reward_for_member(uuid,uuid,bigint,date)',
    'public.reflow_book_plan_for_assignee(uuid,uuid,uuid,uuid,date)',
    'public.add_book_plan_review_for_assignee(uuid,uuid,uuid,uuid,integer,text)',
    'public.update_book_plan_pages_for_assignee(uuid,uuid,uuid,uuid,integer)',
    'public.delete_book_plan_task_for_assignee(uuid,uuid,uuid,text)',
    'public.create_academy_schedule_for_assignee(uuid,uuid,uuid,text,integer,time without time zone,text,integer)',
    'public.update_academy_schedule_for_assignee(uuid,uuid,uuid,uuid,text,integer,time without time zone,text,integer)',
    'public.delete_academy_schedule_for_assignee(uuid,uuid,uuid,uuid)',
    'public.complete_academy_schedule_for_assignee(uuid,uuid,uuid,uuid,date)'
  ]
  loop
    if to_regprocedure(function_name) is null then
      raise exception using
        errcode = 'P0001',
        message = format('2A contract preflight failed: wrapper is missing: %s', function_name);
    end if;
    if not (
      select
        procedure.prosecdef
        and procedure.proowner = 'postgres'::regrole
        and procedure.proconfig @> array['search_path=pg_catalog, public']
        and has_function_privilege('service_role', procedure.oid, 'EXECUTE')
        and not has_function_privilege('anon', procedure.oid, 'EXECUTE')
        and not has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      from pg_catalog.pg_proc procedure
      where procedure.oid = to_regprocedure(function_name)
    ) then
      raise exception using
        errcode = 'P0001',
        message = format('2A contract preflight failed: wrapper security contract changed: %s', function_name);
    end if;
  end loop;

  if to_regprocedure(
    'public.complete_academy_schedule(uuid,uuid,uuid,date)'
  ) is null
     or not has_function_privilege(
       'service_role',
       'public.complete_academy_schedule(uuid,uuid,uuid,date)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.complete_academy_schedule(uuid,uuid,uuid,date)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.complete_academy_schedule(uuid,uuid,uuid,date)',
       'EXECUTE'
     ) then
    raise exception using
      errcode = 'P0001',
      message = '2A contract preflight failed: legacy academy completion grant changed';
  end if;

  foreach function_name in array array[
    'public.create_book_plan(text,text,text,text,text,date,integer,integer,integer,integer[],text,text)',
    'public.complete_study_plan_and_reschedule(bigint,date)'
  ]
  loop
    if to_regprocedure(function_name) is null
       or not has_function_privilege('anon', to_regprocedure(function_name), 'EXECUTE')
       or not has_function_privilege('authenticated', to_regprocedure(function_name), 'EXECUTE') then
      raise exception using
        errcode = 'P0001',
        message = format('2A contract preflight failed: legacy compatibility grant changed: %s', function_name);
    end if;
  end loop;
end
$preflight$;

-- Remove every browser-callable path that can mutate study_plans without the
-- family/member checks in the expand wrappers.
revoke all on function public.create_book_plan(
  text, text, text, text, text, date, integer, integer, integer, integer[], text, text
) from public, anon, authenticated;
grant execute on function public.create_book_plan(
  text, text, text, text, text, date, integer, integer, integer, integer[], text, text
) to service_role;

revoke all on function public.complete_study_plan_and_reschedule(bigint, date) from public, anon, authenticated;
grant execute on function public.complete_study_plan_and_reschedule(bigint, date) to service_role;

drop policy if exists "single user study plans access" on public.study_plans;
alter table public.study_plans enable row level security;
alter table public.study_plans no force row level security;
revoke all privileges on table public.study_plans from anon, authenticated;
grant select, insert, update, delete on table public.study_plans to service_role;

drop policy "book_plans_existing_app_access" on public.book_plans;
alter table public.book_plans enable row level security;
alter table public.book_plans no force row level security;
revoke all privileges on table public.book_plans from anon, authenticated;
grant select, insert, update, delete on table public.book_plans to service_role;

drop policy "academy_schedules_existing_app_access"
  on public.academy_schedules;
alter table public.academy_schedules enable row level security;
alter table public.academy_schedules no force row level security;
revoke all privileges on table public.academy_schedules
  from anon, authenticated;
grant select, insert, update, delete on table public.academy_schedules
  to service_role;

drop policy "academy_completion_family_select"
  on public.academy_completion_history;
alter table public.academy_completion_history enable row level security;
alter table public.academy_completion_history no force row level security;
revoke all privileges on table public.academy_completion_history
  from anon, authenticated;
grant select, insert, update, delete on table public.academy_completion_history
  to service_role;

do $postflight$
begin
  if exists (
    select 1
    from pg_catalog.pg_class class
    cross join lateral aclexplode(coalesce(class.relacl, acldefault('r', class.relowner))) acl
    join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
    where class.oid in (
      'public.study_plans'::regclass,
      'public.book_plans'::regclass,
      'public.academy_schedules'::regclass,
      'public.academy_completion_history'::regclass
    )
      and grantee.rolname in ('anon', 'authenticated')
  ) then
    raise exception using errcode = 'P0001', message = '2A contract postflight failed: browser table privilege remains';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policy policy
    where policy.polrelid in (
      'public.study_plans'::regclass,
      'public.book_plans'::regclass,
      'public.academy_schedules'::regclass,
      'public.academy_completion_history'::regclass
    )
  ) then
    raise exception using errcode = 'P0001', message = '2A contract postflight failed: browser policy remains';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';

commit;
