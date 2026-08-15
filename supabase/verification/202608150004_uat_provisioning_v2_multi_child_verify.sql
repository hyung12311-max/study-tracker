begin transaction read only;

do $verify$
declare
  v1 regprocedure := to_regprocedure('public.provision_uat_family(uuid,text,text,text,text,text,text,text,text,text)');
  v2 regprocedure := to_regprocedure('public.provision_uat_family_v2(uuid,text,text,text,text,text,text,jsonb)');
  legacy_pin regprocedure := to_regprocedure('public.set_family_member_pin(uuid,uuid,text)');
begin
  if v1 is null or v2 is null or legacy_pin is null then
    raise exception using errcode = 'P0001', message = 'UAT provisioning v1/v2 contract is incomplete';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'uat_family_provisioning_requests'
      and column_name = 'child_count'
      and data_type = 'integer'
      and is_nullable = 'NO'
  ) then
    raise exception using errcode = 'P0001', message = 'UAT provisioning v2 audit child count is missing';
  end if;

  if not has_function_privilege('service_role', v1, 'EXECUTE')
     or has_function_privilege('anon', v1, 'EXECUTE')
     or has_function_privilege('authenticated', v1, 'EXECUTE')
     or not has_function_privilege('service_role', v2, 'EXECUTE')
     or has_function_privilege('anon', v2, 'EXECUTE')
     or has_function_privilege('authenticated', v2, 'EXECUTE') then
    raise exception using errcode = 'P0001', message = 'UAT provisioning v1/v2 ACL is invalid';
  end if;

  if has_function_privilege('service_role', legacy_pin, 'EXECUTE')
     or has_function_privilege('anon', legacy_pin, 'EXECUTE')
     or has_function_privilege('authenticated', legacy_pin, 'EXECUTE') then
    raise exception using errcode = 'P0001', message = 'legacy PIN direct execution was reopened';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc procedure
    where procedure.oid = v2
      and procedure.prosecdef
      and procedure.proowner = 'postgres'::regrole
      and procedure.proconfig = array['search_path=pg_catalog, public']
      and pg_catalog.pg_get_functiondef(procedure.oid) like '%perform public.set_family_member_pin(%'
  ) then
    raise exception using errcode = 'P0001', message = 'UAT provisioning v2 function is not hardened';
  end if;

  if not (
    select relrowsecurity and relforcerowsecurity
    from pg_catalog.pg_class
    where oid = 'public.uat_family_provisioning_requests'::regclass
  ) then
    raise exception using errcode = 'P0001', message = 'UAT provisioning audit RLS changed';
  end if;
end
$verify$;

commit;
