\set ON_ERROR_STOP on

\ir phase1_batch5b_isolated_bootstrap.sql

alter table public.families alter column id set default extensions.gen_random_uuid();
alter table public.families add column display_name text;
update public.families set display_name=family_key;
alter table public.families alter column display_name set not null;
alter table public.family_members alter column id set default extensions.gen_random_uuid();
alter table public.family_members add constraint family_members_family_id_id_key unique(family_id,id);

create or replace function public.set_family_member_pin(p_member_id uuid,p_family_id uuid,p_pin text)
returns void
language plpgsql
security definer
set search_path=public, extensions
as $function$
begin
  update public.family_members
  set pin_hash=extensions.crypt(p_pin,extensions.gen_salt('bf',4)),failed_attempts=0,locked_until=null,updated_at=now()
  where id=p_member_id and family_id=p_family_id;
  if not found then raise exception using errcode='P0002',message='member not found'; end if;
end
$function$;
alter function public.create_reward_exchange_request(uuid,uuid,uuid,text) security definer;
alter function public.create_reward_exchange_request(uuid,uuid,uuid,text) set search_path=public;
alter function public.set_family_member_pin(uuid,uuid,text) owner to postgres;
alter function public.create_reward_exchange_request(uuid,uuid,uuid,text) owner to postgres;
revoke all on function public.create_reward_exchange_request(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.set_family_member_pin(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.create_reward_exchange_request(uuid,uuid,uuid,text) to service_role;
grant execute on function public.set_family_member_pin(uuid,uuid,text) to service_role;

alter table public.reward_settings enable row level security;
alter table public.reward_settings force row level security;
revoke all on table public.reward_settings from public,anon,authenticated,service_role;
grant select on table public.reward_settings to service_role;
alter table public.family_reward_settings enable row level security;
alter table public.family_reward_settings force row level security;
revoke all on table public.family_reward_settings from public,anon,authenticated,service_role;
grant select,insert,update,delete on table public.family_reward_settings to service_role;

create table public.push_subscriptions(endpoint text primary key,is_active boolean not null default true);
alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from public,anon,authenticated,service_role;
grant select,insert,update,delete on table public.push_subscriptions to service_role;
create table public.family_push_subscriptions(id uuid primary key default extensions.gen_random_uuid(),family_id uuid not null references public.families(id));
alter table public.family_push_subscriptions enable row level security;
revoke all on table public.family_push_subscriptions from public,anon,authenticated,service_role;
grant select,insert,update,delete on table public.family_push_subscriptions to service_role;

\ir ../../supabase/migrations/202608100011_create_uat_family_provisioning.sql
\ir ../../supabase/migrations/202608150002_reward_auth_expand_contract.sql
\ir ../../supabase/migrations/202608150003_legacy_contract_cleanup.sql
\ir ../../supabase/verification/202608150003_legacy_contract_cleanup_verify.sql

set role service_role;
select (public.create_reward_exchange_request_v2(
  '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','batch5c_v2_positive_1'
)).id is not null as exchange_v2_positive;
select public.set_family_member_pin_v2(
  '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002','9753'
);
select count(*)=1 as scoped_reward_read_pass from public.family_reward_settings where family_id='10000000-0000-4000-8000-000000000001';
select public.fixture_expect_error('legacy Exchange direct execute',$$
  select public.create_reward_exchange_request('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','legacy_denied_001')
$$,array['42501']);
select public.fixture_expect_error('legacy PIN direct execute',$$
  select public.set_family_member_pin('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','8642')
$$,array['42501']);
select public.fixture_expect_error('legacy reward table direct read',$$
  select * from public.reward_settings
$$,array['42501']);
select public.fixture_expect_error('legacy Push table direct read',$$
  select * from public.push_subscriptions
$$,array['42501']);
select * from public.provision_uat_family(
  '60000000-0000-4000-8000-000000000001',repeat('a',64),'uat-batch5c','UAT uat-batch5c',
  'uat-batch5c-parent','UAT Parent','2468','uat-batch5c-child','UAT Child','1357'
);
reset role;

select public.fixture_expect_error('v2 cross-family exchange',$$
  select public.create_reward_exchange_request_v2('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000001','batch5c_cross_001')
$$,array['P0002']);
select public.fixture_expect_error('v2 cross-family PIN',$$
  select public.set_family_member_pin_v2('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','8642')
$$,array['P0002']);

do $uat_internal_pin$
begin
  if not exists (
    select 1
    from public.family_members member
    join public.families family on family.id=member.family_id
    where family.family_key='uat-batch5c' and member.member_key='uat-batch5c-parent'
      and extensions.crypt('2468',member.pin_hash)=member.pin_hash
  ) or not exists (
    select 1
    from public.family_members member
    join public.families family on family.id=member.family_id
    where family.family_key='uat-batch5c' and member.member_key='uat-batch5c-child'
      and extensions.crypt('1357',member.pin_hash)=member.pin_hash
  ) then
    raise exception 'UAT internal PIN provisioning failed';
  end if;
end
$uat_internal_pin$;

\ir ../../supabase/verification/202608150003_legacy_contract_cleanup_verify.sql

create temporary table batch5c_business_counts as
select
  (select count(*) from public.families) families,
  (select count(*) from public.family_members) members,
  (select count(*) from public.reward_settings) legacy_settings,
  (select count(*) from public.family_reward_settings) scoped_settings,
  (select count(*) from public.reward_exchange_requests) exchange_requests,
  (select count(*) from public.push_subscriptions) legacy_push;

\ir ../../supabase/rollbacks/202608150003_rollback_legacy_contract_cleanup.sql

do $rollback_contract$
begin
  if not has_function_privilege('service_role','public.create_reward_exchange_request(uuid,uuid,uuid,text)','execute')
     or not has_function_privilege('service_role','public.set_family_member_pin(uuid,uuid,text)','execute')
     or not has_table_privilege('service_role','public.reward_settings','select')
     or not has_table_privilege('service_role','public.push_subscriptions','select')
     or (select relforcerowsecurity from pg_catalog.pg_class where oid='public.push_subscriptions'::regclass)
     or exists (
       select 1 from batch5c_business_counts before
       where (before.families,before.members,before.legacy_settings,before.scoped_settings,before.exchange_requests,before.legacy_push)
         is distinct from (
           (select count(*) from public.families),
           (select count(*) from public.family_members),
           (select count(*) from public.reward_settings),
           (select count(*) from public.family_reward_settings),
           (select count(*) from public.reward_exchange_requests),
           (select count(*) from public.push_subscriptions)
         )
     ) then
    raise exception 'Batch 5C rollback contract failed';
  end if;
end
$rollback_contract$;

select 'Phase 1 Batch 5C legacy contract cleanup fixture passed' as result;
