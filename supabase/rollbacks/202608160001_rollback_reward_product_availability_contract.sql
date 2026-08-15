begin;

do $guard$
begin
  if current_setting('app.reward_availability_rollback_approved',true) is distinct from 'true' then
    raise exception using errcode='P0001', message='Reward availability rollback requires explicit coordinated approval';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='reward_products' and column_name='available_from')
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='reward_products' and column_name='available_until') then
    raise exception using errcode='P0001', message='Reward availability rollback target is missing';
  end if;
  if exists (select 1 from public.reward_products where available_from is not null or available_until is not null) then
    raise exception using errcode='P0001', message='Reward availability rollback refused because availability data exists';
  end if;
end
$guard$;

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
  select member.* into actor from public.family_members member where member.id=p_actor_member_id and member.family_id=p_family_id and member.is_active=true and member.role in ('parent','child') for update;
  if actor.id is null then raise exception using errcode='42501', message='active reward actor is required'; end if;
  select member.* into target from public.family_members member where member.id=p_target_member_id and member.family_id=p_family_id and member.is_active=true and member.role='child' for update;
  if target.id is null then raise exception using errcode='P0002', message='reward target was not found'; end if;
  if actor.role='child' and actor.id<>target.id then raise exception using errcode='42501', message='child reward target must be self'; end if;
  select product_row.* into product from public.reward_products product_row where product_row.id=p_product_id and product_row.family_id=p_family_id and product_row.is_active=true for update;
  if product.id is null then raise exception using errcode='P0002', message='reward product was not found'; end if;
  if product.stock is not null and product.stock<=0 then raise exception using errcode='55000', message='REWARD_PRODUCT_OUT_OF_STOCK'; end if;
  select request.* into result from public.reward_exchange_requests request where request.client_request_id=p_client_request_id and request.member_id=target.id;
  if result.id is not null then
    if result.family_id<>p_family_id or result.product_id is distinct from product.id then raise exception using errcode='55000', message='IDEMPOTENCY_CONFLICT'; end if;
    return result;
  end if;
  select coalesce(sum(transaction_row.amount),0) into balance from public.sticker_transactions transaction_row where transaction_row.family_id=p_family_id and transaction_row.member_id=target.id;
  select coalesce(sum(request.sticker_cost),0) into reserved from public.reward_exchange_requests request where request.family_id=p_family_id and request.member_id=target.id and request.status='pending';
  if balance-reserved<product.sticker_cost then raise exception using errcode='55000', message='INSUFFICIENT_AVAILABLE_STICKERS'; end if;
  insert into public.reward_exchange_requests(family_id,member_id,product_id,product_name,product_emoji,sticker_cost,client_request_id)
  values(p_family_id,target.id,product.id,product.name,product.emoji,product.sticker_cost,p_client_request_id) returning * into result;
  return result;
end
$function$;

alter function public.create_reward_exchange_request_v2(uuid,uuid,uuid,uuid,text) owner to postgres;
revoke all on function public.create_reward_exchange_request_v2(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.create_reward_exchange_request_v2(uuid,uuid,uuid,uuid,text) to service_role;

alter table public.reward_products
  drop constraint reward_products_availability_window_check,
  drop column available_from,
  drop column available_until;

notify pgrst, 'reload schema';
commit;
