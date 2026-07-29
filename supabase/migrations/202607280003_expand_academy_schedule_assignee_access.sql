-- EXPAND phase: add service-role-only Academy schedule APIs.
-- This migration deliberately preserves every existing row, table grant,
-- RLS state, policy, and legacy function grant for old-application compatibility.

begin;

do $preflight$
declare
  required_column text;
begin
  if to_regclass('public.academy_schedules') is null
     or to_regclass('public.academy_completion_history') is null
     or to_regclass('public.family_members') is null
     or to_regclass('public.sticker_transactions') is null then
    raise exception using
      errcode = 'P0001',
      message = 'academy expand preflight failed: required relation is missing';
  end if;

  foreach required_column in array array[
    'academy_schedules.id',
    'academy_schedules.academy_name',
    'academy_schedules.day_of_week',
    'academy_schedules.start_time',
    'academy_schedules.memo',
    'academy_schedules.star_count',
    'academy_schedules.family_id',
    'academy_schedules.assigned_member_id',
    'academy_schedules.created_by_member_id',
    'academy_completion_history.academy_schedule_id',
    'academy_completion_history.family_id',
    'academy_completion_history.member_id',
    'academy_completion_history.completed_date'
  ]
  loop
    if not exists (
      select 1
      from information_schema.columns columns
      where columns.table_schema = 'public'
        and columns.table_name = split_part(required_column, '.', 1)
        and columns.column_name = split_part(required_column, '.', 2)
    ) then
      raise exception using
        errcode = 'P0001',
        message = format(
          'academy expand preflight failed: required column is missing: public.%s',
          required_column
        );
    end if;
  end loop;

  if to_regprocedure(
    'public.complete_academy_schedule(uuid,uuid,uuid,date)'
  ) is null then
    raise exception using
      errcode = 'P0001',
      message = 'academy expand preflight failed: legacy completion function is missing';
  end if;

  if not coalesce((
    select roles.rolbypassrls
    from pg_catalog.pg_roles roles
    where roles.rolname = 'service_role'
  ), false) then
    raise exception using
      errcode = 'P0001',
      message = 'academy expand preflight failed: service_role must bypass RLS';
  end if;
end
$preflight$;

create or replace function public.create_academy_schedule_for_assignee(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_academy_name text,
  p_day_of_week integer,
  p_start_time time without time zone,
  p_memo text,
  p_star_count integer
)
returns public.academy_schedules
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  created_schedule public.academy_schedules%rowtype;
begin
  perform 1
  from public.family_members members
  where members.id = p_actor_member_id
    and members.family_id = p_family_id
    and members.role = 'parent'
    and members.is_active = true;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'active parent member is required';
  end if;

  perform 1
  from public.family_members members
  where members.id = p_assigned_member_id
    and members.family_id = p_family_id
    and members.role = 'child'
    and members.is_active = true;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'active assigned child is required';
  end if;

  if p_academy_name is null
     or btrim(p_academy_name) = ''
     or char_length(btrim(p_academy_name)) > 200
     or p_day_of_week is null
     or p_day_of_week not between 0 and 6
     or p_start_time is null
     or char_length(coalesce(p_memo, '')) > 1000
     or p_star_count is null
     or p_star_count not between 1 and 20 then
    raise exception using
      errcode = '22023',
      message = 'academy schedule input is invalid';
  end if;

  insert into public.academy_schedules (
    academy_name,
    day_of_week,
    start_time,
    memo,
    star_count,
    family_id,
    assigned_member_id,
    created_by_member_id
  )
  values (
    btrim(p_academy_name),
    p_day_of_week,
    p_start_time,
    nullif(btrim(coalesce(p_memo, '')), ''),
    p_star_count,
    p_family_id,
    p_assigned_member_id,
    p_actor_member_id
  )
  returning * into created_schedule;

  return created_schedule;
end
$function$;

create or replace function public.update_academy_schedule_for_assignee(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_schedule_id uuid,
  p_academy_name text,
  p_day_of_week integer,
  p_start_time time without time zone,
  p_memo text,
  p_star_count integer
)
returns public.academy_schedules
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  locked_schedule public.academy_schedules%rowtype;
  updated_schedule public.academy_schedules%rowtype;
  changed_count integer;
begin
  perform 1
  from public.family_members members
  where members.id = p_actor_member_id
    and members.family_id = p_family_id
    and members.role = 'parent'
    and members.is_active = true;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'active parent member is required';
  end if;

  perform 1
  from public.family_members members
  where members.id = p_assigned_member_id
    and members.family_id = p_family_id
    and members.role = 'child'
    and members.is_active = true;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'active assigned child is required';
  end if;

  select schedules.*
  into locked_schedule
  from public.academy_schedules schedules
  where schedules.id = p_schedule_id
    and schedules.family_id = p_family_id
    and schedules.assigned_member_id = p_assigned_member_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'academy schedule was not found';
  end if;

  if p_academy_name is null
     or btrim(p_academy_name) = ''
     or char_length(btrim(p_academy_name)) > 200
     or p_day_of_week is null
     or p_day_of_week not between 0 and 6
     or p_start_time is null
     or char_length(coalesce(p_memo, '')) > 1000
     or p_star_count is null
     or p_star_count not between 1 and 20 then
    raise exception using
      errcode = '22023',
      message = 'academy schedule input is invalid';
  end if;

  update public.academy_schedules schedules
  set
    academy_name = btrim(p_academy_name),
    day_of_week = p_day_of_week,
    start_time = p_start_time,
    memo = nullif(btrim(coalesce(p_memo, '')), ''),
    star_count = p_star_count
  where schedules.id = p_schedule_id
    and schedules.family_id = p_family_id
    and schedules.assigned_member_id = p_assigned_member_id
  returning schedules.* into updated_schedule;

  get diagnostics changed_count = row_count;
  if changed_count <> 1 then
    raise exception using
      errcode = '40001',
      message = 'academy schedule changed during update';
  end if;

  return updated_schedule;
end
$function$;

create or replace function public.delete_academy_schedule_for_assignee(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_schedule_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  locked_schedule public.academy_schedules%rowtype;
  changed_count integer;
begin
  perform 1
  from public.family_members members
  where members.id = p_actor_member_id
    and members.family_id = p_family_id
    and members.role = 'parent'
    and members.is_active = true;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'active parent member is required';
  end if;

  perform 1
  from public.family_members members
  where members.id = p_assigned_member_id
    and members.family_id = p_family_id
    and members.role = 'child'
    and members.is_active = true;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'active assigned child is required';
  end if;

  select schedules.*
  into locked_schedule
  from public.academy_schedules schedules
  where schedules.id = p_schedule_id
    and schedules.family_id = p_family_id
    and schedules.assigned_member_id = p_assigned_member_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'academy schedule was not found';
  end if;

  if exists (
    select 1
    from public.academy_completion_history completions
    where completions.academy_schedule_id = p_schedule_id
  ) then
    raise exception using
      errcode = 'P0003',
      message = 'completed academy schedule cannot be deleted';
  end if;

  delete from public.academy_schedules schedules
  where schedules.id = p_schedule_id
    and schedules.family_id = p_family_id
    and schedules.assigned_member_id = p_assigned_member_id;

  get diagnostics changed_count = row_count;
  if changed_count <> 1 then
    raise exception using
      errcode = '40001',
      message = 'academy schedule changed during deletion';
  end if;

  return p_schedule_id;
end
$function$;

create or replace function public.complete_academy_schedule_for_assignee(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_schedule_id uuid,
  p_completed_date date
)
returns public.academy_completion_history
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  locked_schedule public.academy_schedules%rowtype;
  completion public.academy_completion_history%rowtype;
begin
  if p_actor_member_id is distinct from p_assigned_member_id then
    raise exception using
      errcode = '42501',
      message = 'academy completion actor must be the assigned child';
  end if;

  perform 1
  from public.family_members members
  where members.id = p_actor_member_id
    and members.family_id = p_family_id
    and members.role = 'child'
    and members.is_active = true;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'active assigned child is required';
  end if;

  if p_completed_date is null then
    raise exception using
      errcode = '22023',
      message = 'academy completion date is required';
  end if;

  select schedules.*
  into locked_schedule
  from public.academy_schedules schedules
  where schedules.id = p_schedule_id
    and schedules.family_id = p_family_id
    and schedules.assigned_member_id = p_assigned_member_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'academy schedule was not found';
  end if;

  select *
  into completion
  from public.complete_academy_schedule(
    p_family_id,
    p_assigned_member_id,
    p_schedule_id,
    p_completed_date
  );

  if completion.family_id is distinct from p_family_id
     or completion.member_id is distinct from p_assigned_member_id
     or completion.academy_schedule_id is distinct from p_schedule_id then
    raise exception using
      errcode = 'P0001',
      message = 'academy completion ownership is inconsistent';
  end if;

  return completion;
end
$function$;

alter function public.create_academy_schedule_for_assignee(
  uuid, uuid, uuid, text, integer, time without time zone, text, integer
) owner to postgres;
alter function public.update_academy_schedule_for_assignee(
  uuid, uuid, uuid, uuid, text, integer, time without time zone, text, integer
) owner to postgres;
alter function public.delete_academy_schedule_for_assignee(
  uuid, uuid, uuid, uuid
) owner to postgres;
alter function public.complete_academy_schedule_for_assignee(
  uuid, uuid, uuid, uuid, date
) owner to postgres;

revoke all on function public.create_academy_schedule_for_assignee(
  uuid, uuid, uuid, text, integer, time without time zone, text, integer
) from public, anon, authenticated;
grant execute on function public.create_academy_schedule_for_assignee(
  uuid, uuid, uuid, text, integer, time without time zone, text, integer
) to service_role;

revoke all on function public.update_academy_schedule_for_assignee(
  uuid, uuid, uuid, uuid, text, integer, time without time zone, text, integer
) from public, anon, authenticated;
grant execute on function public.update_academy_schedule_for_assignee(
  uuid, uuid, uuid, uuid, text, integer, time without time zone, text, integer
) to service_role;

revoke all on function public.delete_academy_schedule_for_assignee(
  uuid, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.delete_academy_schedule_for_assignee(
  uuid, uuid, uuid, uuid
) to service_role;

revoke all on function public.complete_academy_schedule_for_assignee(
  uuid, uuid, uuid, uuid, date
) from public, anon, authenticated;
grant execute on function public.complete_academy_schedule_for_assignee(
  uuid, uuid, uuid, uuid, date
) to service_role;

notify pgrst, 'reload schema';

commit;
