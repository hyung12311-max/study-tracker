begin;

do $preflight$
begin
  if to_regclass('public.families') is null
     or to_regclass('public.family_members') is null
     or to_regclass('public.family_reward_settings') is null then
    raise exception using errcode = 'P0001', message = 'Product onboarding prerequisites are missing';
  end if;
end
$preflight$;

create table public.product_onboarding_requests (
  onboarding_request_id uuid primary key,
  request_digest text not null,
  rate_scope_digest text not null,
  family_id uuid not null unique,
  parent_member_id uuid not null unique,
  status text not null default 'complete',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint product_onboarding_requests_request_digest_check
    check (request_digest ~ '^[0-9a-f]{64}$'),
  constraint product_onboarding_requests_rate_scope_digest_check
    check (rate_scope_digest ~ '^[0-9a-f]{64}$'),
  constraint product_onboarding_requests_status_check check (status = 'complete'),
  constraint product_onboarding_requests_expiry_check check (expires_at > created_at),
  constraint product_onboarding_requests_family_fk
    foreign key (family_id) references public.families(id) on delete restrict,
  constraint product_onboarding_requests_parent_fk
    foreign key (family_id, parent_member_id)
    references public.family_members(family_id, id) on delete restrict
);

create index product_onboarding_requests_rate_window_idx
  on public.product_onboarding_requests(rate_scope_digest, created_at desc);

alter table public.product_onboarding_requests enable row level security;
alter table public.product_onboarding_requests force row level security;
revoke all on table public.product_onboarding_requests from public, anon, authenticated, service_role;
grant select, insert on table public.product_onboarding_requests to service_role;

create function public.create_product_family_with_first_parent(
  p_onboarding_request_id uuid,
  p_request_digest text,
  p_rate_scope_digest text,
  p_family_display_name text,
  p_parent_display_name text,
  p_parent_pin text
)
returns table (
  family_id uuid,
  parent_member_id uuid,
  created boolean,
  canonical_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  existing_request public.product_onboarding_requests%rowtype;
  new_family_id uuid;
  new_parent_id uuid;
  new_family_key text;
begin
  if p_onboarding_request_id is null
     or p_request_digest !~ '^[0-9a-f]{64}$'
     or p_rate_scope_digest !~ '^[0-9a-f]{64}$'
     or char_length(p_family_display_name) not between 1 and 60
     or char_length(p_parent_display_name) not between 1 and 60
     or p_parent_pin !~ '^\d{4}$'
     or p_parent_pin in ('0000', '1111', '1234', '4321')
     or p_parent_pin ~ '^(\d)\1{3}$' then
    raise exception using errcode = '22023', message = 'ONBOARDING_VALIDATION_FAILED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_onboarding_request_id::text, 202608170001)
  );

  select request.* into existing_request
  from public.product_onboarding_requests request
  where request.onboarding_request_id = p_onboarding_request_id;

  if existing_request.onboarding_request_id is not null then
    if existing_request.request_digest <> p_request_digest then
      raise exception using errcode = '55000', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return query select existing_request.family_id, existing_request.parent_member_id,
      false, existing_request.status;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_rate_scope_digest, 202608170001)
  );
  if (select count(*) from public.product_onboarding_requests request
      where request.rate_scope_digest = p_rate_scope_digest
        and request.created_at > now() - interval '10 minutes') >= 3 then
    raise exception using errcode = '55000', message = 'ONBOARDING_RATE_LIMITED';
  end if;

  new_family_id := gen_random_uuid();
  new_parent_id := gen_random_uuid();
  new_family_key := 'product-' || replace(new_family_id::text, '-', '');

  insert into public.families (id, family_key, display_name)
  values (new_family_id, new_family_key, p_family_display_name);

  insert into public.family_members (
    id, family_id, member_key, display_name, role, avatar_emoji,
    is_active, pin_hash, failed_attempts, locked_until
  ) values (
    new_parent_id, new_family_id, 'parent', p_parent_display_name, 'parent', '👤',
    true, extensions.crypt(p_parent_pin, extensions.gen_salt('bf', 12)), 0, null
  );

  insert into public.family_reward_settings (family_id) values (new_family_id);

  insert into public.product_onboarding_requests (
    onboarding_request_id, request_digest, rate_scope_digest,
    family_id, parent_member_id, status
  ) values (
    p_onboarding_request_id, p_request_digest, p_rate_scope_digest,
    new_family_id, new_parent_id, 'complete'
  );

  return query select new_family_id, new_parent_id, true, 'complete'::text;
exception
  when unique_violation then
    raise exception using errcode = '55000', message = 'ONBOARDING_CREATION_FAILED';
end
$function$;

alter function public.create_product_family_with_first_parent(uuid, text, text, text, text, text)
  owner to postgres;
revoke all on function public.create_product_family_with_first_parent(uuid, text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_product_family_with_first_parent(uuid, text, text, text, text, text)
  to service_role;

notify pgrst, 'reload schema';
commit;
