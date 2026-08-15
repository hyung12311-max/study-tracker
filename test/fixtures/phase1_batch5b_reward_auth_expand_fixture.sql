\set ON_ERROR_STOP on
\ir phase1_batch5b_isolated_bootstrap.sql
\ir ../../supabase/migrations/202608150002_reward_auth_expand_contract.sql
\ir ../../supabase/verification/202608150002_reward_auth_expand_contract_verify.sql

do $backfill$
begin
  if (select count(*) from public.reward_settings)<>1
    or (select count(*) from public.family_reward_settings)<>1
    or not exists(select 1 from public.family_reward_settings where family_id='10000000-0000-4000-8000-000000000001' and target_stickers=17 and reward_name='Legacy reward') then
    raise exception 'reward setting deterministic backfill/parity failed';
  end if;
end
$backfill$;

set role service_role;
select (public.create_reward_exchange_request_v2(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','parent_request_0001')).id is not null as parent_exchange_pass;
select (public.create_reward_exchange_request_v2(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003',
 '20000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','child_request_0001')).id is not null as child_exchange_pass;
reset role;

select public.fixture_expect_error('cross-family target exchange',$$
 select public.create_reward_exchange_request_v2('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000001','cross_target_0001')$$,array['P0002']);
select public.fixture_expect_error('cross-family product exchange',$$
 select public.create_reward_exchange_request_v2('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','cross_product_001')$$,array['P0002']);
select public.fixture_expect_error('child sibling exchange',$$
 select public.create_reward_exchange_request_v2('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','sibling_req_0001')$$,array['42501']);

create temporary table pin_before as select pin_hash,failed_attempts,locked_until from public.family_members where id='20000000-0000-4000-8000-000000000005';
select public.fixture_expect_error('cross-family PIN',$$
 select public.set_family_member_pin_v2('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','9753')$$,array['P0002']);
select public.fixture_expect_error('PIN role drift',$$
 select public.set_family_member_pin_v2('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','9753')$$,array['42501']);
do $pin_zero_delta$
begin
  if exists(select 1 from public.family_members member cross join pin_before before where member.id='20000000-0000-4000-8000-000000000005' and (member.pin_hash,member.failed_attempts,member.locked_until) is distinct from (before.pin_hash,before.failed_attempts,before.locked_until)) then
    raise exception 'cross-family PIN changed protected state';
  end if;
end
$pin_zero_delta$;
set role service_role;
select public.set_family_member_pin_v2('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','9753');
reset role;
do $pin_positive$
begin
  if not exists(select 1 from public.family_members where id='20000000-0000-4000-8000-000000000002' and extensions.crypt('9753',pin_hash)=pin_hash and failed_attempts=0 and locked_until is null) then
    raise exception 'positive PIN hash semantics failed';
  end if;
end
$pin_positive$;

\ir ../../supabase/rollbacks/202608150002_rollback_reward_auth_expand_contract.sql
do $rollback_preservation$
begin
  if to_regprocedure('public.create_reward_exchange_request_v2(uuid,uuid,uuid,uuid,text)') is not null
    or to_regprocedure('public.set_family_member_pin_v2(uuid,uuid,uuid,text)') is not null
    or (select count(*) from public.family_reward_settings)<>1 then
    raise exception 'Batch 5B rollback contract failed';
  end if;
end
$rollback_preservation$;

select 'Phase 1 Batch 5B reward/auth expand fixture passed' result;
