begin;

-- Phase 1 / Batch 5A. Abort before the first mutation if the deployed contract
-- or any existing tenant relationship differs from the reviewed preflight.
do $preflight$
declare
  missing_tables text;
  missing_columns text;
begin
  select string_agg(name, ', ' order by name) into missing_tables
  from unnest(array[
    'family_members', 'family_messages', 'family_message_reads',
    'learning_assignment_plans', 'learning_assignment_plan_revisions',
    'learning_attempts', 'learning_attempt_questions', 'learning_attempt_answers',
    'learning_mistake_review_sessions', 'learning_mistake_review_items',
    'learning_mistake_review_events', 'reward_products',
    'reward_exchange_requests', 'reward_exchange_history', 'reward_wishlist',
    'sticker_transactions', 'learning_stage_first_passes',
    'family_push_subscriptions', 'family_notification_preferences'
  ]) as required(name)
  where to_regclass('public.' || name) is null;

  if missing_tables is not null then
    raise exception using errcode = 'P0001',
      message = 'Batch 5A preflight missing tables: ' || missing_tables;
  end if;

  select string_agg(table_name || '.' || column_name, ', ' order by table_name, column_name)
  into missing_columns
  from (values
    ('family_members','id','uuid'), ('family_members','family_id','uuid'),
    ('family_members','member_key','text'),
    ('family_messages','id','uuid'), ('family_messages','family_id','uuid'),
    ('family_messages','sender_id','uuid'),
    ('family_message_reads','message_id','uuid'), ('family_message_reads','member_id','uuid'),
    ('learning_assignment_plans','id','uuid'), ('learning_assignment_plans','family_id','uuid'),
    ('learning_assignment_plan_revisions','plan_id','uuid'),
    ('learning_assignment_plan_revisions','changed_by_member_id','uuid'),
    ('learning_attempts','id','uuid'), ('learning_attempts','family_id','uuid'),
    ('learning_attempts','assigned_member_id','uuid'), ('learning_attempts','assignment_id','uuid'),
    ('learning_attempts','content_version_id','uuid'), ('learning_attempts','stage_id','uuid'),
    ('learning_attempt_questions','id','uuid'), ('learning_attempt_questions','attempt_id','uuid'),
    ('learning_attempt_answers','id','uuid'), ('learning_attempt_answers','attempt_id','uuid'),
    ('learning_attempt_answers','attempt_question_id','uuid'),
    ('learning_mistake_review_sessions','id','uuid'),
    ('learning_mistake_review_sessions','family_id','uuid'),
    ('learning_mistake_review_sessions','assigned_member_id','uuid'),
    ('learning_mistake_review_sessions','assignment_id','uuid'),
    ('learning_mistake_review_sessions','content_version_id','uuid'),
    ('learning_mistake_review_items','session_id','uuid'),
    ('learning_mistake_review_items','source_attempt_id','uuid'),
    ('learning_mistake_review_items','source_attempt_question_id','uuid'),
    ('learning_mistake_review_items','source_answer_id','uuid'),
    ('learning_mistake_review_events','session_id','uuid'),
    ('learning_mistake_review_events','actor_member_id','uuid'),
    ('reward_products','id','uuid'), ('reward_products','family_id','uuid'),
    ('reward_exchange_requests','id','uuid'), ('reward_exchange_requests','family_id','uuid'),
    ('reward_exchange_requests','member_id','uuid'), ('reward_exchange_requests','product_id','uuid'),
    ('reward_exchange_history','request_id','uuid'), ('reward_exchange_history','family_id','uuid'),
    ('reward_exchange_history','member_id','uuid'), ('reward_exchange_history','product_id','uuid'),
    ('reward_exchange_history','approved_by','uuid'),
    ('reward_wishlist','family_id','uuid'), ('reward_wishlist','member_id','uuid'),
    ('reward_wishlist','product_id','uuid'),
    ('sticker_transactions','id','uuid'), ('sticker_transactions','family_id','uuid'),
    ('sticker_transactions','member_id','uuid'),
    ('learning_stage_first_passes','reward_transaction_id','uuid'),
    ('learning_stage_first_passes','family_id','uuid'),
    ('learning_stage_first_passes','assigned_member_id','uuid'),
    ('family_push_subscriptions','family_id','uuid'),
    ('family_push_subscriptions','member_id','uuid'),
    ('family_notification_preferences','family_id','uuid'),
    ('family_notification_preferences','member_key','text')
  ) expected(table_name, column_name, udt_name)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = expected.table_name
      and c.column_name = expected.column_name and c.udt_name = expected.udt_name
  );

  if missing_columns is not null then
    raise exception using errcode = 'P0001',
      message = 'Batch 5A preflight missing or mistyped columns: ' || missing_columns;
  end if;

  select string_agg(name, ', ' order by name) into missing_columns
  from unnest(array[
    'learning_assignment_plan_revisions_guard_change',
    'learning_mistake_review_items_immutable',
    'learning_mistake_review_events_immutable'
  ]) expected(name)
  where not exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgname=expected.name and not t.tgisinternal and t.tgenabled='O'
  );
  if missing_columns is not null then
    raise exception using errcode='P0001',
      message='Batch 5A preflight missing enabled immutability triggers: '||missing_columns;
  end if;

  if not exists (select 1 from pg_catalog.pg_index i where i.indrelid='public.family_members'::regclass and i.indisunique and i.indisvalid and pg_get_indexdef(i.indexrelid) like '%(family_id, id)%')
    or not exists (select 1 from pg_catalog.pg_index i where i.indrelid='public.family_members'::regclass and i.indisunique and i.indisvalid and pg_get_indexdef(i.indexrelid) like '%(family_id, member_key)%')
    or not exists (select 1 from pg_catalog.pg_constraint c where c.conrelid='public.learning_mistake_review_sessions'::regclass and c.contype='u' and pg_get_constraintdef(c.oid) like 'UNIQUE (id, family_id, assigned_member_id, assignment_id, content_version_id)%')
    or not exists (select 1 from pg_catalog.pg_constraint c where c.conrelid='public.learning_attempt_questions'::regclass and c.contype='u' and pg_get_constraintdef(c.oid) like 'UNIQUE (id, attempt_id)%')
    or not exists (select 1 from pg_catalog.pg_constraint c where c.conrelid='public.learning_mistake_review_items'::regclass and c.contype='u' and pg_get_constraintdef(c.oid) like 'UNIQUE (id, session_id)%')
  then
    raise exception using errcode='P0001', message='Batch 5A preflight parent unique-key contract changed';
  end if;

  if (select count(*) from pg_catalog.pg_constraint c
      where c.contype='f' and c.conrelid in (
        'public.family_messages'::regclass,'public.family_message_reads'::regclass,
        'public.learning_assignment_plan_revisions'::regclass,
        'public.learning_mistake_review_items'::regclass,
        'public.learning_mistake_review_events'::regclass,
        'public.reward_exchange_requests'::regclass,'public.reward_exchange_history'::regclass,
        'public.reward_wishlist'::regclass,'public.sticker_transactions'::regclass,
        'public.learning_stage_first_passes'::regclass,'public.family_push_subscriptions'::regclass
      )) < 22 then
    raise exception using errcode='P0001', message='Batch 5A preflight expected current FK contract changed';
  end if;

  if exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public'
      and ((c.table_name = 'family_message_reads' and c.column_name = 'family_id')
        or (c.table_name = 'learning_assignment_plan_revisions' and c.column_name = 'family_id')
        or (c.table_name = 'learning_mistake_review_items' and c.column_name in
          ('family_id','assigned_member_id','assignment_id','content_version_id','source_stage_id'))
        or (c.table_name = 'learning_mistake_review_events' and c.column_name = 'family_id'))
  ) then
    raise exception using errcode = 'P0001',
      message = 'Batch 5A target columns already exist; migration state is ambiguous';
  end if;
end
$preflight$;

do $integrity_preflight$
begin
  if exists (
    select 1 from public.family_message_reads r
    join public.family_messages m on m.id = r.message_id
    join public.family_members fm on fm.id = r.member_id
    where m.family_id <> fm.family_id
  ) or exists (
    select 1 from public.family_messages m join public.family_members fm on fm.id = m.sender_id
    where m.family_id <> fm.family_id
  ) then raise exception using errcode='23514', message='Batch 5A message tenant violation'; end if;

  if exists (
    select 1 from public.learning_assignment_plan_revisions r
    join public.learning_assignment_plans p on p.id = r.plan_id
    join public.family_members fm on fm.id = r.changed_by_member_id
    where p.family_id <> fm.family_id
  ) then raise exception using errcode='23514', message='Batch 5A revision tenant violation'; end if;

  if exists (
    select 1 from public.learning_mistake_review_items i
    join public.learning_mistake_review_sessions s on s.id=i.session_id
    join public.learning_attempts a on a.id=i.source_attempt_id
    left join public.learning_attempt_questions q
      on q.id=i.source_attempt_question_id and q.attempt_id=i.source_attempt_id
    left join public.learning_attempt_answers aa
      on aa.id=i.source_answer_id and aa.attempt_id=i.source_attempt_id
       and aa.attempt_question_id=i.source_attempt_question_id
    where q.id is null or aa.id is null or s.family_id<>a.family_id
      or s.assigned_member_id<>a.assigned_member_id
      or s.assignment_id<>a.assignment_id or s.content_version_id<>a.content_version_id
  ) or exists (
    select 1 from public.learning_mistake_review_events e
    join public.learning_mistake_review_sessions s on s.id=e.session_id
    join public.family_members fm on fm.id=e.actor_member_id
    where s.family_id<>fm.family_id
  ) then raise exception using errcode='23514', message='Batch 5A review tenant or source-chain violation'; end if;

  if exists (select 1 from public.reward_exchange_requests r join public.family_members m on m.id=r.member_id where r.family_id<>m.family_id)
    or exists (select 1 from public.reward_exchange_requests r join public.reward_products p on p.id=r.product_id where r.family_id<>p.family_id)
    or exists (select 1 from public.reward_exchange_history h join public.reward_exchange_requests r on r.id=h.request_id where h.family_id<>r.family_id or h.member_id<>r.member_id)
    or exists (select 1 from public.reward_exchange_history h join public.family_members m on m.id=h.member_id where h.family_id<>m.family_id)
    or exists (select 1 from public.reward_exchange_history h join public.family_members m on m.id=h.approved_by where h.family_id<>m.family_id)
    or exists (select 1 from public.reward_exchange_history h join public.reward_products p on p.id=h.product_id where h.family_id<>p.family_id)
    or exists (select 1 from public.reward_wishlist w join public.family_members m on m.id=w.member_id where w.family_id<>m.family_id)
    or exists (select 1 from public.reward_wishlist w join public.reward_products p on p.id=w.product_id where w.family_id<>p.family_id)
    or exists (select 1 from public.sticker_transactions t join public.family_members m on m.id=t.member_id where t.family_id<>m.family_id)
    or exists (select 1 from public.learning_stage_first_passes f join public.sticker_transactions t on t.id=f.reward_transaction_id where f.family_id<>t.family_id or f.assigned_member_id<>t.member_id)
  then raise exception using errcode='23514', message='Batch 5A reward tenant violation'; end if;

  if exists (select 1 from public.family_push_subscriptions p join public.family_members m on m.id=p.member_id where p.family_id<>m.family_id)
    or exists (select 1 from public.family_notification_preferences p left join public.family_members m on m.family_id=p.family_id and m.member_key=p.member_key where m.id is null)
  then raise exception using errcode='23514', message='Batch 5A push/preference tenant violation'; end if;
end
$integrity_preflight$;

alter table public.family_message_reads add column family_id uuid;
alter table public.learning_assignment_plan_revisions add column family_id uuid;
alter table public.learning_mistake_review_items
  add column family_id uuid,
  add column assigned_member_id uuid,
  add column assignment_id uuid,
  add column content_version_id uuid,
  add column source_stage_id uuid;
alter table public.learning_mistake_review_events add column family_id uuid;

update public.family_message_reads r set family_id=m.family_id
from public.family_messages m where m.id=r.message_id;

-- These append-only tables deliberately reject ordinary UPDATEs. Suspend only
-- their named immutability triggers for the deterministic migration backfill;
-- transaction rollback restores the prior state on any failure.
alter table public.learning_assignment_plan_revisions
  disable trigger learning_assignment_plan_revisions_guard_change;
alter table public.learning_mistake_review_items
  disable trigger learning_mistake_review_items_immutable;
alter table public.learning_mistake_review_events
  disable trigger learning_mistake_review_events_immutable;

update public.learning_assignment_plan_revisions r set family_id=p.family_id
from public.learning_assignment_plans p where p.id=r.plan_id;
update public.learning_mistake_review_items i set
  family_id=s.family_id, assigned_member_id=s.assigned_member_id,
  assignment_id=s.assignment_id, content_version_id=s.content_version_id,
  source_stage_id=a.stage_id
from public.learning_mistake_review_sessions s, public.learning_attempts a
where s.id=i.session_id and a.id=i.source_attempt_id;
update public.learning_mistake_review_events e set family_id=s.family_id
from public.learning_mistake_review_sessions s where s.id=e.session_id;

alter table public.learning_assignment_plan_revisions
  enable trigger learning_assignment_plan_revisions_guard_change;
alter table public.learning_mistake_review_items
  enable trigger learning_mistake_review_items_immutable;
alter table public.learning_mistake_review_events
  enable trigger learning_mistake_review_events_immutable;

do $backfill_check$
begin
  if exists (select 1 from public.family_message_reads where family_id is null)
    or exists (select 1 from public.learning_assignment_plan_revisions where family_id is null)
    or exists (select 1 from public.learning_mistake_review_items where family_id is null or assigned_member_id is null or assignment_id is null or content_version_id is null or source_stage_id is null)
    or exists (select 1 from public.learning_mistake_review_events where family_id is null)
  then raise exception using errcode='23502', message='Batch 5A deterministic backfill left null scope'; end if;
end
$backfill_check$;

create function public.derive_family_message_read_scope()
returns trigger language plpgsql set search_path=pg_catalog,public as $function$
begin
  select m.family_id into strict new.family_id from public.family_messages m where m.id=new.message_id;
  return new;
end
$function$;
create trigger family_message_reads_derive_scope
before insert or update of message_id on public.family_message_reads
for each row execute function public.derive_family_message_read_scope();

create function public.derive_learning_plan_revision_scope()
returns trigger language plpgsql set search_path=pg_catalog,public as $function$
begin
  select p.family_id into strict new.family_id from public.learning_assignment_plans p where p.id=new.plan_id;
  return new;
end
$function$;
create trigger learning_assignment_plan_revisions_derive_scope
before insert or update of plan_id on public.learning_assignment_plan_revisions
for each row execute function public.derive_learning_plan_revision_scope();

create function public.derive_learning_review_item_scope()
returns trigger language plpgsql set search_path=pg_catalog,public as $function$
declare s public.learning_mistake_review_sessions%rowtype; a public.learning_attempts%rowtype;
begin
  select * into strict s from public.learning_mistake_review_sessions where id=new.session_id;
  select * into strict a from public.learning_attempts where id=new.source_attempt_id;
  new.family_id:=s.family_id; new.assigned_member_id:=s.assigned_member_id;
  new.assignment_id:=s.assignment_id; new.content_version_id:=s.content_version_id;
  new.source_stage_id:=a.stage_id;
  return new;
end
$function$;
create trigger learning_mistake_review_items_derive_scope
before insert or update of session_id,source_attempt_id on public.learning_mistake_review_items
for each row execute function public.derive_learning_review_item_scope();

create function public.derive_learning_review_event_scope()
returns trigger language plpgsql set search_path=pg_catalog,public as $function$
begin
  select s.family_id into strict new.family_id from public.learning_mistake_review_sessions s where s.id=new.session_id;
  return new;
end
$function$;
create trigger learning_mistake_review_events_derive_scope
before insert or update of session_id on public.learning_mistake_review_events
for each row execute function public.derive_learning_review_event_scope();

alter table public.family_message_reads alter column family_id set not null;
alter table public.learning_assignment_plan_revisions alter column family_id set not null;
alter table public.learning_mistake_review_items
  alter column family_id set not null, alter column assigned_member_id set not null,
  alter column assignment_id set not null, alter column content_version_id set not null,
  alter column source_stage_id set not null;
alter table public.learning_mistake_review_events alter column family_id set not null;

alter table public.family_messages add constraint family_messages_family_id_id_key unique (family_id,id);
alter table public.learning_assignment_plans add constraint learning_assignment_plans_family_id_id_key unique (family_id,id);
alter table public.learning_mistake_review_sessions add constraint learning_mistake_review_sessions_family_id_id_key unique (family_id,id);
alter table public.learning_attempts add constraint learning_attempts_full_scope_key unique (id,family_id,assigned_member_id,assignment_id,content_version_id,stage_id);
alter table public.learning_attempt_answers add constraint learning_attempt_answers_source_chain_key unique (id,attempt_id,attempt_question_id);
alter table public.reward_products add constraint reward_products_family_id_id_key unique (family_id,id);
alter table public.reward_exchange_requests add constraint reward_exchange_requests_family_id_id_member_id_key unique (family_id,id,member_id);
alter table public.sticker_transactions add constraint sticker_transactions_id_family_id_member_id_key unique (id,family_id,member_id);

alter table public.family_message_reads add constraint family_message_reads_message_scope_fk foreign key(family_id,message_id) references public.family_messages(family_id,id) on delete cascade not valid;
alter table public.family_message_reads add constraint family_message_reads_member_scope_fk foreign key(family_id,member_id) references public.family_members(family_id,id) on delete cascade not valid;
alter table public.family_messages add constraint family_messages_sender_scope_fk foreign key(family_id,sender_id) references public.family_members(family_id,id) on delete set null (sender_id) not valid;
alter table public.learning_assignment_plan_revisions add constraint learning_assignment_plan_revisions_plan_scope_fk foreign key(family_id,plan_id) references public.learning_assignment_plans(family_id,id) on delete restrict not valid;
alter table public.learning_assignment_plan_revisions add constraint learning_assignment_plan_revisions_actor_scope_fk foreign key(family_id,changed_by_member_id) references public.family_members(family_id,id) on delete restrict not valid;
alter table public.learning_mistake_review_items add constraint learning_mistake_review_items_session_scope_fk foreign key(session_id,family_id,assigned_member_id,assignment_id,content_version_id) references public.learning_mistake_review_sessions(id,family_id,assigned_member_id,assignment_id,content_version_id) on delete restrict not valid;
alter table public.learning_mistake_review_items add constraint learning_mistake_review_items_attempt_scope_fk foreign key(source_attempt_id,family_id,assigned_member_id,assignment_id,content_version_id,source_stage_id) references public.learning_attempts(id,family_id,assigned_member_id,assignment_id,content_version_id,stage_id) on delete restrict not valid;
alter table public.learning_mistake_review_items add constraint learning_mistake_review_items_answer_chain_fk foreign key(source_answer_id,source_attempt_id,source_attempt_question_id) references public.learning_attempt_answers(id,attempt_id,attempt_question_id) on delete restrict not valid;
alter table public.learning_mistake_review_events add constraint learning_mistake_review_events_session_scope_fk foreign key(family_id,session_id) references public.learning_mistake_review_sessions(family_id,id) on delete restrict not valid;
alter table public.learning_mistake_review_events add constraint learning_mistake_review_events_actor_scope_fk foreign key(family_id,actor_member_id) references public.family_members(family_id,id) on delete restrict not valid;
alter table public.reward_exchange_requests add constraint reward_exchange_requests_member_scope_fk foreign key(family_id,member_id) references public.family_members(family_id,id) on delete cascade not valid;
alter table public.reward_exchange_requests add constraint reward_exchange_requests_product_scope_fk foreign key(family_id,product_id) references public.reward_products(family_id,id) on delete set null (product_id) not valid;
alter table public.reward_exchange_history add constraint reward_exchange_history_request_scope_fk foreign key(family_id,request_id,member_id) references public.reward_exchange_requests(family_id,id,member_id) on delete cascade not valid;
alter table public.reward_exchange_history add constraint reward_exchange_history_member_scope_fk foreign key(family_id,member_id) references public.family_members(family_id,id) on delete cascade not valid;
alter table public.reward_exchange_history add constraint reward_exchange_history_product_scope_fk foreign key(family_id,product_id) references public.reward_products(family_id,id) on delete set null (product_id) not valid;
alter table public.reward_exchange_history add constraint reward_exchange_history_approver_scope_fk foreign key(family_id,approved_by) references public.family_members(family_id,id) on delete set null (approved_by) not valid;
alter table public.reward_wishlist add constraint reward_wishlist_member_scope_fk foreign key(family_id,member_id) references public.family_members(family_id,id) on delete cascade not valid;
alter table public.reward_wishlist add constraint reward_wishlist_product_scope_fk foreign key(family_id,product_id) references public.reward_products(family_id,id) on delete cascade not valid;
alter table public.sticker_transactions add constraint sticker_transactions_member_scope_fk foreign key(family_id,member_id) references public.family_members(family_id,id) on delete cascade not valid;
alter table public.learning_stage_first_passes add constraint learning_stage_first_passes_reward_scope_fk foreign key(reward_transaction_id,family_id,assigned_member_id) references public.sticker_transactions(id,family_id,member_id) on delete restrict deferrable initially deferred not valid;
alter table public.family_push_subscriptions add constraint family_push_subscriptions_member_scope_fk foreign key(family_id,member_id) references public.family_members(family_id,id) on delete cascade not valid;
alter table public.family_notification_preferences add constraint family_notification_preferences_member_scope_fk foreign key(family_id,member_key) references public.family_members(family_id,member_key) on delete cascade not valid;

create index family_message_reads_family_member_idx on public.family_message_reads(family_id,member_id);
create index learning_assignment_plan_revisions_family_actor_idx on public.learning_assignment_plan_revisions(family_id,changed_by_member_id);
create index learning_mistake_review_items_scope_idx on public.learning_mistake_review_items(family_id,assigned_member_id,assignment_id);
create index learning_mistake_review_events_family_actor_idx on public.learning_mistake_review_events(family_id,actor_member_id);
create index reward_exchange_requests_family_product_idx on public.reward_exchange_requests(family_id,product_id);
create index reward_exchange_history_family_member_idx on public.reward_exchange_history(family_id,member_id);
create index reward_exchange_history_family_product_idx on public.reward_exchange_history(family_id,product_id);
create index reward_exchange_history_family_approver_idx on public.reward_exchange_history(family_id,approved_by);
create index reward_wishlist_family_product_idx on public.reward_wishlist(family_id,product_id);
create index sticker_transactions_family_member_idx on public.sticker_transactions(family_id,member_id);
create index family_push_subscriptions_family_member_idx on public.family_push_subscriptions(family_id,member_id);

do $validate$
declare c text;
begin
  foreach c in array array[
    'family_message_reads_message_scope_fk','family_message_reads_member_scope_fk',
    'family_messages_sender_scope_fk','learning_assignment_plan_revisions_plan_scope_fk',
    'learning_assignment_plan_revisions_actor_scope_fk','learning_mistake_review_items_session_scope_fk',
    'learning_mistake_review_items_attempt_scope_fk','learning_mistake_review_items_answer_chain_fk',
    'learning_mistake_review_events_session_scope_fk','learning_mistake_review_events_actor_scope_fk',
    'reward_exchange_requests_member_scope_fk','reward_exchange_requests_product_scope_fk',
    'reward_exchange_history_request_scope_fk','reward_exchange_history_member_scope_fk',
    'reward_exchange_history_product_scope_fk','reward_exchange_history_approver_scope_fk',
    'reward_wishlist_member_scope_fk','reward_wishlist_product_scope_fk',
    'sticker_transactions_member_scope_fk','learning_stage_first_passes_reward_scope_fk',
    'family_push_subscriptions_member_scope_fk','family_notification_preferences_member_scope_fk'
  ] loop execute format('alter table %s validate constraint %I',
    (select conrelid::regclass from pg_constraint where conname=c), c); end loop;
end
$validate$;

commit;
