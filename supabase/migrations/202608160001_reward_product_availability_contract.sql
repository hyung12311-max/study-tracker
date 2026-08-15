begin;

do $preflight$
declare
  exchange_oid oid := to_regprocedure('public.create_reward_exchange_request_v2(uuid,uuid,uuid,uuid,text)');
begin
  if to_regclass('public.reward_products') is null then
    raise exception using errcode='P0001', message='Reward availability table prerequisite is missing';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='reward_products'
      and column_name in ('available_from','available_until')
  ) then
    raise exception using errcode='P0001', message='Reward availability columns already exist';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='reward_products' and column_name='id' and udt_name='uuid' and is_nullable='NO')
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='reward_products' and column_name='family_id' and udt_name='uuid' and is_nullable='NO')
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='reward_products' and column_name='name' and udt_name='text' and is_nullable='NO')
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='reward_products' and column_name='sticker_cost' and udt_name='int4' and is_nullable='NO')
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='reward_products' and column_name='stock' and udt_name='int4' and is_nullable='YES')
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='reward_products' and column_name='is_active' and udt_name='bool' and is_nullable='NO')
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='reward_products' and column_name='created_at' and udt_name='timestamptz' and is_nullable='NO')
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='reward_products' and column_name='updated_at' and udt_name='timestamptz' and is_nullable='NO') then
    raise exception using errcode='P0001', message='Reward product base schema contract changed';
  end if;

  if (select count(*) from pg_constraint where conrelid='public.reward_products'::regclass and convalidated and conname in (
      'reward_products_pkey','reward_products_family_id_fkey','reward_products_family_id_id_key',
      'reward_products_name_check','reward_products_sticker_cost_check','reward_products_stock_check','reward_products_sort_order_check'
    ))<>7
    or not exists (select 1 from pg_indexes where schemaname='public' and tablename='reward_products' and indexname='reward_products_family_active_order_idx') then
    raise exception using errcode='P0001', message='Reward product constraint or index baseline changed';
  end if;

  if exchange_oid is null
    or not (select prosecdef and proowner='postgres'::regrole and coalesce(proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public'] from pg_proc where oid=exchange_oid)
    or not has_function_privilege('service_role',exchange_oid,'EXECUTE')
    or has_function_privilege('anon',exchange_oid,'EXECUTE')
    or has_function_privilege('authenticated',exchange_oid,'EXECUTE')
    or not (select pg_get_functiondef(exchange_oid) like '%product.available_from%' and pg_get_functiondef(exchange_oid) like '%product.available_until%') then
    raise exception using errcode='P0001', message='Reward exchange v2 availability contract changed';
  end if;
end
$preflight$;

create temporary table reward_product_availability_baseline on commit drop as
select count(*)::bigint as product_count
from public.reward_products;

alter table public.reward_products
  add column available_from timestamptz null,
  add column available_until timestamptz null,
  add constraint reward_products_availability_window_check check (
    available_from is null
    or available_until is null
    or available_from <= available_until
  );

create or replace function public.create_reward_exchange_request_v2(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_target_member_id uuid,
  p_product_id uuid,
  p_client_request_id text
)
returns public.reward_exchange_requests
language plpgsql
security definer
set search_path=pg_catalog, public
as $function$
declare
  actor public.family_members%rowtype;
  target public.family_members%rowtype;
  product public.reward_products%rowtype;
  result public.reward_exchange_requests%rowtype;
  balance integer;
  reserved integer;
begin
  if p_family_id is null or p_actor_member_id is null or p_target_member_id is null
    or p_product_id is null or p_client_request_id is null
    or p_client_request_id !~ '^[a-zA-Z0-9_-]{8,100}$' then
    raise exception using errcode='22023', message='invalid reward exchange request';
  end if;

  select member.* into actor from public.family_members member
  where member.id=p_actor_member_id and member.family_id=p_family_id
    and member.is_active=true and member.role in ('parent','child') for update;
  if actor.id is null then raise exception using errcode='42501', message='active reward actor is required'; end if;

  select member.* into target from public.family_members member
  where member.id=p_target_member_id and member.family_id=p_family_id
    and member.is_active=true and member.role='child' for update;
  if target.id is null then raise exception using errcode='P0002', message='reward target was not found'; end if;
  if actor.role='child' and actor.id<>target.id then
    raise exception using errcode='42501', message='child reward target must be self';
  end if;

  select product_row.* into product from public.reward_products product_row
  where product_row.id=p_product_id and product_row.family_id=p_family_id
    and product_row.is_active=true for update;
  if product.id is null then raise exception using errcode='P0002', message='reward product was not found'; end if;
  if (product.available_from is not null and product.available_from>now())
    or (product.available_until is not null and product.available_until<now()) then
    raise exception using errcode='55000', message='REWARD_PRODUCT_UNAVAILABLE';
  end if;
  if product.stock is not null and product.stock<=0 then
    raise exception using errcode='55000', message='REWARD_PRODUCT_OUT_OF_STOCK';
  end if;

  select request.* into result from public.reward_exchange_requests request
  where request.client_request_id=p_client_request_id and request.member_id=target.id;
  if result.id is not null then
    if result.family_id<>p_family_id or result.product_id is distinct from product.id then
      raise exception using errcode='55000', message='IDEMPOTENCY_CONFLICT';
    end if;
    return result;
  end if;

  select coalesce(sum(transaction_row.amount),0) into balance
  from public.sticker_transactions transaction_row
  where transaction_row.family_id=p_family_id and transaction_row.member_id=target.id;
  select coalesce(sum(request.sticker_cost),0) into reserved
  from public.reward_exchange_requests request
  where request.family_id=p_family_id and request.member_id=target.id and request.status='pending';
  if balance-reserved<product.sticker_cost then
    raise exception using errcode='55000', message='INSUFFICIENT_AVAILABLE_STICKERS';
  end if;

  insert into public.reward_exchange_requests(
    family_id,member_id,product_id,product_name,product_emoji,sticker_cost,client_request_id
  ) values (
    p_family_id,target.id,product.id,product.name,product.emoji,product.sticker_cost,p_client_request_id
  ) returning * into result;
  return result;
end
$function$;

alter function public.create_reward_exchange_request_v2(uuid,uuid,uuid,uuid,text) owner to postgres;
revoke all on function public.create_reward_exchange_request_v2(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.create_reward_exchange_request_v2(uuid,uuid,uuid,uuid,text) to service_role;

do $postcondition$
declare
  exchange_oid oid := to_regprocedure('public.create_reward_exchange_request_v2(uuid,uuid,uuid,uuid,text)');
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='reward_products' and column_name='available_from' and udt_name='timestamptz' and is_nullable='YES' and column_default is null)
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='reward_products' and column_name='available_until' and udt_name='timestamptz' and is_nullable='YES' and column_default is null)
    or not exists (select 1 from pg_constraint where conrelid='public.reward_products'::regclass and conname='reward_products_availability_window_check' and contype='c' and convalidated)
    or (select count(*) from public.reward_products)<>(select product_count from reward_product_availability_baseline)
    or exists (select 1 from public.reward_products where available_from is not null or available_until is not null)
    or exchange_oid is null
    or not (select pg_get_functiondef(exchange_oid) like '%product.available_from%' and pg_get_functiondef(exchange_oid) like '%product.available_until%') then
    raise exception using errcode='P0001', message='Reward availability postcondition failed';
  end if;
end
$postcondition$;

notify pgrst, 'reload schema';

commit;
