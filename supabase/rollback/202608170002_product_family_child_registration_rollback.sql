begin;
drop function if exists public.create_product_family_child(uuid,uuid,uuid,text,text,text);
drop table if exists public.product_child_creation_requests;
notify pgrst, 'reload schema';
commit;
