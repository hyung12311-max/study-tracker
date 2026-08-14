-- Phase 0A: close public family bootstrap leaks and move reward settings to family scope.
-- Additive except for access-control tightening and the message idempotency constraint.

begin;

do $$
begin
  if to_regclass('public.families') is null
     or to_regclass('public.family_members') is null
     or to_regclass('public.family_messages') is null
     or to_regclass('public.reward_settings') is null
     or to_regclass('public.sticker_history') is null then
    raise exception 'Phase 0A prerequisites are missing';
  end if;
end
$$;

create table public.family_reward_settings (
  family_id uuid primary key references public.families(id) on delete cascade,
  target_stickers integer not null default 10 check (target_stickers > 0 and target_stickers <= 10000),
  reward_name text not null default '5,000원 용돈' check (char_length(btrim(reward_name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.family_reward_settings enable row level security;
alter table public.family_reward_settings force row level security;
revoke all on table public.family_reward_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.family_reward_settings to service_role;

drop policy if exists "single user reward settings access" on public.reward_settings;
alter table public.reward_settings enable row level security;
alter table public.reward_settings force row level security;
revoke all on table public.reward_settings from public, anon, authenticated, service_role;
grant select on table public.reward_settings to service_role;

drop policy if exists "single user sticker history access" on public.sticker_history;
alter table public.sticker_history enable row level security;
alter table public.sticker_history force row level security;
revoke all on table public.sticker_history from public, anon, authenticated;
grant select, insert, update, delete on table public.sticker_history to service_role;

create or replace function public.verify_family_parent_pin(
  p_family_id uuid,
  p_member_id uuid,
  p_pin text
)
returns table(
  member_id uuid,
  family_id uuid,
  member_key text,
  display_name text,
  role text,
  avatar_emoji text,
  locked_until timestamptz,
  verified boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  m public.family_members%rowtype;
begin
  select fm.* into m
  from public.family_members fm
  where fm.id = p_member_id
    and fm.family_id = p_family_id
    and fm.role = 'parent'
    and fm.is_active = true
  for update;

  if not found then return; end if;

  if m.locked_until is not null and m.locked_until > now() then
    return query select m.id, m.family_id, m.member_key, m.display_name, m.role,
      m.avatar_emoji, m.locked_until, false;
    return;
  end if;

  if m.pin_hash is not null and extensions.crypt(p_pin, m.pin_hash) = m.pin_hash then
    update public.family_members as fm
    set failed_attempts = 0, locked_until = null, updated_at = now()
    where fm.id = m.id and fm.family_id = m.family_id;
    return query select m.id, m.family_id, m.member_key, m.display_name, m.role,
      m.avatar_emoji, null::timestamptz, true;
    return;
  end if;

  update public.family_members as fm
  set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
      locked_until = case when failed_attempts + 1 >= 5 then now() + interval '30 seconds' else null end,
      updated_at = now()
  where fm.id = m.id and fm.family_id = m.family_id
  returning fm.locked_until into m.locked_until;

  return query select m.id, m.family_id, m.member_key, m.display_name, m.role,
    m.avatar_emoji, m.locked_until, false;
end
$$;

revoke all on function public.verify_family_parent_pin(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.verify_family_parent_pin(uuid, uuid, text) to service_role;

alter table public.family_messages
  drop constraint if exists family_messages_client_message_id_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.family_messages'::regclass
      and conname = 'family_messages_family_client_message_id_key'
  ) then
    alter table public.family_messages
      add constraint family_messages_family_client_message_id_key
      unique (family_id, client_message_id);
  end if;
end
$$;

notify pgrst, 'reload schema';
commit;
