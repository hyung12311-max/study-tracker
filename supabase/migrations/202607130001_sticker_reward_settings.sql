begin;

create table if not exists public.sticker_reward_settings (
  family_id uuid primary key references public.families(id) on delete cascade,
  early_complete_count integer not null default 3 check (early_complete_count between 0 and 20),
  on_time_complete_count integer not null default 2 check (on_time_complete_count between 0 and 20),
  delayed_complete_count integer not null default 1 check (delayed_complete_count between 0 and 20),
  no_date_complete_count integer not null default 1 check (no_date_complete_count between 0 and 20),
  academy_complete_count integer not null default 1 check (academy_complete_count between 0 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.sticker_reward_settings (family_id)
select id from public.families on conflict (family_id) do nothing;

alter table public.sticker_history
  add column if not exists family_id uuid references public.families(id) on delete cascade,
  add column if not exists member_id uuid references public.family_members(id) on delete cascade,
  add column if not exists reward_type text,
  add column if not exists reward_reason text,
  add column if not exists completed_date date;
alter table public.sticker_history drop constraint if exists sticker_history_sticker_count_check;
alter table public.sticker_history add constraint sticker_history_sticker_count_check check (sticker_count between 0 and 20);

alter table public.academy_completion_history drop constraint if exists academy_completion_history_star_count_check;
alter table public.academy_completion_history add constraint academy_completion_history_star_count_check check (star_count between 0 and 20);

create or replace function public.sync_study_sticker_transaction()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then
    if old.member_id is not null then
      delete from public.sticker_transactions where member_id=old.member_id and source_type=old.reward_type and source_id=old.study_plan_id::text;
    end if;
    return old;
  end if;
  if new.member_id is null or new.family_id is null or new.reward_type is null then return new; end if;
  delete from public.sticker_transactions
    where member_id=new.member_id and source_id=new.study_plan_id::text and source_type like 'study_%' and source_type<>new.reward_type;
  if new.sticker_count=0 then
    delete from public.sticker_transactions where member_id=new.member_id and source_type=new.reward_type and source_id=new.study_plan_id::text;
  else
    insert into public.sticker_transactions(family_id,member_id,amount,transaction_type,source_type,source_id,description,metadata,created_at)
    values(new.family_id,new.member_id,new.sticker_count,'earn',new.reward_type,new.study_plan_id::text,
      coalesce(new.reward_reason,'학습 완료'),jsonb_build_object('study_plan_id',new.study_plan_id,'completed_date',new.completed_date),new.created_at)
    on conflict(member_id,source_type,source_id) do update set amount=excluded.amount,description=excluded.description,metadata=excluded.metadata;
  end if;
  return new;
end $$;

create or replace function public.complete_study_plan_with_reward(p_family_id uuid,p_member_id uuid,p_plan_id bigint,p_completed_date date)
returns table(adjustment_type text,rescheduled_count integer,sticker_count integer,reward_type text,reward_reason text,already_completed boolean,completed_plan jsonb,balance integer)
language plpgsql security definer set search_path=public as $$
declare r record; plan_row public.study_plans%rowtype; settings public.sticker_reward_settings%rowtype; award integer; kind text; reason text; current_balance integer;
begin
  perform 1 from public.family_members where id=p_member_id and family_id=p_family_id and is_active=true for update;
  if not found then raise exception 'member unavailable'; end if;
  select * into plan_row from public.study_plans where id=p_plan_id for update;
  if not found then raise exception 'study plan not found'; end if;
  insert into public.sticker_reward_settings(family_id) values(p_family_id) on conflict(family_id) do nothing;
  select * into settings from public.sticker_reward_settings where family_id=p_family_id;
  select * into r from public.complete_study_plan_and_reschedule(p_plan_id,p_completed_date);
  if r.already_completed then
    select coalesce(sum(amount),0) into current_balance from public.sticker_transactions where member_id=p_member_id;
    return query select r.adjustment_type,r.rescheduled_count,0,null::text,null::text,true,r.completed_plan,current_balance; return;
  end if;
  if plan_row.study_date is null then kind:='study_no_date';award:=settings.no_date_complete_count;reason:='완료했어요!';
  elsif p_completed_date<plan_row.study_date then kind:='study_early';award:=settings.early_complete_count;reason:='계획보다 먼저 완료했어요!';
  elsif p_completed_date=plan_row.study_date then kind:='study_on_time';award:=settings.on_time_complete_count;reason:='계획한 날짜에 완료했어요!';
  else kind:='study_delayed';award:=settings.delayed_complete_count;reason:='끝까지 잘 해냈어요!'; end if;
  update public.sticker_history set family_id=p_family_id,member_id=p_member_id,sticker_count=award,reward_type=kind,
    reward_reason=reason,completed_date=p_completed_date where study_plan_id=p_plan_id;
  select coalesce(sum(amount),0) into current_balance from public.sticker_transactions where member_id=p_member_id;
  return query select r.adjustment_type,r.rescheduled_count,award,kind,reason,false,r.completed_plan,current_balance;
end $$;

create or replace function public.complete_academy_schedule(p_family_id uuid,p_member_id uuid,p_schedule_id uuid,p_completed_date date)
returns public.academy_completion_history language plpgsql security definer set search_path=public as $$
declare schedule public.academy_schedules%rowtype; completion public.academy_completion_history%rowtype; award integer;
begin
  perform 1 from public.family_members where id=p_member_id and family_id=p_family_id and is_active=true for update;
  if not found then raise exception 'member unavailable'; end if;
  select * into schedule from public.academy_schedules where id=p_schedule_id for update;
  if not found then raise exception 'academy schedule unavailable'; end if;
  insert into public.sticker_reward_settings(family_id) values(p_family_id) on conflict(family_id) do nothing;
  select academy_complete_count into award from public.sticker_reward_settings where family_id=p_family_id;
  insert into public.academy_completion_history(family_id,member_id,academy_schedule_id,completed_date,star_count)
    values(p_family_id,p_member_id,p_schedule_id,p_completed_date,award)
    on conflict(member_id,academy_schedule_id,completed_date) do nothing returning * into completion;
  if completion.id is null then select * into completion from public.academy_completion_history where member_id=p_member_id and academy_schedule_id=p_schedule_id and completed_date=p_completed_date; return completion; end if;
  if award>0 then
    insert into public.sticker_transactions(family_id,member_id,amount,transaction_type,source_type,source_id,description,metadata)
    values(p_family_id,p_member_id,award,'earn','academy_complete',completion.id::text,schedule.academy_name||' 학원 일정 완료',
      jsonb_build_object('academy_schedule_id',schedule.id,'completed_date',p_completed_date)) on conflict(member_id,source_type,source_id) do nothing;
  end if;
  return completion;
end $$;

alter table public.sticker_reward_settings enable row level security;
revoke all on public.sticker_reward_settings from anon,authenticated;
revoke insert,update,delete on public.sticker_history from anon,authenticated;
grant select on public.sticker_history to anon,authenticated;
revoke all on function public.complete_study_plan_and_reschedule(bigint,date) from anon,authenticated;
revoke all on function public.complete_study_plan_with_reward(uuid,uuid,bigint,date) from public,anon,authenticated;
grant execute on function public.complete_study_plan_with_reward(uuid,uuid,bigint,date) to service_role;
grant execute on function public.complete_academy_schedule(uuid,uuid,uuid,date) to service_role;
notify pgrst,'reload schema';
commit;
