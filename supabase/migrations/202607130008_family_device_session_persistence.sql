begin;

alter table public.family_device_sessions
  add column if not exists member_key text,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

update public.family_device_sessions sessions
set member_key = members.member_key
from public.family_members members
where sessions.member_id = members.id
  and sessions.family_id = members.family_id
  and sessions.member_key is null;

alter table public.family_device_sessions
  alter column member_key set not null;

update public.family_device_sessions
set is_active = false
where revoked_at is not null or expires_at <= now();

create index if not exists family_device_sessions_token_active_idx
  on public.family_device_sessions(token_hash)
  where is_active and revoked_at is null;

create or replace function public.set_family_device_session_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_family_device_session_updated_at on public.family_device_sessions;
create trigger set_family_device_session_updated_at
before update on public.family_device_sessions
for each row execute function public.set_family_device_session_updated_at();

alter table public.family_device_sessions enable row level security;
revoke all on table public.family_device_sessions from anon, authenticated;
grant select, insert, update, delete on table public.family_device_sessions to service_role;

notify pgrst, 'reload schema';
commit;
