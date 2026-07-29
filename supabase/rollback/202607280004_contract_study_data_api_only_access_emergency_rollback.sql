-- CONTRACT emergency recovery only. This restores the verified pre-contract
-- browser-access contract and therefore reopens direct REST risk.
-- Prefer fixing or rolling forward the application/wrappers. The v2 and
-- Academy wrappers deliberately remain installed. This script restores the
-- exact verified pre-contract browser ACLs, including the dangerous
-- TRUNCATE/REFERENCES/TRIGGER/MAINTAIN privileges on all four relations.
-- A separate incident approval is required. Never run it as routine recovery
-- and never run it automatically.

begin;

lock table
  public.study_plans,
  public.book_plans,
  public.academy_schedules,
  public.academy_completion_history
in share row exclusive mode;

do $preflight$
begin
  if exists (
    select 1
    from (
      values
        ('study_plans'),
        ('book_plans'),
        ('academy_schedules'),
        ('academy_completion_history')
    ) target(table_name)
    left join pg_catalog.pg_class class
      on class.oid = to_regclass('public.' || target.table_name)
    where class.oid is null
       or not class.relrowsecurity
       or class.relforcerowsecurity
       or exists (
         select 1
         from pg_catalog.pg_policy policy
         where policy.polrelid = class.oid
       )
       or exists (
         select 1
         from aclexplode(coalesce(class.relacl, acldefault('r', class.relowner))) acl
         join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
         where grantee.rolname in ('anon', 'authenticated')
       )
  ) then
    raise exception using
      errcode = 'P0001',
      message = '2A emergency rollback preflight failed: database is not in the verified contract state';
  end if;

  if not coalesce((
    select role.rolbypassrls
    from pg_catalog.pg_roles role
    where role.rolname = 'service_role'
  ), false)
     or not (
       has_table_privilege('service_role', 'public.study_plans', 'SELECT, INSERT, UPDATE, DELETE')
       and has_table_privilege('service_role', 'public.book_plans', 'SELECT, INSERT, UPDATE, DELETE')
       and has_table_privilege('service_role', 'public.academy_schedules', 'SELECT, INSERT, UPDATE, DELETE')
       and has_table_privilege('service_role', 'public.academy_completion_history', 'SELECT, INSERT, UPDATE, DELETE')
     ) then
    raise exception using
      errcode = 'P0001',
      message = '2A emergency rollback preflight failed: service_role contract changed';
  end if;

  if has_function_privilege(
       'anon',
       'public.create_book_plan(text,text,text,text,text,date,integer,integer,integer,integer[],text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.complete_study_plan_and_reschedule(bigint,date)',
       'EXECUTE'
     ) then
    raise exception using
      errcode = 'P0001',
      message = '2A emergency rollback preflight failed: legacy RPC access is already open';
  end if;
end
$preflight$;

alter table public.study_plans disable row level security;
grant all privileges on table public.study_plans to anon, authenticated;

drop policy if exists "book_plans_existing_app_access" on public.book_plans;
create policy "book_plans_existing_app_access"
  on public.book_plans
  for all
  to anon, authenticated
  using (true)
  with check (true);
alter table public.book_plans enable row level security;
alter table public.book_plans no force row level security;
grant all privileges on table public.book_plans to anon, authenticated;

drop policy if exists "academy_schedules_existing_app_access"
  on public.academy_schedules;
create policy "academy_schedules_existing_app_access"
  on public.academy_schedules
  for all
  to anon, authenticated
  using (true)
  with check (true);
alter table public.academy_schedules enable row level security;
alter table public.academy_schedules no force row level security;
grant all privileges on table public.academy_schedules
  to anon, authenticated;

drop policy if exists "academy_completion_family_select"
  on public.academy_completion_history;
create policy "academy_completion_family_select"
  on public.academy_completion_history
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.family_members viewer
      where viewer.id = auth.uid()
        and viewer.family_id = academy_completion_history.family_id
        and viewer.is_active = true
        and (
          viewer.role = 'parent'
          or viewer.id = academy_completion_history.member_id
        )
    )
  );
alter table public.academy_completion_history enable row level security;
alter table public.academy_completion_history no force row level security;
grant select, truncate, references, trigger, maintain
  on table public.academy_completion_history
  to anon, authenticated;

grant execute on function public.create_book_plan(
  text, text, text, text, text, date, integer, integer, integer, integer[], text, text
) to anon, authenticated;
grant execute on function public.complete_study_plan_and_reschedule(bigint, date)
  to anon, authenticated;

do $postflight$
begin
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
  ) or exists (
    select 1
    from pg_catalog.pg_class class
    cross join lateral aclexplode(coalesce(
      class.relacl,
      acldefault('r', class.relowner)
    )) acl
    where class.oid in (
      'public.study_plans'::regclass,
      'public.book_plans'::regclass,
      'public.academy_schedules'::regclass,
      'public.academy_completion_history'::regclass
    )
      and acl.grantee = 0
  ) then
    raise exception using
      errcode = 'P0001',
      message = '2A emergency rollback postflight failed: exact browser ACL baseline was not restored';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'academy_schedules'
      and policy.policyname = 'academy_schedules_existing_app_access'
      and policy.cmd = 'ALL'
      and policy.roles @> array['anon', 'authenticated']::name[]
      and cardinality(policy.roles) = 2
      and trim(coalesce(policy.qual, '')) in ('true', '(true)')
      and trim(coalesce(policy.with_check, '')) in ('true', '(true)')
  ) or not exists (
    select 1
    from pg_catalog.pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'academy_completion_history'
      and policy.policyname = 'academy_completion_family_select'
      and policy.cmd = 'SELECT'
      and policy.roles = array['authenticated']::name[]
      and policy.with_check is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = '2A emergency rollback postflight failed: academy browser policy was not restored';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';

commit;
