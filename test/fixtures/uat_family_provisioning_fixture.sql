\set ON_ERROR_STOP on

-- Disposable UAT provisioning fixture. No Production connection or identifiers.
\ir phase2b_isolated_bootstrap.sql

alter table public.family_members
  add column pin_hash text,
  add column failed_attempts integer not null default 0,
  add column locked_until timestamptz;

create function public.set_family_member_pin(p_member_id uuid, p_family_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $function$
begin
  if p_pin !~ '^\d{4}$' then
    raise exception using errcode = '22023', message = 'invalid pin';
  end if;
  update public.family_members
  set pin_hash = crypt(p_pin, gen_salt('bf', 4)), failed_attempts = 0, locked_until = null
  where id = p_member_id and family_id = p_family_id;
end
$function$;

create function public.fixture_assert(p_condition boolean, p_message text)
returns void
language plpgsql
as $function$
begin
  if not coalesce(p_condition, false) then
    raise exception using errcode = 'P0001', message = 'fixture assertion failed: ' || p_message;
  end if;
end
$function$;

create function public.fixture_expect_error(p_case text, p_sql text, p_expected_states text[])
returns void
language plpgsql
as $function$
declare
  actual_state text;
begin
  begin
    execute p_sql;
  exception when others then
    actual_state := sqlstate;
  end;
  if actual_state is null or not actual_state = any(p_expected_states) then
    raise exception using errcode = 'P0001', message = 'fixture expected error failed: ' || p_case;
  end if;
end
$function$;

insert into public.families (id, family_key, display_name)
values ('10000000-0000-4000-8000-000000000001', 'existing-fixture', 'Existing Fixture');

insert into public.family_members (id, family_id, member_key, display_name, role, is_active)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'existing-parent',
  'Existing Parent',
  'parent',
  true
);

\ir ../../supabase/migrations/202608100011_create_uat_family_provisioning.sql

set role service_role;
select created as first_created
from public.provision_uat_family(
  '30000000-0000-4000-8000-000000000001',
  repeat('a', 64),
  'uat-fixture-one',
  'UAT uat-fixture-one',
  'uat-fixture-one-parent',
  'UAT Parent',
  '5827',
  'uat-fixture-one-child',
  'UAT Child',
  '6941'
)
\gset
reset role;

select public.fixture_assert(:'first_created'::boolean, 'first provisioning did not create rows');

select public.fixture_assert(
  (select count(*) = 1 from public.families where family_key = 'uat-fixture-one')
  and (
    select count(*) = 2
    from public.family_members member
    join public.families family on family.id = member.family_id
    where family.family_key = 'uat-fixture-one'
      and member.is_active = true
  )
  and exists (
    select 1
    from public.family_members member
    join public.families family on family.id = member.family_id
    where family.family_key = 'uat-fixture-one'
      and member.member_key = 'uat-fixture-one-parent'
      and member.role = 'parent'
  )
  and exists (
    select 1
    from public.family_members member
    join public.families family on family.id = member.family_id
    where family.family_key = 'uat-fixture-one'
      and member.member_key = 'uat-fixture-one-child'
      and member.role = 'child'
  ),
  'UAT family and member creation failed'
);

select public.fixture_assert(
  exists (
    select 1
    from public.family_members member
    where member.member_key = 'uat-fixture-one-parent'
      and member.pin_hash <> '5827'
      and crypt('5827', member.pin_hash) = member.pin_hash
  )
  and exists (
    select 1
    from public.family_members member
    where member.member_key = 'uat-fixture-one-child'
      and member.pin_hash <> '6941'
      and crypt('6941', member.pin_hash) = member.pin_hash
  ),
  'bootstrap PIN hashing contract failed'
);

set role service_role;
select created as retry_created
from public.provision_uat_family(
  '30000000-0000-4000-8000-000000000001',
  repeat('a', 64),
  'uat-fixture-one',
  'UAT uat-fixture-one',
  'uat-fixture-one-parent',
  'UAT Parent',
  '9275',
  'uat-fixture-one-child',
  'UAT Child',
  '8364'
)
\gset
reset role;

select public.fixture_assert(
  not :'retry_created'::boolean
  and (select count(*) = 2 from public.families)
  and (select count(*) = 3 from public.family_members)
  and (select count(*) = 1 from public.uat_family_provisioning_requests)
  and exists (
    select 1 from public.family_members
    where member_key = 'uat-fixture-one-parent'
      and crypt('5827', pin_hash) = pin_hash
      and crypt('9275', pin_hash) <> pin_hash
  ),
  'idempotent retry changed UAT rows'
);

select public.fixture_assert(
  (select display_name = 'Existing Fixture' from public.families where family_key = 'existing-fixture')
  and (
    select display_name = 'Existing Parent' and role = 'parent' and is_active
    from public.family_members where member_key = 'existing-parent'
  ),
  'existing family changed during provisioning'
);

select public.fixture_expect_error(
  'request ID reused with another payload',
  $$select * from public.provision_uat_family(
    '30000000-0000-4000-8000-000000000001', repeat('b', 64),
    'uat-fixture-one', 'UAT uat-fixture-one',
    'uat-fixture-one-parent', 'UAT Parent', '5827',
    'uat-fixture-one-child', 'UAT Child', '6941'
  )$$,
  array['55000']
);

select public.fixture_expect_error(
  'another request cannot adopt an existing UAT family',
  $$select * from public.provision_uat_family(
    '30000000-0000-4000-8000-000000000002', repeat('c', 64),
    'uat-fixture-one', 'UAT uat-fixture-one',
    'uat-fixture-one-parent', 'UAT Parent', '5827',
    'uat-fixture-one-child', 'UAT Child', '6941'
  )$$,
  array['55000']
);

select public.fixture_expect_error(
  'non-UAT family is rejected in the database',
  $$select * from public.provision_uat_family(
    '30000000-0000-4000-8000-000000000003', repeat('d', 64),
    'customer-family', 'UAT customer-family',
    'customer-family-parent', 'UAT Parent', '5827',
    'customer-family-child', 'UAT Child', '6941'
  )$$,
  array['22023']
);

select public.fixture_assert(
  not has_table_privilege('anon', 'public.uat_family_provisioning_requests', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.uat_family_provisioning_requests', 'SELECT,INSERT,UPDATE,DELETE')
  and has_table_privilege('service_role', 'public.uat_family_provisioning_requests', 'SELECT')
  and not has_table_privilege('service_role', 'public.uat_family_provisioning_requests', 'INSERT,UPDATE,DELETE')
  and not has_function_privilege('anon', 'public.provision_uat_family(uuid,text,text,text,text,text,text,text,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.provision_uat_family(uuid,text,text,text,text,text,text,text,text,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.provision_uat_family(uuid,text,text,text,text,text,text,text,text,text)', 'EXECUTE'),
  'provisioning ACL failed'
);

select public.fixture_expect_error(
  'immutable provisioning audit',
  $$update public.uat_family_provisioning_requests set purpose = 'uat'$$,
  array['55000']
);

select public.fixture_expect_error(
  'rollback guard with persisted UAT audit',
  $sql$do $guard$
    begin
      if exists (select 1 from public.uat_family_provisioning_requests) then
        raise exception using errcode = '55000', message = 'UAT family provisioning is in use';
      end if;
    end
  $guard$$sql$,
  array['55000']
);

\ir ../../supabase/verification/202608100011_uat_family_provisioning_verify.sql

select 'UAT family provisioning fixture passed' as result;
