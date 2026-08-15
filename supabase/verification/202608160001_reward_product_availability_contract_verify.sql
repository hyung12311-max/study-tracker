begin transaction read only;

do $verify$
declare
  exchange_oid oid := to_regprocedure('public.create_reward_exchange_request_v2(uuid,uuid,uuid,uuid,text)');
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='reward_products' and column_name='available_from' and udt_name='timestamptz' and is_nullable='YES' and column_default is null)
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='reward_products' and column_name='available_until' and udt_name='timestamptz' and is_nullable='YES' and column_default is null) then
    raise exception using errcode='P0001', message='Reward availability column verification failed';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.reward_products'::regclass
      and conname='reward_products_availability_window_check'
      and contype='c' and convalidated
      and pg_get_constraintdef(oid) like '%available_from%'
      and pg_get_constraintdef(oid) like '%available_until%'
  ) then
    raise exception using errcode='P0001', message='Reward availability window verification failed';
  end if;

  if exchange_oid is null
    or not (select prosecdef and proowner='postgres'::regrole and coalesce(proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public'] from pg_proc where oid=exchange_oid)
    or not (select pg_get_functiondef(exchange_oid) like '%product.available_from%' and pg_get_functiondef(exchange_oid) like '%product.available_until%')
    or not has_function_privilege('service_role',exchange_oid,'EXECUTE')
    or has_function_privilege('anon',exchange_oid,'EXECUTE')
    or has_function_privilege('authenticated',exchange_oid,'EXECUTE') then
    raise exception using errcode='P0001', message='Reward availability RPC verification failed';
  end if;

  if exists (select 1 from public.reward_products where available_from is not null or available_until is not null) then
    raise exception using errcode='P0001', message='Existing reward product availability changed';
  end if;

  if exists (select 1 from public.reward_exchange_requests request join public.family_members member on member.id=request.member_id where request.family_id<>member.family_id)
    or exists (select 1 from public.reward_exchange_requests request join public.reward_products product on product.id=request.product_id where request.family_id<>product.family_id) then
    raise exception using errcode='23514', message='Reward availability tenant verification failed';
  end if;
end
$verify$;

select 'Reward product availability contract verification passed' as result;
rollback;
