begin;

drop function public.provision_uat_family_v2(uuid, text, text, text, text, text, text, jsonb);

-- child_count is retained as immutable audit metadata. Existing v2 UAT rows are never deleted.

commit;
