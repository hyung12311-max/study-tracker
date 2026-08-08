begin;

do $guard$
begin
  if to_regclass('public.learning_assignments') is null
     or to_regclass('public.learning_attempts') is null
     or to_regclass('public.learning_attempt_questions') is null
     or to_regclass('public.learning_attempt_answers') is null
     or to_regclass('public.learning_skill_definitions') is null then
    raise exception using errcode = '55000', message = 'learning review schedule prerequisites are missing';
  end if;
  if to_regclass('public.learning_review_schedule_overrides') is not null
     or to_regclass('public.learning_review_schedule_events') is not null
     or to_regprocedure('public.set_learning_review_schedule_override(uuid,uuid,uuid,uuid,text,text,integer,uuid)') is not null then
    raise exception using errcode = '55000', message = 'learning review schedule objects already exist';
  end if;
end
$guard$;

create table public.learning_review_schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  assigned_member_id uuid not null,
  assignment_id uuid not null,
  content_version_id uuid not null,
  skill_code text not null,
  override_due_at timestamptz,
  duration_days integer,
  revision integer not null default 1,
  created_by_member_id uuid not null,
  updated_by_member_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint learning_review_schedule_overrides_scope_key
    unique (family_id, assigned_member_id, assignment_id, skill_code),
  constraint learning_review_schedule_overrides_full_scope_key
    unique (id, family_id, assigned_member_id, assignment_id, skill_code),
  constraint learning_review_schedule_overrides_assignment_fk
    foreign key (assignment_id, family_id, assigned_member_id, content_version_id)
    references public.learning_assignments(id, family_id, assigned_member_id, content_version_id)
    on delete restrict,
  constraint learning_review_schedule_overrides_skill_fk
    foreign key (skill_code) references public.learning_skill_definitions(skill_code) on delete restrict,
  constraint learning_review_schedule_overrides_created_by_fk
    foreign key (family_id, created_by_member_id)
    references public.family_members(family_id, id) on delete restrict,
  constraint learning_review_schedule_overrides_updated_by_fk
    foreign key (family_id, updated_by_member_id)
    references public.family_members(family_id, id) on delete restrict,
  constraint learning_review_schedule_overrides_value_check check (
    (override_due_at is null and duration_days is null)
    or (override_due_at is not null and duration_days in (1, 3, 7))
  ),
  constraint learning_review_schedule_overrides_revision_check check (revision >= 1),
  constraint learning_review_schedule_overrides_timestamp_check check (created_at <= updated_at)
);

create index learning_review_schedule_overrides_member_due_idx
  on public.learning_review_schedule_overrides
  (family_id, assigned_member_id, override_due_at, assignment_id, skill_code);

create table public.learning_review_schedule_events (
  id uuid primary key default gen_random_uuid(),
  override_id uuid not null,
  family_id uuid not null,
  assigned_member_id uuid not null,
  assignment_id uuid not null,
  skill_code text not null,
  event_type text not null,
  prior_due_at timestamptz,
  new_due_at timestamptz,
  duration_days integer,
  revision integer not null,
  actor_member_id uuid not null,
  request_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint learning_review_schedule_events_override_fk
    foreign key (override_id, family_id, assigned_member_id, assignment_id, skill_code)
    references public.learning_review_schedule_overrides(id, family_id, assigned_member_id, assignment_id, skill_code)
    on delete restrict,
  constraint learning_review_schedule_events_actor_fk
    foreign key (family_id, actor_member_id)
    references public.family_members(family_id, id) on delete restrict,
  constraint learning_review_schedule_events_actor_request_key
    unique (actor_member_id, request_id),
  constraint learning_review_schedule_events_override_revision_key
    unique (override_id, revision),
  constraint learning_review_schedule_events_type_check
    check (event_type in ('override_created', 'override_changed', 'override_cleared')),
  constraint learning_review_schedule_events_value_check check (
    (event_type = 'override_cleared' and new_due_at is null and duration_days is null)
    or (event_type in ('override_created', 'override_changed') and new_due_at is not null and duration_days in (1, 3, 7))
  ),
  constraint learning_review_schedule_events_revision_check check (revision >= 1)
);

create index learning_review_schedule_events_scope_created_idx
  on public.learning_review_schedule_events
  (family_id, assigned_member_id, assignment_id, skill_code, created_at desc);

create function public.guard_learning_review_schedule_override()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'learning review schedule overrides cannot be deleted';
  end if;
  if new.id <> old.id or new.family_id <> old.family_id
     or new.assigned_member_id <> old.assigned_member_id
     or new.assignment_id <> old.assignment_id
     or new.content_version_id <> old.content_version_id
     or new.skill_code <> old.skill_code
     or new.created_by_member_id <> old.created_by_member_id
     or new.created_at <> old.created_at
     or new.revision <> old.revision + 1
     or new.updated_at < old.updated_at then
    raise exception using errcode = '55000', message = 'learning review schedule override scope is immutable';
  end if;
  return new;
end
$function$;

create function public.guard_learning_review_schedule_event()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  raise exception using errcode = '55000', message = 'learning review schedule events are immutable';
end
$function$;

create trigger learning_review_schedule_overrides_guard
before update or delete on public.learning_review_schedule_overrides
for each row execute function public.guard_learning_review_schedule_override();

create trigger learning_review_schedule_events_immutable
before update or delete on public.learning_review_schedule_events
for each row execute function public.guard_learning_review_schedule_event();

create function public.set_learning_review_schedule_override(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_assignment_id uuid,
  p_skill_code text,
  p_action text,
  p_duration_days integer,
  p_request_id uuid
)
returns table (
  schedule_override_id uuid,
  schedule_assignment_id uuid,
  schedule_skill_code text,
  schedule_override_due_at timestamptz,
  schedule_duration_days integer,
  schedule_revision integer,
  schedule_operation text,
  schedule_changed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  target_assignment public.learning_assignments%rowtype;
  target_override public.learning_review_schedule_overrides%rowtype;
  prior_event public.learning_review_schedule_events%rowtype;
  saved_override public.learning_review_schedule_overrides%rowtype;
  next_due_at timestamptz;
  next_revision integer;
  operation text;
  event_created_at timestamptz;
begin
  if p_family_id is null or p_actor_member_id is null or p_assigned_member_id is null
     or p_assignment_id is null or p_skill_code is null or p_action is null
     or p_request_id is null then
    raise exception using errcode = '22004', message = 'review schedule fields are required';
  end if;
  if p_skill_code !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
     or char_length(p_skill_code) not between 1 and 100
     or p_action not in ('snooze', 'clear')
     or (p_action = 'snooze' and p_duration_days not in (1, 3, 7))
     or (p_action = 'clear' and p_duration_days is not null) then
    raise exception using errcode = '22023', message = 'invalid review schedule request';
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

  select assignment.* into target_assignment
  from public.learning_assignments assignment
  where assignment.id = p_assignment_id
    and assignment.family_id = p_family_id
    and assignment.assigned_member_id = p_assigned_member_id
    and assignment.status in ('active', 'completed')
  for update;
  if target_assignment.id is null then
    raise exception using errcode = 'P0002', message = 'review schedule assignment was not found';
  end if;
  if not exists (
    select 1
    from public.learning_attempts attempt
    join public.learning_attempt_questions question on question.attempt_id = attempt.id
    join public.learning_attempt_answers answer
      on answer.attempt_id = attempt.id
     and answer.attempt_question_id = question.id
     and answer.is_correct = false
    where attempt.family_id = p_family_id
      and attempt.assigned_member_id = p_assigned_member_id
      and attempt.assignment_id = p_assignment_id
      and attempt.content_version_id = target_assignment.content_version_id
      and attempt.status in ('passed', 'failed')
      and p_skill_code = any(question.skill_codes_snapshot)
  ) then
    raise exception using errcode = 'P0002', message = 'review schedule skill was not found';
  end if;

  select event.* into prior_event
  from public.learning_review_schedule_events event
  where event.actor_member_id = p_actor_member_id and event.request_id = p_request_id;
  if prior_event.id is not null then
    if prior_event.family_id <> p_family_id
       or prior_event.assigned_member_id <> p_assigned_member_id
       or prior_event.assignment_id <> p_assignment_id
       or prior_event.skill_code <> p_skill_code
       or (p_action = 'clear' and prior_event.event_type <> 'override_cleared')
       or (p_action = 'snooze' and prior_event.event_type not in ('override_created', 'override_changed'))
       or prior_event.duration_days is distinct from p_duration_days then
      raise exception using errcode = '55000', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return query select prior_event.override_id, prior_event.assignment_id,
      prior_event.skill_code, prior_event.new_due_at, prior_event.duration_days,
      prior_event.revision, prior_event.event_type, prior_event.created_at;
    return;
  end if;

  select schedule.* into target_override
  from public.learning_review_schedule_overrides schedule
  where schedule.family_id = p_family_id
    and schedule.assigned_member_id = p_assigned_member_id
    and schedule.assignment_id = p_assignment_id
    and schedule.skill_code = p_skill_code
  for update;
  next_due_at := case when p_action = 'snooze'
    then statement_timestamp() + make_interval(days => p_duration_days)
    else null end;

  if target_override.id is null then
    next_revision := 1;
    operation := case when p_action = 'clear' then 'override_cleared' else 'override_created' end;
    insert into public.learning_review_schedule_overrides (
      family_id, assigned_member_id, assignment_id, content_version_id, skill_code,
      override_due_at, duration_days, revision, created_by_member_id, updated_by_member_id
    ) values (
      p_family_id, p_assigned_member_id, p_assignment_id, target_assignment.content_version_id,
      p_skill_code, next_due_at, p_duration_days, next_revision,
      p_actor_member_id, p_actor_member_id
    ) returning * into saved_override;
  else
    next_revision := target_override.revision + 1;
    operation := case when p_action = 'clear' then 'override_cleared'
      when target_override.override_due_at is null then 'override_created'
      else 'override_changed' end;
    update public.learning_review_schedule_overrides
    set override_due_at = next_due_at,
        duration_days = p_duration_days,
        revision = next_revision,
        updated_by_member_id = p_actor_member_id,
        updated_at = statement_timestamp()
    where id = target_override.id
    returning * into saved_override;
  end if;

  insert into public.learning_review_schedule_events (
    override_id, family_id, assigned_member_id, assignment_id, skill_code,
    event_type, prior_due_at, new_due_at, duration_days, revision,
    actor_member_id, request_id
  ) values (
    saved_override.id, p_family_id, p_assigned_member_id, p_assignment_id, p_skill_code,
    operation, target_override.override_due_at, saved_override.override_due_at,
    saved_override.duration_days, next_revision, p_actor_member_id, p_request_id
  ) returning created_at into event_created_at;

  return query select saved_override.id, saved_override.assignment_id,
    saved_override.skill_code, saved_override.override_due_at, saved_override.duration_days,
    saved_override.revision, operation, event_created_at;
end
$function$;

alter table public.learning_review_schedule_overrides enable row level security;
alter table public.learning_review_schedule_overrides force row level security;
alter table public.learning_review_schedule_events enable row level security;
alter table public.learning_review_schedule_events force row level security;

alter function public.guard_learning_review_schedule_override() owner to postgres;
alter function public.guard_learning_review_schedule_event() owner to postgres;
alter function public.set_learning_review_schedule_override(uuid,uuid,uuid,uuid,text,text,integer,uuid) owner to postgres;

revoke all privileges on table public.learning_review_schedule_overrides,
  public.learning_review_schedule_events from public, anon, authenticated, service_role;
grant select on table public.learning_review_schedule_overrides,
  public.learning_review_schedule_events to service_role;

revoke all on function public.guard_learning_review_schedule_override()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_learning_review_schedule_event()
  from public, anon, authenticated, service_role;
revoke all on function public.set_learning_review_schedule_override(uuid,uuid,uuid,uuid,text,text,integer,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.set_learning_review_schedule_override(uuid,uuid,uuid,uuid,text,text,integer,uuid)
  to service_role;

commit;
