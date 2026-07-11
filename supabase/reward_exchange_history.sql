-- Integrated reward exchange schema.
-- Prerequisites: public.families, public.family_members, public.reward_products,
-- public.study_plans, and public.sticker_history.
-- Run this file once in the Supabase SQL Editor. It is safe to rerun where noted.

begin;

create extension if not exists pgcrypto;

-- Academy schedules use the column names already referenced by js/app.js.
create table if not exists public.academy_schedules (
  id uuid primary key default gen_random_uuid(),
  academy_name text not null,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  memo text,
  star_count integer not null default 1 check (star_count > 0),
  created_at timestamptz not null default now()
);

-- Completion ownership is recorded by the authenticated family API.
create table if not exists public.academy_completion_history (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  academy_schedule_id uuid not null references public.academy_schedules(id) on delete cascade,
  completed_date date not null,
  star_count integer not null default 1 check (star_count > 0),
  created_at timestamptz not null default now(),
  unique (member_id, academy_schedule_id, completed_date)
);

-- 1. Exchange requests: API POST creates pending rows; parent decisions update them.
create table if not exists public.reward_exchange_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  product_id uuid references public.reward_products(id) on delete set null,
  product_name text not null,
  product_emoji text,
  sticker_cost integer not null check (sticker_cost > 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.family_members(id) on delete set null,
  rejection_reason text,
  client_request_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Wallet ledger: positive amounts earn stickers; negative amounts spend them.
create table if not exists public.sticker_transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  amount integer not null check (amount <> 0),
  transaction_type text not null
    check (transaction_type in ('earn', 'spend', 'adjustment')),
  source_type text not null,
  source_id text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (member_id, source_type, source_id)
);

-- 3. Immutable snapshot written when a parent approves a request.
create table if not exists public.reward_exchange_history (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  request_id uuid not null unique
    references public.reward_exchange_requests(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  product_id uuid references public.reward_products(id) on delete set null,
  product_name text not null,
  product_emoji text,
  sticker_cost integer not null check (sticker_cost > 0),
  completed_at timestamptz not null default now(),
  approved_by uuid references public.family_members(id) on delete set null
);

-- Required by the existing reward-store GET and wishlist API.
create table if not exists public.reward_wishlist (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  product_id uuid not null references public.reward_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (member_id, product_id)
);

create index if not exists reward_exchange_requests_family_status_idx
  on public.reward_exchange_requests (family_id, status, requested_at desc);
create index if not exists reward_exchange_requests_member_status_idx
  on public.reward_exchange_requests (member_id, status, requested_at desc);
create index if not exists sticker_transactions_member_created_idx
  on public.sticker_transactions (member_id, created_at desc);
create index if not exists sticker_transactions_family_created_idx
  on public.sticker_transactions (family_id, created_at desc);
create index if not exists reward_exchange_history_family_completed_idx
  on public.reward_exchange_history (family_id, completed_at desc);
create index if not exists reward_exchange_history_member_completed_idx
  on public.reward_exchange_history (member_id, completed_at desc);
create index if not exists reward_wishlist_member_created_idx
  on public.reward_wishlist (member_id, created_at desc);
create index if not exists academy_schedules_day_time_idx
  on public.academy_schedules (day_of_week, start_time);
create index if not exists academy_completion_member_date_idx
  on public.academy_completion_history (member_id, completed_date desc);

create or replace function public.set_reward_exchange_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_reward_exchange_request_updated_at
  on public.reward_exchange_requests;
create trigger set_reward_exchange_request_updated_at
before update on public.reward_exchange_requests
for each row execute function public.set_reward_exchange_updated_at();

-- The existing app awards study stickers to the default child account.
create or replace function public.default_reward_member()
returns table(family_id uuid, member_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select fm.family_id, fm.id
  from public.family_members fm
  join public.families f on f.id = fm.family_id
  where f.family_key = 'default'
    and fm.member_key = 'hagyeom'
    and fm.is_active = true
  limit 1
$$;

create or replace function public.sync_study_sticker_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target record;
  plan_subject text;
begin
  select * into target from public.default_reward_member();
  if target.member_id is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'DELETE' then
    delete from public.sticker_transactions
    where member_id = target.member_id
      and source_type = 'study_complete'
      and source_id = old.study_plan_id::text;
    return old;
  end if;

  select subject into plan_subject
  from public.study_plans
  where id = new.study_plan_id;

  insert into public.sticker_transactions (
    family_id, member_id, amount, transaction_type,
    source_type, source_id, description, created_at
  ) values (
    target.family_id, target.member_id, new.sticker_count, 'earn',
    'study_complete', new.study_plan_id::text,
    coalesce(plan_subject, '학습') || ' 완료', new.created_at
  )
  on conflict (member_id, source_type, source_id)
  do update set
    amount = excluded.amount,
    description = excluded.description;

  return new;
end;
$$;

drop trigger if exists sync_study_sticker_transaction
  on public.sticker_history;
create trigger sync_study_sticker_transaction
after insert or update or delete on public.sticker_history
for each row execute function public.sync_study_sticker_transaction();

-- Backfill existing study stickers into the wallet ledger without duplication.
insert into public.sticker_transactions (
  family_id, member_id, amount, transaction_type,
  source_type, source_id, description, created_at
)
select
  target.family_id,
  target.member_id,
  sh.sticker_count,
  'earn',
  'study_complete',
  sh.study_plan_id::text,
  coalesce(sp.subject, '학습') || ' 완료',
  sh.created_at
from public.sticker_history sh
join public.study_plans sp on sp.id = sh.study_plan_id
cross join lateral public.default_reward_member() target
on conflict (member_id, source_type, source_id) do nothing;

-- Creates the completion row and its sticker transaction in one transaction.
create or replace function public.complete_academy_schedule(
  p_family_id uuid,
  p_member_id uuid,
  p_schedule_id uuid,
  p_completed_date date
)
returns public.academy_completion_history
language plpgsql
security definer
set search_path = public
as $$
declare
  schedule public.academy_schedules%rowtype;
  completion public.academy_completion_history%rowtype;
begin
  perform 1
  from public.family_members
  where id = p_member_id
    and family_id = p_family_id
    and is_active = true
  for update;
  if not found then raise exception 'member unavailable'; end if;

  select * into completion
  from public.academy_completion_history
  where member_id = p_member_id
    and academy_schedule_id = p_schedule_id
    and completed_date = p_completed_date;
  if found then return completion; end if;

  select * into schedule
  from public.academy_schedules
  where id = p_schedule_id
  for update;
  if not found then raise exception 'academy schedule unavailable'; end if;

  insert into public.academy_completion_history (
    family_id, member_id, academy_schedule_id, completed_date, star_count
  ) values (
    p_family_id, p_member_id, schedule.id, p_completed_date, schedule.star_count
  ) returning * into completion;

  insert into public.sticker_transactions (
    family_id, member_id, amount, transaction_type,
    source_type, source_id, description, metadata
  ) values (
    p_family_id, p_member_id, completion.star_count, 'earn',
    'academy_complete', completion.id::text,
    schedule.academy_name || ' 다녀오기 완료',
    jsonb_build_object(
      'academy_schedule_id', schedule.id,
      'academy_name', schedule.academy_name,
      'completed_date', completion.completed_date
    )
  )
  on conflict (member_id, source_type, source_id) do nothing;

  return completion;
end;
$$;

-- Deleting a completion (including schedule cascade deletion) removes its earn row.
create or replace function public.delete_academy_sticker_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.sticker_transactions
  where member_id = old.member_id
    and source_type = 'academy_complete'
    and source_id = old.id::text;
  return old;
end;
$$;

drop trigger if exists delete_academy_sticker_transaction
  on public.academy_completion_history;
create trigger delete_academy_sticker_transaction
after delete on public.academy_completion_history
for each row execute function public.delete_academy_sticker_transaction();

-- Backfill existing academy completions without duplicate awards.
insert into public.sticker_transactions (
  family_id, member_id, amount, transaction_type,
  source_type, source_id, description, metadata, created_at
)
select
  ach.family_id,
  ach.member_id,
  ach.star_count,
  'earn',
  'academy_complete',
  ach.id::text,
  schedules.academy_name || ' 다녀오기 완료',
  jsonb_build_object(
    'academy_schedule_id', schedules.id,
    'academy_name', schedules.academy_name,
    'completed_date', ach.completed_date
  ),
  ach.created_at
from public.academy_completion_history ach
join public.academy_schedules schedules on schedules.id = ach.academy_schedule_id
on conflict (member_id, source_type, source_id) do nothing;

-- Idempotently creates one pending request per clientRequestId and member.
create or replace function public.create_reward_exchange_request(
  p_family_id uuid,
  p_member_id uuid,
  p_product_id uuid,
  p_client_request_id text
)
returns public.reward_exchange_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  product public.reward_products%rowtype;
  result public.reward_exchange_requests%rowtype;
  balance integer;
  reserved integer;
begin
  perform 1
  from public.family_members
  where id = p_member_id
    and family_id = p_family_id
    and is_active = true
  for update;
  if not found then raise exception 'member unavailable'; end if;

  select * into result
  from public.reward_exchange_requests
  where client_request_id = p_client_request_id
    and member_id = p_member_id;
  if found then return result; end if;

  select * into product
  from public.reward_products
  where id = p_product_id
    and family_id = p_family_id
    and is_active = true
  for update;
  if not found then raise exception 'product unavailable'; end if;
  if product.stock is not null and product.stock <= 0 then
    raise exception 'out of stock';
  end if;

  select coalesce(sum(amount), 0) into balance
  from public.sticker_transactions
  where member_id = p_member_id;

  select coalesce(sum(sticker_cost), 0) into reserved
  from public.reward_exchange_requests
  where member_id = p_member_id
    and status = 'pending';

  if balance - reserved < product.sticker_cost then
    raise exception 'insufficient available stickers';
  end if;

  insert into public.reward_exchange_requests (
    family_id, member_id, product_id, product_name,
    product_emoji, sticker_cost, client_request_id
  ) values (
    p_family_id, p_member_id, product.id, product.name,
    product.emoji, product.sticker_cost, p_client_request_id
  ) returning * into result;

  return result;
end;
$$;

-- Parent approval is atomic: lock request, check balance, decrement stock,
-- write spend/history rows, and finally mark the request approved.
create or replace function public.approve_reward_exchange(
  p_request_id uuid,
  p_parent_id uuid,
  p_family_id uuid
)
returns public.reward_exchange_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.reward_exchange_requests%rowtype;
  balance integer;
begin
  perform 1
  from public.family_members
  where id = p_parent_id
    and family_id = p_family_id
    and role = 'parent'
    and is_active = true;
  if not found then raise exception 'parent permission required'; end if;

  select * into req
  from public.reward_exchange_requests
  where id = p_request_id
    and family_id = p_family_id
  for update;
  if not found or req.status <> 'pending' then
    raise exception 'request is not pending';
  end if;

  select coalesce(sum(amount), 0) into balance
  from public.sticker_transactions
  where member_id = req.member_id;
  if balance < req.sticker_cost then
    raise exception 'insufficient stickers';
  end if;

  if req.product_id is not null then
    update public.reward_products
    set stock = case when stock is null then null else stock - 1 end,
        updated_at = now()
    where id = req.product_id
      and family_id = req.family_id
      and is_active = true
      and (stock is null or stock > 0);
    if not found then raise exception 'out of stock'; end if;
  end if;

  insert into public.sticker_transactions (
    family_id, member_id, amount, transaction_type,
    source_type, source_id, description
  ) values (
    req.family_id, req.member_id, -req.sticker_cost, 'spend',
    'reward_exchange', req.id::text, req.product_name || ' 교환'
  );

  insert into public.reward_exchange_history (
    family_id, request_id, member_id, product_id,
    product_name, product_emoji, sticker_cost, approved_by
  ) values (
    req.family_id, req.id, req.member_id, req.product_id,
    req.product_name, req.product_emoji, req.sticker_cost, p_parent_id
  );

  update public.reward_exchange_requests
  set status = 'approved',
      decided_at = now(),
      decided_by = p_parent_id
  where id = req.id
  returning * into req;

  return req;
end;
$$;

alter table public.reward_exchange_requests enable row level security;
alter table public.sticker_transactions enable row level security;
alter table public.reward_exchange_history enable row level security;
alter table public.reward_wishlist enable row level security;
alter table public.academy_schedules enable row level security;
alter table public.academy_completion_history enable row level security;

drop policy if exists reward_exchange_requests_family_select
  on public.reward_exchange_requests;
create policy reward_exchange_requests_family_select
on public.reward_exchange_requests for select to authenticated
using (
  exists (
    select 1 from public.family_members viewer
    where viewer.id = auth.uid()
      and viewer.family_id = reward_exchange_requests.family_id
      and viewer.is_active = true
      and (viewer.role = 'parent' or viewer.id = reward_exchange_requests.member_id)
  )
);

drop policy if exists sticker_transactions_family_select
  on public.sticker_transactions;
create policy sticker_transactions_family_select
on public.sticker_transactions for select to authenticated
using (
  exists (
    select 1 from public.family_members viewer
    where viewer.id = auth.uid()
      and viewer.family_id = sticker_transactions.family_id
      and viewer.is_active = true
      and (viewer.role = 'parent' or viewer.id = sticker_transactions.member_id)
  )
);

drop policy if exists reward_exchange_history_family_select
  on public.reward_exchange_history;
create policy reward_exchange_history_family_select
on public.reward_exchange_history for select to authenticated
using (
  exists (
    select 1 from public.family_members viewer
    where viewer.id = auth.uid()
      and viewer.family_id = reward_exchange_history.family_id
      and viewer.is_active = true
      and (viewer.role = 'parent' or viewer.id = reward_exchange_history.member_id)
  )
);

drop policy if exists reward_wishlist_family_access
  on public.reward_wishlist;
create policy reward_wishlist_family_access
on public.reward_wishlist for all to authenticated
using (
  exists (
    select 1 from public.family_members viewer
    where viewer.id = auth.uid()
      and viewer.family_id = reward_wishlist.family_id
      and viewer.is_active = true
      and viewer.id = reward_wishlist.member_id
  )
)
with check (
  exists (
    select 1 from public.family_members viewer
    where viewer.id = auth.uid()
      and viewer.family_id = reward_wishlist.family_id
      and viewer.is_active = true
      and viewer.id = reward_wishlist.member_id
  )
);

-- Schedule CRUD remains compatible with the existing Supabase browser repository.
drop policy if exists academy_schedules_existing_app_access
  on public.academy_schedules;
create policy academy_schedules_existing_app_access
on public.academy_schedules for all to anon, authenticated
using (true)
with check (true);

drop policy if exists academy_completion_family_select
  on public.academy_completion_history;
create policy academy_completion_family_select
on public.academy_completion_history for select to authenticated
using (
  exists (
    select 1 from public.family_members viewer
    where viewer.id = auth.uid()
      and viewer.family_id = academy_completion_history.family_id
      and viewer.is_active = true
      and (viewer.role = 'parent' or viewer.id = academy_completion_history.member_id)
  )
);

grant select on public.reward_exchange_requests to authenticated;
grant select on public.sticker_transactions to authenticated;
grant select on public.reward_exchange_history to authenticated;
grant select, insert, delete on public.reward_wishlist to authenticated;
grant select, insert, update, delete on public.academy_schedules to anon, authenticated;
grant select on public.academy_completion_history to authenticated;

revoke insert, update, delete on public.reward_exchange_requests from anon, authenticated;
revoke insert, update, delete on public.sticker_transactions from anon, authenticated;
revoke insert, update, delete on public.reward_exchange_history from anon, authenticated;
revoke insert, update, delete on public.academy_completion_history from anon, authenticated;

revoke all on function public.default_reward_member() from public, anon, authenticated;
revoke all on function public.create_reward_exchange_request(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.approve_reward_exchange(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.complete_academy_schedule(uuid, uuid, uuid, date)
  from public, anon, authenticated;

grant execute on function public.default_reward_member() to service_role;
grant execute on function public.create_reward_exchange_request(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.approve_reward_exchange(uuid, uuid, uuid)
  to service_role;
grant execute on function public.complete_academy_schedule(uuid, uuid, uuid, date)
  to service_role;

commit;
