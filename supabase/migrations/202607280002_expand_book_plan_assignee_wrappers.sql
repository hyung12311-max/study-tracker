-- Phase 2A follow-up EXPAND.
--
-- Add service-role-only book-plan mutation wrappers that bind every mutation
-- to the child explicitly selected by the authenticated parent. This migration
-- is additive: it does not change existing wrappers, RLS, policies, or grants.

begin;

do $preflight$
declare
  function_name text;
begin
  if to_regclass('public.family_members') is null
     or to_regclass('public.book_plans') is null
     or to_regclass('public.study_plans') is null then
    raise exception using
      errcode = 'P0001',
      message = '2A book assignee expand preflight failed: required table is missing';
  end if;

  if not coalesce((
    select role.rolbypassrls
    from pg_catalog.pg_roles role
    where role.rolname = 'service_role'
  ), false) then
    raise exception using
      errcode = 'P0001',
      message = '2A book assignee expand preflight failed: service_role must bypass RLS';
  end if;

  foreach function_name in array array[
    'public.reflow_book_plan_for_family(uuid,uuid,uuid,date)',
    'public.add_book_plan_review_for_family(uuid,uuid,uuid,integer,text)',
    'public.update_book_plan_pages_for_family(uuid,uuid,uuid,integer)',
    'public.delete_book_plan_task_for_family(uuid,uuid,text)'
  ]
  loop
    if to_regprocedure(function_name) is null then
      raise exception using
        errcode = 'P0001',
        message = format(
          '2A book assignee expand preflight failed: v1 wrapper is missing: %s',
          function_name
        );
    end if;
  end loop;
end
$preflight$;

create or replace function public.reflow_book_plan_for_assignee(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_book_plan_id uuid,
  p_from_date date
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  result_count integer;
begin
  perform 1
  from public.family_members actor
  where actor.id = p_actor_member_id
    and actor.family_id = p_family_id
    and actor.role = 'parent'
    and actor.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active parent member is required';
  end if;

  perform 1
  from public.family_members child
  where child.id = p_assigned_member_id
    and child.family_id = p_family_id
    and child.role = 'child'
    and child.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active assigned child is required';
  end if;

  perform 1
  from public.book_plans plan
  where plan.id = p_book_plan_id
    and plan.family_id = p_family_id
    and plan.assigned_member_id = p_assigned_member_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'book plan was not found';
  end if;

  result_count := public.reflow_book_plan_for_family(
    p_family_id,
    p_actor_member_id,
    p_book_plan_id,
    p_from_date
  );
  return result_count;
end
$function$;

create or replace function public.add_book_plan_review_for_assignee(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
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
  result_id text;
begin
  perform 1
  from public.family_members actor
  where actor.id = p_actor_member_id
    and actor.family_id = p_family_id
    and actor.role = 'parent'
    and actor.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active parent member is required';
  end if;

  perform 1
  from public.family_members child
  where child.id = p_assigned_member_id
    and child.family_id = p_family_id
    and child.role = 'child'
    and child.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active assigned child is required';
  end if;

  perform 1
  from public.book_plans plan
  where plan.id = p_book_plan_id
    and plan.family_id = p_family_id
    and plan.assigned_member_id = p_assigned_member_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'book plan was not found';
  end if;

  result_id := public.add_book_plan_review_for_family(
    p_family_id,
    p_actor_member_id,
    p_book_plan_id,
    p_after_sequence,
    p_content
  );
  return result_id;
end
$function$;

create or replace function public.update_book_plan_pages_for_assignee(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_book_plan_id uuid,
  p_pages_per_day integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  perform 1
  from public.family_members actor
  where actor.id = p_actor_member_id
    and actor.family_id = p_family_id
    and actor.role = 'parent'
    and actor.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active parent member is required';
  end if;

  perform 1
  from public.family_members child
  where child.id = p_assigned_member_id
    and child.family_id = p_family_id
    and child.role = 'child'
    and child.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active assigned child is required';
  end if;

  perform 1
  from public.book_plans plan
  where plan.id = p_book_plan_id
    and plan.family_id = p_family_id
    and plan.assigned_member_id = p_assigned_member_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'book plan was not found';
  end if;

  perform public.update_book_plan_pages_for_family(
    p_family_id,
    p_actor_member_id,
    p_book_plan_id,
    p_pages_per_day
  );
end
$function$;

create or replace function public.delete_book_plan_task_for_assignee(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_study_plan_id text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  study_plan_id_value bigint;
  book_plan_id_value uuid;
begin
  perform 1
  from public.family_members actor
  where actor.id = p_actor_member_id
    and actor.family_id = p_family_id
    and actor.role = 'parent'
    and actor.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active parent member is required';
  end if;

  perform 1
  from public.family_members child
  where child.id = p_assigned_member_id
    and child.family_id = p_family_id
    and child.role = 'child'
    and child.is_active = true;
  if not found then
    raise exception using errcode = '42501', message = 'active assigned child is required';
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

  select task.book_plan_id
  into book_plan_id_value
  from public.study_plans task
  where task.id = study_plan_id_value
    and task.family_id = p_family_id
    and task.assigned_member_id = p_assigned_member_id
    and task.book_plan_id is not null
    and task.task_type in ('page', 'review');
  if not found then
    raise exception using errcode = 'P0002', message = 'book task was not found';
  end if;

  -- Keep the same lock order as the v1 wrappers: project first, task second.
  perform 1
  from public.book_plans plan
  where plan.id = book_plan_id_value
    and plan.family_id = p_family_id
    and plan.assigned_member_id = p_assigned_member_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'book task was not found';
  end if;

  perform 1
  from public.study_plans task
  where task.id = study_plan_id_value
    and task.book_plan_id = book_plan_id_value
    and task.family_id = p_family_id
    and task.assigned_member_id = p_assigned_member_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'book task was not found';
  end if;

  perform public.delete_book_plan_task_for_family(
    p_family_id,
    p_actor_member_id,
    p_study_plan_id
  );
end
$function$;

alter function public.reflow_book_plan_for_assignee(uuid, uuid, uuid, uuid, date)
  owner to postgres;
alter function public.add_book_plan_review_for_assignee(uuid, uuid, uuid, uuid, integer, text)
  owner to postgres;
alter function public.update_book_plan_pages_for_assignee(uuid, uuid, uuid, uuid, integer)
  owner to postgres;
alter function public.delete_book_plan_task_for_assignee(uuid, uuid, uuid, text)
  owner to postgres;

revoke all on function public.reflow_book_plan_for_assignee(uuid, uuid, uuid, uuid, date)
  from public, anon, authenticated;
grant execute on function public.reflow_book_plan_for_assignee(uuid, uuid, uuid, uuid, date)
  to service_role;

revoke all on function public.add_book_plan_review_for_assignee(uuid, uuid, uuid, uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.add_book_plan_review_for_assignee(uuid, uuid, uuid, uuid, integer, text)
  to service_role;

revoke all on function public.update_book_plan_pages_for_assignee(uuid, uuid, uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.update_book_plan_pages_for_assignee(uuid, uuid, uuid, uuid, integer)
  to service_role;

revoke all on function public.delete_book_plan_task_for_assignee(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.delete_book_plan_task_for_assignee(uuid, uuid, uuid, text)
  to service_role;

notify pgrst, 'reload schema';

commit;
