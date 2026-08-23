begin;

do $guard$
begin
  if to_regclass('public.product_onboarding_requests') is not null
     and exists (select 1 from public.product_onboarding_requests) then
    raise exception 'Rollback refuses to remove persisted Product onboarding history';
  end if;
end
$guard$;

drop function if exists public.create_product_family_with_first_parent(uuid, text, text, text, text, text);
drop table if exists public.product_onboarding_requests;

notify pgrst, 'reload schema';
commit;
