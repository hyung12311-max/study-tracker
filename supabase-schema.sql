create extension if not exists pgcrypto;

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  workbook text not null,
  chapter text not null,
  lesson text not null,
  study_date date not null,
  day_label text not null,
  content text not null,
  goal text not null,
  status text not null default '예정' check (status in ('planned', 'done', 'late', '예정', '완료', '지연')),
  completed_at timestamptz,
  parent_notified_at timestamptz,
  parent_notification_delivered boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.study_plans
  add column if not exists completed_at timestamptz,
  add column if not exists parent_notified_at timestamptz,
  add column if not exists parent_notification_delivered boolean not null default false;

create table if not exists public.reward_settings (
  id uuid primary key default gen_random_uuid(),
  target_stickers integer not null default 10 check (target_stickers > 0),
  reward_name text not null default '5,000원 용돈'
);

create table if not exists public.reward_milestones (
  id uuid primary key default gen_random_uuid(),
  required_stickers integer not null check (required_stickers > 0),
  reward_name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.sticker_history (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references public.study_plans(id) on delete cascade,
  sticker_count integer not null default 1 check (sticker_count > 0),
  created_at timestamptz not null default now(),
  unique (study_plan_id)
);

create table if not exists public.academy_schedules (
  id uuid primary key default gen_random_uuid(),
  academy_name text not null,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  memo text,
  star_count integer not null default 1 check (star_count > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.academy_completion_history (
  id uuid primary key default gen_random_uuid(),
  academy_schedule_id uuid not null references public.academy_schedules(id) on delete cascade,
  completed_date date not null,
  star_count integer not null default 1 check (star_count > 0),
  created_at timestamptz not null default now(),
  unique (academy_schedule_id, completed_date)
);

create table if not exists public.completion_notifications (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid references public.study_plans(id) on delete set null,
  title text not null,
  body text not null,
  delivered boolean not null default false,
  delivery_channel text not null default 'browser',
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists study_plans_date_idx on public.study_plans(study_date);
create index if not exists study_plans_status_idx on public.study_plans(status);
create index if not exists reward_milestones_required_idx on public.reward_milestones(required_stickers);
create index if not exists sticker_history_plan_idx on public.sticker_history(study_plan_id);
create index if not exists academy_schedules_day_idx on public.academy_schedules(day_of_week, start_time);
create index if not exists academy_completion_schedule_date_idx on public.academy_completion_history(academy_schedule_id, completed_date);
create index if not exists completion_notifications_plan_idx on public.completion_notifications(study_plan_id);

alter table public.study_plans enable row level security;
alter table public.reward_settings enable row level security;
alter table public.reward_milestones enable row level security;
alter table public.sticker_history enable row level security;
alter table public.academy_schedules enable row level security;
alter table public.academy_completion_history enable row level security;
alter table public.completion_notifications enable row level security;

drop policy if exists "single user study plans access" on public.study_plans;
create policy "single user study plans access"
on public.study_plans for all
using (true)
with check (true);

drop policy if exists "single user reward settings access" on public.reward_settings;
create policy "single user reward settings access"
on public.reward_settings for all
using (true)
with check (true);

drop policy if exists "single user reward milestones access" on public.reward_milestones;
create policy "single user reward milestones access"
on public.reward_milestones for all
using (true)
with check (true);

drop policy if exists "single user sticker history access" on public.sticker_history;
create policy "single user sticker history access"
on public.sticker_history for all
using (true)
with check (true);

drop policy if exists "single user academy schedules access" on public.academy_schedules;
create policy "single user academy schedules access"
on public.academy_schedules for all
using (true)
with check (true);

drop policy if exists "single user academy completion access" on public.academy_completion_history;
create policy "single user academy completion access"
on public.academy_completion_history for all
using (true)
with check (true);

drop policy if exists "single user completion notifications access" on public.completion_notifications;
create policy "single user completion notifications access"
on public.completion_notifications for all
using (true)
with check (true);

do $$
begin
  alter publication supabase_realtime add table public.study_plans;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.reward_settings;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.reward_milestones;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.sticker_history;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.academy_schedules;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.academy_completion_history;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.completion_notifications;
exception when duplicate_object then null;
end $$;
