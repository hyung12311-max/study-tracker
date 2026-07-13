begin;

create table if not exists public.family_device_sessions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  token_hash text not null unique,
  device_name text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text
);

create index if not exists family_device_sessions_member_active_idx
on public.family_device_sessions(member_id,expires_at desc) where revoked_at is null;

alter table public.family_device_sessions enable row level security;
revoke all on table public.family_device_sessions from anon,authenticated;
grant select,insert,update,delete on table public.family_device_sessions to service_role;

notify pgrst,'reload schema';
commit;

select to_regclass('public.family_device_sessions') as device_sessions_table;
