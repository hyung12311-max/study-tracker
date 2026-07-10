create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(), family_key text unique not null, display_name text not null,
  chat_notifications_enabled boolean not null default true, system_notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families(id) on delete cascade,
  member_key text not null, display_name text not null, role text not null check (role in ('parent','child')),
  avatar_emoji text, pin_hash text, failed_attempts integer not null default 0, locked_until timestamptz,
  is_active boolean not null default true, notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(family_id, member_key)
);
create table if not exists public.family_messages (
  id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families(id) on delete cascade,
  sender_id uuid references public.family_members(id) on delete set null,
  message_type text not null default 'text' check (message_type in ('text','system')),
  content text not null check (char_length(content) between 1 and 1000), related_type text, related_id text,
  client_message_id text unique, push_sent_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), deleted_at timestamptz, unique(family_id, related_type, related_id)
);
create table if not exists public.family_message_reads (
  id uuid primary key default gen_random_uuid(), message_id uuid not null references public.family_messages(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade, read_at timestamptz not null default now(),
  unique(message_id, member_id)
);
create index if not exists family_messages_family_created_idx on public.family_messages(family_id, created_at desc);
create index if not exists family_message_reads_member_idx on public.family_message_reads(member_id, read_at desc);
create index if not exists family_members_family_active_idx on public.family_members(family_id, is_active);

insert into public.families(family_key, display_name) values ('default','우리 가족') on conflict (family_key) do nothing;
insert into public.family_members(family_id, member_key, display_name, role, avatar_emoji, pin_hash)
select f.id, s.member_key, s.display_name, s.role, s.avatar_emoji, crypt(s.initial_pin, gen_salt('bf',12))
from public.families f cross join (values
 ('father','아빠','parent','👨','1234'), ('mother','엄마','parent','👩','1234'),
 ('hagyeom','하겸이','child','👦','1234'), ('dayul','다율이','child','👧','1234')
) s(member_key,display_name,role,avatar_emoji,initial_pin)
where f.family_key='default' on conflict (family_id,member_key) do nothing;

create or replace function public.verify_family_member_pin(p_member_key text,p_pin text)
returns table(member_id uuid,family_id uuid,member_key text,display_name text,role text,avatar_emoji text,locked_until timestamptz,verified boolean)
language plpgsql security definer set search_path=public,extensions as $$
declare m public.family_members%rowtype;
begin
 select * into m from public.family_members fm where fm.member_key=p_member_key and fm.is_active order by fm.created_at limit 1 for update;
 if not found then return; end if;
 if m.locked_until is not null and m.locked_until>now() then
  return query select m.id,m.family_id,m.member_key,m.display_name,m.role,m.avatar_emoji,m.locked_until,false; return;
 end if;
 if m.pin_hash is not null and crypt(p_pin,m.pin_hash)=m.pin_hash then
  update public.family_members set failed_attempts=0,locked_until=null,updated_at=now() where id=m.id;
  return query select m.id,m.family_id,m.member_key,m.display_name,m.role,m.avatar_emoji,null::timestamptz,true; return;
 end if;
 update public.family_members set failed_attempts=case when failed_attempts+1>=5 then 0 else failed_attempts+1 end,
  locked_until=case when failed_attempts+1>=5 then now()+interval '30 seconds' else null end,updated_at=now()
 where id=m.id returning family_members.locked_until into m.locked_until;
 return query select m.id,m.family_id,m.member_key,m.display_name,m.role,m.avatar_emoji,m.locked_until,false;
end $$;
revoke all on function public.verify_family_member_pin(text,text) from public,anon,authenticated;
grant execute on function public.verify_family_member_pin(text,text) to service_role;

create or replace function public.set_family_member_pin(p_member_id uuid,p_family_id uuid,p_pin text)
returns void language plpgsql security definer set search_path=public,extensions as $$
begin
 if p_pin !~ '^\d{4}$' then raise exception 'invalid pin'; end if;
 update public.family_members set pin_hash=crypt(p_pin,gen_salt('bf',12)),failed_attempts=0,locked_until=null,updated_at=now()
 where id=p_member_id and family_id=p_family_id;
end $$;
revoke all on function public.set_family_member_pin(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.set_family_member_pin(uuid,uuid,text) to service_role;

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_messages enable row level security;
alter table public.family_message_reads enable row level security;
drop policy if exists "family message realtime read" on public.family_messages;
create policy "family message realtime read" on public.family_messages for select to authenticated
using (deleted_at is null and family_id = ((auth.jwt() ->> 'family_id')::uuid));
do $$ begin alter publication supabase_realtime add table public.family_messages; exception when duplicate_object then null; end $$;

alter table public.push_subscriptions
 add column if not exists family_member_id uuid references public.family_members(id) on delete set null,
 add column if not exists device_name text,
 add column if not exists updated_at timestamptz not null default now(),
 add column if not exists is_active boolean not null default true;
create index if not exists push_subscriptions_family_member_idx on public.push_subscriptions(family_member_id,is_active);
