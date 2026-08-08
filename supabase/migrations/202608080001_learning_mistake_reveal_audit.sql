begin;

do $preflight$
begin
  if to_regclass('public.learning_assignments') is null
     or to_regclass('public.learning_attempts') is null
     or to_regclass('public.learning_attempt_questions') is null
     or to_regclass('public.learning_attempt_answers') is null then
    raise exception using errcode = 'P0001', message = 'Phase D reveal prerequisites are missing';
  end if;
end
$preflight$;

create table public.learning_mistake_reveal_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  actor_member_id uuid not null,
  assigned_member_id uuid not null,
  assignment_id uuid not null,
  content_version_id uuid not null,
  attempt_id uuid not null,
  stage_id uuid not null,
  attempt_question_id uuid not null,
  request_id uuid not null,
  event_type text not null default 'solution_revealed',
  revealed_at timestamptz not null default now(),
  constraint learning_mistake_reveal_events_actor_fk
    foreign key (family_id, actor_member_id)
    references public.family_members(family_id, id) on delete restrict,
  constraint learning_mistake_reveal_events_assignee_fk
    foreign key (family_id, assigned_member_id)
    references public.family_members(family_id, id) on delete restrict,
  constraint learning_mistake_reveal_events_assignment_fk
    foreign key (assignment_id, family_id, assigned_member_id, content_version_id)
    references public.learning_assignments(id, family_id, assigned_member_id, content_version_id)
    on delete restrict,
  constraint learning_mistake_reveal_events_attempt_fk
    foreign key (attempt_id, family_id, assigned_member_id, assignment_id, stage_id)
    references public.learning_attempts(id, family_id, assigned_member_id, assignment_id, stage_id)
    on delete restrict,
  constraint learning_mistake_reveal_events_question_fk
    foreign key (attempt_question_id, attempt_id)
    references public.learning_attempt_questions(id, attempt_id) on delete restrict,
  constraint learning_mistake_reveal_events_type_check
    check (event_type = 'solution_revealed'),
  constraint learning_mistake_reveal_events_actor_target_key
    unique (family_id, actor_member_id, assignment_id, attempt_question_id),
  constraint learning_mistake_reveal_events_actor_request_key
    unique (family_id, actor_member_id, request_id)
);

create index learning_mistake_reveal_events_assignment_question_idx
  on public.learning_mistake_reveal_events (
    family_id, assigned_member_id, assignment_id, attempt_question_id, revealed_at desc
  );

create function public.guard_learning_mistake_reveal_event()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  raise exception using errcode = '55000', message = 'learning mistake reveal events are immutable';
end
$function$;

create trigger learning_mistake_reveal_events_immutable
before update or delete on public.learning_mistake_reveal_events
for each row execute function public.guard_learning_mistake_reveal_event();

create function public.reveal_learning_mistake_solution(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assignment_id uuid,
  p_attempt_question_id uuid,
  p_request_id uuid
)
returns table (
  correct_answer text,
  explanation text,
  review_status text,
  revealed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  actor public.family_members%rowtype;
  target record;
  existing_request public.learning_mistake_reveal_events%rowtype;
  event_time timestamptz;
begin
  if p_family_id is null or p_actor_member_id is null or p_assignment_id is null
     or p_attempt_question_id is null or p_request_id is null then
    raise exception using errcode = '22004', message = 'reveal request fields are required';
  end if;

  select member.* into actor
  from public.family_members member
  where member.family_id = p_family_id
    and member.id = p_actor_member_id
    and member.is_active = true
    and member.role in ('parent', 'child')
  for update;
  if actor.id is null then
    raise exception using errcode = '42501', message = 'active family member is required';
  end if;

  select
    assignment.assigned_member_id,
    assignment.content_version_id,
    attempt.id as attempt_id,
    attempt.stage_id,
    question.correct_option_id,
    question.options_snapshot,
    question.explanation_snapshot
  into target
  from public.learning_assignments assignment
  join public.family_members assigned_member
    on assigned_member.family_id = assignment.family_id
   and assigned_member.id = assignment.assigned_member_id
   and assigned_member.role = 'child'
   and assigned_member.is_active = true
  join public.learning_attempts attempt
    on attempt.assignment_id = assignment.id
   and attempt.family_id = assignment.family_id
   and attempt.assigned_member_id = assignment.assigned_member_id
   and attempt.content_version_id = assignment.content_version_id
   and attempt.status in ('passed', 'failed')
  join public.learning_attempt_questions question
    on question.attempt_id = attempt.id
   and question.id = p_attempt_question_id
  join public.learning_attempt_answers answer
    on answer.attempt_id = attempt.id
   and answer.attempt_question_id = question.id
   and answer.is_correct = false
  where assignment.id = p_assignment_id
    and assignment.family_id = p_family_id
    and (actor.role = 'parent' or assignment.assigned_member_id = p_actor_member_id)
  limit 1;

  if target.attempt_id is null then
    raise exception using errcode = 'P0002', message = 'reviewable mistake was not found';
  end if;

  select event.* into existing_request
  from public.learning_mistake_reveal_events event
  where event.family_id = p_family_id
    and event.actor_member_id = p_actor_member_id
    and event.request_id = p_request_id;
  if existing_request.id is not null and (
    existing_request.assignment_id <> p_assignment_id
    or existing_request.attempt_question_id <> p_attempt_question_id
  ) then
    raise exception using errcode = '55000', message = 'IDEMPOTENCY_CONFLICT';
  end if;

  insert into public.learning_mistake_reveal_events (
    family_id, actor_member_id, assigned_member_id, assignment_id,
    content_version_id, attempt_id, stage_id, attempt_question_id, request_id
  ) values (
    p_family_id, p_actor_member_id, target.assigned_member_id, p_assignment_id,
    target.content_version_id, target.attempt_id, target.stage_id, p_attempt_question_id, p_request_id
  ) on conflict (family_id, actor_member_id, assignment_id, attempt_question_id) do nothing;

  select event.revealed_at into event_time
  from public.learning_mistake_reveal_events event
  where event.family_id = p_family_id
    and event.actor_member_id = p_actor_member_id
    and event.assignment_id = p_assignment_id
    and event.attempt_question_id = p_attempt_question_id;

  return query select
    coalesce((
      select option_row ->> 'text'
      from jsonb_array_elements(target.options_snapshot) option_row
      where option_row ->> 'id' = target.correct_option_id::text
      limit 1
    ), ''),
    target.explanation_snapshot,
    'reviewed'::text,
    event_time;
end
$function$;

alter function public.guard_learning_mistake_reveal_event() owner to postgres;
alter function public.reveal_learning_mistake_solution(uuid, uuid, uuid, uuid, uuid) owner to postgres;

alter table public.learning_mistake_reveal_events enable row level security;
alter table public.learning_mistake_reveal_events force row level security;

revoke all privileges on table public.learning_mistake_reveal_events
  from public, anon, authenticated, service_role;
grant select on table public.learning_mistake_reveal_events to service_role;

revoke all on function public.guard_learning_mistake_reveal_event()
  from public, anon, authenticated, service_role;
revoke all on function public.reveal_learning_mistake_solution(uuid, uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.reveal_learning_mistake_solution(uuid, uuid, uuid, uuid, uuid)
  to service_role;

commit;
