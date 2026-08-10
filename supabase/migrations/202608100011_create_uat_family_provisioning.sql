begin;

do $preflight$
begin
  if to_regclass('public.families') is null
     or to_regclass('public.family_members') is null
     or to_regprocedure('public.set_family_member_pin(uuid,uuid,text)') is null then
    raise exception using errcode = 'P0001', message = 'UAT provisioning prerequisites are missing';
  end if;
end
$preflight$;

create table public.uat_family_provisioning_requests (
  request_id uuid primary key,
  request_digest text not null,
  purpose text not null default 'uat',
  family_id uuid not null unique,
  parent_member_id uuid not null unique,
  child_member_id uuid not null unique,
  created_at timestamptz not null default now(),
  constraint uat_family_provisioning_requests_digest_check
    check (request_digest ~ '^[0-9a-f]{64}$'),
  constraint uat_family_provisioning_requests_purpose_check
    check (purpose = 'uat'),
  constraint uat_family_provisioning_requests_family_fk
    foreign key (family_id) references public.families(id) on delete restrict,
  constraint uat_family_provisioning_requests_parent_fk
    foreign key (family_id, parent_member_id)
    references public.family_members(family_id, id) on delete restrict,
  constraint uat_family_provisioning_requests_child_fk
    foreign key (family_id, child_member_id)
    references public.family_members(family_id, id) on delete restrict,
  constraint uat_family_provisioning_requests_distinct_members_check
    check (parent_member_id <> child_member_id)
);

create function public.guard_uat_family_provisioning_request()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  raise exception using errcode = '55000', message = 'UAT provisioning audit is immutable';
end
$function$;

create trigger uat_family_provisioning_requests_immutable
before update or delete on public.uat_family_provisioning_requests
for each row execute function public.guard_uat_family_provisioning_request();

create function public.provision_uat_family(
  p_request_id uuid,
  p_request_digest text,
  p_family_key text,
  p_family_display_name text,
  p_parent_member_key text,
  p_parent_display_name text,
  p_parent_pin text,
  p_child_member_key text,
  p_child_display_name text,
  p_child_pin text
)
returns table (
  family_id uuid,
  parent_member_id uuid,
  child_member_id uuid,
  created boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  existing_request public.uat_family_provisioning_requests%rowtype;
  new_family_id uuid;
  new_parent_id uuid;
  new_child_id uuid;
begin
  if p_request_id is null
     or p_request_digest !~ '^[0-9a-f]{64}$'
     or p_family_key !~ '^uat-[a-z0-9][a-z0-9-]{2,20}$'
     or p_family_display_name <> 'UAT ' || p_family_key
     or p_parent_member_key <> p_family_key || '-parent'
     or p_child_member_key <> p_family_key || '-child'
     or p_parent_display_name !~* '^UAT\y'
     or p_child_display_name !~* '^UAT\y'
     or char_length(p_parent_display_name) not between 5 and 80
     or char_length(p_child_display_name) not between 5 and 80
     or p_parent_pin !~ '^\d{4}$'
     or p_child_pin !~ '^\d{4}$'
     or p_parent_pin = p_child_pin then
    raise exception using errcode = '22023', message = 'invalid UAT provisioning request';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_request_id::text, 202608100011)
  );

  select request.* into existing_request
  from public.uat_family_provisioning_requests request
  where request.request_id = p_request_id;

  if existing_request.request_id is not null then
    if existing_request.request_digest <> p_request_digest then
      raise exception using errcode = '55000', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return query select
      existing_request.family_id,
      existing_request.parent_member_id,
      existing_request.child_member_id,
      false;
    return;
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

  insert into public.family_members (family_id, member_key, display_name, role, is_active)
  values (new_family_id, p_child_member_key, p_child_display_name, 'child', true)
  returning id into new_child_id;

  perform public.set_family_member_pin(new_parent_id, new_family_id, p_parent_pin);
  perform public.set_family_member_pin(new_child_id, new_family_id, p_child_pin);

  insert into public.uat_family_provisioning_requests (
    request_id,
    request_digest,
    purpose,
    family_id,
    parent_member_id,
    child_member_id
  ) values (
    p_request_id,
    p_request_digest,
    'uat',
    new_family_id,
    new_parent_id,
    new_child_id
  );

  return query select new_family_id, new_parent_id, new_child_id, true;
exception
  when unique_violation then
    raise exception using errcode = '55000', message = 'UAT_FAMILY_CONFLICT';
end
$function$;

alter function public.guard_uat_family_provisioning_request() owner to postgres;
alter function public.provision_uat_family(uuid, text, text, text, text, text, text, text, text, text) owner to postgres;

alter table public.uat_family_provisioning_requests enable row level security;
alter table public.uat_family_provisioning_requests force row level security;

revoke all privileges on table public.uat_family_provisioning_requests
  from public, anon, authenticated, service_role;
grant select on table public.uat_family_provisioning_requests to service_role;

revoke all on function public.guard_uat_family_provisioning_request()
  from public, anon, authenticated, service_role;
revoke all on function public.provision_uat_family(uuid, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.provision_uat_family(uuid, text, text, text, text, text, text, text, text, text)
  to service_role;

notify pgrst, 'reload schema';

commit;
