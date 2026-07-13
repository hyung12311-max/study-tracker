-- Family-specific sticker reward settings.
-- This migration intentionally does not create, replace, revoke, or grant
-- completion RPC functions. It can be applied independently and rerun safely.

begin;

create table if not exists public.sticker_reward_settings (
  family_id uuid primary key references public.families(id) on delete cascade,
  early_complete_count integer not null default 3,
  on_time_complete_count integer not null default 2,
  delayed_complete_count integer not null default 1,
  no_date_complete_count integer not null default 1,
  academy_complete_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Repair a partially created table before adding named constraints.
alter table public.sticker_reward_settings
  add column if not exists early_complete_count integer not null default 3,
  add column if not exists on_time_complete_count integer not null default 2,
  add column if not exists delayed_complete_count integer not null default 1,
  add column if not exists no_date_complete_count integer not null default 1,
  add column if not exists academy_complete_count integer not null default 1,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists sticker_reward_settings_family_id_uidx
on public.sticker_reward_settings (family_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sticker_reward_settings'::regclass
      and conname = 'sticker_reward_settings_early_count_check'
  ) then
    alter table public.sticker_reward_settings add constraint sticker_reward_settings_early_count_check check (early_complete_count between 0 and 20);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sticker_reward_settings'::regclass
      and conname = 'sticker_reward_settings_on_time_count_check'
  ) then
    alter table public.sticker_reward_settings add constraint sticker_reward_settings_on_time_count_check check (on_time_complete_count between 0 and 20);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sticker_reward_settings'::regclass
      and conname = 'sticker_reward_settings_delayed_count_check'
  ) then
    alter table public.sticker_reward_settings add constraint sticker_reward_settings_delayed_count_check check (delayed_complete_count between 0 and 20);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sticker_reward_settings'::regclass
      and conname = 'sticker_reward_settings_no_date_count_check'
  ) then
    alter table public.sticker_reward_settings add constraint sticker_reward_settings_no_date_count_check check (no_date_complete_count between 0 and 20);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sticker_reward_settings'::regclass
      and conname = 'sticker_reward_settings_academy_count_check'
  ) then
    alter table public.sticker_reward_settings add constraint sticker_reward_settings_academy_count_check check (academy_complete_count between 0 and 20);
  end if;
end
$$;

create or replace function public.set_sticker_reward_settings_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_sticker_reward_settings_updated_at on public.sticker_reward_settings;
create trigger set_sticker_reward_settings_updated_at
before update on public.sticker_reward_settings
for each row execute function public.set_sticker_reward_settings_updated_at();

insert into public.sticker_reward_settings (family_id)
select id from public.families
on conflict (family_id) do nothing;

alter table public.sticker_reward_settings enable row level security;

revoke all on table public.sticker_reward_settings from anon, authenticated;
grant select, insert, update on table public.sticker_reward_settings to service_role;

revoke all on function public.set_sticker_reward_settings_updated_at() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- Read-only verification queries to run after the migration:
select to_regclass('public.sticker_reward_settings') as settings_table;

select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'sticker_reward_settings'
order by ordinal_position;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.sticker_reward_settings'::regclass
order by conname;

select relrowsecurity as rls_enabled
from pg_class
where oid = 'public.sticker_reward_settings'::regclass;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'sticker_reward_settings'
order by grantee, privilege_type;

select
  to_regprocedure('public.complete_study_plan_and_reschedule(bigint,date)') as complete_study_plan_and_reschedule,
  to_regprocedure('public.complete_study_plan_with_reward(uuid,uuid,bigint,date)') as complete_study_plan_with_reward,
  to_regprocedure('public.complete_academy_schedule(uuid,uuid,uuid,date)') as complete_academy_schedule;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_result(p.oid) as result_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'complete_study_plan_and_reschedule',
    'complete_study_plan_with_reward',
    'complete_academy_schedule'
  )
order by p.proname, identity_arguments;
