begin;

do $preflight$
declare
  legacy_exchange oid := to_regprocedure('public.create_reward_exchange_request(uuid,uuid,uuid,text)');
  legacy_pin oid := to_regprocedure('public.set_family_member_pin(uuid,uuid,text)');
begin
  if legacy_exchange is null or legacy_pin is null
     or to_regprocedure('public.create_reward_exchange_request_v2(uuid,uuid,uuid,uuid,text)') is null
     or to_regprocedure('public.set_family_member_pin_v2(uuid,uuid,uuid,text)') is null
     or has_function_privilege('service_role',legacy_exchange,'execute')
     or has_function_privilege('service_role',legacy_pin,'execute')
     or has_table_privilege('service_role','public.reward_settings','select')
     or has_table_privilege('service_role','public.push_subscriptions','select')
     or not (select relforcerowsecurity from pg_catalog.pg_class where oid='public.push_subscriptions'::regclass)
     or (select count(*) from public.push_subscriptions)<>0 then
    raise exception using errcode='P0001', message='Batch 5C rollback preflight failed';
  end if;
end
$preflight$;

grant execute on function public.create_reward_exchange_request(uuid,uuid,uuid,text) to service_role;
grant execute on function public.set_family_member_pin(uuid,uuid,text) to service_role;
grant select on table public.reward_settings to service_role;

alter table public.push_subscriptions no force row level security;
grant select, insert, update, delete on table public.push_subscriptions to service_role;

notify pgrst, 'reload schema';
commit;
