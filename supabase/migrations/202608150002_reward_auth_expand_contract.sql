begin;

do $preflight$
declare
  default_family_count integer;
  legacy_setting_count integer;
  target_setting_count integer;
  legacy_target_null_count integer;
  legacy_name_null_count integer;
begin
  if to_regclass('public.families') is null
    or to_regclass('public.family_members') is null
    or to_regclass('public.reward_settings') is null
    or to_regclass('public.family_reward_settings') is null
    or to_regclass('public.reward_products') is null
    or to_regclass('public.reward_exchange_requests') is null
    or to_regclass('public.sticker_transactions') is null then
    raise exception using errcode='P0001', message='Batch 5B prerequisites are missing';
  end if;

  if to_regprocedure('public.create_reward_exchange_request(uuid,uuid,uuid,text)') is null
    or to_regprocedure('public.set_family_member_pin(uuid,uuid,text)') is null then
    raise exception using errcode='P0001', message='Batch 5B legacy function contract is missing';
  end if;
  if to_regprocedure('public.create_reward_exchange_request_v2(uuid,uuid,uuid,uuid,text)') is not null
    or to_regprocedure('public.set_family_member_pin_v2(uuid,uuid,uuid,text)') is not null then
    raise exception using errcode='P0001', message='Batch 5B target function already exists';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='reward_settings' and column_name='target_stickers' and udt_name='int4' and is_nullable='YES' and column_default='10')
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='reward_settings' and column_name='reward_name' and udt_name='text' and is_nullable='YES' and column_default is null)
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='family_reward_settings' and column_name='family_id' and udt_name='uuid' and is_nullable='NO')
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='family_reward_settings' and column_name='target_stickers' and udt_name='int4' and is_nullable='NO')
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='family_reward_settings' and column_name='reward_name' and udt_name='text' and is_nullable='NO')
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='family_members' and column_name='pin_hash' and udt_name='text') then
    raise exception using errcode='P0001', message='Batch 5B reward schema contract changed';
  end if;

  select count(*) into default_family_count from public.families where family_key='default';
  select count(*) into legacy_setting_count from public.reward_settings;
  select count(*) into target_setting_count
  from public.family_reward_settings setting
  join public.families family on family.id=setting.family_id
  where family.family_key='default';
  select count(*) filter (where target_stickers is null),count(*) filter (where reward_name is null)
  into legacy_target_null_count,legacy_name_null_count from public.reward_settings;
  if default_family_count<>1 or legacy_setting_count<>1 or target_setting_count<>0 then
    raise exception using errcode='P0001',
      message=format('Batch 5B reward data cardinality guard failed: default=%s legacy=%s target=%s',default_family_count,legacy_setting_count,target_setting_count);
  end if;
  if legacy_target_null_count<>0 or legacy_name_null_count<>0 then
    raise exception using errcode='P0001',
      message=format('Batch 5B reward data null guard failed: target_stickers=%s reward_name=%s',legacy_target_null_count,legacy_name_null_count);
  end if;

  if exists (select 1 from public.reward_exchange_requests request join public.family_members member on member.id=request.member_id where request.family_id<>member.family_id)
    or exists (select 1 from public.reward_exchange_requests request join public.reward_products product on product.id=request.product_id where request.family_id<>product.family_id)
    or exists (select 1 from public.sticker_transactions transaction_row join public.family_members member on member.id=transaction_row.member_id where transaction_row.family_id<>member.family_id) then
    raise exception using errcode='23514', message='Batch 5B existing reward tenant violation';
  end if;
end
$preflight$;

insert into public.family_reward_settings(
  family_id,target_stickers,reward_name,created_at,updated_at
)
select family.id,legacy.target_stickers,legacy.reward_name,now(),now()
from public.families family cross join public.reward_settings legacy
where family.family_key='default';

do $parity$
begin
  if (select count(*) from public.reward_settings)<>1
    or (select count(*) from public.family_reward_settings setting join public.families family on family.id=setting.family_id where family.family_key='default')<>1
    or exists (
      select 1 from public.family_reward_settings setting
      join public.families family on family.id=setting.family_id
      cross join public.reward_settings legacy
      where family.family_key='default'
        and (setting.target_stickers,setting.reward_name) is distinct from (legacy.target_stickers,legacy.reward_name)
    ) then
    raise exception using errcode='P0001', message='Batch 5B reward setting parity failed';
  end if;
end
$parity$;

create function public.create_reward_exchange_request_v2(
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

create function public.set_family_member_pin_v2(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_target_member_id uuid,
  p_pin text
)
returns void
language plpgsql
security definer
set search_path=pg_catalog, public, extensions
as $function$
declare
  actor public.family_members%rowtype;
begin
  if p_family_id is null or p_actor_member_id is null or p_target_member_id is null
    or p_pin !~ '^\d{4}$' then
    raise exception using errcode='22023', message='invalid PIN request';
  end if;
  select member.* into actor from public.family_members member
  where member.id=p_actor_member_id and member.family_id=p_family_id
    and member.is_active=true and member.role='parent' for update;
  if actor.id is null then raise exception using errcode='42501', message='active parent actor is required'; end if;

  update public.family_members member
  set pin_hash=extensions.crypt(p_pin,extensions.gen_salt('bf',12)),
      failed_attempts=0,locked_until=null,updated_at=now()
  where member.id=p_target_member_id and member.family_id=p_family_id and member.is_active=true;
  if not found then raise exception using errcode='P0002', message='PIN target was not found'; end if;
end
$function$;

alter function public.create_reward_exchange_request_v2(uuid,uuid,uuid,uuid,text) owner to postgres;
alter function public.set_family_member_pin_v2(uuid,uuid,uuid,text) owner to postgres;
revoke all on function public.create_reward_exchange_request_v2(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.set_family_member_pin_v2(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.create_reward_exchange_request_v2(uuid,uuid,uuid,uuid,text) to service_role;
grant execute on function public.set_family_member_pin_v2(uuid,uuid,uuid,text) to service_role;

commit;
