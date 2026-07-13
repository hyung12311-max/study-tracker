-- Server-managed milestone settings and completion notification audit log.

create table if not exists public.reward_milestones (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  required_stickers integer not null check (required_stickers > 0),
  reward_name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, required_stickers)
);

create table if not exists public.completion_notifications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  study_plan_id bigint references public.study_plans(id) on delete set null,
  title text not null,
  body text not null,
  delivered boolean not null default false,
  delivery_channel text not null default 'browser',
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists reward_milestones_family_sort_idx
  on public.reward_milestones(family_id, required_stickers, sort_order);
create index if not exists completion_notifications_family_created_idx
  on public.completion_notifications(family_id, created_at desc);
create index if not exists completion_notifications_plan_idx
  on public.completion_notifications(study_plan_id);

create or replace function public.set_legacy_feature_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_reward_milestones_updated_at on public.reward_milestones;
create trigger set_reward_milestones_updated_at
before update on public.reward_milestones
for each row execute function public.set_legacy_feature_updated_at();

insert into public.reward_milestones(family_id, required_stickers, reward_name, sort_order)
select families.id, coalesce(settings.target_stickers, 10), coalesce(settings.reward_name, '목표 달성 보상'), 0
from public.families families
left join lateral (
  select target_stickers, reward_name from public.reward_settings order by id limit 1
) settings on true
on conflict (family_id, required_stickers) do nothing;

alter table public.reward_milestones enable row level security;
alter table public.completion_notifications enable row level security;

revoke all on table public.reward_milestones from anon, authenticated;
revoke all on table public.completion_notifications from anon, authenticated;
grant all on table public.reward_milestones to service_role;
grant all on table public.completion_notifications to service_role;

notify pgrst, 'reload schema';
