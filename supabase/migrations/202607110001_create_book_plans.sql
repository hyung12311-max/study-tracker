-- Adds book projects and the create_book_plan RPC used by js/app.js.
-- Existing standalone study_plans rows remain unchanged and receive task_type='daily'.

begin;

create extension if not exists pgcrypto;

create table if not exists public.book_plans (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  workbook text not null,
  chapter text not null,
  lesson text not null,
  content text,
  start_date date not null,
  study_weekdays smallint[] not null,
  start_page integer not null check (start_page > 0),
  end_page integer not null check (end_page >= start_page),
  pages_per_day integer not null check (pages_per_day > 0),
  goal text,
  memo text,
  expected_end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(study_weekdays) > 0),
  check (study_weekdays <@ array[0,1,2,3,4,5,6]::smallint[])
);

alter table public.study_plans
  add column if not exists book_plan_id uuid references public.book_plans(id) on delete cascade,
  add column if not exists sequence_no integer,
  add column if not exists start_page integer,
  add column if not exists end_page integer,
  add column if not exists task_type text not null default 'page',
  add column if not exists note text;

update public.study_plans
set task_type = 'daily'
where book_plan_id is null and task_type = 'page';

alter table public.study_plans drop constraint if exists study_plans_task_type_check;
alter table public.study_plans
  add constraint study_plans_task_type_check
  check (task_type in ('page', 'review', 'daily'));

create index if not exists study_plans_book_plan_sequence_idx
  on public.study_plans (book_plan_id, sequence_no);
create index if not exists book_plans_updated_idx
  on public.book_plans (updated_at desc);

-- Remove a possible earlier development signature so PostgREST sees one exact RPC.
drop function if exists public.create_book_plan(
  text, text, text, text, text, date, smallint[],
  integer, integer, integer, text, text
);

create or replace function public.create_book_plan(
  p_subject text,
  p_workbook text,
  p_chapter text,
  p_lesson text,
  p_content text,
  p_start_date date,
  p_study_weekdays integer[],
  p_start_page integer,
  p_end_page integer,
  p_pages_per_day integer,
  p_goal text,
  p_memo text
)
returns public.book_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  project public.book_plans%rowtype;
  normalized_weekdays smallint[];
  current_date_value date;
  current_page integer;
  current_end_page integer;
  sequence_value integer := 1;
  last_study_date date;
begin
  if nullif(trim(p_subject), '') is null
    or nullif(trim(p_workbook), '') is null
    or nullif(trim(p_chapter), '') is null
    or nullif(trim(p_lesson), '') is null then
    raise exception 'subject, workbook, chapter, and lesson are required';
  end if;
  if p_start_date is null then raise exception 'start date is required'; end if;
  if p_start_page is null or p_start_page < 1 then raise exception 'start page must be positive'; end if;
  if p_end_page is null or p_end_page < p_start_page then raise exception 'end page must not be before start page'; end if;
  if p_pages_per_day is null or p_pages_per_day < 1 then raise exception 'pages per day must be positive'; end if;

  select array_agg(distinct weekday::smallint order by weekday::smallint)
  into normalized_weekdays
  from unnest(coalesce(p_study_weekdays, array[]::integer[])) weekday
  where weekday between 0 and 6;

  if coalesce(cardinality(normalized_weekdays), 0) = 0 then
    raise exception 'at least one study weekday is required';
  end if;

  insert into public.book_plans (
    subject, workbook, chapter, lesson, content, start_date,
    study_weekdays, start_page, end_page, pages_per_day, goal, memo
  ) values (
    trim(p_subject), trim(p_workbook), trim(p_chapter), trim(p_lesson),
    nullif(trim(coalesce(p_content, '')), ''), p_start_date,
    normalized_weekdays, p_start_page, p_end_page, p_pages_per_day,
    nullif(trim(coalesce(p_goal, '')), ''),
    nullif(trim(coalesce(p_memo, '')), '')
  ) returning * into project;

  current_date_value := p_start_date;
  current_page := p_start_page;

  while current_page <= p_end_page loop
    while not (extract(dow from current_date_value)::smallint = any(normalized_weekdays)) loop
      current_date_value := current_date_value + 1;
    end loop;

    current_end_page := least(current_page + p_pages_per_day - 1, p_end_page);
    insert into public.study_plans (
      subject, workbook, chapter, lesson, study_date, day_label,
      content, goal, status, book_plan_id, sequence_no,
      start_page, end_page, task_type, note
    ) values (
      project.subject, project.workbook, project.chapter, project.lesson,
      current_date_value, sequence_value || '일차', coalesce(project.content, ''),
      current_page || '~' || current_end_page || '쪽', '예정', project.id,
      sequence_value, current_page, current_end_page, 'page', project.memo
    );

    last_study_date := current_date_value;
    current_page := current_end_page + 1;
    sequence_value := sequence_value + 1;
    current_date_value := current_date_value + 1;
  end loop;

  update public.book_plans
  set expected_end_date = last_study_date,
      updated_at = now()
  where id = project.id
  returning * into project;

  return project;
end;
$$;

alter table public.book_plans enable row level security;
drop policy if exists book_plans_existing_app_access on public.book_plans;
create policy book_plans_existing_app_access
on public.book_plans for all to anon, authenticated
using (true) with check (true);

grant select, insert, update, delete on public.book_plans to anon, authenticated;
revoke all on function public.create_book_plan(
  text, text, text, text, text, date, integer[],
  integer, integer, integer, text, text
) from public;
grant execute on function public.create_book_plan(
  text, text, text, text, text, date, integer[],
  integer, integer, integer, text, text
) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
