begin;

do $preflight$
declare
  legacy_exchange oid := to_regprocedure('public.create_reward_exchange_request(uuid,uuid,uuid,text)');
  exchange_v2 oid := to_regprocedure('public.create_reward_exchange_request_v2(uuid,uuid,uuid,uuid,text)');
  legacy_pin oid := to_regprocedure('public.set_family_member_pin(uuid,uuid,text)');
  pin_v2 oid := to_regprocedure('public.set_family_member_pin_v2(uuid,uuid,uuid,text)');
  uat_provision oid := to_regprocedure('public.provision_uat_family(uuid,text,text,text,text,text,text,text,text,text)');
begin
  if legacy_exchange is null or exchange_v2 is null or legacy_pin is null or pin_v2 is null or uat_provision is null then
    raise exception using errcode='P0001', message='Batch 5C function preflight failed';
  end if;

  if to_regclass('public.reward_settings') is null
     or to_regclass('public.family_reward_settings') is null
     or to_regclass('public.push_subscriptions') is null
     or to_regclass('public.family_push_subscriptions') is null then
    raise exception using errcode='P0001', message='Batch 5C table preflight failed';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc procedure
    where procedure.oid in (legacy_exchange, exchange_v2, legacy_pin, pin_v2, uat_provision)
      and (
        procedure.proowner <> 'postgres'::regrole
        or not procedure.prosecdef
        or not exists (
          select 1 from unnest(coalesce(procedure.proconfig, array[]::text[])) setting
          where setting like 'search_path=%'
        )
      )
  ) then
    raise exception using errcode='P0001', message='Batch 5C function security preflight failed';
  end if;

  if not has_function_privilege('service_role', legacy_exchange, 'execute')
     or not has_function_privilege('service_role', legacy_pin, 'execute')
     or not has_function_privilege('service_role', exchange_v2, 'execute')
     or not has_function_privilege('service_role', pin_v2, 'execute')
     or not has_function_privilege('service_role', uat_provision, 'execute')
     or has_function_privilege('anon', legacy_exchange, 'execute')
     or has_function_privilege('authenticated', legacy_exchange, 'execute')
     or has_function_privilege('anon', legacy_pin, 'execute')
     or has_function_privilege('authenticated', legacy_pin, 'execute') then
    raise exception using errcode='P0001', message='Batch 5C function ACL preflight failed';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace on namespace.oid=procedure.pronamespace
    where namespace.nspname='public'
      and procedure.prokind in ('f','p')
      and procedure.oid<>legacy_exchange
      and pg_catalog.pg_get_functiondef(procedure.oid) ilike '%public.create_reward_exchange_request(%'
  ) then
    raise exception using errcode='P0001', message='legacy Exchange internal dependency remains';
  end if;

  if not (
    select pg_catalog.pg_get_functiondef(procedure.oid) ilike '%perform public.set_family_member_pin(%'
    from pg_catalog.pg_proc procedure
    where procedure.oid=uat_provision
  ) or exists (
    select 1
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace on namespace.oid=procedure.pronamespace
    where namespace.nspname='public'
      and procedure.prokind in ('f','p')
      and procedure.oid not in (legacy_pin, uat_provision)
      and pg_catalog.pg_get_functiondef(procedure.oid) ilike '%public.set_family_member_pin(%'
  ) then
    raise exception using errcode='P0001', message='legacy PIN internal dependency changed';
  end if;

  if (select count(*) from public.reward_settings)<>1
     or (select count(*) from public.family_reward_settings setting join public.families family on family.id=setting.family_id where family.family_key='default')<>1
     or exists (
       select 1
       from public.family_reward_settings setting
       join public.families family on family.id=setting.family_id and family.family_key='default'
       cross join public.reward_settings legacy
       where (setting.target_stickers,setting.reward_name) is distinct from (legacy.target_stickers,legacy.reward_name)
     ) then
    raise exception using errcode='P0001', message='legacy reward parity preflight failed';
  end if;

  if not has_table_privilege('service_role','public.reward_settings','select')
     or has_table_privilege('service_role','public.reward_settings','insert')
     or has_table_privilege('service_role','public.reward_settings','update')
     or has_table_privilege('service_role','public.reward_settings','delete')
     or not (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid='public.reward_settings'::regclass)
     or exists (select 1 from public.family_reward_settings setting left join public.families family on family.id=setting.family_id where family.id is null) then
    raise exception using errcode='P0001', message='legacy reward access preflight failed';
  end if;

  if (select count(*) from public.push_subscriptions)<>0
     or not (select relrowsecurity and not relforcerowsecurity from pg_catalog.pg_class where oid='public.push_subscriptions'::regclass)
     or not has_table_privilege('service_role','public.push_subscriptions','select')
     or not has_table_privilege('service_role','public.push_subscriptions','insert')
     or not has_table_privilege('service_role','public.push_subscriptions','update')
     or not has_table_privilege('service_role','public.push_subscriptions','delete') then
    raise exception using errcode='P0001', message='legacy Push preflight failed';
  end if;
end
$preflight$;

revoke all on function public.create_reward_exchange_request(uuid,uuid,uuid,text)
  from public, anon, authenticated, service_role;
revoke all on function public.set_family_member_pin(uuid,uuid,text)
  from public, anon, authenticated, service_role;

revoke all privileges on table public.reward_settings
  from public, anon, authenticated, service_role;

alter table public.push_subscriptions force row level security;
revoke all privileges on table public.push_subscriptions
  from public, anon, authenticated, service_role;

do $postcondition$
declare
  legacy_exchange oid := to_regprocedure('public.create_reward_exchange_request(uuid,uuid,uuid,text)');
  legacy_pin oid := to_regprocedure('public.set_family_member_pin(uuid,uuid,text)');
begin
  if has_function_privilege('service_role', legacy_exchange, 'execute')
     or has_function_privilege('service_role', legacy_pin, 'execute')
     or has_table_privilege('service_role','public.reward_settings','select')
     or has_table_privilege('service_role','public.push_subscriptions','select')
     or not (select relforcerowsecurity from pg_catalog.pg_class where oid='public.push_subscriptions'::regclass) then
    raise exception using errcode='P0001', message='Batch 5C access closure failed';
  end if;
end
$postcondition$;

notify pgrst, 'reload schema';
commit;
