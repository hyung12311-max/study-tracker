-- Read-only, fail-fast verification for Phase 0A.
begin transaction read only;

do $$
declare
  table_name text;
  table_oid regclass;
  definition text;
begin
  if to_regclass('public.family_reward_settings') is null then
    raise exception 'family_reward_settings is missing';
  end if;

  foreach table_name in array array['family_reward_settings', 'reward_settings', 'sticker_history'] loop
    table_oid := to_regclass('public.' || table_name);
    if table_oid is null then raise exception '% is missing', table_name; end if;
    if not exists (select 1 from pg_class where oid = table_oid and relrowsecurity and relforcerowsecurity) then
      raise exception '% must have enabled and forced RLS', table_name;
    end if;
    if exists (
      select 1 from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) privilege
      where has_table_privilege('anon', table_oid, privilege)
         or has_table_privilege('authenticated', table_oid, privilege)
    ) then
      raise exception '% is still browser accessible', table_name;
    end if;
    if exists (
      select 1 from pg_policy
      where polrelid = table_oid and polpermissive
    ) then
      raise exception '% has a permissive policy', table_name;
    end if;
  end loop;

  if not (select bool_and(has_table_privilege('service_role', 'public.family_reward_settings', privilege))
          from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) privilege) then
    raise exception 'service_role lacks family_reward_settings CRUD';
  end if;
  if not has_table_privilege('service_role', 'public.reward_settings', 'SELECT')
     or exists (
       select 1 from unnest(array['INSERT', 'UPDATE', 'DELETE']) privilege
       where has_table_privilege('service_role', 'public.reward_settings', privilege)
     ) then
    raise exception 'legacy reward_settings must be service-role read-only';
  end if;
  if not (select bool_and(has_table_privilege('service_role', 'public.sticker_history', privilege))
          from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) privilege) then
    raise exception 'service_role lacks sticker_history CRUD';
  end if;

  if to_regprocedure('public.verify_family_parent_pin(uuid,uuid,text)') is null then
    raise exception 'family-scoped parent PIN function is missing';
  end if;
  if not exists (
    select 1 from pg_proc
    where oid = 'public.verify_family_parent_pin(uuid,uuid,text)'::regprocedure
      and prosecdef
      and proconfig @> array['search_path=pg_catalog, public, extensions']
  ) then
    raise exception 'PIN function must be security definer with a fixed search_path';
  end if;
  if has_function_privilege('anon', 'public.verify_family_parent_pin(uuid,uuid,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.verify_family_parent_pin(uuid,uuid,text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.verify_family_parent_pin(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'PIN function grants are incorrect';
  end if;

  select pg_get_constraintdef(oid) into definition
  from pg_constraint
  where conrelid = 'public.family_messages'::regclass
    and conname = 'family_messages_family_client_message_id_key';
  if definition is null or definition !~* 'unique .*family_id, client_message_id' then
    raise exception 'family-scoped client_message_id uniqueness is missing';
  end if;
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.family_messages'::regclass
      and conname = 'family_messages_client_message_id_key'
  ) then
    raise exception 'global client_message_id uniqueness still exists';
  end if;
end
$$;

select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
where c.oid in (
  'public.family_reward_settings'::regclass,
  'public.reward_settings'::regclass,
  'public.sticker_history'::regclass
)
order by c.relname;

rollback;
