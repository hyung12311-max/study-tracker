\set ON_ERROR_STOP on

-- Disposable PostgreSQL 17 fixture only. It inherits the verified v1 contract.
\ir uat_family_provisioning_fixture.sql

-- Production Batch 5C keeps this function owner-internal for UAT provisioning.
revoke all on function public.set_family_member_pin(uuid, uuid, text)
  from public, anon, authenticated, service_role;

\ir ../../supabase/migrations/202608150004_uat_provisioning_v2_multi_child.sql

set role service_role;
select * from public.provision_uat_family_v2(
  '30000000-0000-4000-8000-000000000021',
  repeat('a', 64),
  'uat-b6-family-a',
  'UAT uat-b6-family-a',
  'parent',
  'UAT Parent A',
  '5827',
  '[
    {"member_key":"child1","display_name":"UAT Child A1","pin":"6941"},
    {"member_key":"child2","display_name":"UAT Child A2","pin":"7385"}
  ]'::jsonb
);
select * from public.provision_uat_family_v2(
  '30000000-0000-4000-8000-000000000022',
  repeat('b', 64),
  'uat-b6-family-b',
  'UAT uat-b6-family-b',
  'parent',
  'UAT Parent B',
  '8364',
  '[
    {"member_key":"child1","display_name":"UAT Child B1","pin":"9275"},
    {"member_key":"child2","display_name":"UAT Child B2","pin":"4618"}
  ]'::jsonb
);
reset role;

select public.fixture_assert(
  (
    select count(*) = 2
    from public.families
    where family_key in ('uat-b6-family-a', 'uat-b6-family-b')
  ) and (
    select count(*) = 6
    from public.family_members member
    join public.families family on family.id = member.family_id
    where family.family_key in ('uat-b6-family-a', 'uat-b6-family-b')
      and member.is_active
  ) and (
    select count(*) = 2
    from public.uat_family_provisioning_requests request
    join public.families family on family.id = request.family_id
    where family.family_key in ('uat-b6-family-a', 'uat-b6-family-b')
      and request.child_count = 2
  ),
  'v2 Parent plus two Children creation failed'
);

select public.fixture_assert(
  (
    select count(*) = 2 and count(distinct family_id) = 2
    from public.family_members
    where member_key = 'parent'
  ) and (
    select count(*) = 2 and count(distinct family_id) = 2
    from public.family_members
    where member_key = 'child1'
  ) and (
    select count(*) = 2 and count(distinct family_id) = 2
    from public.family_members
    where member_key = 'child2'
  ),
  'same logical keys across Families failed'
);

select public.fixture_assert(
  not exists (
    select 1
    from public.family_members member
    join public.families family on family.id = member.family_id
    where family.family_key = 'uat-b6-family-a'
      and member.family_id <> family.id
  ) and not exists (
    select 1
    from public.family_members member
    join public.families family on family.id = member.family_id
    where family.family_key = 'uat-b6-family-b'
      and member.family_id <> family.id
  ),
  'v2 cross-Family member relation found'
);

select public.fixture_assert(
  exists (
    select 1
    from public.family_members member
    join public.families family on family.id = member.family_id
    where family.family_key = 'uat-b6-family-a'
      and member.member_key = 'parent'
      and crypt('5827', member.pin_hash) = member.pin_hash
  ) and exists (
    select 1
    from public.family_members member
    join public.families family on family.id = member.family_id
    where family.family_key = 'uat-b6-family-a'
      and member.member_key = 'child2'
      and crypt('7385', member.pin_hash) = member.pin_hash
  ),
  'v2 owner-internal PIN setup failed'
);

set role service_role;
select public.fixture_expect_error(
  'duplicate child key',
  $$select * from public.provision_uat_family_v2(
    '30000000-0000-4000-8000-000000000023', repeat('c', 64),
    'uat-b6-duplicate', 'UAT uat-b6-duplicate',
    'parent', 'UAT Duplicate Parent', '5739',
    '[
      {"member_key":"child1","display_name":"UAT Duplicate Child 1","pin":"6814"},
      {"member_key":"child1","display_name":"UAT Duplicate Child 2","pin":"7925"}
    ]'::jsonb
  )$$,
  array['22023']
);
reset role;
select public.fixture_assert(
  not exists (select 1 from public.families where family_key = 'uat-b6-duplicate')
  and not exists (
    select 1 from public.uat_family_provisioning_requests
    where request_id = '30000000-0000-4000-8000-000000000023'
  ),
  'duplicate child key changed database state'
);

set role service_role;
select public.fixture_expect_error(
  'invalid second child atomic failure',
  $$select * from public.provision_uat_family_v2(
    '30000000-0000-4000-8000-000000000024', repeat('d', 64),
    'uat-b6-atomic', 'UAT uat-b6-atomic',
    'parent', 'UAT Atomic Parent', '5739',
    '[
      {"member_key":"child1","display_name":"UAT Atomic Child 1","pin":"6814"},
      {"member_key":"child2","display_name":"UAT Atomic Child 2","pin":"12"}
    ]'::jsonb
  )$$,
  array['22023']
);
reset role;
select public.fixture_assert(
  not exists (select 1 from public.families where family_key = 'uat-b6-atomic')
  and not exists (
    select 1 from public.family_members member
    join public.families family on family.id = member.family_id
    where family.family_key = 'uat-b6-atomic'
  ) and not exists (
    select 1 from public.uat_family_provisioning_requests
    where request_id = '30000000-0000-4000-8000-000000000024'
  ),
  'invalid second child changed database state'
);

set role service_role;
select public.fixture_expect_error(
  'existing v2 Family collision',
  $$select * from public.provision_uat_family_v2(
    '30000000-0000-4000-8000-000000000025', repeat('e', 64),
    'uat-b6-family-a', 'UAT uat-b6-family-a',
    'parent', 'UAT Other Parent', '5739',
    '[{"member_key":"child1","display_name":"UAT Other Child","pin":"6814"}]'::jsonb
  )$$,
  array['55000']
);
reset role;
select public.fixture_assert(
  (select count(*) = 1 from public.families where family_key = 'uat-b6-family-a')
  and (
    select count(*) = 3
    from public.family_members member
    join public.families family on family.id = member.family_id
    where family.family_key = 'uat-b6-family-a'
  ) and not exists (
    select 1 from public.uat_family_provisioning_requests
    where request_id = '30000000-0000-4000-8000-000000000025'
  ),
  'v2 Family collision changed database state'
);

set role service_role;
select * from public.provision_uat_family(
  '30000000-0000-4000-8000-000000000026',
  repeat('f', 64),
  'uat-v1-after-v2',
  'UAT uat-v1-after-v2',
  'uat-v1-after-v2-parent',
  'UAT V1 Parent',
  '5739',
  'uat-v1-after-v2-child',
  'UAT V1 Child',
  '6814'
);
reset role;
select public.fixture_assert(
  (select count(*) = 1 from public.families where family_key = 'uat-v1-after-v2')
  and (
    select count(*) = 2
    from public.family_members member
    join public.families family on family.id = member.family_id
    where family.family_key = 'uat-v1-after-v2'
  ) and (
    select child_count = 1
    from public.uat_family_provisioning_requests request
    join public.families family on family.id = request.family_id
    where family.family_key = 'uat-v1-after-v2'
  ),
  'v1 regression after v2 failed'
);

select public.fixture_assert(
  not has_function_privilege('anon', 'public.provision_uat_family_v2(uuid,text,text,text,text,text,text,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.provision_uat_family_v2(uuid,text,text,text,text,text,text,jsonb)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.provision_uat_family_v2(uuid,text,text,text,text,text,text,jsonb)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.set_family_member_pin(uuid,uuid,text)', 'EXECUTE'),
  'v2 provisioning ACL failed'
);

\ir ../../supabase/verification/202608150004_uat_provisioning_v2_multi_child_verify.sql
\ir ../../supabase/rollbacks/202608150004_rollback_uat_provisioning_v2_multi_child.sql

select public.fixture_assert(
  to_regprocedure('public.provision_uat_family_v2(uuid,text,text,text,text,text,text,jsonb)') is null
  and to_regprocedure('public.provision_uat_family(uuid,text,text,text,text,text,text,text,text,text)') is not null
  and exists (
    select 1 from public.families where family_key in ('uat-b6-family-a', 'uat-b6-family-b')
  ) and exists (
    select 1 from public.uat_family_provisioning_requests where child_count = 2
  ),
  'v2 rollback contract failed'
);

select 'UAT provisioning v2 multi-child fixture passed' as result;
