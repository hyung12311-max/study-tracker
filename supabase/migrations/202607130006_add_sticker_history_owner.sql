-- The deployed notification API filters sticker_history by authenticated member_id.
alter table public.sticker_history
  add column if not exists family_id uuid references public.families(id),
  add column if not exists member_id uuid references public.family_members(id);

update public.sticker_history history
set family_id = owner.family_id,
    member_id = owner.member_id
from (select * from public.default_reward_member()) owner
where history.family_id is null
   or history.member_id is null;

create index if not exists sticker_history_member_idx
  on public.sticker_history(family_id, member_id, study_plan_id);

create or replace function public.set_default_sticker_history_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare owner record;
begin
  if new.family_id is null or new.member_id is null then
    select * into owner from public.default_reward_member();
    new.family_id := coalesce(new.family_id, owner.family_id);
    new.member_id := coalesce(new.member_id, owner.member_id);
  end if;
  return new;
end;
$$;

drop trigger if exists set_default_sticker_history_owner on public.sticker_history;
create trigger set_default_sticker_history_owner
before insert or update on public.sticker_history
for each row execute function public.set_default_sticker_history_owner();

notify pgrst, 'reload schema';
