\set ON_ERROR_STOP on
\ir phase1_batch5a_isolated_bootstrap.sql
\ir ../../supabase/migrations/202608150001_core_composite_tenant_integrity.sql
\ir ../../supabase/verification/202608150001_core_composite_tenant_integrity_verify.sql

-- Existing valid data was backfilled from trusted parents and preserved.
do $preservation$
declare b record;
begin
  select * into b from batch5a_before;
  if b.message_reads<>(select count(*) from public.family_message_reads)
    or b.revisions<>(select count(*) from public.learning_assignment_plan_revisions)
    or b.review_items<>(select count(*) from public.learning_mistake_review_items)
    or b.reward_requests<>(select count(*) from public.reward_exchange_requests)
    or b.ledger_rows<>(select count(*) from public.sticker_transactions)
    or b.push_rows<>(select count(*) from public.family_push_subscriptions)
    or b.message_content<>(select content from public.family_messages where id='30000000-0000-4000-8000-000000000001')
    or b.revision_number<>(select revision from public.learning_assignment_plan_revisions where id='41000000-0000-4000-8000-000000000001')
    or b.product_name<>(select name from public.reward_products where id='60000000-0000-4000-8000-000000000001')
  then raise exception 'Batch 5A existing data preservation failed'; end if;
  if exists(select 1 from public.family_message_reads where family_id is null)
    or exists(select 1 from public.learning_assignment_plan_revisions where family_id is null)
    or exists(select 1 from public.learning_mistake_review_items where family_id is null or source_stage_id is null)
    or exists(select 1 from public.learning_mistake_review_events where family_id is null)
  then raise exception 'Batch 5A backfill completeness failed'; end if;
end
$preservation$;

-- Same-family writers keep their old signatures: derived columns are omitted.
insert into public.family_message_reads(id,message_id,member_id) values
 ('31000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004');
insert into public.learning_assignment_plan_revisions(id,plan_id,changed_by_member_id,revision) values
 ('41000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003',1);
insert into public.learning_mistake_review_items(id,session_id,source_attempt_id,source_attempt_question_id,source_answer_id,display_order) values
 ('57000000-0000-4000-8000-000000000002','56000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000002','55000000-0000-4000-8000-000000000002',1);
insert into public.learning_mistake_review_events(id,session_id,actor_member_id) values
 ('58000000-0000-4000-8000-000000000002','56000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003');
insert into public.reward_wishlist values
 ('63000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004','60000000-0000-4000-8000-000000000002');
insert into public.family_push_subscriptions values
 ('70000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004','https://fixture/b');
insert into public.family_notification_preferences values
 ('10000000-0000-4000-8000-000000000002','child-b');

select public.fixture_expect_error('message read cross-family', $$
 insert into public.family_message_reads(id,message_id,member_id) values
 ('31000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004')$$, array['23503']);
select public.fixture_expect_error('message sender cross-family', $$
 insert into public.family_messages values
 ('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','bad')$$, array['23503']);

select public.fixture_expect_error('planning revision actor cross-family', $$
 insert into public.learning_assignment_plan_revisions(id,plan_id,changed_by_member_id,revision) values
 ('41000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003',2)$$, array['23503']);

select public.fixture_expect_error('review item attempt cross-family', $$
 insert into public.learning_mistake_review_items(id,session_id,source_attempt_id,source_attempt_question_id,source_answer_id,display_order) values
 ('57000000-0000-4000-8000-000000000003','56000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000002','55000000-0000-4000-8000-000000000002',2)$$, array['23503']);
select public.fixture_expect_error('review event actor cross-family', $$
 insert into public.learning_mistake_review_events(id,session_id,actor_member_id) values
 ('58000000-0000-4000-8000-000000000003','56000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003')$$, array['23503']);

select public.fixture_expect_error('reward request member cross-family', $$
 insert into public.reward_exchange_requests values
 ('61000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','60000000-0000-4000-8000-000000000001')$$, array['23503']);
select public.fixture_expect_error('reward request product cross-family', $$
 insert into public.reward_exchange_requests values
 ('61000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002')$$, array['23503']);
select public.fixture_expect_error('reward history request/member cross-family', $$
 insert into public.reward_exchange_history values
 ('62000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003')$$, array['23503']);
select public.fixture_expect_error('reward wishlist product cross-family', $$
 insert into public.reward_wishlist values
 ('63000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002')$$, array['23503']);
select public.fixture_expect_error('sticker transaction member cross-family', $$
 insert into public.sticker_transactions values
 ('64000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',1)$$, array['23503']);

select public.fixture_expect_error('first-pass ledger cross-family', $$
 insert into public.learning_stage_first_passes values
 ('65000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','64000000-0000-4000-8000-000000000002'); set constraints all immediate$$, array['23503']);

select public.fixture_expect_error('push subscription member cross-family', $$
 insert into public.family_push_subscriptions values
 ('70000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','https://fixture/bad')$$, array['23503']);
select public.fixture_expect_error('notification preference key cross-family', $$
 insert into public.family_notification_preferences values
 ('10000000-0000-4000-8000-000000000001','child-b')$$, array['23503']);

select 'Phase 1 Batch 5A two-family composite fixture passed' as result;
