begin;
select to_regclass('public.product_child_creation_requests') as product_child_creation_requests;
select to_regprocedure('public.create_product_family_child(uuid,uuid,uuid,text,text,text)') as create_product_family_child;
select relrowsecurity, relforcerowsecurity from pg_class where oid='public.product_child_creation_requests'::regclass;
select has_function_privilege('anon','public.create_product_family_child(uuid,uuid,uuid,text,text,text)','execute') as anon_execute,
       has_function_privilege('authenticated','public.create_product_family_child(uuid,uuid,uuid,text,text,text)','execute') as authenticated_execute,
       has_function_privilege('service_role','public.create_product_family_child(uuid,uuid,uuid,text,text,text)','execute') as service_execute;
select pg_get_functiondef('public.create_product_family_child(uuid,uuid,uuid,text,text,text)'::regprocedure) like '%pin_hash%null%' as pin_hash_is_null;
rollback;
