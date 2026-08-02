-- Phase B-2: atomic planned assignment creation and canonical pause enforcement.

begin;

do $preflight$
begin
  if to_regclass('public.learning_assignment_plans') is null
     or to_regclass('public.learning_assignment_stage_targets') is null
     or to_regclass('public.learning_assignment_plan_revisions') is null
     or to_regprocedure('public.create_learning_assignment(uuid,uuid,uuid,uuid)') is null
     or to_regprocedure('public.create_learning_assignment_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)') is null
     or to_regprocedure('public.is_learning_assignment_plan_paused(uuid)') is null then
    raise exception using errcode = 'P0001', message = 'Phase B-2 planning API prerequisites are missing';
  end if;

  if to_regprocedure('public.create_learning_assignment_with_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)') is not null
     or to_regprocedure('public.guard_learning_attempt_plan_pause()') is not null then
    raise exception using errcode = 'P0001', message = 'Phase B-2 planning API objects already exist';
  end if;
end
$preflight$;

create function public.create_learning_assignment_with_plan(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_content_version_id uuid,
  p_planned_start_date date,
  p_target_completion_date date,
  p_timezone_name text,
  p_stage_targets jsonb,
  p_request_id uuid
)
returns table (
  assignment_id uuid,
  unit_id uuid,
  content_version_id uuid,
  assigned_member_id uuid,
  first_stage_id uuid,
  stage_count integer,
  plan_id uuid,
  plan_revision integer,
  plan_state text,
  planned_start_date date,
  target_completion_date date,
  timezone_name text,
  paused_at timestamptz,
  stage_targets jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  prior_assignment public.learning_assignments%rowtype;
  prior_plan public.learning_assignment_plans%rowtype;
  prior_revision public.learning_assignment_plan_revisions%rowtype;
  created_assignment record;
  created_plan record;
  canonical_targets jsonb;
  first_stage uuid;
  expected_stage_count integer;
begin
  if p_request_id is null then
    raise exception using errcode = '22004', message = 'assignment plan request id is required';
  end if;

  select revision_row.*
  into prior_revision
  from public.learning_assignment_plan_revisions revision_row
  join public.learning_assignment_plans plan on plan.id = revision_row.plan_id
  where plan.family_id = p_family_id
    and plan.assigned_member_id = p_assigned_member_id
    and revision_row.request_id = p_request_id
  for update of plan;

  if found then
    select plan.* into strict prior_plan
    from public.learning_assignment_plans plan
    where plan.id = prior_revision.plan_id
    for update;

    select assignment.* into strict prior_assignment
    from public.learning_assignments assignment
    where assignment.id = prior_plan.assignment_id;

    canonical_targets := public.normalize_learning_assignment_plan_targets(
      prior_assignment.id,
      p_planned_start_date,
      p_target_completion_date,
      p_stage_targets
    );
    if prior_revision.operation <> 'create'
       or prior_assignment.content_version_id <> p_content_version_id
       or prior_revision.planned_start_date <> p_planned_start_date
       or prior_revision.target_completion_date <> p_target_completion_date
       or prior_revision.timezone_name <> p_timezone_name
       or prior_revision.stage_targets_snapshot <> canonical_targets then
      raise exception using errcode = '55000', message = 'IDEMPOTENCY_CONFLICT';
    end if;

    select stage.id into first_stage
    from public.learning_stages stage
    where stage.content_version_id = prior_assignment.content_version_id
    order by stage.display_order
    limit 1;
    select count(*)::integer into expected_stage_count
    from public.learning_stages stage
    where stage.content_version_id = prior_assignment.content_version_id;

    return query select
      prior_assignment.id, prior_assignment.unit_id, prior_assignment.content_version_id,
      prior_assignment.assigned_member_id, first_stage, expected_stage_count,
      prior_plan.id, prior_revision.revision, prior_revision.plan_state,
      prior_revision.planned_start_date, prior_revision.target_completion_date,
      prior_revision.timezone_name, prior_revision.paused_at,
      prior_revision.stage_targets_snapshot;
    return;
  end if;

  select * into strict created_assignment
  from public.create_learning_assignment(
    p_family_id,
    p_actor_member_id,
    p_assigned_member_id,
    p_content_version_id
  );

  select * into strict created_plan
  from public.create_learning_assignment_plan(
    p_family_id,
    p_actor_member_id,
    p_assigned_member_id,
    created_assignment.assignment_id,
    p_planned_start_date,
    p_target_completion_date,
    p_timezone_name,
    p_stage_targets,
    p_request_id
  );

  return query select
    created_assignment.assignment_id, created_assignment.unit_id,
    created_assignment.content_version_id, created_assignment.assigned_member_id,
    created_assignment.first_stage_id, created_assignment.stage_count,
    created_plan.plan_id, created_plan.plan_revision, created_plan.plan_state,
    created_plan.planned_start_date, created_plan.target_completion_date,
    created_plan.timezone_name, created_plan.paused_at, created_plan.stage_targets;
end
$function$;

create function public.guard_learning_attempt_plan_pause()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if public.is_learning_assignment_plan_paused(new.assignment_id) then
    raise exception using errcode = '55000', message = 'LEARNING_PLAN_PAUSED';
  end if;
  return new;
end
$function$;

create trigger learning_attempts_guard_plan_pause
before insert on public.learning_attempts
for each row execute function public.guard_learning_attempt_plan_pause();

alter function public.create_learning_assignment_with_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid) owner to postgres;
alter function public.guard_learning_attempt_plan_pause() owner to postgres;

revoke all on function public.create_learning_assignment_with_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.guard_learning_attempt_plan_pause()
  from public, anon, authenticated, service_role;
grant execute on function public.create_learning_assignment_with_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)
  to service_role;

commit;
