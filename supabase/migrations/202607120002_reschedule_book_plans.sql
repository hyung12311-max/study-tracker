-- Adds stable automatic-plan grouping and atomically completes/reschedules a plan.
-- Existing rows remain unchanged: their new columns stay null and are never auto-rescheduled.

create extension if not exists pgcrypto;

alter table public.study_plans
  add column if not exists plan_group_id uuid,
  add column if not exists study_weekdays integer[],
  add column if not exists plan_sequence integer,
  add column if not exists completed_date date;

create index if not exists study_plans_group_sequence_idx
  on public.study_plans (plan_group_id, plan_sequence)
  where plan_group_id is not null;

create or replace function public.next_plan_study_slot(
  p_from_date date,
  p_study_weekdays integer[]
)
returns date
language plpgsql
immutable
strict
set search_path = public
as $$
declare
  candidate date := p_from_date;
begin
  if coalesce(cardinality(p_study_weekdays), 0) = 0 then
    raise exception 'study weekdays are required';
  end if;
  while extract(dow from candidate)::integer <> all(p_study_weekdays) loop
    candidate := candidate + 1;
  end loop;
  return candidate;
end;
$$;

drop function if exists public.create_book_plan(
  text, text, text, text, text, date, integer[], integer, integer, integer, text, text
);
drop function if exists public.create_book_plan(
  text, text, text, text, text, date, integer, integer, integer, integer[], text, text
);

create function public.create_book_plan(
  p_subject text,
  p_workbook text,
  p_lesson text,
  p_chapter text,
  p_content text,
  p_start_date date,
  p_start_page integer,
  p_end_page integer,
  p_pages_per_day integer,
  p_study_weekdays integer[],
  p_goal text,
  p_memo text
)
returns table (
  generated_count integer,
  first_study_date date,
  last_study_date date,
  generated_rows jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_weekdays integer[];
  schedule_date date := p_start_date;
  page_from integer := p_start_page;
  page_to integer;
  sequence_number integer := 0;
  group_id uuid := gen_random_uuid();
  inserted_row public.study_plans%rowtype;
  rows_json jsonb := '[]'::jsonb;
begin
  if nullif(trim(p_subject), '') is null or nullif(trim(p_workbook), '') is null then
    raise exception 'subject and workbook are required';
  end if;
  if nullif(trim(p_lesson), '') is null or nullif(trim(p_chapter), '') is null then
    raise exception 'lesson and chapter are required';
  end if;
  if p_start_date is null then raise exception 'start date is required'; end if;
  if p_start_page is null or p_end_page is null or p_start_page < 1 or p_end_page < p_start_page then
    raise exception 'invalid page range';
  end if;
  if p_pages_per_day is null or p_pages_per_day < 1 then
    raise exception 'pages per day must be at least 1';
  end if;

  select array_agg(distinct weekday order by weekday)
    into normalized_weekdays
  from unnest(coalesce(p_study_weekdays, array[]::integer[])) weekday
  where weekday between 0 and 6;
  if coalesce(cardinality(normalized_weekdays), 0) = 0 then
    raise exception 'at least one study weekday is required';
  end if;

  while page_from <= p_end_page loop
    schedule_date := public.next_plan_study_slot(schedule_date, normalized_weekdays);
    page_to := least(page_from + p_pages_per_day - 1, p_end_page);
    sequence_number := sequence_number + 1;

    insert into public.study_plans (
      subject, workbook, chapter, lesson, study_date, day_label,
      content, goal, status, plan_group_id, study_weekdays, plan_sequence
    ) values (
      trim(p_subject), trim(p_workbook), trim(p_lesson), trim(p_chapter),
      schedule_date, sequence_number || '일차',
      coalesce(nullif(trim(p_content), ''), trim(p_workbook)),
      page_from || '~' || page_to || '쪽' ||
        case when nullif(trim(p_goal), '') is null then '' else ' · ' || trim(p_goal) end ||
        case when nullif(trim(p_memo), '') is null then '' else ' · ' || trim(p_memo) end,
      '예정', group_id, normalized_weekdays, sequence_number
    ) returning * into inserted_row;

    rows_json := rows_json || jsonb_build_array(to_jsonb(inserted_row));
    page_from := page_to + 1;
    schedule_date := schedule_date + 1;
  end loop;

  return query select sequence_number,
    (rows_json -> 0 ->> 'study_date')::date,
    (rows_json -> (jsonb_array_length(rows_json) - 1) ->> 'study_date')::date,
    rows_json;
end;
$$;

drop function if exists public.complete_study_plan_and_reschedule(bigint, date);

create function public.complete_study_plan_and_reschedule(
  p_plan_id bigint,
  p_completed_date date
)
returns table (
  adjustment_type text,
  rescheduled_count integer,
  sticker_awarded boolean,
  already_completed boolean,
  completed_plan jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_plan public.study_plans%rowtype;
  pending_plan public.study_plans%rowtype;
  next_date date;
  changed integer := 0;
  awarded boolean := false;
  adjustment text := 'normal';
begin
  if p_completed_date is null then raise exception 'completed date is required'; end if;

  select * into current_plan
  from public.study_plans
  where id = p_plan_id
  for update;
  if not found then raise exception 'study plan not found'; end if;

  if current_plan.status in ('완료', 'done') then
    return query select 'already_completed'::text, 0, false, true, to_jsonb(current_plan);
    return;
  end if;

  if current_plan.plan_group_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(current_plan.plan_group_id::text, 0));
  end if;

  update public.study_plans
  set status = '완료', completed_date = p_completed_date
  where id = current_plan.id
  returning * into current_plan;

  if not exists (select 1 from public.sticker_history where study_plan_id = current_plan.id) then
    insert into public.sticker_history (study_plan_id, sticker_count)
    values (current_plan.id, 1);
    awarded := true;
  end if;

  if p_completed_date < current_plan.study_date then adjustment := 'early';
  elsif p_completed_date > current_plan.study_date then adjustment := 'late';
  end if;

  if adjustment <> 'normal'
     and current_plan.plan_group_id is not null
     and current_plan.plan_sequence is not null
     and coalesce(cardinality(current_plan.study_weekdays), 0) > 0 then
    if adjustment = 'early' then
      next_date := current_plan.study_date;
    else
      next_date := public.next_plan_study_slot(p_completed_date + 1, current_plan.study_weekdays);
    end if;

    for pending_plan in
      select * from public.study_plans
      where plan_group_id = current_plan.plan_group_id
        and plan_sequence > current_plan.plan_sequence
        and status not in ('완료', 'done')
      order by plan_sequence, id
      for update
    loop
      if pending_plan.study_date is distinct from next_date then
        update public.study_plans set study_date = next_date where id = pending_plan.id;
        changed := changed + 1;
      end if;
      next_date := public.next_plan_study_slot(next_date + 1, current_plan.study_weekdays);
    end loop;
  end if;

  return query select adjustment, changed, awarded, false, to_jsonb(current_plan);
end;
$$;

revoke all on function public.create_book_plan(
  text, text, text, text, text, date, integer, integer, integer, integer[], text, text
) from public;
grant execute on function public.create_book_plan(
  text, text, text, text, text, date, integer, integer, integer, integer[], text, text
) to anon, authenticated;

revoke all on function public.complete_study_plan_and_reschedule(bigint, date) from public;
grant execute on function public.complete_study_plan_and_reschedule(bigint, date) to anon, authenticated;

notify pgrst, 'reload schema';
