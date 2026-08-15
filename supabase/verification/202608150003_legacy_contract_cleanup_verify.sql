begin transaction read only;

do $verify$
declare
  legacy_exchange oid := to_regprocedure('public.create_reward_exchange_request(uuid,uuid,uuid,text)');
  exchange_v2 oid := to_regprocedure('public.create_reward_exchange_request_v2(uuid,uuid,uuid,uuid,text)');
  legacy_pin oid := to_regprocedure('public.set_family_member_pin(uuid,uuid,text)');
  pin_v2 oid := to_regprocedure('public.set_family_member_pin_v2(uuid,uuid,uuid,text)');
  uat_provision oid := to_regprocedure('public.provision_uat_family(uuid,text,text,text,text,text,text,text,text,text)');
begin
  if legacy_exchange is null or exchange_v2 is null or legacy_pin is null or pin_v2 is null or uat_provision is null then
    raise exception 'Batch 5C function coexistence verification failed';
  end if;

  if exists (
    select 1 from pg_catalog.pg_proc procedure
    where procedure.oid in (exchange_v2,pin_v2,uat_provision)
      and (procedure.proowner<>'postgres'::regrole or not procedure.prosecdef)
  ) or not has_function_privilege('service_role',exchange_v2,'execute')
     or not has_function_privilege('service_role',pin_v2,'execute')
     or not has_function_privilege('service_role',uat_provision,'execute') then
    raise exception 'Batch 5C maintained contract verification failed';
  end if;

  if has_function_privilege('service_role',legacy_exchange,'execute')
     or has_function_privilege('service_role',legacy_pin,'execute')
     or has_function_privilege('anon',legacy_exchange,'execute')
     or has_function_privilege('authenticated',legacy_exchange,'execute')
     or has_function_privilege('anon',legacy_pin,'execute')
     or has_function_privilege('authenticated',legacy_pin,'execute') then
    raise exception 'Batch 5C legacy RPC closure verification failed';
  end if;

  if exists (
    select 1 from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace on namespace.oid=procedure.pronamespace
    where namespace.nspname='public' and procedure.prokind in ('f','p')
      and procedure.oid<>legacy_exchange
      and pg_catalog.pg_get_functiondef(procedure.oid) ilike '%public.create_reward_exchange_request(%'
  ) or not (
    select pg_catalog.pg_get_functiondef(procedure.oid) ilike '%perform public.set_family_member_pin(%'
    from pg_catalog.pg_proc procedure where procedure.oid=uat_provision
  ) or exists (
    select 1 from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace on namespace.oid=procedure.pronamespace
    where namespace.nspname='public' and procedure.prokind in ('f','p')
      and procedure.oid not in (legacy_pin,uat_provision)
      and pg_catalog.pg_get_functiondef(procedure.oid) ilike '%public.set_family_member_pin(%'
  ) then
    raise exception 'Batch 5C internal dependency verification failed';
  end if;

  if (select count(*) from public.reward_settings)<>1
     or (select count(*) from public.family_reward_settings setting join public.families family on family.id=setting.family_id where family.family_key='default')<>1
     or exists (
       select 1 from public.family_reward_settings setting
       join public.families family on family.id=setting.family_id and family.family_key='default'
       cross join public.reward_settings legacy
       where (setting.target_stickers,setting.reward_name) is distinct from (legacy.target_stickers,legacy.reward_name)
     )
     or has_table_privilege('service_role','public.reward_settings','select')
     or has_table_privilege('anon','public.reward_settings','select')
     or has_table_privilege('authenticated','public.reward_settings','select')
     or not (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid='public.reward_settings'::regclass)
     or not has_table_privilege('service_role','public.family_reward_settings','select') then
    raise exception 'Batch 5C reward archive verification failed';
  end if;

  if (select count(*) from public.push_subscriptions)<>0
     or has_table_privilege('service_role','public.push_subscriptions','select')
     or has_table_privilege('anon','public.push_subscriptions','select')
     or has_table_privilege('authenticated','public.push_subscriptions','select')
     or not (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid='public.push_subscriptions'::regclass)
     or not has_table_privilege('service_role','public.family_push_subscriptions','select') then
    raise exception 'Batch 5C Push archive verification failed';
  end if;

  if exists (select 1 from public.family_reward_settings setting left join public.families family on family.id=setting.family_id where family.id is null) then
    raise exception 'Batch 5C tenant verification failed';
  end if;
end
$verify$;

select 'Batch 5C legacy contract cleanup verification passed' as result;
rollback;
