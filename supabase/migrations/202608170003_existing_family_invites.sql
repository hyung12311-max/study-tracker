begin;
create table public.family_invites(
 id uuid primary key default gen_random_uuid(), safe_ref uuid not null unique default gen_random_uuid(), invite_hash text not null unique check(invite_hash ~ '^[0-9a-f]{64}$'),
 family_id uuid not null, creator_parent_id uuid not null, created_at timestamptz not null default now(), expires_at timestamptz not null,
 used_at timestamptz, revoked_at timestamptz,
 foreign key(family_id,creator_parent_id) references public.family_members(family_id,id) on delete restrict,
 check(expires_at>created_at), check(not(used_at is not null and revoked_at is not null))
);
create index family_invites_creator_rate_idx on public.family_invites(family_id,creator_parent_id,created_at desc);
create table public.family_invite_exchange_attempts(id bigint generated always as identity primary key,rate_scope_digest text not null check(rate_scope_digest ~ '^[0-9a-f]{64}$'),invite_hash text not null check(invite_hash ~ '^[0-9a-f]{64}$'),succeeded boolean not null,created_at timestamptz not null default now());
create index family_invite_exchange_rate_idx on public.family_invite_exchange_attempts(rate_scope_digest,created_at desc);
alter table public.family_invites enable row level security;alter table public.family_invites force row level security;
alter table public.family_invite_exchange_attempts enable row level security;alter table public.family_invite_exchange_attempts force row level security;
revoke all on public.family_invites,public.family_invite_exchange_attempts from public,anon,authenticated,service_role;
grant select,insert,update on public.family_invites to service_role;grant select,insert on public.family_invite_exchange_attempts to service_role;

create function public.create_product_family_invite(p_family_id uuid,p_parent_member_id uuid,p_invite_hash text)
returns table(safe_ref uuid,expires_at timestamptz) language plpgsql security definer set search_path=pg_catalog,public as $f$
declare v_ref uuid;v_exp timestamptz:=now()+interval '10 minutes';begin
 perform 1 from public.family_members m where m.family_id=p_family_id and m.id=p_parent_member_id and m.role='parent' and m.is_active=true;if not found then raise exception using errcode='42501',message='PARENT_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text||':'||p_parent_member_id::text,202608170003));
 if(select count(*) from public.family_invites i where i.family_id=p_family_id and i.creator_parent_id=p_parent_member_id and i.created_at>now()-interval '10 minutes')>=5 then raise exception using errcode='55000',message='INVITE_CREATE_RATE_LIMITED';end if;
 insert into public.family_invites(invite_hash,family_id,creator_parent_id,expires_at)values(p_invite_hash,p_family_id,p_parent_member_id,v_exp)returning family_invites.safe_ref into v_ref;return query select v_ref,v_exp;end $f$;

create function public.exchange_product_family_invite(p_invite_hash text,p_rate_scope_digest text)
returns table(exchanged boolean,family_id uuid,result_code text) language plpgsql security definer set search_path=pg_catalog,public as $f$
declare v public.family_invites%rowtype;begin
 perform pg_advisory_xact_lock(hashtextextended(p_rate_scope_digest,202608170003));
 if(select count(*) from public.family_invite_exchange_attempts a where a.rate_scope_digest=p_rate_scope_digest and a.created_at>now()-interval '10 minutes')>=10 then return query select false,null::uuid,'INVITE_RATE_LIMITED'::text;return;end if;
 select * into v from public.family_invites i where i.invite_hash=p_invite_hash for update;
 if not found or v.used_at is not null or v.revoked_at is not null or not(v.expires_at > now()) then insert into public.family_invite_exchange_attempts(rate_scope_digest,invite_hash,succeeded)values(p_rate_scope_digest,p_invite_hash,false);return query select false,null::uuid,'INVITE_INVALID'::text;return;end if;
 update public.family_invites set used_at=now() where id=v.id and used_at is null and revoked_at is null and expires_at>now();
 insert into public.family_invite_exchange_attempts(rate_scope_digest,invite_hash,succeeded)values(p_rate_scope_digest,p_invite_hash,true);return query select true,v.family_id,'OK'::text;end $f$;

create function public.revoke_product_family_invite(p_family_id uuid,p_parent_member_id uuid,p_safe_ref uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $f$ begin perform 1 from public.family_members m where m.family_id=p_family_id and m.id=p_parent_member_id and m.role='parent' and m.is_active=true;if not found then raise exception using errcode='42501',message='PARENT_REQUIRED';end if;update public.family_invites set revoked_at=now() where family_id=p_family_id and safe_ref=p_safe_ref and used_at is null and revoked_at is null;return found;end $f$;
alter function public.create_product_family_invite(uuid,uuid,text) owner to postgres;alter function public.exchange_product_family_invite(text,text) owner to postgres;alter function public.revoke_product_family_invite(uuid,uuid,uuid) owner to postgres;
revoke all on function public.create_product_family_invite(uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.exchange_product_family_invite(text,text) from public,anon,authenticated,service_role;
revoke all on function public.revoke_product_family_invite(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.create_product_family_invite(uuid,uuid,text) to service_role;
grant execute on function public.exchange_product_family_invite(text,text) to service_role;
grant execute on function public.revoke_product_family_invite(uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';commit;
