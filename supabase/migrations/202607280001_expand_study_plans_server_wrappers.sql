-- EXPAND phase for the Phase 2A study_plans security rollout.
-- Adds service-role-only, family-scoped wrappers without changing any existing
-- table privilege, RLS state, policy, or legacy RPC EXECUTE grant.
-- Deploy and verify this migration before deploying the new application.

begin;

do $preflight$
declare
  function_name text;
begin
  if to_regclass('public.study_plans') is null then
    raise exception using errcode = 'P0001', message = '2A security preflight failed: study_plans is missing';
  end if;

  if not coalesce((
    select role.rolbypassrls
    from pg_catalog.pg_roles role
    where role.rolname = 'service_role'
  ), false) then
    raise exception using errcode = 'P0001', message = '2A security preflight failed: service_role must bypass RLS';
  end if;

  foreach function_name in array array[
    'public.create_book_plan(text,text,text,text,text,date,integer,integer,integer,integer[],text,text)',
    'public.complete_study_plan_and_reschedule(bigint,date)',
    'public.complete_study_plan_with_reward(uuid,uuid,bigint,date)',
    'public.create_reading_plan(uuid,uuid,text,text,integer,integer,integer[],date)'
  ]
  loop
    if to_regprocedure(function_name) is null then
      raise exception using
        errcode = 'P0001',
        message = format('2A security preflight failed: required function is missing: %s', function_name);
    end if;
    if not (
      select procedure.prosecdef
      from pg_catalog.pg_proc procedure
      where procedure.oid = to_regprocedure(function_name)
    ) then
      raise exception using
        errcode = 'P0001',
        message = format('2A security preflight failed: required function is not SECURITY DEFINER: %s', function_name);
    end if;
    if not (
      select procedure.proowner = 'postgres'::regrole
      from pg_catalog.pg_proc procedure
      where procedure.oid = to_regprocedure(function_name)
    ) then
      raise exception using
        errcode = 'P0001',
        message = format('2A security preflight failed: required function owner changed: %s', function_name);
    end if;
    if not coalesce((
      select procedure.proconfig @> array['search_path=public']
      from pg_catalog.pg_proc procedure
      where procedure.oid = to_regprocedure(function_name)
    ), false) then
      raise exception using
        errcode = 'P0001',
        message = format('2A security preflight failed: required function search_path changed: %s', function_name);
    end if;
  end loop;
end
$preflight$;

create or replace function public.create_book_plan_for_member(
  p_family_id uuid,
  p_assigned_member_id uuid,
  p_created_by_member_id uuid,
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
set search_path = pg_catalog, public
as $function$
declare
  generated record;
  generated_rows_value jsonb;
  claimed_count integer;
begin
  perform 1
  from public.family_members parent_member
  where parent_member.id = p_created_by_member_id
    and parent_member.family_id = p_family_id
    and parent_member.role = 'parent'
    and parent_member.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active parent member is required';
  end if;

  perform 1
  from public.family_members child_member
  where child_member.id = p_assigned_member_id
    and child_member.family_id = p_family_id
    and child_member.role = 'child'
    and child_member.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active child member is required';
  end if;

  select *
  into generated
  from public.create_book_plan(
    p_subject,
    p_workbook,
    p_lesson,
    p_chapter,
    p_content,
    p_start_date,
    p_start_page,
    p_end_page,
    p_pages_per_day,
    p_study_weekdays,
    p_goal,
    p_memo
  );
  generated_rows_value := generated.generated_rows;

  update public.study_plans plan
  set family_id = p_family_id,
      assigned_member_id = p_assigned_member_id,
      created_by_member_id = p_created_by_member_id
  where plan.id in (
    select (entry.value ->> 'id')::bigint
    from jsonb_array_elements(generated_rows_value) entry
  )
    and plan.family_id is null
    and plan.assigned_member_id is null
    and plan.created_by_member_id is null;
  get diagnostics claimed_count = row_count;

  if claimed_count <> generated.generated_count then
    raise exception using
      errcode = 'P0001',
      message = 'generated study plan ownership claim failed';
  end if;

  select jsonb_agg(to_jsonb(plan) order by plan.study_date, plan.id)
  into generated_rows_value
  from public.study_plans plan
  where plan.id in (
    select (entry.value ->> 'id')::bigint
    from jsonb_array_elements(generated_rows_value) entry
  );

  return query select
    generated.generated_count::integer,
    generated.first_study_date::date,
    generated.last_study_date::date,
    generated_rows_value::jsonb;
end
$function$;

create or replace function public.create_reading_plan_for_member(
  p_family_id uuid,
  p_assigned_member_id uuid,
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
set search_path = pg_catalog, public
as $function$
declare
  generated record;
  claimed_count integer;
begin
  perform 1
  from public.family_members parent_member
  where parent_member.id = p_created_by_member_id
    and parent_member.family_id = p_family_id
    and parent_member.role = 'parent'
    and parent_member.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active parent member is required';
  end if;

  perform 1
  from public.family_members child_member
  where child_member.id = p_assigned_member_id
    and child_member.family_id = p_family_id
    and child_member.role = 'child'
    and child_member.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active child member is required';
  end if;

  select *
  into generated
  from public.create_reading_plan(
    p_family_id,
    p_created_by_member_id,
    p_reading_mode,
    p_book_title,
    p_start_page,
    p_end_page,
    p_study_weekdays,
    p_start_date
  );

  update public.reading_plans plan
  set assigned_member_id = p_assigned_member_id
  where plan.id = generated.reading_plan_id
    and plan.family_id = p_family_id
    and plan.created_by_member_id = p_created_by_member_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'reading plan ownership claim failed';
  end if;

  update public.study_plans plan
  set family_id = p_family_id,
      assigned_member_id = p_assigned_member_id,
      created_by_member_id = p_created_by_member_id
  where plan.reading_plan_id = generated.reading_plan_id
    and plan.family_id is null
    and plan.assigned_member_id is null
    and plan.created_by_member_id is null;
  get diagnostics claimed_count = row_count;

  if claimed_count <> generated.generated_count then
    raise exception using errcode = 'P0001', message = 'generated reading study plan ownership claim failed';
  end if;

  return query select
    generated.reading_plan_id::uuid,
    generated.generated_count::integer,
    generated.first_study_date::date,
    generated.last_study_date::date;
end
$function$;

create or replace function public.reflow_book_plan_for_family(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_book_plan_id uuid,
  p_from_date date
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  project public.book_plans%rowtype;
  next_date date;
  next_page integer;
  completed_page integer;
  page_count integer;
  review_count integer;
  start_slot integer;
  slot integer;
  review_row public.study_plans%rowtype;
  page_end integer;
  generated_count integer := 0;
  last_scheduled_date date;
  changed_count integer;
begin
  perform 1
  from public.family_members member
  where member.id = p_actor_member_id
    and member.family_id = p_family_id
    and member.role = 'parent'
    and member.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active parent member is required';
  end if;

  select * into project
  from public.book_plans
  where id = p_book_plan_id
    and family_id = p_family_id
  for update;
  if not found then
    if exists (
      select 1
      from public.book_plans
      where id = p_book_plan_id
    ) then
      raise exception using errcode = '42501', message = 'book plan is outside the family';
    end if;
    raise exception using errcode = 'P0002', message = 'book plan was not found';
  end if;

  if project.assigned_member_id is null or project.created_by_member_id is null then
    raise exception using errcode = 'P0001', message = 'book plan ownership is incomplete';
  end if;

  perform 1
  from public.family_members child_member
  where child_member.id = project.assigned_member_id
    and child_member.family_id = p_family_id
    and child_member.role = 'child'
    and child_member.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active assigned child is required';
  end if;

  perform 1
  from public.family_members creator_member
  where creator_member.id = project.created_by_member_id
    and creator_member.family_id = p_family_id
    and creator_member.role = 'parent';
  if not found then
    raise exception using errcode = 'P0001', message = 'book plan creator ownership is invalid';
  end if;

  if project.start_page is null
     or project.end_page is null
     or project.start_page < 1
     or project.end_page < project.start_page
     or project.pages_per_day is null
     or project.pages_per_day < 1
     or coalesce(cardinality(project.study_weekdays), 0) = 0
     or not (project.study_weekdays <@ array[0,1,2,3,4,5,6]::smallint[]) then
    raise exception using errcode = '22023', message = 'book plan scheduling contract is invalid';
  end if;

  if exists (
    select 1
    from public.study_plans plan
    where plan.book_plan_id = project.id
      and (
        plan.family_id is distinct from p_family_id
        or plan.assigned_member_id is distinct from project.assigned_member_id
        or plan.created_by_member_id is distinct from project.created_by_member_id
      )
  ) then
    raise exception using errcode = 'P0001', message = 'book plan task ownership is inconsistent';
  end if;

  perform 1
  from public.study_plans plan
  where plan.book_plan_id = project.id
    and plan.family_id = p_family_id
    and plan.assigned_member_id = project.assigned_member_id
  for update;

  select max(plan.end_page), max(plan.study_date)
  into completed_page, next_date
  from public.study_plans plan
  where plan.book_plan_id = project.id
    and plan.family_id = p_family_id
    and plan.assigned_member_id = project.assigned_member_id
    and plan.status in ('완료', 'done')
    and plan.task_type = 'page';

  next_page := greatest(
    coalesce(completed_page + 1, project.start_page),
    project.start_page
  );

  select coalesce(max(plan.sequence_no), 0) + 1
  into start_slot
  from public.study_plans plan
  where plan.book_plan_id = project.id
    and plan.family_id = p_family_id
    and plan.assigned_member_id = project.assigned_member_id
    and plan.status in ('완료', 'done');

  next_date := coalesce(p_from_date, next_date + 1, project.start_date);
  while not (
    extract(dow from next_date)::smallint = any(project.study_weekdays)
  ) loop
    next_date := next_date + 1;
  end loop;

  delete from public.study_plans plan
  where plan.book_plan_id = project.id
    and plan.family_id = p_family_id
    and plan.assigned_member_id = project.assigned_member_id
    and plan.status not in ('완료', 'done')
    and plan.task_type = 'page';

  select count(*)::integer
  into review_count
  from public.study_plans plan
  where plan.book_plan_id = project.id
    and plan.family_id = p_family_id
    and plan.assigned_member_id = project.assigned_member_id
    and plan.status not in ('완료', 'done')
    and plan.task_type = 'review';

  page_count := case
    when next_page > project.end_page then 0
    else ceil(
      (project.end_page - next_page + 1)::numeric / project.pages_per_day
    )::integer
  end;

  with ranked_reviews as (
    select
      plan.id,
      plan.sequence_no,
      row_number() over (
        order by plan.sequence_no, plan.study_date, plan.id
      )::integer as review_no
    from public.study_plans plan
    where plan.book_plan_id = project.id
      and plan.family_id = p_family_id
      and plan.assigned_member_id = project.assigned_member_id
      and plan.status not in ('완료', 'done')
      and plan.task_type = 'review'
  )
  update public.study_plans plan
  set sequence_no = greatest(
    start_slot + ranked.review_no - 1,
    least(
      coalesce(ranked.sequence_no, start_slot + ranked.review_no - 1),
      start_slot + page_count + ranked.review_no - 1
    )
  )
  from ranked_reviews ranked
  where plan.id = ranked.id
    and plan.family_id = p_family_id
    and plan.assigned_member_id = project.assigned_member_id;

  if page_count + review_count > 0 then
    for slot in start_slot..(start_slot + page_count + review_count - 1) loop
      select * into review_row
      from public.study_plans plan
      where plan.book_plan_id = project.id
        and plan.family_id = p_family_id
        and plan.assigned_member_id = project.assigned_member_id
        and plan.status not in ('완료', 'done')
        and plan.task_type = 'review'
        and plan.sequence_no = slot
      order by plan.id
      limit 1;

      if found then
        update public.study_plans plan
        set study_date = next_date,
            day_label = slot || '일차'
        where plan.id = review_row.id
          and plan.family_id = p_family_id
          and plan.assigned_member_id = project.assigned_member_id;
      else
        page_end := least(
          next_page + project.pages_per_day - 1,
          project.end_page
        );
        insert into public.study_plans (
          subject,
          workbook,
          chapter,
          lesson,
          study_date,
          day_label,
          content,
          goal,
          status,
          book_plan_id,
          sequence_no,
          start_page,
          end_page,
          task_type,
          note,
          family_id,
          assigned_member_id,
          created_by_member_id
        ) values (
          project.subject,
          project.workbook,
          project.chapter,
          project.lesson,
          next_date,
          slot || '일차',
          coalesce(project.content, ''),
          next_page || '~' || page_end || '쪽',
          '예정',
          project.id,
          slot,
          next_page,
          page_end,
          'page',
          project.memo,
          p_family_id,
          project.assigned_member_id,
          project.created_by_member_id
        );
        next_page := page_end + 1;
        generated_count := generated_count + 1;
      end if;

      last_scheduled_date := next_date;
      next_date := next_date + 1;
      while not (
        extract(dow from next_date)::smallint = any(project.study_weekdays)
      ) loop
        next_date := next_date + 1;
      end loop;
    end loop;
  end if;

  update public.book_plans plan
  set expected_end_date = coalesce(
        last_scheduled_date,
        (
          select max(task.study_date)
          from public.study_plans task
          where task.book_plan_id = project.id
            and task.family_id = p_family_id
            and task.assigned_member_id = project.assigned_member_id
        ),
        plan.start_date
      ),
      updated_at = statement_timestamp()
  where plan.id = project.id
    and plan.family_id = p_family_id
    and plan.assigned_member_id = project.assigned_member_id;
  get diagnostics changed_count = row_count;
  if changed_count <> 1 then
    raise exception using errcode = '40001', message = 'book plan changed during reflow';
  end if;

  return generated_count;
end
$function$;

create or replace function public.add_book_plan_review_for_family(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_book_plan_id uuid,
  p_after_sequence integer,
  p_content text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  project public.book_plans%rowtype;
  result_id text;
  maximum_sequence integer;
  normalized_content text := nullif(trim(coalesce(p_content, '')), '');
begin
  perform 1
  from public.family_members member
  where member.id = p_actor_member_id
    and member.family_id = p_family_id
    and member.role = 'parent'
    and member.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active parent member is required';
  end if;

  if p_after_sequence is null or p_after_sequence < 0 then
    raise exception using errcode = '22023', message = 'review sequence must be zero or greater';
  end if;
  if normalized_content is null or char_length(normalized_content) > 5000 then
    raise exception using errcode = '22023', message = 'review content is invalid';
  end if;

  select * into project
  from public.book_plans
  where id = p_book_plan_id
    and family_id = p_family_id
  for update;
  if not found then
    if exists (
      select 1
      from public.book_plans
      where id = p_book_plan_id
    ) then
      raise exception using errcode = '42501', message = 'book plan is outside the family';
    end if;
    raise exception using errcode = 'P0002', message = 'book plan was not found';
  end if;

  if project.assigned_member_id is null or project.created_by_member_id is null then
    raise exception using errcode = 'P0001', message = 'book plan ownership is incomplete';
  end if;

  perform 1
  from public.family_members child_member
  where child_member.id = project.assigned_member_id
    and child_member.family_id = p_family_id
    and child_member.role = 'child'
    and child_member.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active assigned child is required';
  end if;

  perform 1
  from public.family_members creator_member
  where creator_member.id = project.created_by_member_id
    and creator_member.family_id = p_family_id
    and creator_member.role = 'parent';
  if not found then
    raise exception using errcode = 'P0001', message = 'book plan creator ownership is invalid';
  end if;

  if exists (
    select 1
    from public.study_plans plan
    where plan.book_plan_id = project.id
      and (
        plan.family_id is distinct from p_family_id
        or plan.assigned_member_id is distinct from project.assigned_member_id
        or plan.created_by_member_id is distinct from project.created_by_member_id
      )
  ) then
    raise exception using errcode = 'P0001', message = 'book plan task ownership is inconsistent';
  end if;

  perform 1
  from public.study_plans plan
  where plan.book_plan_id = project.id
    and plan.family_id = p_family_id
    and plan.assigned_member_id = project.assigned_member_id
  for update;

  select coalesce(max(plan.sequence_no), 0)
  into maximum_sequence
  from public.study_plans plan
  where plan.book_plan_id = project.id
    and plan.family_id = p_family_id
    and plan.assigned_member_id = project.assigned_member_id;

  if p_after_sequence > maximum_sequence then
    raise exception using errcode = '40001', message = 'review insertion point is stale';
  end if;

  if exists (
    select 1
    from public.study_plans plan
    where plan.book_plan_id = project.id
      and plan.family_id = p_family_id
      and plan.assigned_member_id = project.assigned_member_id
      and plan.status not in ('완료', 'done')
      and plan.task_type = 'review'
      and plan.sequence_no = p_after_sequence + 1
      and plan.content = normalized_content
  ) then
    raise exception using errcode = '23505', message = 'duplicate review request';
  end if;

  update public.study_plans plan
  set sequence_no = plan.sequence_no + 1
  where plan.book_plan_id = project.id
    and plan.family_id = p_family_id
    and plan.assigned_member_id = project.assigned_member_id
    and plan.status not in ('완료', 'done')
    and plan.sequence_no > p_after_sequence;

  insert into public.study_plans (
    subject,
    workbook,
    chapter,
    lesson,
    study_date,
    day_label,
    content,
    goal,
    status,
    book_plan_id,
    sequence_no,
    task_type,
    family_id,
    assigned_member_id,
    created_by_member_id
  ) values (
    project.subject,
    project.workbook,
    project.chapter,
    project.lesson,
    project.start_date,
    '',
    normalized_content,
    '복습',
    '예정',
    project.id,
    p_after_sequence + 1,
    'review',
    p_family_id,
    project.assigned_member_id,
    project.created_by_member_id
  )
  returning id::text into result_id;

  perform public.reflow_book_plan_for_family(
    p_family_id,
    p_actor_member_id,
    p_book_plan_id,
    null
  );
  return result_id;
end
$function$;

create or replace function public.update_book_plan_pages_for_family(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_book_plan_id uuid,
  p_pages_per_day integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  project public.book_plans%rowtype;
  changed_count integer;
begin
  perform 1
  from public.family_members member
  where member.id = p_actor_member_id
    and member.family_id = p_family_id
    and member.role = 'parent'
    and member.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active parent member is required';
  end if;

  if p_pages_per_day is null or p_pages_per_day < 1 or p_pages_per_day > 100000 then
    raise exception using errcode = '22023', message = 'pages per day is outside the supported range';
  end if;

  select * into project
  from public.book_plans
  where id = p_book_plan_id
    and family_id = p_family_id
  for update;
  if not found then
    if exists (
      select 1
      from public.book_plans
      where id = p_book_plan_id
    ) then
      raise exception using errcode = '42501', message = 'book plan is outside the family';
    end if;
    raise exception using errcode = 'P0002', message = 'book plan was not found';
  end if;

  if project.assigned_member_id is null or project.created_by_member_id is null then
    raise exception using errcode = 'P0001', message = 'book plan ownership is incomplete';
  end if;

  perform 1
  from public.family_members child_member
  where child_member.id = project.assigned_member_id
    and child_member.family_id = p_family_id
    and child_member.role = 'child'
    and child_member.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active assigned child is required';
  end if;

  perform 1
  from public.family_members creator_member
  where creator_member.id = project.created_by_member_id
    and creator_member.family_id = p_family_id
    and creator_member.role = 'parent';
  if not found then
    raise exception using errcode = 'P0001', message = 'book plan creator ownership is invalid';
  end if;

  if exists (
    select 1
    from public.study_plans plan
    where plan.book_plan_id = project.id
      and (
        plan.family_id is distinct from p_family_id
        or plan.assigned_member_id is distinct from project.assigned_member_id
        or plan.created_by_member_id is distinct from project.created_by_member_id
      )
  ) then
    raise exception using errcode = 'P0001', message = 'book plan task ownership is inconsistent';
  end if;

  if project.pages_per_day = p_pages_per_day then
    return;
  end if;

  update public.book_plans plan
  set pages_per_day = p_pages_per_day,
      updated_at = statement_timestamp()
  where plan.id = project.id
    and plan.family_id = p_family_id
    and plan.assigned_member_id = project.assigned_member_id;
  get diagnostics changed_count = row_count;
  if changed_count <> 1 then
    raise exception using errcode = '40001', message = 'book plan changed during page update';
  end if;

  perform public.reflow_book_plan_for_family(
    p_family_id,
    p_actor_member_id,
    p_book_plan_id,
    null
  );
end
$function$;

create or replace function public.delete_book_plan_task_for_family(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_study_plan_id text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  project public.book_plans%rowtype;
  task public.study_plans%rowtype;
  study_plan_id_value bigint;
  changed_count integer;
begin
  perform 1
  from public.family_members member
  where member.id = p_actor_member_id
    and member.family_id = p_family_id
    and member.role = 'parent'
    and member.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active parent member is required';
  end if;

  if p_study_plan_id is null or p_study_plan_id !~ '^[1-9][0-9]{0,18}$' then
    raise exception using errcode = '22023', message = 'study plan id is invalid';
  end if;
  begin
    study_plan_id_value := p_study_plan_id::bigint;
  exception
    when numeric_value_out_of_range then
      raise exception using errcode = '22023', message = 'study plan id is invalid';
  end;

  select * into task
  from public.study_plans plan
  where plan.id = study_plan_id_value;
  if not found then
    raise exception using errcode = 'P0002', message = 'generated task was not found';
  end if;
  if task.book_plan_id is null or task.task_type not in ('page', 'review') then
    raise exception using errcode = '22023', message = 'study plan is not a generated book task';
  end if;
  if task.family_id is distinct from p_family_id then
    raise exception using errcode = '42501', message = 'book task is outside the family';
  end if;

  select * into project
  from public.book_plans plan
  where plan.id = task.book_plan_id
    and plan.family_id = p_family_id
    and plan.assigned_member_id = task.assigned_member_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'book task ownership does not match its plan';
  end if;

  if project.assigned_member_id is null
     or project.created_by_member_id is null
     or task.assigned_member_id is distinct from project.assigned_member_id
     or task.created_by_member_id is distinct from project.created_by_member_id then
    raise exception using errcode = 'P0001', message = 'book task ownership is inconsistent';
  end if;

  perform 1
  from public.family_members child_member
  where child_member.id = project.assigned_member_id
    and child_member.family_id = p_family_id
    and child_member.role = 'child'
    and child_member.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active assigned child is required';
  end if;

  perform 1
  from public.family_members creator_member
  where creator_member.id = project.created_by_member_id
    and creator_member.family_id = p_family_id
    and creator_member.role = 'parent';
  if not found then
    raise exception using errcode = 'P0001', message = 'book plan creator ownership is invalid';
  end if;

  select * into task
  from public.study_plans plan
  where plan.id = study_plan_id_value
    and plan.book_plan_id = project.id
    and plan.family_id = p_family_id
    and plan.assigned_member_id = project.assigned_member_id
  for update;
  if not found then
    raise exception using errcode = '40001', message = 'book task changed before deletion';
  end if;
  if task.status in ('완료', 'done') then
    raise exception using errcode = '55000', message = 'completed tasks cannot be deleted';
  end if;

  delete from public.study_plans plan
  where plan.id = study_plan_id_value
    and plan.book_plan_id = project.id
    and plan.family_id = p_family_id
    and plan.assigned_member_id = project.assigned_member_id
    and plan.status not in ('완료', 'done');
  get diagnostics changed_count = row_count;
  if changed_count <> 1 then
    raise exception using errcode = '40001', message = 'book task changed during deletion';
  end if;

  perform public.reflow_book_plan_for_family(
    p_family_id,
    p_actor_member_id,
    project.id,
    null
  );
end
$function$;

create or replace function public.complete_study_plan_with_reward_for_member(
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
set search_path = pg_catalog, public
as $function$
begin
  perform 1
  from public.family_members member
  where member.id = p_member_id
    and member.family_id = p_family_id
    and member.role = 'child'
    and member.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active child member is required';
  end if;

  perform 1
  from public.study_plans plan
  where plan.id = p_plan_id
    and plan.family_id = p_family_id
    and plan.assigned_member_id = p_member_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'study plan is outside the member scope';
  end if;

  return query
  select *
  from public.complete_study_plan_with_reward(
    p_family_id,
    p_member_id,
    p_plan_id,
    p_completed_date
  );
end
$function$;

alter function public.create_book_plan_for_member(
  uuid, uuid, uuid, text, text, text, text, text, date,
  integer, integer, integer, integer[], text, text
) owner to postgres;
alter function public.create_reading_plan_for_member(
  uuid, uuid, uuid, text, text, integer, integer, integer[], date
) owner to postgres;
alter function public.reflow_book_plan_for_family(uuid, uuid, uuid, date)
  owner to postgres;
alter function public.add_book_plan_review_for_family(uuid, uuid, uuid, integer, text)
  owner to postgres;
alter function public.update_book_plan_pages_for_family(uuid, uuid, uuid, integer)
  owner to postgres;
alter function public.delete_book_plan_task_for_family(uuid, uuid, text)
  owner to postgres;
alter function public.complete_study_plan_with_reward_for_member(uuid, uuid, bigint, date)
  owner to postgres;

revoke all on function public.create_book_plan_for_member(
  uuid, uuid, uuid, text, text, text, text, text, date,
  integer, integer, integer, integer[], text, text
) from public, anon, authenticated;
grant execute on function public.create_book_plan_for_member(
  uuid, uuid, uuid, text, text, text, text, text, date,
  integer, integer, integer, integer[], text, text
) to service_role;

revoke all on function public.create_reading_plan_for_member(
  uuid, uuid, uuid, text, text, integer, integer, integer[], date
) from public, anon, authenticated;
grant execute on function public.create_reading_plan_for_member(
  uuid, uuid, uuid, text, text, integer, integer, integer[], date
) to service_role;

revoke all on function public.reflow_book_plan_for_family(uuid, uuid, uuid, date)
  from public, anon, authenticated;
grant execute on function public.reflow_book_plan_for_family(uuid, uuid, uuid, date)
  to service_role;

revoke all on function public.add_book_plan_review_for_family(uuid, uuid, uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.add_book_plan_review_for_family(uuid, uuid, uuid, integer, text)
  to service_role;

revoke all on function public.update_book_plan_pages_for_family(uuid, uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.update_book_plan_pages_for_family(uuid, uuid, uuid, integer)
  to service_role;

revoke all on function public.delete_book_plan_task_for_family(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.delete_book_plan_task_for_family(uuid, uuid, text)
  to service_role;

revoke all on function public.complete_study_plan_with_reward_for_member(uuid, uuid, bigint, date)
  from public, anon, authenticated;
grant execute on function public.complete_study_plan_with_reward_for_member(uuid, uuid, bigint, date)
  to service_role;

notify pgrst, 'reload schema';

commit;
