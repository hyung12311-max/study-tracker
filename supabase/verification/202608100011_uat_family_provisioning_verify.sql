begin transaction read only;

do $verify$
begin
  if to_regclass('public.uat_family_provisioning_requests') is null then
    raise exception using errcode = 'P0001', message = 'UAT provisioning audit table is missing';
  end if;

  if not (
    select relrowsecurity and relforcerowsecurity
    from pg_catalog.pg_class
    where oid = 'public.uat_family_provisioning_requests'::regclass
  ) then
    raise exception using errcode = 'P0001', message = 'UAT provisioning audit RLS is not forced';
  end if;

  if has_table_privilege('anon', 'public.uat_family_provisioning_requests', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.uat_family_provisioning_requests', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role', 'public.uat_family_provisioning_requests', 'INSERT,UPDATE,DELETE')
     or not has_table_privilege('service_role', 'public.uat_family_provisioning_requests', 'SELECT') then
    raise exception using errcode = 'P0001', message = 'UAT provisioning audit ACL is invalid';
  end if;

  if has_function_privilege('anon', 'public.provision_uat_family(uuid,text,text,text,text,text,text,text,text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.provision_uat_family(uuid,text,text,text,text,text,text,text,text,text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.provision_uat_family(uuid,text,text,text,text,text,text,text,text,text)', 'EXECUTE') then
    raise exception using errcode = 'P0001', message = 'UAT provisioning function ACL is invalid';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'provision_uat_family'
      and procedure.prosecdef
      and procedure.proconfig = array['search_path=pg_catalog, public']
  ) then
    raise exception using errcode = 'P0001', message = 'UAT provisioning function is not hardened';
  end if;
end
$verify$;

commit;
