begin;

-- The derived columns contain persisted scope data. Refuse destructive rollback
-- once any affected business row exists; operators may retain the migration or
-- archive/delete data through a separately reviewed recovery procedure.
do $guard$
begin
  if exists (select 1 from public.family_message_reads)
    or exists (select 1 from public.learning_assignment_plan_revisions)
    or exists (select 1 from public.learning_mistake_review_items)
    or exists (select 1 from public.learning_mistake_review_events)
    or exists (select 1 from public.reward_exchange_requests)
    or exists (select 1 from public.reward_exchange_history)
    or exists (select 1 from public.reward_wishlist)
    or exists (select 1 from public.sticker_transactions)
    or exists (select 1 from public.learning_stage_first_passes)
    or exists (select 1 from public.family_push_subscriptions)
    or exists (select 1 from public.family_notification_preferences)
  then
    raise exception using errcode='55000',
      message='Batch 5A rollback refused: tenant-scoped business data exists';
  end if;
end
$guard$;

alter table public.family_notification_preferences drop constraint family_notification_preferences_member_scope_fk;
alter table public.family_push_subscriptions drop constraint family_push_subscriptions_member_scope_fk;
alter table public.learning_stage_first_passes drop constraint learning_stage_first_passes_reward_scope_fk;
alter table public.sticker_transactions drop constraint sticker_transactions_member_scope_fk;
alter table public.reward_wishlist drop constraint reward_wishlist_product_scope_fk, drop constraint reward_wishlist_member_scope_fk;
alter table public.reward_exchange_history
  drop constraint reward_exchange_history_approver_scope_fk,
  drop constraint reward_exchange_history_product_scope_fk,
  drop constraint reward_exchange_history_member_scope_fk,
  drop constraint reward_exchange_history_request_scope_fk;
alter table public.reward_exchange_requests
  drop constraint reward_exchange_requests_product_scope_fk,
  drop constraint reward_exchange_requests_member_scope_fk;
alter table public.learning_mistake_review_events
  drop constraint learning_mistake_review_events_actor_scope_fk,
  drop constraint learning_mistake_review_events_session_scope_fk;
alter table public.learning_mistake_review_items
  drop constraint learning_mistake_review_items_answer_chain_fk,
  drop constraint learning_mistake_review_items_attempt_scope_fk,
  drop constraint learning_mistake_review_items_session_scope_fk;
alter table public.learning_assignment_plan_revisions
  drop constraint learning_assignment_plan_revisions_actor_scope_fk,
  drop constraint learning_assignment_plan_revisions_plan_scope_fk;
alter table public.family_messages drop constraint family_messages_sender_scope_fk;
alter table public.family_message_reads
  drop constraint family_message_reads_member_scope_fk,
  drop constraint family_message_reads_message_scope_fk;

drop index public.family_push_subscriptions_family_member_idx;
drop index public.sticker_transactions_family_member_idx;
drop index public.reward_wishlist_family_product_idx;
drop index public.reward_exchange_history_family_approver_idx;
drop index public.reward_exchange_history_family_product_idx;
drop index public.reward_exchange_history_family_member_idx;
drop index public.reward_exchange_requests_family_product_idx;
drop index public.learning_mistake_review_events_family_actor_idx;
drop index public.learning_mistake_review_items_scope_idx;
drop index public.learning_assignment_plan_revisions_family_actor_idx;
drop index public.family_message_reads_family_member_idx;

alter table public.sticker_transactions drop constraint sticker_transactions_id_family_id_member_id_key;
alter table public.reward_exchange_requests drop constraint reward_exchange_requests_family_id_id_member_id_key;
alter table public.reward_products drop constraint reward_products_family_id_id_key;
alter table public.learning_attempt_answers drop constraint learning_attempt_answers_source_chain_key;
alter table public.learning_attempts drop constraint learning_attempts_full_scope_key;
alter table public.learning_mistake_review_sessions drop constraint learning_mistake_review_sessions_family_id_id_key;
alter table public.learning_assignment_plans drop constraint learning_assignment_plans_family_id_id_key;
alter table public.family_messages drop constraint family_messages_family_id_id_key;

drop trigger learning_mistake_review_events_derive_scope on public.learning_mistake_review_events;
drop trigger learning_mistake_review_items_derive_scope on public.learning_mistake_review_items;
drop trigger learning_assignment_plan_revisions_derive_scope on public.learning_assignment_plan_revisions;
drop trigger family_message_reads_derive_scope on public.family_message_reads;
drop function public.derive_learning_review_event_scope();
drop function public.derive_learning_review_item_scope();
drop function public.derive_learning_plan_revision_scope();
drop function public.derive_family_message_read_scope();

alter table public.learning_mistake_review_events drop column family_id;
alter table public.learning_mistake_review_items
  drop column source_stage_id, drop column content_version_id,
  drop column assignment_id, drop column assigned_member_id, drop column family_id;
alter table public.learning_assignment_plan_revisions drop column family_id;
alter table public.family_message_reads drop column family_id;

commit;
