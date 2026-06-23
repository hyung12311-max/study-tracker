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
  created_at timestamptz not null default now()
);

create table if not exists public.reward_settings (
  id uuid primary key default gen_random_uuid(),
  target_stickers integer not null default 10 check (target_stickers > 0),
  reward_name text not null default '5,000원 용돈'
);

create table if not exists public.sticker_history (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references public.study_plans(id) on delete cascade,
  sticker_count integer not null default 1 check (sticker_count > 0),
  created_at timestamptz not null default now(),
  unique (study_plan_id)
);

create index if not exists study_plans_date_idx on public.study_plans(study_date);
create index if not exists study_plans_status_idx on public.study_plans(status);
create index if not exists sticker_history_plan_idx on public.sticker_history(study_plan_id);

alter table public.study_plans enable row level security;
alter table public.reward_settings enable row level security;
alter table public.sticker_history enable row level security;

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

drop policy if exists "single user sticker history access" on public.sticker_history;
create policy "single user sticker history access"
on public.sticker_history for all
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
  alter publication supabase_realtime add table public.sticker_history;
exception when duplicate_object then null;
end $$;
