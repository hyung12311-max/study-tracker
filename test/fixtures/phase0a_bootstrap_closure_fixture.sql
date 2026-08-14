\set ON_ERROR_STOP on

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

create table public.families (
  id uuid primary key,
  family_key text not null unique
);

create table public.family_members (
  id uuid primary key,
  family_id uuid not null references public.families(id),
  member_key text not null,
  display_name text not null,
  role text not null check (role in ('parent', 'child')),
  avatar_emoji text,
  login_method text default 'pin',
  pin_hash text,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  is_active boolean not null default true,
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, member_key)
);

create table public.family_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.families(id),
  client_message_id text,
  constraint family_messages_client_message_id_key unique (client_message_id)
);

create table public.reward_settings (
  id uuid primary key default extensions.gen_random_uuid(),
  target_stickers integer not null default 10,
  reward_name text not null default 'legacy'
);
create table public.sticker_history (
  id uuid primary key default extensions.gen_random_uuid(),
  sticker_count integer not null default 1
);
alter table public.reward_settings enable row level security;
alter table public.sticker_history enable row level security;
create policy "single user reward settings access" on public.reward_settings for all using (true) with check (true);
create policy "single user sticker history access" on public.sticker_history for all using (true) with check (true);
grant select, insert, update, delete on public.reward_settings, public.sticker_history to anon, authenticated, service_role;

insert into public.families (id, family_key) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'default'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'second');
insert into public.family_members (id, family_id, member_key, display_name, role, pin_hash) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'mother', 'A parent', 'parent', extensions.crypt('2468', extensions.gen_salt('bf', 4))),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'child', 'A child', 'child', null),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'mother', 'B parent', 'parent', extensions.crypt('1357', extensions.gen_salt('bf', 4))),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'child', 'B child', 'child', null);

\ir ../../supabase/migrations/202608140001_phase_0a_bootstrap_closure.sql
\ir ../../supabase/verification/202608140001_phase_0a_bootstrap_closure_verify.sql

do $$
declare
  result record;
  before_b integer;
begin
  select failed_attempts into before_b from public.family_members
  where id = 'bbbbbbbb-0000-4000-8000-000000000001';

  if exists (
    select 1 from public.verify_family_parent_pin(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-0000-4000-8000-000000000001',
      '1357'
    )
  ) then raise exception 'cross-family parent PIN lookup succeeded'; end if;

  select * into result from public.verify_family_parent_pin(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-0000-4000-8000-000000000001',
    '0000'
  );
  if result.verified then raise exception 'wrong A PIN verified'; end if;
  if (select failed_attempts from public.family_members where id = 'aaaaaaaa-0000-4000-8000-000000000001') <> 1 then
    raise exception 'wrong A PIN did not increment only A';
  end if;
  if (select failed_attempts from public.family_members where id = 'bbbbbbbb-0000-4000-8000-000000000001') <> before_b then
    raise exception 'A PIN attempt modified B';
  end if;

  select * into result from public.verify_family_parent_pin(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-0000-4000-8000-000000000001',
    '2468'
  );
  if not result.verified or result.family_id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' then
    raise exception 'A parent PIN did not verify in A scope';
  end if;
end
$$;

insert into public.family_reward_settings (family_id, target_stickers, reward_name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 10, 'A reward'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 20, 'B reward');
do $$ begin
  if (select reward_name from public.family_reward_settings where family_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 'A reward'
     or (select reward_name from public.family_reward_settings where family_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') <> 'B reward' then
    raise exception 'family reward settings are not isolated';
  end if;
end $$;

insert into public.family_messages (family_id, client_message_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'same-client-id'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'same-client-id');
do $$ begin
  if not exists (
    select 1 from public.family_messages group by client_message_id having count(*) > 1
  ) then raise exception 'rollback duplicate-message guard was not exercised'; end if;
end $$;

-- Exercise both refusal paths, then clean only the disposable fixture rows and
-- prove the rollback succeeds when it is safe.
\set ON_ERROR_STOP off
\ir ../../supabase/rollbacks/202608140001_rollback_phase_0a_bootstrap_closure.sql
\set ON_ERROR_STOP on
do $$ begin
  if to_regclass('public.family_reward_settings') is null then
    raise exception 'data-bearing rollback was not refused';
  end if;
end $$;

delete from public.family_reward_settings;
\set ON_ERROR_STOP off
\ir ../../supabase/rollbacks/202608140001_rollback_phase_0a_bootstrap_closure.sql
\set ON_ERROR_STOP on
do $$ begin
  if to_regclass('public.family_reward_settings') is null then
    raise exception 'duplicate-message rollback was not refused';
  end if;
end $$;

delete from public.family_messages;
\ir ../../supabase/rollbacks/202608140001_rollback_phase_0a_bootstrap_closure.sql

do $$
begin
  if to_regclass('public.family_reward_settings') is not null then raise exception 'rollback did not remove family settings'; end if;
  if to_regprocedure('public.verify_family_parent_pin(uuid,uuid,text)') is not null then raise exception 'rollback did not remove PIN RPC'; end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.family_messages'::regclass
      and conname = 'family_messages_client_message_id_key'
  ) then raise exception 'rollback did not restore global message uniqueness'; end if;
end
$$;
