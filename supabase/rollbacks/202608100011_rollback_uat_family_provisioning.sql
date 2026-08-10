begin;

do $guard$
begin
  if to_regclass('public.uat_family_provisioning_requests') is not null
     and exists (select 1 from public.uat_family_provisioning_requests) then
    raise exception using errcode = '55000', message = 'UAT family provisioning is in use';
  end if;
end
$guard$;

drop function public.provision_uat_family(uuid, text, text, text, text, text, text, text, text, text);
drop trigger uat_family_provisioning_requests_immutable on public.uat_family_provisioning_requests;
drop function public.guard_uat_family_provisioning_request();
drop table public.uat_family_provisioning_requests;

commit;
