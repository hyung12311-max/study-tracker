begin transaction read only;

do $verify$
declare
  missing text;
  invalid_count integer;
begin
  select string_agg(table_name||'.'||column_name, ', ' order by table_name,column_name)
  into missing
  from (values
    ('family_message_reads','family_id','uuid','NO'),
    ('learning_assignment_plan_revisions','family_id','uuid','NO'),
    ('learning_mistake_review_items','family_id','uuid','NO'),
    ('learning_mistake_review_items','assigned_member_id','uuid','NO'),
    ('learning_mistake_review_items','assignment_id','uuid','NO'),
    ('learning_mistake_review_items','content_version_id','uuid','NO'),
    ('learning_mistake_review_items','source_stage_id','uuid','NO'),
    ('learning_mistake_review_events','family_id','uuid','NO')
  ) expected(table_name,column_name,udt_name,is_nullable)
  where not exists (select 1 from information_schema.columns c
    where c.table_schema='public' and c.table_name=expected.table_name
      and c.column_name=expected.column_name and c.udt_name=expected.udt_name
      and c.is_nullable=expected.is_nullable);
  if missing is not null then raise exception using errcode='P0001', message='Batch 5A verification missing columns: '||missing; end if;

  select count(*) into invalid_count from (values
    ('family_message_reads_message_scope_fk','c','family_message_reads','c'),
    ('family_message_reads_member_scope_fk','c','family_message_reads','c'),
    ('family_messages_sender_scope_fk','n','family_messages','c'),
    ('learning_assignment_plan_revisions_plan_scope_fk','r','learning_assignment_plan_revisions','c'),
    ('learning_assignment_plan_revisions_actor_scope_fk','r','learning_assignment_plan_revisions','c'),
    ('learning_mistake_review_items_session_scope_fk','r','learning_mistake_review_items','c'),
    ('learning_mistake_review_items_attempt_scope_fk','r','learning_mistake_review_items','c'),
    ('learning_mistake_review_items_answer_chain_fk','r','learning_mistake_review_items','c'),
    ('learning_mistake_review_events_session_scope_fk','r','learning_mistake_review_events','c'),
    ('learning_mistake_review_events_actor_scope_fk','r','learning_mistake_review_events','c'),
    ('reward_exchange_requests_member_scope_fk','c','reward_exchange_requests','c'),
    ('reward_exchange_requests_product_scope_fk','n','reward_exchange_requests','c'),
    ('reward_exchange_history_request_scope_fk','c','reward_exchange_history','c'),
    ('reward_exchange_history_member_scope_fk','c','reward_exchange_history','c'),
    ('reward_exchange_history_product_scope_fk','n','reward_exchange_history','c'),
    ('reward_exchange_history_approver_scope_fk','n','reward_exchange_history','c'),
    ('reward_wishlist_member_scope_fk','c','reward_wishlist','c'),
    ('reward_wishlist_product_scope_fk','c','reward_wishlist','c'),
    ('sticker_transactions_member_scope_fk','c','sticker_transactions','c'),
    ('learning_stage_first_passes_reward_scope_fk','r','learning_stage_first_passes','c'),
    ('family_push_subscriptions_member_scope_fk','c','family_push_subscriptions','c'),
    ('family_notification_preferences_member_scope_fk','c','family_notification_preferences','c')
  ) expected(conname,delete_code,table_name,constraint_type)
  where not exists (select 1 from pg_constraint c
    where c.conrelid=('public.'||expected.table_name)::regclass
      and c.conname=expected.conname and c.contype='f' and c.convalidated
      and c.confdeltype=expected.delete_code::"char");
  if invalid_count<>0 then raise exception using errcode='P0001', message='Batch 5A FK validation/delete-action contract failed: '||invalid_count; end if;
  if not exists (select 1 from pg_constraint c
    where c.conname='learning_stage_first_passes_reward_scope_fk'
      and c.condeferrable and c.condeferred)
  then raise exception using errcode='P0001', message='Batch 5A deferred ledger FK contract failed'; end if;

  select string_agg(name, ', ' order by name) into missing from unnest(array[
    'family_messages_family_id_id_key','learning_assignment_plans_family_id_id_key',
    'learning_mistake_review_sessions_family_id_id_key','learning_attempts_full_scope_key',
    'learning_attempt_answers_source_chain_key','reward_products_family_id_id_key',
    'reward_exchange_requests_family_id_id_member_id_key','sticker_transactions_id_family_id_member_id_key'
  ]) expected(name) where not exists (select 1 from pg_constraint c where c.conname=expected.name and c.contype='u');
  if missing is not null then raise exception using errcode='P0001', message='Batch 5A supporting unique contract failed: '||missing; end if;

  select string_agg(name, ', ' order by name) into missing from unnest(array[
    'family_message_reads_family_member_idx','learning_assignment_plan_revisions_family_actor_idx',
    'learning_mistake_review_items_scope_idx','learning_mistake_review_events_family_actor_idx',
    'reward_exchange_requests_family_product_idx','reward_exchange_history_family_member_idx',
    'reward_exchange_history_family_product_idx','reward_exchange_history_family_approver_idx',
    'reward_wishlist_family_product_idx','sticker_transactions_family_member_idx',
    'family_push_subscriptions_family_member_idx'
  ]) expected(name) where to_regclass('public.'||name) is null;
  if missing is not null then raise exception using errcode='P0001', message='Batch 5A supporting index contract failed: '||missing; end if;

  if to_regprocedure('public.derive_family_message_read_scope()') is null
    or to_regprocedure('public.derive_learning_plan_revision_scope()') is null
    or to_regprocedure('public.derive_learning_review_item_scope()') is null
    or to_regprocedure('public.derive_learning_review_event_scope()') is null
  then raise exception using errcode='P0001', message='Batch 5A writer compatibility derivation functions missing'; end if;

  if (select count(*) from pg_trigger where not tgisinternal and tgenabled='O' and tgname in
    ('family_message_reads_derive_scope','learning_assignment_plan_revisions_derive_scope',
     'learning_mistake_review_items_derive_scope','learning_mistake_review_events_derive_scope')) <> 4
  then raise exception using errcode='P0001', message='Batch 5A writer compatibility triggers missing'; end if;

  if exists (select 1 from public.family_message_reads r join public.family_messages m on m.id=r.message_id where r.family_id<>m.family_id)
    or exists (select 1 from public.family_message_reads r join public.family_members m on m.id=r.member_id where r.family_id<>m.family_id)
    or exists (select 1 from public.learning_assignment_plan_revisions r join public.learning_assignment_plans p on p.id=r.plan_id where r.family_id<>p.family_id)
    or exists (select 1 from public.learning_mistake_review_items i join public.learning_mistake_review_sessions s on s.id=i.session_id where (i.family_id,i.assigned_member_id,i.assignment_id,i.content_version_id)<>(s.family_id,s.assigned_member_id,s.assignment_id,s.content_version_id))
    or exists (select 1 from public.learning_mistake_review_items i join public.learning_attempts a on a.id=i.source_attempt_id where (i.family_id,i.assigned_member_id,i.assignment_id,i.content_version_id,i.source_stage_id)<>(a.family_id,a.assigned_member_id,a.assignment_id,a.content_version_id,a.stage_id))
    or exists (select 1 from public.learning_mistake_review_events e join public.learning_mistake_review_sessions s on s.id=e.session_id where e.family_id<>s.family_id)
    or exists (select 1 from public.reward_exchange_requests r join public.family_members m on m.id=r.member_id where r.family_id<>m.family_id)
    or exists (select 1 from public.reward_exchange_requests r join public.reward_products p on p.id=r.product_id where r.family_id<>p.family_id)
    or exists (select 1 from public.reward_exchange_history h join public.reward_exchange_requests r on r.id=h.request_id where (h.family_id,h.member_id)<>(r.family_id,r.member_id))
    or exists (select 1 from public.reward_exchange_history h join public.family_members m on m.id=h.approved_by where h.family_id<>m.family_id)
    or exists (select 1 from public.reward_wishlist w join public.family_members m on m.id=w.member_id where w.family_id<>m.family_id)
    or exists (select 1 from public.reward_wishlist w join public.reward_products p on p.id=w.product_id where w.family_id<>p.family_id)
    or exists (select 1 from public.sticker_transactions t join public.family_members m on m.id=t.member_id where t.family_id<>m.family_id)
    or exists (select 1 from public.learning_stage_first_passes f join public.sticker_transactions t on t.id=f.reward_transaction_id where (f.family_id,f.assigned_member_id)<>(t.family_id,t.member_id))
    or exists (select 1 from public.family_push_subscriptions p join public.family_members m on m.id=p.member_id where p.family_id<>m.family_id)
    or exists (select 1 from public.family_notification_preferences p left join public.family_members m on m.family_id=p.family_id and m.member_key=p.member_key where m.id is null)
  then raise exception using errcode='23514', message='Batch 5A derived scope verification failed'; end if;
end
$verify$;

select 'Batch 5A core composite tenant integrity verification passed' as result;
rollback;
