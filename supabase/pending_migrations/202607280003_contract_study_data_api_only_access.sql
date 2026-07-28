-- CONTRACT phase for the Phase 2A study data security rollout.
--
-- This file is intentionally outside supabase/migrations so `supabase db push`
-- cannot apply it in the same batch as the expand migration. Promote this exact
-- file to supabase/migrations only after:
--   1. 202607280001 and 202607280002 expand verification passes,
--   2. the new application is deployed, and
--   3. parent, Hagyeom, and Dayul regression checks pass.
--
-- reading_plans is intentionally not changed here. The application no longer
-- has a browser table path for it, but its exact Production table grants and
-- policies were not part of the verified legacy metadata contract. A future
-- read-only inventory must precede any destructive reading_plans change.

begin;

lock table public.study_plans, public.book_plans in share row exclusive mode;

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

  if (
    select class.relforcerowsecurity
    from pg_catalog.pg_class class
    where class.oid = 'public.study_plans'::regclass
  ) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: unexpected FORCE RLS state';
  end if;

  if not (
    select class.relrowsecurity and not class.relforcerowsecurity
    from pg_catalog.pg_class class
    where class.oid = 'public.book_plans'::regclass
  ) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: unexpected book_plans RLS state';
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

  if exists (
    select 1
    from pg_catalog.pg_policy policy
    where policy.polrelid = 'public.study_plans'::regclass
      and policy.polname <> 'single user study plans access'
  ) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: unexpected study_plans policy';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class class
    cross join lateral aclexplode(coalesce(
      class.relacl,
      acldefault('r', class.relowner)
    )) acl
    where class.oid = 'public.book_plans'::regclass
      and acl.grantee = 0
      and acl.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: unexpected PUBLIC book table privilege';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'public'
      and grant_row.table_name in ('study_plans', 'book_plans')
      and grant_row.grantee in ('anon', 'authenticated')
      and grant_row.privilege_type not in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: unexpected browser table privilege';
  end if;

  if not (
    has_table_privilege('anon', 'public.study_plans', 'SELECT')
    and has_table_privilege('anon', 'public.study_plans', 'INSERT')
    and has_table_privilege('anon', 'public.study_plans', 'UPDATE')
    and has_table_privilege('anon', 'public.study_plans', 'DELETE')
    and has_table_privilege('authenticated', 'public.study_plans', 'SELECT')
    and has_table_privilege('authenticated', 'public.study_plans', 'INSERT')
    and has_table_privilege('authenticated', 'public.study_plans', 'UPDATE')
    and has_table_privilege('authenticated', 'public.study_plans', 'DELETE')
  ) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: legacy browser CRUD grant changed';
  end if;

  if not (
    has_table_privilege('anon', 'public.book_plans', 'SELECT')
    and has_table_privilege('anon', 'public.book_plans', 'INSERT')
    and has_table_privilege('anon', 'public.book_plans', 'UPDATE')
    and has_table_privilege('anon', 'public.book_plans', 'DELETE')
    and has_table_privilege('authenticated', 'public.book_plans', 'SELECT')
    and has_table_privilege('authenticated', 'public.book_plans', 'INSERT')
    and has_table_privilege('authenticated', 'public.book_plans', 'UPDATE')
    and has_table_privilege('authenticated', 'public.book_plans', 'DELETE')
  ) then
    raise exception using errcode = 'P0001', message = '2A contract preflight failed: legacy book browser CRUD grant changed';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class class
    cross join lateral aclexplode(coalesce(
      class.relacl,
      acldefault('r', class.relowner)
    )) acl
    where class.oid = 'public.study_plans'::regclass
      and acl.grantee = 0
      and acl.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
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
    'public.delete_book_plan_task_for_assignee(uuid,uuid,uuid,text)'
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

notify pgrst, 'reload schema';

commit;
