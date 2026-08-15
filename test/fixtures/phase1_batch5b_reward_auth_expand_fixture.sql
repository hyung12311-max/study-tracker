\set ON_ERROR_STOP on
\ir phase1_batch5b_isolated_bootstrap.sql
\ir ../../supabase/migrations/202608150002_reward_auth_expand_contract.sql
\ir ../../supabase/verification/202608150002_reward_auth_expand_contract_verify.sql

do $authoritative_base$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='reward_products'
      and column_name in ('available_from','available_until')
  ) then
    raise exception '202608150004 authoritative fixture must not pre-create availability columns';
  end if;
end
$authoritative_base$;

\ir ../../supabase/migrations/202608160001_reward_product_availability_contract.sql
\ir ../../supabase/verification/202608160001_reward_product_availability_contract_verify.sql

do $backfill$
begin
  if (select count(*) from public.reward_settings)<>1
    or (select count(*) from public.family_reward_settings)<>1
    or not exists(select 1 from public.family_reward_settings where family_id='10000000-0000-4000-8000-000000000001' and target_stickers=17 and reward_name='Legacy reward') then
    raise exception 'reward setting deterministic backfill/parity failed';
  end if;
end
$backfill$;

do $availability_preservation$
begin
  if (select count(*) from public.reward_products)<>2
    or not exists(select 1 from public.reward_products where id='40000000-0000-4000-8000-000000000001' and family_id='10000000-0000-4000-8000-000000000001' and name='Product A' and sticker_cost=5 and stock=10 and is_active=true and available_from is null and available_until is null)
    or not exists(select 1 from public.reward_products where id='40000000-0000-4000-8000-000000000002' and family_id='10000000-0000-4000-8000-000000000002' and name='Product B' and sticker_cost=5 and stock=10 and is_active=true and available_from is null and available_until is null) then
    raise exception 'existing reward product preservation failed';
  end if;
end
$availability_preservation$;

set role service_role;
select (public.create_reward_exchange_request_v2(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','parent_request_0001')).id is not null as parent_exchange_pass;
select (public.create_reward_exchange_request_v2(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003',
 '20000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','child_request_0001')).id is not null as child_exchange_pass;
reset role;

insert into public.reward_products(id,family_id,name,emoji,sticker_cost,stock,is_active,available_from,available_until) values
 ('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Expensive','E',50,10,true,null,null),
 ('40000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Future','F',1,10,true,now()+interval '1 day',null),
 ('40000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','Expired','X',1,10,true,null,now()-interval '1 day'),
 ('40000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','Window','W',1,10,true,now()-interval '1 day',now()+interval '1 day'),
 ('40000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','Null window','N',1,10,true,null,null);

select public.fixture_expect_error('insufficient balance exchange',$$
 select public.create_reward_exchange_request_v2('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000003','insufficient_0001')$$,array['55000']);
select public.fixture_expect_error('future availability exchange',$$
 select public.create_reward_exchange_request_v2('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000004','future_window_001')$$,array['55000']);
select public.fixture_expect_error('expired availability exchange',$$
 select public.create_reward_exchange_request_v2('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000005','expired_window_1')$$,array['55000']);

set role service_role;
select (public.create_reward_exchange_request_v2(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',
 '20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000006','window_positive_1')).id is not null as window_exchange_pass;
select (public.create_reward_exchange_request_v2(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',
 '20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000007','null_window_0001')).id is not null as null_window_exchange_pass;
reset role;

select public.fixture_expect_error('invalid availability ordering',$$
 insert into public.reward_products(id,family_id,name,emoji,sticker_cost,stock,is_active,available_from,available_until)
 values('40000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','Invalid','I',1,1,true,now()+interval '1 day',now())$$,array['23514']);

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
