begin;

create table public.product_child_creation_requests (
  family_id uuid not null,
  parent_member_id uuid not null,
  client_request_id uuid not null,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  child_member_id uuid not null,
  status text not null default 'complete' check (status = 'complete'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  primary key (family_id, parent_member_id, client_request_id),
  foreign key (family_id, parent_member_id) references public.family_members(family_id, id) on delete restrict,
  foreign key (family_id, child_member_id) references public.family_members(family_id, id) on delete restrict
);
create index product_child_creation_requests_rate_idx on public.product_child_creation_requests(family_id, parent_member_id, created_at desc);
alter table public.product_child_creation_requests enable row level security;
alter table public.product_child_creation_requests force row level security;
revoke all on table public.product_child_creation_requests from public, anon, authenticated, service_role;
grant select, insert on table public.product_child_creation_requests to service_role;

create function public.create_product_family_child(p_family_id uuid, p_parent_member_id uuid, p_client_request_id uuid, p_request_digest text, p_display_name text, p_avatar_emoji text)
returns table(child_member_id uuid, display_name text, avatar_emoji text, created boolean, canonical_status text)
language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare existing_request public.product_child_creation_requests%rowtype; new_child_id uuid; normalized_name text;
begin
  normalized_name := btrim(p_display_name);
  if p_family_id is null or p_parent_member_id is null or p_client_request_id is null or p_request_digest !~ '^[0-9a-f]{64}$'
     or char_length(normalized_name) not between 1 and 60 or normalized_name ~ '[[:cntrl:]]'
     or p_avatar_emoji not in ('👦','👧','🧒','🐰','🐻','🐱','🦊','🐼') then
    raise exception using errcode='22023', message='CHILD_VALIDATION_FAILED';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_family_id::text || ':' || p_parent_member_id::text || ':' || p_client_request_id::text, 202608170002));
  select * into existing_request from public.product_child_creation_requests r where r.family_id=p_family_id and r.parent_member_id=p_parent_member_id and r.client_request_id=p_client_request_id;
  if found then
    if existing_request.request_digest <> p_request_digest then raise exception using errcode='55000', message='IDEMPOTENCY_CONFLICT'; end if;
    return query select m.id,m.display_name,m.avatar_emoji,false,existing_request.status from public.family_members m where m.id=existing_request.child_member_id and m.family_id=p_family_id; return;
  end if;
  perform 1 from public.family_members m where m.id=p_parent_member_id and m.family_id=p_family_id and m.role='parent' and m.is_active=true;
  if not found then raise exception using errcode='42501', message='PARENT_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_family_id::text, 202608170002));
  if (select count(*) from public.product_child_creation_requests r where r.family_id=p_family_id and r.parent_member_id=p_parent_member_id and r.created_at > now()-interval '10 minutes') >= 5 then raise exception using errcode='55000', message='CHILD_CREATION_RATE_LIMITED'; end if;
  if (select count(*) from public.family_members m where m.family_id=p_family_id) >= 10 then raise exception using errcode='55000', message='FAMILY_MEMBER_LIMIT_REACHED'; end if;
  new_child_id := gen_random_uuid();
  insert into public.family_members(id,family_id,member_key,display_name,role,avatar_emoji,is_active,pin_hash,failed_attempts,locked_until)
  values(new_child_id,p_family_id,'child-'||replace(new_child_id::text,'-',''),normalized_name,'child',p_avatar_emoji,true,null,0,null);
  insert into public.product_child_creation_requests(family_id,parent_member_id,client_request_id,request_digest,child_member_id) values(p_family_id,p_parent_member_id,p_client_request_id,p_request_digest,new_child_id);
  return query select new_child_id,normalized_name,p_avatar_emoji,true,'complete'::text;
end $function$;
alter function public.create_product_family_child(uuid,uuid,uuid,text,text,text) owner to postgres;
revoke all on function public.create_product_family_child(uuid,uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.create_product_family_child(uuid,uuid,uuid,text,text,text) to service_role;
notify pgrst, 'reload schema';
commit;
