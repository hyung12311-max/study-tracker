-- Book plan projects and generated study tasks.
-- Review this migration, then run it once in the Supabase SQL Editor.
-- It preserves all existing standalone rows in public.study_plans.

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

update public.study_plans set task_type = 'daily' where book_plan_id is null and task_type = 'page';

alter table public.study_plans
  drop constraint if exists study_plans_task_type_check;
alter table public.study_plans
  add constraint study_plans_task_type_check check (task_type in ('page', 'review', 'daily'));

create index if not exists study_plans_book_plan_sequence_idx
  on public.study_plans (book_plan_id, sequence_no);
create index if not exists book_plans_updated_idx
  on public.book_plans (updated_at desc);

create or replace function public.next_book_study_date(p_date date, p_weekdays smallint[])
returns date
language plpgsql
immutable
set search_path = public
as $$
declare
  result date := p_date;
begin
  if coalesce(cardinality(p_weekdays), 0) = 0 then
    raise exception 'at least one study weekday is required';
  end if;
  while not (extract(dow from result)::smallint = any(p_weekdays)) loop
    result := result + 1;
  end loop;
  return result;
end;
$$;

create or replace function public.reflow_book_plan(
  p_book_plan_id uuid,
  p_from_date date default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  project public.book_plans%rowtype;
  next_date date;
  next_page integer;
  completed_page integer;
  page_count integer;
  review_count integer;
  start_slot integer;
  slot integer;
  page_index integer := 0;
  review_row public.study_plans%rowtype;
  page_end integer;
  generated integer := 0;
  last_scheduled_date date;
begin
  select * into project from public.book_plans where id = p_book_plan_id for update;
  if not found then raise exception 'book plan not found'; end if;

  select max(end_page), max(study_date)
    into completed_page, next_date
  from public.study_plans
  where book_plan_id = project.id and status = '완료' and task_type = 'page';

  next_page := greatest(coalesce(completed_page + 1, project.start_page), project.start_page);
  select coalesce(max(sequence_no), 0) + 1 into start_slot
  from public.study_plans where book_plan_id = project.id and status = '완료';
  next_date := coalesce(p_from_date, next_date + 1, project.start_date);
  next_date := public.next_book_study_date(next_date, project.study_weekdays);

  delete from public.study_plans
  where book_plan_id = project.id and status <> '완료' and task_type = 'page';

  select count(*) into review_count
  from public.study_plans
  where book_plan_id = project.id and status <> '완료' and task_type = 'review';

  page_count := case when next_page > project.end_page then 0
    else ceil((project.end_page - next_page + 1)::numeric / project.pages_per_day)::integer end;

  -- Keep review tasks in their relative order even when a page-size change
  -- reduces the number of generated page tasks.
  with ranked_reviews as (
    select id, sequence_no,
      row_number() over (order by sequence_no, study_date, id)::integer as review_no
    from public.study_plans
    where book_plan_id = project.id and status <> '완료' and task_type = 'review'
  )
  update public.study_plans task
  set sequence_no = greatest(
    start_slot + ranked.review_no - 1,
    least(ranked.sequence_no, start_slot + page_count + ranked.review_no - 1)
  )
  from ranked_reviews ranked
  where task.id = ranked.id;

  for slot in start_slot..(start_slot + page_count + review_count - 1) loop
    select * into review_row
    from public.study_plans
    where book_plan_id = project.id
      and status <> '완료'
      and task_type = 'review'
      and sequence_no = slot
    limit 1;

    if found then
      update public.study_plans
      set study_date = next_date,
          day_label = slot || '일차'
      where id = review_row.id;
    else
      page_end := least(next_page + project.pages_per_day - 1, project.end_page);
      insert into public.study_plans (
        subject, workbook, chapter, lesson, study_date, day_label,
        content, goal, status, book_plan_id, sequence_no,
        start_page, end_page, task_type, note
      ) values (
        project.subject, project.workbook, project.chapter, project.lesson,
        next_date, slot || '일차', coalesce(project.content, ''),
        next_page || '~' || page_end || '쪽', '예정', project.id, slot,
        next_page, page_end, 'page', project.memo
      );
      next_page := page_end + 1;
      page_index := page_index + 1;
      generated := generated + 1;
    end if;
    last_scheduled_date := next_date;
    next_date := public.next_book_study_date(next_date + 1, project.study_weekdays);
  end loop;

  update public.book_plans
  set expected_end_date = coalesce(last_scheduled_date, (select max(study_date) from public.study_plans where book_plan_id = project.id), start_date),
      updated_at = now()
  where id = project.id;
  return generated;
end;
$$;

create or replace function public.create_book_plan(
  p_subject text,
  p_workbook text,
  p_chapter text,
  p_lesson text,
  p_content text,
  p_start_date date,
  p_study_weekdays smallint[],
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
begin
  insert into public.book_plans (
    subject, workbook, chapter, lesson, content, start_date,
    study_weekdays, start_page, end_page, pages_per_day, goal, memo
  ) values (
    trim(p_subject), trim(p_workbook), trim(p_chapter), trim(p_lesson),
    nullif(trim(p_content), ''), p_start_date, p_study_weekdays,
    p_start_page, p_end_page, p_pages_per_day,
    nullif(trim(p_goal), ''), nullif(trim(p_memo), '')
  ) returning * into project;
  perform public.reflow_book_plan(project.id, project.start_date);
  select * into project from public.book_plans where id = project.id;
  return project;
end;
$$;

create or replace function public.add_book_plan_review(
  p_book_plan_id uuid,
  p_after_sequence integer,
  p_content text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  project public.book_plans%rowtype;
  result_id text;
begin
  select * into project from public.book_plans where id = p_book_plan_id for update;
  if not found then raise exception 'book plan not found'; end if;
  update public.study_plans set sequence_no = sequence_no + 1
  where book_plan_id = project.id and status <> '완료' and sequence_no > p_after_sequence;
  insert into public.study_plans (
    subject, workbook, chapter, lesson, study_date, day_label,
    content, goal, status, book_plan_id, sequence_no, task_type
  ) values (
    project.subject, project.workbook, project.chapter, project.lesson,
    project.start_date, '', coalesce(nullif(trim(p_content), ''), '복습'),
    '복습', '예정', project.id, p_after_sequence + 1, 'review'
  ) returning id::text into result_id;
  perform public.reflow_book_plan(project.id);
  return result_id;
end;
$$;

create or replace function public.delete_book_plan_task(p_study_plan_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  project_id uuid;
  task_status text;
begin
  select book_plan_id, status into project_id, task_status
  from public.study_plans where id::text = p_study_plan_id for update;
  if project_id is null then raise exception 'generated task not found'; end if;
  if task_status = '완료' then raise exception 'completed tasks cannot be deleted'; end if;
  delete from public.study_plans where id::text = p_study_plan_id;
  perform public.reflow_book_plan(project_id);
end;
$$;

create or replace function public.update_book_plan_pages(p_book_plan_id uuid, p_pages_per_day integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pages_per_day <= 0 then raise exception 'pages per day must be positive'; end if;
  update public.book_plans set pages_per_day = p_pages_per_day, updated_at = now()
  where id = p_book_plan_id;
  if not found then raise exception 'book plan not found'; end if;
  perform public.reflow_book_plan(p_book_plan_id);
end;
$$;

alter table public.book_plans enable row level security;
drop policy if exists book_plans_existing_app_access on public.book_plans;
create policy book_plans_existing_app_access on public.book_plans
for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.book_plans to anon, authenticated;
grant execute on function public.create_book_plan(text,text,text,text,text,date,smallint[],integer,integer,integer,text,text) to anon, authenticated;
grant execute on function public.reflow_book_plan(uuid,date) to anon, authenticated;
grant execute on function public.add_book_plan_review(uuid,integer,text) to anon, authenticated;
grant execute on function public.delete_book_plan_task(text) to anon, authenticated;
grant execute on function public.update_book_plan_pages(uuid,integer) to anon, authenticated;

commit;
