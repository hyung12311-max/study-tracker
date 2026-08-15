\set ON_ERROR_STOP on

create extension if not exists pgcrypto;

create table public.families(id uuid primary key, family_key text not null unique);
create table public.family_members(
  id uuid primary key, family_id uuid not null references public.families(id),
  member_key text not null, unique(family_id,member_key)
);
create unique index family_members_family_id_id_uidx on public.family_members(family_id,id);

create table public.family_messages(
  id uuid primary key, family_id uuid not null references public.families(id),
  sender_id uuid references public.family_members(id) on delete set null, content text not null
);
create table public.family_message_reads(
  id uuid primary key, message_id uuid not null references public.family_messages(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  unique(message_id,member_id)
);

create table public.learning_assignment_plans(id uuid primary key, family_id uuid not null);
create table public.learning_assignment_plan_revisions(
  id uuid primary key, plan_id uuid not null references public.learning_assignment_plans(id) on delete restrict,
  changed_by_member_id uuid not null references public.family_members(id) on delete restrict,
  revision integer not null
);

create table public.learning_attempts(
  id uuid primary key, family_id uuid not null, assigned_member_id uuid not null,
  assignment_id uuid not null, content_version_id uuid not null, stage_id uuid not null
);
create table public.learning_attempt_questions(
  id uuid primary key, attempt_id uuid not null references public.learning_attempts(id) on delete restrict,
  unique(id,attempt_id)
);
create table public.learning_attempt_answers(
  id uuid primary key, attempt_id uuid not null references public.learning_attempts(id) on delete restrict,
  attempt_question_id uuid not null,
  foreign key(attempt_question_id,attempt_id) references public.learning_attempt_questions(id,attempt_id) on delete restrict
);
create table public.learning_mistake_review_sessions(
  id uuid primary key, family_id uuid not null, assigned_member_id uuid not null,
  assignment_id uuid not null, content_version_id uuid not null,
  unique(id,family_id,assigned_member_id,assignment_id,content_version_id)
);
create table public.learning_mistake_review_items(
  id uuid primary key, session_id uuid not null references public.learning_mistake_review_sessions(id) on delete restrict,
  source_attempt_id uuid not null references public.learning_attempts(id) on delete restrict,
  source_attempt_question_id uuid not null, source_answer_id uuid not null, display_order integer not null,
  foreign key(source_attempt_question_id,source_attempt_id) references public.learning_attempt_questions(id,attempt_id) on delete restrict,
  foreign key(source_answer_id) references public.learning_attempt_answers(id) on delete restrict,
  unique(id,session_id)
);
create table public.learning_mistake_review_events(
  id uuid primary key, session_id uuid not null references public.learning_mistake_review_sessions(id) on delete restrict,
  actor_member_id uuid not null references public.family_members(id) on delete restrict
);

create function public.fixture_immutable_guard() returns trigger language plpgsql as $function$
begin raise exception using errcode='55000', message='fixture row is immutable'; end
$function$;
create trigger learning_assignment_plan_revisions_guard_change
before update or delete on public.learning_assignment_plan_revisions
for each row execute function public.fixture_immutable_guard();
create trigger learning_mistake_review_items_immutable
before update or delete on public.learning_mistake_review_items
for each row execute function public.fixture_immutable_guard();
create trigger learning_mistake_review_events_immutable
before update or delete on public.learning_mistake_review_events
for each row execute function public.fixture_immutable_guard();

create table public.reward_products(id uuid primary key, family_id uuid not null, name text not null);
create table public.reward_exchange_requests(
  id uuid primary key, family_id uuid not null, member_id uuid not null references public.family_members(id) on delete cascade,
  product_id uuid references public.reward_products(id) on delete set null
);
create table public.reward_exchange_history(
  id uuid primary key, family_id uuid not null,
  request_id uuid not null unique references public.reward_exchange_requests(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  product_id uuid references public.reward_products(id) on delete set null,
  approved_by uuid references public.family_members(id) on delete set null
);
create table public.reward_wishlist(
  id uuid primary key, family_id uuid not null,
  member_id uuid not null references public.family_members(id) on delete cascade,
  product_id uuid not null references public.reward_products(id) on delete cascade
);
create table public.sticker_transactions(
  id uuid primary key, family_id uuid not null,
  member_id uuid not null references public.family_members(id) on delete cascade,
  amount integer not null
);
create table public.learning_stage_first_passes(
  id uuid primary key, family_id uuid not null, assigned_member_id uuid not null,
  reward_transaction_id uuid not null references public.sticker_transactions(id) on delete restrict
    deferrable initially deferred
);
create table public.family_push_subscriptions(
  id uuid primary key, family_id uuid not null,
  member_id uuid not null references public.family_members(id) on delete cascade,
  endpoint text not null unique
);
create table public.family_notification_preferences(
  family_id uuid not null, member_key text not null, primary key(family_id,member_key)
);

insert into public.families values
 ('10000000-0000-4000-8000-000000000001','family-a'),
 ('10000000-0000-4000-8000-000000000002','family-b');
insert into public.family_members values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','parent-a'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','child-a'),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','parent-b'),
 ('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','child-b');
insert into public.family_messages values
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','message-a'),
 ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','message-b');
insert into public.family_message_reads values
 ('31000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
insert into public.learning_assignment_plans values
 ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),
 ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');
insert into public.learning_assignment_plan_revisions values
 ('41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',1);

insert into public.learning_attempts values
 ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001'),
 ('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000002','53000000-0000-4000-8000-000000000002');
insert into public.learning_attempt_questions values
 ('54000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001'),
 ('54000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002');
insert into public.learning_attempt_answers values
 ('55000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001'),
 ('55000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000002');
insert into public.learning_mistake_review_sessions values
 ('56000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001'),
 ('56000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000002');
insert into public.learning_mistake_review_items values
 ('57000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001','55000000-0000-4000-8000-000000000001',1);
insert into public.learning_mistake_review_events values
 ('58000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');

insert into public.reward_products values
 ('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','product-a'),
 ('60000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','product-b');
insert into public.reward_exchange_requests values
 ('61000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001'),
 ('61000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004','60000000-0000-4000-8000-000000000002');
insert into public.reward_exchange_history values
 ('62000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');
insert into public.reward_wishlist values
 ('63000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001');
insert into public.sticker_transactions values
 ('64000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',1),
 ('64000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004',1);
insert into public.learning_stage_first_passes values
 ('65000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','64000000-0000-4000-8000-000000000001');
insert into public.family_push_subscriptions values
 ('70000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','https://fixture/a');
insert into public.family_notification_preferences values
 ('10000000-0000-4000-8000-000000000001','child-a');

create temporary table batch5a_before as
select
 (select count(*) from public.family_message_reads) message_reads,
 (select count(*) from public.learning_assignment_plan_revisions) revisions,
 (select count(*) from public.learning_mistake_review_items) review_items,
 (select count(*) from public.reward_exchange_requests) reward_requests,
 (select count(*) from public.sticker_transactions) ledger_rows,
 (select count(*) from public.family_push_subscriptions) push_rows,
 (select content from public.family_messages where id='30000000-0000-4000-8000-000000000001') message_content,
 (select revision from public.learning_assignment_plan_revisions where id='41000000-0000-4000-8000-000000000001') revision_number,
 (select name from public.reward_products where id='60000000-0000-4000-8000-000000000001') product_name;

create function public.fixture_expect_error(label text, statement text, expected text[])
returns void language plpgsql as $function$
begin
  begin execute statement;
  exception when others then
    if sqlstate = any(expected) then return; end if;
    raise exception '% raised %, expected %', label, sqlstate, expected;
  end;
  raise exception '% unexpectedly succeeded', label;
end
$function$;
