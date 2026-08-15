\set ON_ERROR_STOP on

\ir phase1_batch5a_core_composite_integrity_fixture.sql

-- Identical member keys remain legal only when their Family differs.
insert into public.family_members(id,family_id,member_key) values
 ('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','shared-parent'),
 ('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','shared-child'),
 ('20000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000002','shared-parent'),
 ('20000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000002','shared-child');

do $collision_contract$
begin
  if (select count(*) from public.family_members where member_key='shared-parent')<>2
     or (select count(distinct family_id) from public.family_members where member_key='shared-parent')<>2
     or (select count(*) from public.family_members where member_key='shared-child')<>2
     or (select count(distinct family_id) from public.family_members where member_key='shared-child')<>2 then
    raise exception 'Batch 6 same-key Family isolation failed';
  end if;
end
$collision_contract$;

select public.fixture_expect_error('same-family member key collision', $$
 insert into public.family_members(id,family_id,member_key) values
 ('20000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001','shared-child')$$, array['23505']);

-- Existing attempt/question ownership rejects a cross-attempt answer chain.
select public.fixture_expect_error('attempt answer question cross-family', $$
 insert into public.learning_attempt_answers(id,attempt_id,attempt_question_id) values
 ('55000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000002')$$, array['23503']);

-- Composite constraints protect UPDATE paths as well as INSERT paths.
select public.fixture_expect_error('message sender update cross-family', $$
 update public.family_messages set sender_id='20000000-0000-4000-8000-000000000003'
 where id='30000000-0000-4000-8000-000000000001'$$, array['23503']);
select public.fixture_expect_error('reward product update cross-family', $$
 update public.reward_exchange_requests set product_id='60000000-0000-4000-8000-000000000002'
 where id='61000000-0000-4000-8000-000000000001'$$, array['23503']);
select public.fixture_expect_error('push member update cross-family', $$
 update public.family_push_subscriptions set member_id='20000000-0000-4000-8000-000000000004'
 where id='70000000-0000-4000-8000-000000000001'$$, array['23503']);

-- Same-Family equivalents remain valid.
update public.family_messages set sender_id='20000000-0000-4000-8000-000000000001'
where id='30000000-0000-4000-8000-000000000001';
update public.reward_exchange_requests set product_id='60000000-0000-4000-8000-000000000001'
where id='61000000-0000-4000-8000-000000000001';
update public.family_push_subscriptions set member_id='20000000-0000-4000-8000-000000000002'
where id='70000000-0000-4000-8000-000000000001';

do $zero_violation$
begin
  if exists (
    select 1 from public.family_messages message
    join public.family_members sender on sender.id=message.sender_id
    where sender.family_id<>message.family_id
  ) or exists (
    select 1 from public.reward_exchange_requests request
    join public.family_members member on member.id=request.member_id
    where member.family_id<>request.family_id
  ) or exists (
    select 1 from public.reward_exchange_requests request
    join public.reward_products product on product.id=request.product_id
    where product.family_id<>request.family_id
  ) or exists (
    select 1 from public.family_push_subscriptions subscription
    join public.family_members member on member.id=subscription.member_id
    where member.family_id<>subscription.family_id
  ) then
    raise exception 'Batch 6 tenant violation remains';
  end if;
end
$zero_violation$;

select 'Phase 1 Batch 6 two-family security validation fixture passed' as result;
