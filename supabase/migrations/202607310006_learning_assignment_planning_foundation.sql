-- Phase B-1: optional assignment plans, stage targets, and immutable revisions.
-- Existing assignments remain valid without a plan. Attempt start integration is deferred.

begin;

do $preflight$
begin
  if to_regclass('public.learning_assignments') is null
     or to_regclass('public.learning_stages') is null
     or to_regclass('public.learning_stage_first_passes') is null
     or to_regclass('public.family_members') is null then
    raise exception using
      errcode = 'P0001',
      message = 'Phase B-1 planning prerequisites are missing';
  end if;

  if to_regclass('public.learning_assignment_plans') is not null
     or to_regclass('public.learning_assignment_stage_targets') is not null
     or to_regclass('public.learning_assignment_plan_revisions') is not null
     or to_regprocedure('public.create_learning_assignment_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)') is not null
     or to_regprocedure('public.update_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,date,date,text,jsonb,uuid)') is not null
     or to_regprocedure('public.pause_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)') is not null
     or to_regprocedure('public.resume_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)') is not null then
    raise exception using
      errcode = 'P0001',
      message = 'Phase B-1 planning target objects already exist';
  end if;
end
$preflight$;

create table public.learning_assignment_plans (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  family_id uuid not null,
  assigned_member_id uuid not null,
  content_version_id uuid not null,
  planned_start_date date not null,
  target_completion_date date not null,
  timezone_name text not null default 'Asia/Seoul',
  plan_state text not null default 'active',
  paused_at timestamptz,
  configured_by_member_id uuid not null,
  create_request_id uuid not null,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_assignment_plans_assignment_key unique (assignment_id),
  constraint learning_assignment_plans_id_assignment_key unique (id, assignment_id),
  constraint learning_assignment_plans_request_key
    unique (family_id, assigned_member_id, create_request_id),
  constraint learning_assignment_plans_assignment_scope_fk
    foreign key (assignment_id, family_id, assigned_member_id, content_version_id)
    references public.learning_assignments(
      id, family_id, assigned_member_id, content_version_id
    ) on delete restrict,
  constraint learning_assignment_plans_configured_by_fk
    foreign key (family_id, configured_by_member_id)
    references public.family_members(family_id, id) on delete restrict,
  constraint learning_assignment_plans_date_check
    check (planned_start_date <= target_completion_date),
  constraint learning_assignment_plans_timezone_check
    check (btrim(timezone_name) = timezone_name and char_length(timezone_name) between 1 and 100),
  constraint learning_assignment_plans_state_check
    check (plan_state in ('active', 'paused')),
  constraint learning_assignment_plans_pause_check
    check (
      (plan_state = 'active' and paused_at is null)
      or (plan_state = 'paused' and paused_at is not null)
    ),
  constraint learning_assignment_plans_revision_check check (revision >= 1),
  constraint learning_assignment_plans_timestamp_check check (created_at <= updated_at)
);

create index learning_assignment_plans_family_member_state_idx
  on public.learning_assignment_plans (
    family_id, assigned_member_id, plan_state, target_completion_date
  );

create table public.learning_assignment_stage_targets (
  plan_id uuid not null,
  assignment_id uuid not null,
  stage_id uuid not null,
  display_order integer not null,
  target_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_assignment_stage_targets_pkey primary key (plan_id, stage_id),
  constraint learning_assignment_stage_targets_assignment_order_key
    unique (assignment_id, display_order),
  constraint learning_assignment_stage_targets_plan_assignment_fk
    foreign key (plan_id, assignment_id)
    references public.learning_assignment_plans(id, assignment_id)
    on delete restrict,
  constraint learning_assignment_stage_targets_stage_fk
    foreign key (stage_id) references public.learning_stages(id) on delete restrict,
  constraint learning_assignment_stage_targets_order_check check (display_order > 0),
  constraint learning_assignment_stage_targets_timestamp_check check (created_at <= updated_at)
);

create index learning_assignment_stage_targets_assignment_date_idx
  on public.learning_assignment_stage_targets (assignment_id, target_date, display_order);

create table public.learning_assignment_plan_revisions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  revision integer not null,
  operation text not null,
  changed_by_member_id uuid not null,
  planned_start_date date not null,
  target_completion_date date not null,
  timezone_name text not null,
  plan_state text not null,
  paused_at timestamptz,
  previous_snapshot jsonb,
  stage_targets_snapshot jsonb not null,
  request_id uuid not null,
  changed_at timestamptz not null default now(),
  constraint learning_assignment_plan_revisions_plan_revision_key
    unique (plan_id, revision),
  constraint learning_assignment_plan_revisions_plan_request_key
    unique (plan_id, request_id),
  constraint learning_assignment_plan_revisions_plan_fk
    foreign key (plan_id) references public.learning_assignment_plans(id) on delete restrict,
  constraint learning_assignment_plan_revisions_changed_by_fk
    foreign key (changed_by_member_id) references public.family_members(id) on delete restrict,
  constraint learning_assignment_plan_revisions_revision_check check (revision >= 1),
  constraint learning_assignment_plan_revisions_operation_check
    check (operation in ('create', 'update', 'pause', 'resume')),
  constraint learning_assignment_plan_revisions_date_check
    check (planned_start_date <= target_completion_date),
  constraint learning_assignment_plan_revisions_state_check
    check (plan_state in ('active', 'paused')),
  constraint learning_assignment_plan_revisions_pause_check
    check (
      (plan_state = 'active' and paused_at is null)
      or (plan_state = 'paused' and paused_at is not null)
    ),
  constraint learning_assignment_plan_revisions_previous_snapshot_check
    check (previous_snapshot is null or jsonb_typeof(previous_snapshot) = 'object'),
  constraint learning_assignment_plan_revisions_stage_snapshot_check
    check (jsonb_typeof(stage_targets_snapshot) = 'array')
);

create index learning_assignment_plan_revisions_plan_changed_idx
  on public.learning_assignment_plan_revisions (plan_id, changed_at desc);

create function public.guard_learning_assignment_plan_row()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'UPDATE' and (
    new.id,
    new.assignment_id,
    new.family_id,
    new.assigned_member_id,
    new.content_version_id,
    new.create_request_id,
    new.created_at
  ) is distinct from (
    old.id,
    old.assignment_id,
    old.family_id,
    old.assigned_member_id,
    old.content_version_id,
    old.create_request_id,
    old.created_at
  ) then
    raise exception using errcode = '55000', message = 'learning assignment plan identity is immutable';
  end if;

  if not exists (
    select 1
    from public.family_members actor
    where actor.id = new.configured_by_member_id
      and actor.family_id = new.family_id
      and actor.role = 'parent'
      and actor.is_active = true
  ) then
    raise exception using errcode = '42501', message = 'active parent member is required';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_timezone_names zone where zone.name = new.timezone_name
  ) then
    raise exception using errcode = '22023', message = 'invalid planning timezone';
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end
$function$;

create trigger learning_assignment_plans_guard_row
before insert or update on public.learning_assignment_plans
for each row execute function public.guard_learning_assignment_plan_row();

create function public.guard_learning_assignment_stage_target_row()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  target_plan public.learning_assignment_plans%rowtype;
begin
  if tg_op = 'UPDATE' and (
    new.plan_id,
    new.assignment_id,
    new.stage_id,
    new.display_order,
    new.created_at
  ) is distinct from (
    old.plan_id,
    old.assignment_id,
    old.stage_id,
    old.display_order,
    old.created_at
  ) then
    raise exception using errcode = '55000', message = 'learning stage target identity is immutable';
  end if;

  select plan.* into target_plan
  from public.learning_assignment_plans plan
  where plan.id = new.plan_id and plan.assignment_id = new.assignment_id;
  if not found then
    raise exception using errcode = '23503', message = 'learning assignment plan was not found';
  end if;

  if not exists (
    select 1 from public.learning_stages stage
    where stage.id = new.stage_id
      and stage.content_version_id = target_plan.content_version_id
      and stage.display_order = new.display_order
  ) then
    raise exception using errcode = '23514', message = 'stage target does not match assignment content';
  end if;

  if new.target_date < target_plan.planned_start_date
     or new.target_date > target_plan.target_completion_date then
    raise exception using errcode = '23514', message = 'stage target date is outside the plan range';
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end
$function$;

create trigger learning_assignment_stage_targets_guard_row
before insert or update on public.learning_assignment_stage_targets
for each row execute function public.guard_learning_assignment_stage_target_row();

create function public.validate_learning_assignment_plan_stage_targets()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  checked_plan_id uuid;
  target_plan public.learning_assignment_plans%rowtype;
  expected_count integer;
  observed_count integer;
begin
  if tg_table_name = 'learning_assignment_plans' then
    checked_plan_id := coalesce(new.id, old.id);
  else
    checked_plan_id := coalesce(new.plan_id, old.plan_id);
  end if;

  select plan.* into target_plan
  from public.learning_assignment_plans plan
  where plan.id = checked_plan_id;
  if not found then
    return null;
  end if;

  select count(*)::integer into expected_count
  from public.learning_stages stage
  where stage.content_version_id = target_plan.content_version_id;

  select count(*)::integer into observed_count
  from public.learning_assignment_stage_targets target
  where target.plan_id = target_plan.id;

  if expected_count < 1 or observed_count <> expected_count
     or exists (
       select 1
       from public.learning_stages stage
       left join public.learning_assignment_stage_targets target
         on target.plan_id = target_plan.id
        and target.stage_id = stage.id
        and target.display_order = stage.display_order
       where stage.content_version_id = target_plan.content_version_id
         and target.stage_id is null
     )
     or exists (
       select 1
       from (
         select target.target_date,
           lag(target.target_date) over (order by target.display_order) as previous_date
         from public.learning_assignment_stage_targets target
         where target.plan_id = target_plan.id
       ) ordered_target
       where ordered_target.previous_date > ordered_target.target_date
     ) then
    raise exception using errcode = '23514', message = 'learning stage target set is incomplete or unordered';
  end if;
  return null;
end
$function$;

create constraint trigger learning_assignment_plans_validate_targets
after insert or update of planned_start_date, target_completion_date
on public.learning_assignment_plans
deferrable initially deferred
for each row execute function public.validate_learning_assignment_plan_stage_targets();

create constraint trigger learning_assignment_stage_targets_validate_set
after insert or update or delete on public.learning_assignment_stage_targets
deferrable initially deferred
for each row execute function public.validate_learning_assignment_plan_stage_targets();

create function public.guard_learning_assignment_plan_revision_immutable()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  raise exception using errcode = '55000', message = 'learning assignment plan revisions are immutable';
end
$function$;

create trigger learning_assignment_plan_revisions_guard_change
before update or delete on public.learning_assignment_plan_revisions
for each row execute function public.guard_learning_assignment_plan_revision_immutable();

create function public.learning_assignment_plan_is_complete(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select coalesce((
    select assignment.status = 'completed'
      or assignment.completed_at is not null
      or (
        exists (
          select 1 from public.learning_stages stage
          where stage.content_version_id = assignment.content_version_id
        )
        and not exists (
          select 1
          from public.learning_stages stage
          where stage.content_version_id = assignment.content_version_id
            and not exists (
              select 1
              from public.learning_stage_first_passes first_pass
              where first_pass.assignment_id = assignment.id
                and first_pass.stage_id = stage.id
            )
        )
      )
    from public.learning_assignments assignment
    where assignment.id = p_assignment_id
  ), false)
$function$;

create function public.is_learning_assignment_plan_paused(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select coalesce((
    select plan.plan_state = 'paused'
    from public.learning_assignment_plans plan
    where plan.assignment_id = p_assignment_id
  ), false)
$function$;

create function public.normalize_learning_assignment_plan_targets(
  p_assignment_id uuid,
  p_planned_start_date date,
  p_target_completion_date date,
  p_stage_targets jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  target_assignment public.learning_assignments%rowtype;
  expected_count integer;
  canonical_targets jsonb;
begin
  if p_planned_start_date is null or p_target_completion_date is null
     or p_planned_start_date > p_target_completion_date then
    raise exception using errcode = '22023', message = 'invalid learning plan date range';
  end if;
  if p_stage_targets is null or jsonb_typeof(p_stage_targets) <> 'array' then
    raise exception using errcode = '22023', message = 'stage targets must be an array';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_stage_targets) element
    where jsonb_typeof(element) <> 'object'
      or not (element ?& array['stage_id', 'display_order', 'target_date'])
      or (element - array['stage_id', 'display_order', 'target_date']) <> '{}'::jsonb
      or jsonb_typeof(element->'stage_id') <> 'string'
      or jsonb_typeof(element->'display_order') <> 'number'
      or jsonb_typeof(element->'target_date') <> 'string'
      or (element->>'target_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ) then
    raise exception using errcode = '22023', message = 'stage target shape is invalid';
  end if;

  select assignment.* into target_assignment
  from public.learning_assignments assignment
  where assignment.id = p_assignment_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'learning assignment was not found';
  end if;

  select count(*)::integer into expected_count
  from public.learning_stages stage
  where stage.content_version_id = target_assignment.content_version_id;

  if expected_count < 1 or jsonb_array_length(p_stage_targets) <> expected_count then
    raise exception using errcode = '23514', message = 'every assignment stage requires one target';
  end if;

  begin
    with input_target as (
      select input.stage_id, input.display_order, input.target_date
      from jsonb_to_recordset(p_stage_targets)
        as input(stage_id uuid, display_order integer, target_date date)
    )
    select jsonb_agg(
      jsonb_build_object(
        'stage_id', input.stage_id,
        'display_order', input.display_order,
        'target_date', to_char(input.target_date, 'YYYY-MM-DD')
      ) order by input.display_order
    ) into canonical_targets
    from input_target input;
  exception
    when invalid_text_representation or datetime_field_overflow then
      raise exception using errcode = '22023', message = 'stage target value is invalid';
  end;

  if (select count(distinct element->>'stage_id') from jsonb_array_elements(canonical_targets) element) <> expected_count
     or (select count(distinct (element->>'display_order')::integer) from jsonb_array_elements(canonical_targets) element) <> expected_count
     or exists (
       select 1
       from jsonb_to_recordset(canonical_targets)
         as input(stage_id uuid, display_order integer, target_date date)
       left join public.learning_stages stage
         on stage.id = input.stage_id
        and stage.content_version_id = target_assignment.content_version_id
        and stage.display_order = input.display_order
       where stage.id is null
          or input.target_date < p_planned_start_date
          or input.target_date > p_target_completion_date
     )
     or exists (
       select 1 from (
         select input.target_date,
           lag(input.target_date) over (order by input.display_order) previous_date
         from jsonb_to_recordset(canonical_targets)
           as input(stage_id uuid, display_order integer, target_date date)
       ) ordered_target
       where ordered_target.previous_date > ordered_target.target_date
     ) then
    raise exception using errcode = '23514', message = 'stage targets do not match assignment stages or dates';
  end if;

  return canonical_targets;
end
$function$;

create function public.learning_assignment_plan_snapshot(
  p_planned_start_date date,
  p_target_completion_date date,
  p_timezone_name text,
  p_plan_state text,
  p_paused_at timestamptz,
  p_stage_targets jsonb
)
returns jsonb
language sql
immutable
set search_path = pg_catalog, public
as $function$
  select jsonb_build_object(
    'planned_start_date', to_char(p_planned_start_date, 'YYYY-MM-DD'),
    'target_completion_date', to_char(p_target_completion_date, 'YYYY-MM-DD'),
    'timezone_name', p_timezone_name,
    'plan_state', p_plan_state,
    'paused_at', p_paused_at,
    'stage_targets', p_stage_targets
  )
$function$;

create function public.create_learning_assignment_plan(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_assignment_id uuid,
  p_planned_start_date date,
  p_target_completion_date date,
  p_timezone_name text,
  p_stage_targets jsonb,
  p_request_id uuid
)
returns table (
  plan_id uuid,
  assignment_id uuid,
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
  target_assignment public.learning_assignments%rowtype;
  created_plan public.learning_assignment_plans%rowtype;
  prior_revision public.learning_assignment_plan_revisions%rowtype;
  canonical_targets jsonb;
begin
  if p_request_id is null then
    raise exception using errcode = '22004', message = 'plan request id is required';
  end if;
  if not exists (
    select 1 from public.family_members actor
    where actor.id = p_actor_member_id and actor.family_id = p_family_id
      and actor.role = 'parent' and actor.is_active = true
    for update
  ) then
    raise exception using errcode = '42501', message = 'active parent member is required';
  end if;
  if not exists (
    select 1 from public.family_members child
    where child.id = p_assigned_member_id and child.family_id = p_family_id
      and child.role = 'child' and child.is_active = true
    for update
  ) then
    raise exception using errcode = '42501', message = 'active assigned child is required';
  end if;
  if p_timezone_name is null or not exists (
    select 1 from pg_catalog.pg_timezone_names zone where zone.name = p_timezone_name
  ) then
    raise exception using errcode = '22023', message = 'invalid planning timezone';
  end if;

  select assignment.* into target_assignment
  from public.learning_assignments assignment
  where assignment.id = p_assignment_id
    and assignment.family_id = p_family_id
    and assignment.assigned_member_id = p_assigned_member_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'learning assignment was not found';
  end if;
  if target_assignment.status <> 'active' or target_assignment.completed_at is not null then
    raise exception using errcode = '55000', message = 'active learning assignment is required';
  end if;
  if public.learning_assignment_plan_is_complete(target_assignment.id) then
    raise exception using errcode = '55000', message = 'PLAN_LOCKED_AFTER_COMPLETION';
  end if;

  canonical_targets := public.normalize_learning_assignment_plan_targets(
    target_assignment.id, p_planned_start_date, p_target_completion_date, p_stage_targets
  );

  select revision_row.* into prior_revision
  from public.learning_assignment_plan_revisions revision_row
  join public.learning_assignment_plans plan on plan.id = revision_row.plan_id
  where plan.family_id = p_family_id
    and plan.assigned_member_id = p_assigned_member_id
    and revision_row.request_id = p_request_id
  for update of plan;
  if found then
    if prior_revision.operation <> 'create'
       or prior_revision.planned_start_date <> p_planned_start_date
       or prior_revision.target_completion_date <> p_target_completion_date
       or prior_revision.timezone_name <> p_timezone_name
       or prior_revision.stage_targets_snapshot <> canonical_targets then
      raise exception using errcode = '55000', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return query select prior_revision.plan_id, p_assignment_id, prior_revision.revision,
      prior_revision.plan_state, prior_revision.planned_start_date,
      prior_revision.target_completion_date, prior_revision.timezone_name,
      prior_revision.paused_at, prior_revision.stage_targets_snapshot;
    return;
  end if;

  begin
    insert into public.learning_assignment_plans (
      assignment_id, family_id, assigned_member_id, content_version_id,
      planned_start_date, target_completion_date, timezone_name, plan_state,
      paused_at, configured_by_member_id, create_request_id, revision
    ) values (
      target_assignment.id, target_assignment.family_id,
      target_assignment.assigned_member_id, target_assignment.content_version_id,
      p_planned_start_date, p_target_completion_date, p_timezone_name, 'active',
      null, p_actor_member_id, p_request_id, 1
    ) returning * into created_plan;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'learning assignment already has a plan';
  end;

  insert into public.learning_assignment_stage_targets (
    plan_id, assignment_id, stage_id, display_order, target_date
  )
  select created_plan.id, created_plan.assignment_id,
    input.stage_id, input.display_order, input.target_date
  from jsonb_to_recordset(canonical_targets)
    as input(stage_id uuid, display_order integer, target_date date);

  insert into public.learning_assignment_plan_revisions (
    plan_id, revision, operation, changed_by_member_id,
    planned_start_date, target_completion_date, timezone_name, plan_state,
    paused_at, previous_snapshot, stage_targets_snapshot, request_id
  ) values (
    created_plan.id, 1, 'create', p_actor_member_id,
    created_plan.planned_start_date, created_plan.target_completion_date,
    created_plan.timezone_name, created_plan.plan_state, created_plan.paused_at,
    null, canonical_targets, p_request_id
  );

  return query select created_plan.id, created_plan.assignment_id, 1,
    created_plan.plan_state, created_plan.planned_start_date,
    created_plan.target_completion_date, created_plan.timezone_name,
    created_plan.paused_at, canonical_targets;
end
$function$;

create function public.update_learning_assignment_plan(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_plan_id uuid,
  p_expected_revision integer,
  p_planned_start_date date,
  p_target_completion_date date,
  p_timezone_name text,
  p_stage_targets jsonb,
  p_request_id uuid
)
returns table (
  plan_id uuid,
  assignment_id uuid,
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
  target_plan public.learning_assignment_plans%rowtype;
  target_assignment public.learning_assignments%rowtype;
  prior_revision public.learning_assignment_plan_revisions%rowtype;
  canonical_targets jsonb;
  previous_targets jsonb;
  previous_snapshot jsonb;
  next_revision integer;
begin
  if p_request_id is null or p_expected_revision is null then
    raise exception using errcode = '22004', message = 'request id and expected revision are required';
  end if;
  if not exists (
    select 1 from public.family_members actor
    where actor.id = p_actor_member_id and actor.family_id = p_family_id
      and actor.role = 'parent' and actor.is_active = true
    for update
  ) or not exists (
    select 1 from public.family_members child
    where child.id = p_assigned_member_id and child.family_id = p_family_id
      and child.role = 'child' and child.is_active = true
    for update
  ) then
    raise exception using errcode = '42501', message = 'active parent and child scope is required';
  end if;
  if p_timezone_name is null or not exists (
    select 1 from pg_catalog.pg_timezone_names zone where zone.name = p_timezone_name
  ) then
    raise exception using errcode = '22023', message = 'invalid planning timezone';
  end if;

  select plan.* into target_plan
  from public.learning_assignment_plans plan
  where plan.id = p_plan_id and plan.family_id = p_family_id
    and plan.assigned_member_id = p_assigned_member_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'learning assignment plan was not found';
  end if;
  select assignment.* into target_assignment
  from public.learning_assignments assignment
  where assignment.id = target_plan.assignment_id
  for update;
  if target_assignment.status = 'completed' or target_assignment.completed_at is not null
     or public.learning_assignment_plan_is_complete(target_assignment.id) then
    raise exception using errcode = '55000', message = 'PLAN_LOCKED_AFTER_COMPLETION';
  end if;
  if target_assignment.status <> 'active' then
    raise exception using errcode = '55000', message = 'active learning assignment is required';
  end if;

  canonical_targets := public.normalize_learning_assignment_plan_targets(
    target_plan.assignment_id, p_planned_start_date,
    p_target_completion_date, p_stage_targets
  );
  select revision_row.* into prior_revision
  from public.learning_assignment_plan_revisions revision_row
  where revision_row.plan_id = target_plan.id and revision_row.request_id = p_request_id;
  if found then
    if prior_revision.operation <> 'update'
       or prior_revision.planned_start_date <> p_planned_start_date
       or prior_revision.target_completion_date <> p_target_completion_date
       or prior_revision.timezone_name <> p_timezone_name
       or prior_revision.stage_targets_snapshot <> canonical_targets then
      raise exception using errcode = '55000', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return query select target_plan.id, target_plan.assignment_id, prior_revision.revision,
      prior_revision.plan_state, prior_revision.planned_start_date,
      prior_revision.target_completion_date, prior_revision.timezone_name,
      prior_revision.paused_at, prior_revision.stage_targets_snapshot;
    return;
  end if;
  if target_plan.revision <> p_expected_revision then
    raise exception using errcode = '55000', message = 'PLAN_REVISION_CONFLICT';
  end if;

  select jsonb_agg(jsonb_build_object(
    'stage_id', target.stage_id,
    'display_order', target.display_order,
    'target_date', to_char(target.target_date, 'YYYY-MM-DD')
  ) order by target.display_order) into previous_targets
  from public.learning_assignment_stage_targets target
  where target.plan_id = target_plan.id;
  previous_snapshot := public.learning_assignment_plan_snapshot(
    target_plan.planned_start_date, target_plan.target_completion_date,
    target_plan.timezone_name, target_plan.plan_state, target_plan.paused_at,
    previous_targets
  );
  next_revision := target_plan.revision + 1;

  update public.learning_assignment_plans
  set planned_start_date = p_planned_start_date,
      target_completion_date = p_target_completion_date,
      timezone_name = p_timezone_name,
      configured_by_member_id = p_actor_member_id,
      revision = next_revision
  where id = target_plan.id;

  update public.learning_assignment_stage_targets target
  set target_date = input.target_date
  from jsonb_to_recordset(canonical_targets)
    as input(stage_id uuid, display_order integer, target_date date)
  where target.plan_id = target_plan.id
    and target.stage_id = input.stage_id
    and target.display_order = input.display_order;

  insert into public.learning_assignment_plan_revisions (
    plan_id, revision, operation, changed_by_member_id,
    planned_start_date, target_completion_date, timezone_name, plan_state,
    paused_at, previous_snapshot, stage_targets_snapshot, request_id
  ) values (
    target_plan.id, next_revision, 'update', p_actor_member_id,
    p_planned_start_date, p_target_completion_date, p_timezone_name,
    target_plan.plan_state, target_plan.paused_at, previous_snapshot,
    canonical_targets, p_request_id
  );

  return query select target_plan.id, target_plan.assignment_id, next_revision,
    target_plan.plan_state, p_planned_start_date, p_target_completion_date,
    p_timezone_name, target_plan.paused_at, canonical_targets;
end
$function$;

create function public.set_learning_assignment_plan_state(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_plan_id uuid,
  p_expected_revision integer,
  p_request_id uuid,
  p_target_state text
)
returns table (
  plan_id uuid,
  assignment_id uuid,
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
  target_plan public.learning_assignment_plans%rowtype;
  target_assignment public.learning_assignments%rowtype;
  prior_revision public.learning_assignment_plan_revisions%rowtype;
  canonical_targets jsonb;
  previous_snapshot jsonb;
  next_revision integer;
  next_paused_at timestamptz;
  requested_operation text;
begin
  if p_request_id is null or p_expected_revision is null then
    raise exception using errcode = '22004', message = 'request id and expected revision are required';
  end if;
  if p_target_state not in ('active', 'paused') then
    raise exception using errcode = '22023', message = 'invalid learning plan state';
  end if;
  requested_operation := case p_target_state when 'paused' then 'pause' else 'resume' end;
  if not exists (
    select 1 from public.family_members actor
    where actor.id = p_actor_member_id and actor.family_id = p_family_id
      and actor.role = 'parent' and actor.is_active = true
    for update
  ) or not exists (
    select 1 from public.family_members child
    where child.id = p_assigned_member_id and child.family_id = p_family_id
      and child.role = 'child' and child.is_active = true
    for update
  ) then
    raise exception using errcode = '42501', message = 'active parent and child scope is required';
  end if;

  select plan.* into target_plan
  from public.learning_assignment_plans plan
  where plan.id = p_plan_id and plan.family_id = p_family_id
    and plan.assigned_member_id = p_assigned_member_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'learning assignment plan was not found';
  end if;
  select assignment.* into target_assignment
  from public.learning_assignments assignment
  where assignment.id = target_plan.assignment_id
  for update;
  if target_assignment.status = 'completed' or target_assignment.completed_at is not null
     or public.learning_assignment_plan_is_complete(target_assignment.id) then
    raise exception using errcode = '55000', message = 'PLAN_LOCKED_AFTER_COMPLETION';
  end if;
  if target_assignment.status <> 'active' then
    raise exception using errcode = '55000', message = 'active learning assignment is required';
  end if;

  select revision_row.* into prior_revision
  from public.learning_assignment_plan_revisions revision_row
  where revision_row.plan_id = target_plan.id and revision_row.request_id = p_request_id;
  if found then
    if prior_revision.operation <> requested_operation
       or prior_revision.plan_state <> p_target_state then
      raise exception using errcode = '55000', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return query select target_plan.id, target_plan.assignment_id, prior_revision.revision,
      prior_revision.plan_state, prior_revision.planned_start_date,
      prior_revision.target_completion_date, prior_revision.timezone_name,
      prior_revision.paused_at, prior_revision.stage_targets_snapshot;
    return;
  end if;
  if target_plan.revision <> p_expected_revision then
    raise exception using errcode = '55000', message = 'PLAN_REVISION_CONFLICT';
  end if;

  select jsonb_agg(jsonb_build_object(
    'stage_id', target.stage_id,
    'display_order', target.display_order,
    'target_date', to_char(target.target_date, 'YYYY-MM-DD')
  ) order by target.display_order) into canonical_targets
  from public.learning_assignment_stage_targets target
  where target.plan_id = target_plan.id;
  previous_snapshot := public.learning_assignment_plan_snapshot(
    target_plan.planned_start_date, target_plan.target_completion_date,
    target_plan.timezone_name, target_plan.plan_state, target_plan.paused_at,
    canonical_targets
  );
  next_revision := target_plan.revision + 1;
  next_paused_at := case p_target_state when 'paused' then coalesce(target_plan.paused_at, now()) else null end;

  update public.learning_assignment_plans
  set plan_state = p_target_state,
      paused_at = next_paused_at,
      configured_by_member_id = p_actor_member_id,
      revision = next_revision
  where id = target_plan.id;

  insert into public.learning_assignment_plan_revisions (
    plan_id, revision, operation, changed_by_member_id,
    planned_start_date, target_completion_date, timezone_name, plan_state,
    paused_at, previous_snapshot, stage_targets_snapshot, request_id
  ) values (
    target_plan.id, next_revision, requested_operation, p_actor_member_id,
    target_plan.planned_start_date, target_plan.target_completion_date,
    target_plan.timezone_name, p_target_state, next_paused_at,
    previous_snapshot, canonical_targets, p_request_id
  );

  return query select target_plan.id, target_plan.assignment_id, next_revision,
    p_target_state, target_plan.planned_start_date,
    target_plan.target_completion_date, target_plan.timezone_name,
    next_paused_at, canonical_targets;
end
$function$;

create function public.pause_learning_assignment_plan(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_plan_id uuid,
  p_expected_revision integer,
  p_request_id uuid
)
returns table (
  plan_id uuid, assignment_id uuid, plan_revision integer, plan_state text,
  planned_start_date date, target_completion_date date, timezone_name text,
  paused_at timestamptz, stage_targets jsonb
)
language sql
security definer
set search_path = pg_catalog, public
as $function$
  select * from public.set_learning_assignment_plan_state(
    p_family_id, p_actor_member_id, p_assigned_member_id, p_plan_id,
    p_expected_revision, p_request_id, 'paused'
  )
$function$;

create function public.resume_learning_assignment_plan(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_plan_id uuid,
  p_expected_revision integer,
  p_request_id uuid
)
returns table (
  plan_id uuid, assignment_id uuid, plan_revision integer, plan_state text,
  planned_start_date date, target_completion_date date, timezone_name text,
  paused_at timestamptz, stage_targets jsonb
)
language sql
security definer
set search_path = pg_catalog, public
as $function$
  select * from public.set_learning_assignment_plan_state(
    p_family_id, p_actor_member_id, p_assigned_member_id, p_plan_id,
    p_expected_revision, p_request_id, 'active'
  )
$function$;

alter table public.learning_assignment_plans enable row level security;
alter table public.learning_assignment_plans force row level security;
alter table public.learning_assignment_stage_targets enable row level security;
alter table public.learning_assignment_stage_targets force row level security;
alter table public.learning_assignment_plan_revisions enable row level security;
alter table public.learning_assignment_plan_revisions force row level security;

alter function public.guard_learning_assignment_plan_row() owner to postgres;
alter function public.guard_learning_assignment_stage_target_row() owner to postgres;
alter function public.validate_learning_assignment_plan_stage_targets() owner to postgres;
alter function public.guard_learning_assignment_plan_revision_immutable() owner to postgres;
alter function public.learning_assignment_plan_is_complete(uuid) owner to postgres;
alter function public.is_learning_assignment_plan_paused(uuid) owner to postgres;
alter function public.normalize_learning_assignment_plan_targets(uuid,date,date,jsonb) owner to postgres;
alter function public.learning_assignment_plan_snapshot(date,date,text,text,timestamptz,jsonb) owner to postgres;
alter function public.create_learning_assignment_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid) owner to postgres;
alter function public.update_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,date,date,text,jsonb,uuid) owner to postgres;
alter function public.set_learning_assignment_plan_state(uuid,uuid,uuid,uuid,integer,uuid,text) owner to postgres;
alter function public.pause_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid) owner to postgres;
alter function public.resume_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid) owner to postgres;

revoke all privileges on table public.learning_assignment_plans,
  public.learning_assignment_stage_targets,
  public.learning_assignment_plan_revisions
  from public, anon, authenticated, service_role;
grant select on table public.learning_assignment_plans,
  public.learning_assignment_stage_targets,
  public.learning_assignment_plan_revisions
  to service_role;

revoke all on function public.guard_learning_assignment_plan_row()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_learning_assignment_stage_target_row()
  from public, anon, authenticated, service_role;
revoke all on function public.validate_learning_assignment_plan_stage_targets()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_learning_assignment_plan_revision_immutable()
  from public, anon, authenticated, service_role;
revoke all on function public.learning_assignment_plan_is_complete(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.is_learning_assignment_plan_paused(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.normalize_learning_assignment_plan_targets(uuid,date,date,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.learning_assignment_plan_snapshot(date,date,text,text,timestamptz,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.set_learning_assignment_plan_state(uuid,uuid,uuid,uuid,integer,uuid,text)
  from public, anon, authenticated, service_role;
revoke all on function public.create_learning_assignment_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.update_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,date,date,text,jsonb,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.pause_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.resume_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.create_learning_assignment_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)
  to service_role;
grant execute on function public.update_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,date,date,text,jsonb,uuid)
  to service_role;
grant execute on function public.pause_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)
  to service_role;
grant execute on function public.resume_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)
  to service_role;

commit;
