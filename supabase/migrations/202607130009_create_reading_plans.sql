begin;

create table if not exists public.reading_plans (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by_member_id uuid not null references public.family_members(id) on delete restrict,
  reading_mode text not null check (reading_mode in ('free', 'pages')),
  book_title text,
  start_page integer,
  end_page integer,
  study_weekdays smallint[] not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(study_weekdays) > 0),
  check (study_weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
  check (
    (reading_mode = 'free' and start_page is null and end_page is null)
    or
    (reading_mode = 'pages' and start_page > 0 and end_page >= start_page)
  )
);

alter table public.study_plans
  add column if not exists reading_plan_id uuid references public.reading_plans(id) on delete cascade;

alter table public.study_plans drop constraint if exists study_plans_task_type_check;
alter table public.study_plans
  add constraint study_plans_task_type_check
  check (task_type in ('page', 'review', 'daily', 'reading_free', 'reading_pages'));

create index if not exists reading_plans_family_created_idx
  on public.reading_plans(family_id, created_at desc);
create index if not exists study_plans_reading_plan_date_idx
  on public.study_plans(reading_plan_id, study_date);

create or replace function public.create_reading_plan(
  p_family_id uuid,
  p_created_by_member_id uuid,
  p_reading_mode text,
  p_book_title text,
  p_start_page integer,
  p_end_page integer,
  p_study_weekdays integer[],
  p_start_date date
)
returns table (
  reading_plan_id uuid,
  generated_count integer,
  first_study_date date,
  last_study_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_row public.reading_plans%rowtype;
  normalized_weekdays smallint[];
  schedule_date date;
  final_date date;
  sequence_value integer := 0;
  first_date_value date;
  last_date_value date;
  normalized_title text := nullif(trim(coalesce(p_book_title, '')), '');
begin
  perform 1
  from public.family_members
  where id = p_created_by_member_id
    and family_id = p_family_id
    and role = 'parent'
    and is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active parent member is required';
  end if;

  if p_reading_mode not in ('free', 'pages') then
    raise exception using errcode = '22023', message = 'reading mode must be free or pages';
  end if;
  if p_reading_mode = 'free' then
    normalized_title := null;
    p_start_page := null;
    p_end_page := null;
  elsif p_start_page is null or p_end_page is null or p_start_page < 1 or p_end_page < p_start_page then
    raise exception using errcode = '22023', message = 'valid reading page range is required';
  end if;

  select array_agg(distinct weekday::smallint order by weekday::smallint)
  into normalized_weekdays
  from unnest(coalesce(p_study_weekdays, array[]::integer[])) weekday
  where weekday between 0 and 6;
  if coalesce(cardinality(normalized_weekdays), 0) = 0 then
    raise exception using errcode = '22023', message = 'at least one reading weekday is required';
  end if;
  if p_start_date is null then
    raise exception using errcode = '22004', message = 'reading start date is required';
  end if;

  final_date := p_start_date + 27;
  insert into public.reading_plans (
    family_id, created_by_member_id, reading_mode, book_title,
    start_page, end_page, study_weekdays, start_date, end_date
  ) values (
    p_family_id, p_created_by_member_id, p_reading_mode, normalized_title,
    p_start_page, p_end_page, normalized_weekdays, p_start_date, final_date
  ) returning * into plan_row;

  schedule_date := p_start_date;
  while schedule_date <= final_date loop
    if extract(dow from schedule_date)::smallint = any(normalized_weekdays) then
      sequence_value := sequence_value + 1;
      insert into public.study_plans (
        subject, workbook, chapter, lesson, study_date, day_label,
        content, goal, status, reading_plan_id, sequence_no,
        start_page, end_page, task_type, note, study_weekdays
      ) values (
        '독서', coalesce(normalized_title, ''), '', '', schedule_date, sequence_value || '회차',
        case when p_reading_mode = 'free' then '오늘은 자유 독서하는 날이에요.'
             else p_start_page || '~' || p_end_page || 'P 읽기' end,
        case when p_reading_mode = 'free' then ''
             else p_start_page || '~' || p_end_page || 'P' end,
        '예정', plan_row.id, sequence_value,
        p_start_page, p_end_page,
        case when p_reading_mode = 'free' then 'reading_free' else 'reading_pages' end,
        case when p_reading_mode = 'free' then '자유 독서' else '페이지 지정 독서' end,
        normalized_weekdays::integer[]
      );
      first_date_value := coalesce(first_date_value, schedule_date);
      last_date_value := schedule_date;
    end if;
    schedule_date := schedule_date + 1;
  end loop;

  return query select plan_row.id, sequence_value, first_date_value, last_date_value;
end;
$$;

alter table public.reading_plans enable row level security;
revoke all on table public.reading_plans from anon, authenticated;
grant select, insert, update, delete on table public.reading_plans to service_role;
revoke all on function public.create_reading_plan(uuid, uuid, text, text, integer, integer, integer[], date)
  from public, anon, authenticated;
grant execute on function public.create_reading_plan(uuid, uuid, text, text, integer, integer, integer[], date)
  to service_role;

notify pgrst, 'reload schema';
commit;
