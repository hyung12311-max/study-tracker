-- Creates book study schedules against the currently deployed, shared study_plans schema.
-- JavaScript weekdays and PostgreSQL extract(dow) both use Sunday=0 through Saturday=6.
-- Existing study_plans rows are never updated, deleted, or replaced by this function.

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
    while extract(dow from schedule_date)::integer <> all(normalized_weekdays) loop
      schedule_date := schedule_date + 1;
    end loop;

    page_to := least(page_from + p_pages_per_day - 1, p_end_page);
    sequence_number := sequence_number + 1;

    insert into public.study_plans (
      subject, workbook, chapter, lesson, study_date,
      day_label, content, goal, status
    ) values (
      trim(p_subject),
      trim(p_workbook),
      trim(p_lesson),
      trim(p_chapter),
      schedule_date,
      sequence_number || '일차',
      coalesce(nullif(trim(p_content), ''), trim(p_workbook)),
      page_from || '~' || page_to || '쪽' ||
        case when nullif(trim(p_goal), '') is null then '' else ' · ' || trim(p_goal) end ||
        case when nullif(trim(p_memo), '') is null then '' else ' · ' || trim(p_memo) end,
      '예정'
    ) returning * into inserted_row;

    rows_json := rows_json || jsonb_build_array(to_jsonb(inserted_row));
    page_from := page_to + 1;
    schedule_date := schedule_date + 1;
  end loop;

  return query select
    sequence_number,
    (rows_json -> 0 ->> 'study_date')::date,
    (rows_json -> (jsonb_array_length(rows_json) - 1) ->> 'study_date')::date,
    rows_json;
end;
$$;

revoke all on function public.create_book_plan(
  text, text, text, text, text, date, integer, integer, integer, integer[], text, text
) from public;
grant execute on function public.create_book_plan(
  text, text, text, text, text, date, integer, integer, integer, integer[], text, text
) to anon, authenticated;

notify pgrst, 'reload schema';
