-- Run after supabase-schema.sql and supabase/family_chat.sql.
create extension if not exists pgcrypto;

create table if not exists public.reward_products (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text,
  sticker_cost integer not null check (sticker_cost > 0),
  image_url text,
  emoji text,
  stock integer check (stock is null or stock >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  category text not null default '기타',
  available_from timestamptz,
  available_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_exchange_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  product_id uuid references public.reward_products(id) on delete set null,
  product_name text not null,
  product_emoji text,
  sticker_cost integer not null check (sticker_cost > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.family_members(id) on delete set null,
  rejection_reason text,
  client_request_id text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_exchange_history (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  request_id uuid unique not null references public.reward_exchange_requests(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  product_id uuid references public.reward_products(id) on delete set null,
  product_name text not null,
  product_emoji text,
  sticker_cost integer not null,
  completed_at timestamptz not null default now(),
  approved_by uuid references public.family_members(id) on delete set null
);

create table if not exists public.sticker_transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  amount integer not null check (amount <> 0),
  transaction_type text not null check (transaction_type in ('earn','spend','adjustment')),
  source_type text not null,
  source_id text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(member_id, source_type, source_id)
);

create table if not exists public.reward_wishlist (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  product_id uuid not null references public.reward_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(member_id, product_id)
);

create index if not exists reward_products_store_idx on public.reward_products(family_id,is_active,sort_order);
create index if not exists reward_exchange_requests_status_idx on public.reward_exchange_requests(family_id,status,requested_at desc);
create index if not exists sticker_transactions_wallet_idx on public.sticker_transactions(member_id,created_at desc);
create index if not exists reward_wishlist_member_idx on public.reward_wishlist(member_id,created_at desc);

insert into public.reward_products(family_id,name,description,sticker_cost,emoji,stock,sort_order,category)
select f.id,p.name,p.description,p.cost,p.emoji,p.stock,p.sort_order,p.category
from public.families f cross join (values
 ('바나나우유','달콤한 간식 보상',5,'🍌',null::integer,10,'간식'),
 ('프링글스','좋아하는 맛으로 골라요',10,'🥔',null::integer,20,'간식'),
 ('책','읽고 싶은 책 한 권',20,'📖',null::integer,30,'도서')
) p(name,description,cost,emoji,stock,sort_order,category)
where f.family_key='default'
and not exists(select 1 from public.reward_products rp where rp.family_id=f.id);

create or replace function public.default_reward_member()
returns table(family_id uuid,member_id uuid) language sql stable security definer set search_path=public as $$
  select fm.family_id,fm.id from public.family_members fm
  join public.families f on f.id=fm.family_id
  where f.family_key='default' and fm.member_key='hagyeom' limit 1
$$;

create or replace function public.sync_study_sticker_transaction()
returns trigger language plpgsql security definer set search_path=public as $$
declare target record; plan_subject text;
begin
 select * into target from public.default_reward_member();
 if target.member_id is null then if tg_op='DELETE' then return old; else return new; end if; end if;
 if tg_op='DELETE' then
  delete from public.sticker_transactions where member_id=target.member_id and source_type='study_complete' and source_id=old.study_plan_id::text;
  return old;
 end if;
 select subject into plan_subject from public.study_plans where id=new.study_plan_id;
 insert into public.sticker_transactions(family_id,member_id,amount,transaction_type,source_type,source_id,description,created_at)
 values(target.family_id,target.member_id,new.sticker_count,'earn','study_complete',new.study_plan_id::text,coalesce(plan_subject,'학습')||' 완료',new.created_at)
 on conflict(member_id,source_type,source_id) do update set amount=excluded.amount,description=excluded.description;
 return new;
end $$;

drop trigger if exists sync_study_sticker_transaction on public.sticker_history;
create trigger sync_study_sticker_transaction after insert or update or delete on public.sticker_history
for each row execute function public.sync_study_sticker_transaction();

create or replace function public.sync_academy_sticker_transaction()
returns trigger language plpgsql security definer set search_path=public as $$
declare target record; academy_name text;
begin
 select * into target from public.default_reward_member();
 if target.member_id is null then if tg_op='DELETE' then return old; else return new; end if; end if;
 if tg_op='DELETE' then
  delete from public.sticker_transactions where member_id=target.member_id and source_type='academy_complete' and source_id=old.id::text;
  return old;
 end if;
 select a.academy_name into academy_name from public.academy_schedules a where a.id=new.academy_schedule_id;
 insert into public.sticker_transactions(family_id,member_id,amount,transaction_type,source_type,source_id,description,created_at)
 values(target.family_id,target.member_id,new.star_count,'earn','academy_complete',new.id::text,coalesce(academy_name,'학원 일정')||' 완료',new.created_at)
 on conflict(member_id,source_type,source_id) do update set amount=excluded.amount,description=excluded.description;
 return new;
end $$;

drop trigger if exists sync_academy_sticker_transaction on public.academy_completion_history;
create trigger sync_academy_sticker_transaction after insert or update or delete on public.academy_completion_history
for each row execute function public.sync_academy_sticker_transaction();

insert into public.sticker_transactions(family_id,member_id,amount,transaction_type,source_type,source_id,description,created_at)
select fm.family_id,fm.id,sh.sticker_count,'earn','study_complete',sh.study_plan_id::text,coalesce(sp.subject,'학습')||' 완료',sh.created_at
from public.sticker_history sh join public.study_plans sp on sp.id=sh.study_plan_id
join public.family_members fm on true join public.families f on f.id=fm.family_id
where f.family_key='default' and fm.member_key='hagyeom'
on conflict(member_id,source_type,source_id) do nothing;

insert into public.sticker_transactions(family_id,member_id,amount,transaction_type,source_type,source_id,description,created_at)
select fm.family_id,fm.id,ach.star_count,'earn','academy_complete',ach.id::text,coalesce(a.academy_name,'학원 일정')||' 완료',ach.created_at
from public.academy_completion_history ach join public.academy_schedules a on a.id=ach.academy_schedule_id
join public.family_members fm on true join public.families f on f.id=fm.family_id
where f.family_key='default' and fm.member_key='hagyeom'
on conflict(member_id,source_type,source_id) do nothing;

create or replace function public.create_reward_exchange_request(p_family_id uuid,p_member_id uuid,p_product_id uuid,p_client_request_id text)
returns public.reward_exchange_requests language plpgsql security definer set search_path=public as $$
declare product public.reward_products%rowtype; result public.reward_exchange_requests%rowtype; balance integer; reserved integer;
begin
 perform 1 from public.family_members where id=p_member_id and family_id=p_family_id and is_active for update;
 if not found then raise exception 'member unavailable'; end if;
 select * into result from public.reward_exchange_requests where client_request_id=p_client_request_id and member_id=p_member_id;
 if found then return result; end if;
 select * into product from public.reward_products where id=p_product_id and family_id=p_family_id and is_active for update;
 if not found or (product.available_from is not null and product.available_from>now()) or (product.available_until is not null and product.available_until<now()) then raise exception 'product unavailable'; end if;
 if product.stock is not null and product.stock<=0 then raise exception 'out of stock'; end if;
 select coalesce(sum(amount),0) into balance from public.sticker_transactions where member_id=p_member_id;
 select coalesce(sum(sticker_cost),0) into reserved from public.reward_exchange_requests where member_id=p_member_id and status='pending';
 if balance-reserved<product.sticker_cost then raise exception 'insufficient available stickers'; end if;
 insert into public.reward_exchange_requests(family_id,member_id,product_id,product_name,product_emoji,sticker_cost,client_request_id)
 values(p_family_id,p_member_id,product.id,product.name,product.emoji,product.sticker_cost,p_client_request_id)
 returning * into result;
 return result;
end $$;

create or replace function public.approve_reward_exchange(p_request_id uuid,p_parent_id uuid,p_family_id uuid)
returns public.reward_exchange_requests language plpgsql security definer set search_path=public as $$
declare req public.reward_exchange_requests%rowtype; balance integer;
begin
 perform 1 from public.family_members where id=p_parent_id and family_id=p_family_id and role='parent' and is_active;
 if not found then raise exception 'parent permission required'; end if;
 select * into req from public.reward_exchange_requests where id=p_request_id and family_id=p_family_id for update;
 if not found or req.status<>'pending' then raise exception 'request is not pending'; end if;
 select coalesce(sum(amount),0) into balance from public.sticker_transactions where member_id=req.member_id;
 if balance<req.sticker_cost then raise exception 'insufficient stickers'; end if;
 if req.product_id is not null then
  update public.reward_products set stock=case when stock is null then null else stock-1 end,updated_at=now()
  where id=req.product_id and (stock is null or stock>0);
  if not found then raise exception 'out of stock'; end if;
 end if;
 insert into public.sticker_transactions(family_id,member_id,amount,transaction_type,source_type,source_id,description)
 values(req.family_id,req.member_id,-req.sticker_cost,'spend','reward_exchange',req.id::text,req.product_name||' 교환')
 on conflict(member_id,source_type,source_id) do nothing;
 insert into public.reward_exchange_history(family_id,request_id,member_id,product_id,product_name,product_emoji,sticker_cost,approved_by)
 values(req.family_id,req.id,req.member_id,req.product_id,req.product_name,req.product_emoji,req.sticker_cost,p_parent_id);
 update public.reward_exchange_requests set status='approved',decided_at=now(),decided_by=p_parent_id,updated_at=now() where id=req.id returning * into req;
 return req;
end $$;

revoke all on function public.default_reward_member() from public,anon,authenticated;
revoke all on function public.create_reward_exchange_request(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.approve_reward_exchange(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.default_reward_member() to service_role;
grant execute on function public.create_reward_exchange_request(uuid,uuid,uuid,text) to service_role;
grant execute on function public.approve_reward_exchange(uuid,uuid,uuid) to service_role;

alter table public.reward_products enable row level security;
alter table public.reward_exchange_requests enable row level security;
alter table public.reward_exchange_history enable row level security;
alter table public.sticker_transactions enable row level security;
alter table public.reward_wishlist enable row level security;
-- No browser policies: all store reads and writes go through authenticated server APIs.
