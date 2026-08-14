-- Emergency rollback for Phase 0A. Refuses to discard family-scoped settings or
-- restore globally unique message IDs when that would lose or invalidate data.

begin;

do $$
begin
  if to_regclass('public.family_reward_settings') is not null
     and exists (select 1 from public.family_reward_settings) then
    raise exception 'Rollback refused: family_reward_settings contains data';
  end if;

  if exists (
    select client_message_id
    from public.family_messages
    where client_message_id is not null
    group by client_message_id
    having count(*) > 1
  ) then
    raise exception 'Rollback refused: cross-family duplicate client_message_id values exist';
  end if;
end
$$;

alter table public.family_messages
  drop constraint if exists family_messages_family_client_message_id_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.family_messages'::regclass
      and conname = 'family_messages_client_message_id_key'
  ) then
    alter table public.family_messages
      add constraint family_messages_client_message_id_key unique (client_message_id);
  end if;
end
$$;

drop function if exists public.verify_family_parent_pin(uuid, uuid, text);
drop table if exists public.family_reward_settings;

alter table public.reward_settings no force row level security;
drop policy if exists "single user reward settings access" on public.reward_settings;
create policy "single user reward settings access"
  on public.reward_settings for all using (true) with check (true);
grant select, insert, update, delete on table public.reward_settings to anon, authenticated, service_role;

alter table public.sticker_history no force row level security;
drop policy if exists "single user sticker history access" on public.sticker_history;
create policy "single user sticker history access"
  on public.sticker_history for all using (true) with check (true);
grant select, insert, update, delete on table public.sticker_history to anon, authenticated, service_role;

notify pgrst, 'reload schema';
commit;
