begin;

do $preflight$
begin
  if to_regclass('public.families') is null
     or to_regclass('public.family_members') is null
     or to_regclass('public.uat_family_provisioning_requests') is null
     or to_regprocedure('public.provision_uat_family(uuid,text,text,text,text,text,text,text,text,text)') is null
     or to_regprocedure('public.set_family_member_pin(uuid,uuid,text)') is null then
    raise exception using errcode = 'P0001', message = 'UAT provisioning v2 prerequisites are missing';
  end if;

  if has_function_privilege('service_role', 'public.set_family_member_pin(uuid,uuid,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.set_family_member_pin(uuid,uuid,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.set_family_member_pin(uuid,uuid,text)', 'EXECUTE') then
    raise exception using errcode = 'P0001', message = 'legacy PIN direct execution must remain closed';
  end if;
end
$preflight$;

alter table public.uat_family_provisioning_requests
  add column child_count integer not null default 1,
  add constraint uat_family_provisioning_requests_child_count_check
    check (child_count between 1 and 5);

create function public.provision_uat_family_v2(
  p_request_id uuid,
  p_request_digest text,
  p_family_key text,
  p_family_display_name text,
  p_parent_member_key text,
  p_parent_display_name text,
  p_parent_pin text,
  p_children jsonb
)
returns table (
  family_id uuid,
  parent_member_id uuid,
  children jsonb,
  created boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  child_input jsonb;
  child_position bigint;
  new_family_id uuid;
  new_parent_id uuid;
  new_child_id uuid;
  new_children jsonb := '[]'::jsonb;
begin
  if p_request_id is null
     or p_request_digest !~ '^[0-9a-f]{64}$'
     or p_family_key !~ '^uat-[a-z0-9][a-z0-9-]{2,20}$'
     or p_family_display_name <> 'UAT ' || p_family_key
     or p_parent_member_key <> 'parent'
     or p_parent_display_name !~* '^UAT\y'
     or char_length(p_parent_display_name) not between 5 and 80
     or p_parent_pin !~ '^\d{4}$'
     or p_children is null
     or jsonb_typeof(p_children) <> 'array'
     or jsonb_array_length(p_children) not between 1 and 5 then
    raise exception using errcode = '22023', message = 'invalid UAT provisioning v2 request';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_children) with ordinality child(value, position)
    where jsonb_typeof(child.value) <> 'object'
       or not child.value ?& array['member_key', 'display_name', 'pin']
       or child.value <> jsonb_build_object(
         'member_key', child.value->>'member_key',
         'display_name', child.value->>'display_name',
         'pin', child.value->>'pin'
       )
       or child.value->>'member_key' <> 'child' || child.position::text
       or child.value->>'display_name' !~* '^UAT\y'
       or char_length(child.value->>'display_name') not between 5 and 80
       or child.value->>'pin' !~ '^\d{4}$'
  ) or exists (
    select 1
    from (
      select p_parent_pin as bootstrap_pin
      union all
      select child.value->>'pin'
      from jsonb_array_elements(p_children) child(value)
    ) pins
    group by pins.bootstrap_pin
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'invalid UAT provisioning v2 member input';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_request_id::text, 202608150004)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_family_key, 202608150004)
  );

  if exists (
    select 1 from public.uat_family_provisioning_requests request
    where request.request_id = p_request_id
  ) then
    raise exception using errcode = '55000', message = 'UAT_REQUEST_CONFLICT';
  end if;
  if exists (select 1 from public.families family where family.family_key = p_family_key) then
    raise exception using errcode = '55000', message = 'UAT_FAMILY_CONFLICT';
  end if;

  insert into public.families (family_key, display_name)
  values (p_family_key, p_family_display_name)
  returning id into new_family_id;

  insert into public.family_members (family_id, member_key, display_name, role, is_active)
  values (new_family_id, p_parent_member_key, p_parent_display_name, 'parent', true)
  returning id into new_parent_id;
  perform public.set_family_member_pin(new_parent_id, new_family_id, p_parent_pin);

  for child_input, child_position in
    select child.value, child.position
    from jsonb_array_elements(p_children) with ordinality child(value, position)
    order by child.position
  loop
    insert into public.family_members (family_id, member_key, display_name, role, is_active)
    values (
      new_family_id,
      child_input->>'member_key',
      child_input->>'display_name',
      'child',
      true
    )
    returning id into new_child_id;
    perform public.set_family_member_pin(new_child_id, new_family_id, child_input->>'pin');
    new_children := new_children || jsonb_build_array(jsonb_build_object(
      'id', new_child_id,
      'member_key', child_input->>'member_key'
    ));
  end loop;

  insert into public.uat_family_provisioning_requests (
    request_id,
    request_digest,
    purpose,
    family_id,
    parent_member_id,
    child_member_id,
    child_count
  ) values (
    p_request_id,
    p_request_digest,
    'uat',
    new_family_id,
    new_parent_id,
    ((new_children->0)->>'id')::uuid,
    jsonb_array_length(new_children)
  );

  return query select new_family_id, new_parent_id, new_children, true;
exception
  when unique_violation then
    raise exception using errcode = '55000', message = 'UAT_FAMILY_CONFLICT';
end
$function$;

alter function public.provision_uat_family_v2(uuid, text, text, text, text, text, text, jsonb)
  owner to postgres;

revoke all on function public.provision_uat_family_v2(uuid, text, text, text, text, text, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.provision_uat_family_v2(uuid, text, text, text, text, text, text, jsonb)
  to service_role;

notify pgrst, 'reload schema';

commit;
