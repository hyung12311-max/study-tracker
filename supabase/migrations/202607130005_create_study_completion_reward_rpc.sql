-- Atomically completes a study plan and awards the authenticated child.

alter table public.sticker_history
  add column if not exists reward_type text,
  add column if not exists reward_reason text,
  add column if not exists family_id uuid references public.families(id),
  add column if not exists member_id uuid references public.family_members(id);

create or replace function public.complete_study_plan_with_reward(
  p_family_id uuid,
  p_member_id uuid,
  p_plan_id bigint,
  p_completed_date date
)
returns table (
  adjustment_type text,
  rescheduled_count integer,
  sticker_count integer,
  reward_type text,
  reward_reason text,
  already_completed boolean,
  balance bigint,
  completed_plan jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  completion record;
  plan_row public.study_plans%rowtype;
  settings public.sticker_reward_settings%rowtype;
  awarded_count integer;
  awarded_type text;
  awarded_reason text;
  wallet_balance bigint;
begin
  if p_completed_date is null then
    raise exception using errcode = '22004', message = 'completed date is required';
  end if;

  perform 1
  from public.family_members
  where id = p_member_id
    and family_id = p_family_id
    and role = 'child'
    and is_active = true
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'active child member is required';
  end if;

  select * into plan_row
  from public.study_plans
  where id = p_plan_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'study plan not found';
  end if;

  select * into completion
  from public.complete_study_plan_and_reschedule(p_plan_id, p_completed_date);

  -- Use one stable status value across the browser and APIs.
  update public.study_plans
  set status = 'done'
  where id = p_plan_id
  returning * into plan_row;

  select * into settings
  from public.sticker_reward_settings
  where family_id = p_family_id;

  if completion.already_completed then
    select sh.sticker_count, sh.reward_type, sh.reward_reason
    into awarded_count, awarded_type, awarded_reason
    from public.sticker_history sh
    where sh.study_plan_id = p_plan_id;
    awarded_count := coalesce(awarded_count, 0);
    awarded_type := coalesce(awarded_type, 'study_complete');
    awarded_reason := coalesce(awarded_reason, '이미 완료된 학습이에요.');
  elsif plan_row.study_date is null then
    awarded_count := coalesce(settings.no_date_complete_count, 1);
    awarded_type := 'study_no_date';
    awarded_reason := '학습 완료';
  elsif completion.adjustment_type = 'early' then
    awarded_count := coalesce(settings.early_complete_count, 3);
    awarded_type := 'study_early';
    awarded_reason := '미리 완료';
  elsif completion.adjustment_type = 'late' then
    awarded_count := coalesce(settings.delayed_complete_count, 1);
    awarded_type := 'study_delayed';
    awarded_reason := '지연 학습 완료';
  else
    awarded_count := coalesce(settings.on_time_complete_count, 2);
    awarded_type := 'study_on_time';
    awarded_reason := '계획한 날짜에 완료';
  end if;

  if not completion.already_completed then
    update public.sticker_history
    set sticker_count = awarded_count,
        reward_type = awarded_type,
        reward_reason = awarded_reason,
        family_id = p_family_id,
        member_id = p_member_id
    where study_plan_id = p_plan_id;

    -- A plan has one owner. Remove a legacy/default-member award before
    -- assigning the ledger row to the authenticated child.
    delete from public.sticker_transactions
    where source_type = 'study_complete'
      and source_id = p_plan_id::text
      and member_id <> p_member_id;

    insert into public.sticker_transactions (
      family_id, member_id, amount, transaction_type,
      source_type, source_id, description, metadata
    ) values (
      p_family_id, p_member_id, awarded_count, 'earn',
      'study_complete', p_plan_id::text,
      coalesce(plan_row.subject, '학습') || ' 완료',
      jsonb_build_object('reward_type', awarded_type, 'reward_reason', awarded_reason)
    )
    on conflict (member_id, source_type, source_id)
    do update set
      amount = excluded.amount,
      description = excluded.description,
      metadata = excluded.metadata;
  end if;

  select coalesce(sum(amount), 0)
  into wallet_balance
  from public.sticker_transactions
  where family_id = p_family_id
    and member_id = p_member_id;

  return query select
    completion.adjustment_type::text,
    coalesce(completion.rescheduled_count, 0)::integer,
    awarded_count,
    awarded_type,
    awarded_reason,
    completion.already_completed::boolean,
    wallet_balance,
    to_jsonb(plan_row);
end;
$$;

revoke all on function public.complete_study_plan_with_reward(uuid, uuid, bigint, date)
  from public, anon, authenticated;
grant execute on function public.complete_study_plan_with_reward(uuid, uuid, bigint, date)
  to service_role;

notify pgrst, 'reload schema';
