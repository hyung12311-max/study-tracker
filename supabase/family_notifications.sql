alter table public.study_plans
  add column if not exists parent_notified_at timestamptz,
  add column if not exists parent_notification_delivered boolean not null default false;

create table if not exists public.family_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  member_key text not null,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  device_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists family_push_subscriptions_member_idx
on public.family_push_subscriptions(family_id, member_key, is_active);

create table if not exists public.family_notification_preferences (
  family_id uuid not null references public.families(id) on delete cascade,
  member_key text not null,
  study_complete_enabled boolean not null default true,
  family_chat_enabled boolean not null default true,
  reward_request_enabled boolean not null default true,
  overdue_study_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (family_id, member_key)
);

insert into public.family_notification_preferences(family_id, member_key)
select family_id, member_key
from public.family_members
on conflict (family_id, member_key) do nothing;

create or replace function public.set_family_notification_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_family_push_subscriptions_updated_at on public.family_push_subscriptions;
create trigger set_family_push_subscriptions_updated_at
before update on public.family_push_subscriptions
for each row execute function public.set_family_notification_updated_at();

drop trigger if exists set_family_notification_preferences_updated_at on public.family_notification_preferences;
create trigger set_family_notification_preferences_updated_at
before update on public.family_notification_preferences
for each row execute function public.set_family_notification_updated_at();

alter table public.family_push_subscriptions enable row level security;
alter table public.family_notification_preferences enable row level security;

-- These tables are accessed by Vercel Serverless Functions with SUPABASE_SERVICE_ROLE_KEY.
-- Do not add anon SELECT policies that expose endpoints, p256dh, or auth values.
