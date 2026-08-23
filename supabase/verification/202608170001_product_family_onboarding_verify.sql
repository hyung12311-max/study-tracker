begin;
set local transaction read only;

do $verify$
begin
  if to_regclass('public.product_onboarding_requests') is null then
    raise exception 'product_onboarding_requests is missing';
  end if;
  if to_regprocedure('public.create_product_family_with_first_parent(uuid,text,text,text,text,text)') is null then
    raise exception 'create_product_family_with_first_parent is missing';
  end if;
  if has_function_privilege('anon', 'public.create_product_family_with_first_parent(uuid,text,text,text,text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.create_product_family_with_first_parent(uuid,text,text,text,text,text)', 'EXECUTE') then
    raise exception 'Product onboarding RPC execution boundary is open';
  end if;
  if not has_function_privilege('service_role', 'public.create_product_family_with_first_parent(uuid,text,text,text,text,text)', 'EXECUTE') then
    raise exception 'Product onboarding RPC is unavailable to service_role';
  end if;
end
$verify$;

rollback;
