begin transaction read only;

do $verify$
declare
  exchange_oid oid := to_regprocedure('public.create_reward_exchange_request_v2(uuid,uuid,uuid,uuid,text)');
  pin_oid oid := to_regprocedure('public.set_family_member_pin_v2(uuid,uuid,uuid,text)');
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='reward_settings' and column_name='target_stickers' and udt_name='int4' and is_nullable='YES' and column_default='10')
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='reward_settings' and column_name='reward_name' and udt_name='text' and is_nullable='YES' and column_default is null)
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='family_reward_settings' and column_name='target_stickers' and udt_name='int4' and is_nullable='NO')
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='family_reward_settings' and column_name='reward_name' and udt_name='text' and is_nullable='NO') then
    raise exception using errcode='P0001', message='Batch 5B reward schema verification failed';
  end if;
  if (select count(*) from public.families where family_key='default')<>1
    or (select count(*) from public.reward_settings)<>1
    or (select count(*) from public.reward_settings where target_stickers is null or reward_name is null)<>0
    or (select count(*) from public.family_reward_settings setting join public.families family on family.id=setting.family_id where family.family_key='default')<>1 then
    raise exception using errcode='P0001', message='Batch 5B reward setting cardinality failed';
  end if;
  if exists (
    select 1 from public.family_reward_settings setting
    join public.families family on family.id=setting.family_id
    cross join public.reward_settings legacy
    where family.family_key='default'
      and (setting.target_stickers,setting.reward_name) is distinct from (legacy.target_stickers,legacy.reward_name)
  ) then raise exception using errcode='P0001', message='Batch 5B reward parity failed'; end if;

  if exchange_oid is null or pin_oid is null
    or to_regprocedure('public.create_reward_exchange_request(uuid,uuid,uuid,text)') is null
    or to_regprocedure('public.set_family_member_pin(uuid,uuid,text)') is null then
    raise exception using errcode='P0001', message='Batch 5B old/new RPC coexistence failed';
  end if;
  if not (select prosecdef and coalesce(proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public'] from pg_proc where oid=exchange_oid)
    or not (select prosecdef and coalesce(proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public, extensions'] from pg_proc where oid=pin_oid) then
    raise exception using errcode='P0001', message='Batch 5B RPC security/search_path failed';
  end if;
  if exists (select 1 from pg_proc procedure cross join lateral aclexplode(coalesce(procedure.proacl,acldefault('f',procedure.proowner))) acl where procedure.oid=exchange_oid and acl.grantee=0 and acl.privilege_type='EXECUTE')
    or has_function_privilege('anon',exchange_oid,'EXECUTE')
    or has_function_privilege('authenticated',exchange_oid,'EXECUTE')
    or not has_function_privilege('service_role',exchange_oid,'EXECUTE')
    or exists (select 1 from pg_proc procedure cross join lateral aclexplode(coalesce(procedure.proacl,acldefault('f',procedure.proowner))) acl where procedure.oid=pin_oid and acl.grantee=0 and acl.privilege_type='EXECUTE')
    or has_function_privilege('anon',pin_oid,'EXECUTE')
    or has_function_privilege('authenticated',pin_oid,'EXECUTE')
    or not has_function_privilege('service_role',pin_oid,'EXECUTE') then
    raise exception using errcode='P0001', message='Batch 5B RPC execute ACL failed';
  end if;

  if exists (select 1 from public.reward_exchange_requests request join public.family_members member on member.id=request.member_id where request.family_id<>member.family_id)
    or exists (select 1 from public.reward_exchange_requests request join public.reward_products product on product.id=request.product_id where request.family_id<>product.family_id) then
    raise exception using errcode='23514', message='Batch 5B reward tenant verification failed';
  end if;
end
$verify$;

select 'Batch 5B reward/auth expand contract verification passed' as result;
rollback;
