begin;

do $preflight$
begin
  if to_regclass('public.learning_assignments') is null
     or to_regclass('public.learning_attempts') is null
     or to_regclass('public.learning_attempt_questions') is null
     or to_regclass('public.learning_attempt_answers') is null
     or to_regclass('public.learning_mistake_reveal_events') is null
     or to_regprocedure('public.is_learning_assignment_plan_paused(uuid)') is null then
    raise exception using errcode = 'P0001', message = 'Phase E review prerequisites are missing';
  end if;

  if exists (
    select 1
    from (values
      ('learning_mistake_review_sessions'),
      ('learning_mistake_review_items'),
      ('learning_mistake_review_answers'),
      ('learning_mistake_review_events')
    ) target(table_name)
    where to_regclass('public.' || target.table_name) is not null
  ) or to_regprocedure(
    'public.start_learning_mistake_review(uuid,uuid,uuid,uuid,text,uuid,text,uuid)'
  ) is not null then
    raise exception using errcode = 'P0001', message = 'Phase E review target already exists';
  end if;
end
$preflight$;

create table public.learning_mistake_review_sessions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  assigned_member_id uuid not null,
  assignment_id uuid not null,
  content_version_id uuid not null,
  started_by_member_id uuid not null,
  status text not null default 'in_progress',
  filter_status text not null default 'all',
  filter_stage_id uuid,
  filter_skill_code text,
  request_id uuid not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  abandoned_at timestamptz,
  constraint learning_mistake_review_sessions_assignee_fk
    foreign key (family_id, assigned_member_id)
    references public.family_members(family_id, id) on delete restrict,
  constraint learning_mistake_review_sessions_actor_fk
    foreign key (family_id, started_by_member_id)
    references public.family_members(family_id, id) on delete restrict,
  constraint learning_mistake_review_sessions_assignment_fk
    foreign key (assignment_id, family_id, assigned_member_id, content_version_id)
    references public.learning_assignments(id, family_id, assigned_member_id, content_version_id)
    on delete restrict,
  constraint learning_mistake_review_sessions_stage_fk
    foreign key (filter_stage_id, content_version_id)
    references public.learning_stages(id, content_version_id) on delete restrict,
  constraint learning_mistake_review_sessions_scope_key
    unique (id, family_id, assigned_member_id, assignment_id, content_version_id),
  constraint learning_mistake_review_sessions_actor_request_key
    unique (family_id, started_by_member_id, request_id),
  constraint learning_mistake_review_sessions_status_check
    check (status in ('in_progress', 'completed', 'abandoned')),
  constraint learning_mistake_review_sessions_filter_status_check
    check (filter_status in ('all', 'unreviewed', 'reviewed')),
  constraint learning_mistake_review_sessions_skill_check
    check (
      filter_skill_code is null
      or (
        char_length(filter_skill_code) between 1 and 100
        and filter_skill_code ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
      )
    ),
  constraint learning_mistake_review_sessions_terminal_check
    check (
      (status = 'in_progress' and completed_at is null and abandoned_at is null)
      or (status = 'completed' and completed_at is not null and abandoned_at is null)
      or (status = 'abandoned' and completed_at is null and abandoned_at is not null)
    )
);

create unique index learning_mistake_review_sessions_active_uidx
  on public.learning_mistake_review_sessions (family_id, assigned_member_id, assignment_id)
  where status = 'in_progress';

create index learning_mistake_review_sessions_scope_status_idx
  on public.learning_mistake_review_sessions (
    family_id, assigned_member_id, assignment_id, status, started_at desc
  );

create table public.learning_mistake_review_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  source_attempt_id uuid not null,
  source_attempt_question_id uuid not null,
  source_answer_id uuid not null,
  display_order integer not null,
  created_at timestamptz not null default now(),
  constraint learning_mistake_review_items_session_fk
    foreign key (session_id)
    references public.learning_mistake_review_sessions(id) on delete restrict,
  constraint learning_mistake_review_items_attempt_fk
    foreign key (source_attempt_id)
    references public.learning_attempts(id) on delete restrict,
  constraint learning_mistake_review_items_question_fk
    foreign key (source_attempt_question_id, source_attempt_id)
    references public.learning_attempt_questions(id, attempt_id) on delete restrict,
  constraint learning_mistake_review_items_answer_fk
    foreign key (source_answer_id)
    references public.learning_attempt_answers(id) on delete restrict,
  constraint learning_mistake_review_items_session_answer_key
    unique (session_id, source_answer_id),
  constraint learning_mistake_review_items_session_order_key
    unique (session_id, display_order),
  constraint learning_mistake_review_items_id_session_key
    unique (id, session_id),
  constraint learning_mistake_review_items_order_check check (display_order > 0)
);

create index learning_mistake_review_items_session_order_idx
  on public.learning_mistake_review_items (session_id, display_order);

create table public.learning_mistake_review_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  review_item_id uuid not null,
  selected_option_id uuid not null,
  is_correct boolean not null,
  client_request_id uuid not null,
  submitted_at timestamptz not null default now(),
  constraint learning_mistake_review_answers_item_session_fk
    foreign key (review_item_id, session_id)
    references public.learning_mistake_review_items(id, session_id) on delete restrict,
  constraint learning_mistake_review_answers_item_key unique (review_item_id),
  constraint learning_mistake_review_answers_request_key unique (session_id, client_request_id)
);

create index learning_mistake_review_answers_session_submitted_idx
  on public.learning_mistake_review_answers (session_id, submitted_at);

create table public.learning_mistake_review_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  review_item_id uuid,
  actor_member_id uuid not null,
  event_type text not null,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint learning_mistake_review_events_session_fk
    foreign key (session_id)
    references public.learning_mistake_review_sessions(id) on delete restrict,
  constraint learning_mistake_review_events_item_session_fk
    foreign key (review_item_id, session_id)
    references public.learning_mistake_review_items(id, session_id) on delete restrict,
  constraint learning_mistake_review_events_actor_fk
    foreign key (actor_member_id)
    references public.family_members(id) on delete restrict,
  constraint learning_mistake_review_events_request_key unique (session_id, request_id),
  constraint learning_mistake_review_events_type_check check (event_type = 'solution_revealed')
);

create index learning_mistake_review_events_session_created_idx
  on public.learning_mistake_review_events (session_id, created_at);

create function public.guard_learning_mistake_review_session()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'learning mistake review sessions cannot be deleted';
  end if;
  if old.family_id <> new.family_id
     or old.assigned_member_id <> new.assigned_member_id
     or old.assignment_id <> new.assignment_id
     or old.content_version_id <> new.content_version_id
     or old.started_by_member_id <> new.started_by_member_id
     or old.filter_status <> new.filter_status
     or old.filter_stage_id is distinct from new.filter_stage_id
     or old.filter_skill_code is distinct from new.filter_skill_code
     or old.request_id <> new.request_id
     or old.started_at <> new.started_at then
    raise exception using errcode = '55000', message = 'learning mistake review session scope is immutable';
  end if;
  if old.status <> 'in_progress' or new.status not in ('completed', 'abandoned') then
    raise exception using errcode = '55000', message = 'invalid learning mistake review session transition';
  end if;
  return new;
end
$function$;

create trigger learning_mistake_review_sessions_guard
before update or delete on public.learning_mistake_review_sessions
for each row execute function public.guard_learning_mistake_review_session();

create function public.guard_learning_mistake_review_immutable()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  raise exception using errcode = '55000', message = 'learning mistake review records are immutable';
end
$function$;

create trigger learning_mistake_review_items_immutable
before update or delete on public.learning_mistake_review_items
for each row execute function public.guard_learning_mistake_review_immutable();

create trigger learning_mistake_review_answers_immutable
before update or delete on public.learning_mistake_review_answers
for each row execute function public.guard_learning_mistake_review_immutable();

create trigger learning_mistake_review_events_immutable
before update or delete on public.learning_mistake_review_events
for each row execute function public.guard_learning_mistake_review_immutable();

create function public.start_learning_mistake_review(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_assignment_id uuid,
  p_status_filter text,
  p_stage_id uuid,
  p_skill_code text,
  p_request_id uuid
)
returns table (
  review_session_id uuid,
  review_status text,
  item_count integer,
  started_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  actor public.family_members%rowtype;
  target_assignment public.learning_assignments%rowtype;
  prior_session public.learning_mistake_review_sessions%rowtype;
  created_session public.learning_mistake_review_sessions%rowtype;
  inserted_count integer;
begin
  if p_family_id is null or p_actor_member_id is null or p_assigned_member_id is null
     or p_assignment_id is null or p_status_filter is null or p_request_id is null then
    raise exception using errcode = '22004', message = 'review request fields are required';
  end if;
  if p_status_filter not in ('all', 'unreviewed', 'reviewed')
     or (p_skill_code is not null and (
       char_length(p_skill_code) not between 1 and 100
       or p_skill_code !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
     )) then
    raise exception using errcode = '22023', message = 'invalid review filter';
  end if;

  select member.* into actor
  from public.family_members member
  where member.family_id = p_family_id
    and member.id = p_actor_member_id
    and member.is_active = true
    and member.role in ('parent', 'child')
  for update;
  if actor.id is null or (actor.role = 'child' and actor.id <> p_assigned_member_id) then
    raise exception using errcode = '42501', message = 'active scoped review actor is required';
  end if;

  select assignment.* into target_assignment
  from public.learning_assignments assignment
  join public.family_members child
    on child.family_id = assignment.family_id
   and child.id = assignment.assigned_member_id
   and child.role = 'child'
   and child.is_active = true
  where assignment.id = p_assignment_id
    and assignment.family_id = p_family_id
    and assignment.assigned_member_id = p_assigned_member_id
    and assignment.status in ('active', 'completed')
  for update of assignment;
  if target_assignment.id is null then
    raise exception using errcode = 'P0002', message = 'review assignment was not found';
  end if;
  if public.is_learning_assignment_plan_paused(target_assignment.id) then
    raise exception using errcode = '55000', message = 'LEARNING_PLAN_PAUSED';
  end if;
  if p_stage_id is not null and not exists (
    select 1 from public.learning_stages stage
    where stage.id = p_stage_id
      and stage.content_version_id = target_assignment.content_version_id
  ) then
    raise exception using errcode = 'P0002', message = 'review stage was not found';
  end if;

  select session.* into prior_session
  from public.learning_mistake_review_sessions session
  where session.family_id = p_family_id
    and session.started_by_member_id = p_actor_member_id
    and session.request_id = p_request_id
  for update;
  if prior_session.id is not null then
    if prior_session.assignment_id <> p_assignment_id
       or prior_session.assigned_member_id <> p_assigned_member_id
       or prior_session.filter_status <> p_status_filter
       or prior_session.filter_stage_id is distinct from p_stage_id
       or prior_session.filter_skill_code is distinct from p_skill_code then
      raise exception using errcode = '55000', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return query
      select prior_session.id, prior_session.status,
        (select count(*)::integer from public.learning_mistake_review_items item where item.session_id = prior_session.id),
        prior_session.started_at;
    return;
  end if;

  select session.* into prior_session
  from public.learning_mistake_review_sessions session
  where session.family_id = p_family_id
    and session.assigned_member_id = p_assigned_member_id
    and session.assignment_id = p_assignment_id
    and session.status = 'in_progress'
  for update;
  if prior_session.id is not null then
    return query
      select prior_session.id, prior_session.status,
        (select count(*)::integer from public.learning_mistake_review_items item where item.session_id = prior_session.id),
        prior_session.started_at;
    return;
  end if;

  insert into public.learning_mistake_review_sessions (
    family_id, assigned_member_id, assignment_id, content_version_id,
    started_by_member_id, filter_status, filter_stage_id, filter_skill_code, request_id
  ) values (
    p_family_id, p_assigned_member_id, p_assignment_id, target_assignment.content_version_id,
    p_actor_member_id, p_status_filter, p_stage_id, p_skill_code, p_request_id
  ) returning * into created_session;

  with eligible as (
    select
      attempt.id as source_attempt_id,
      question.id as source_attempt_question_id,
      answer.id as source_answer_id,
      attempt.finalized_at,
      question.display_order as question_order
    from public.learning_attempts attempt
    join public.learning_attempt_questions question
      on question.attempt_id = attempt.id
    join public.learning_attempt_answers answer
      on answer.attempt_id = attempt.id
     and answer.attempt_question_id = question.id
     and answer.is_correct = false
    where attempt.family_id = p_family_id
      and attempt.assigned_member_id = p_assigned_member_id
      and attempt.assignment_id = p_assignment_id
      and attempt.content_version_id = target_assignment.content_version_id
      and attempt.status in ('passed', 'failed')
      and (p_stage_id is null or attempt.stage_id = p_stage_id)
      and (p_skill_code is null or p_skill_code = any(question.skill_codes_snapshot))
      and (
        p_status_filter = 'all'
        or (
          p_status_filter = 'reviewed'
          and exists (
            select 1 from public.learning_mistake_reveal_events event
            where event.family_id = p_family_id
              and event.assigned_member_id = p_assigned_member_id
              and event.assignment_id = p_assignment_id
              and event.attempt_question_id = question.id
          )
        )
        or (
          p_status_filter = 'unreviewed'
          and not exists (
            select 1 from public.learning_mistake_reveal_events event
            where event.family_id = p_family_id
              and event.assigned_member_id = p_assigned_member_id
              and event.assignment_id = p_assignment_id
              and event.attempt_question_id = question.id
          )
        )
      )
    order by attempt.finalized_at desc, question.display_order, answer.id
    limit 500
  ), ranked as (
    select eligible.*,
      row_number() over (
        order by eligible.finalized_at desc, eligible.question_order, eligible.source_answer_id
      )::integer as item_order
    from eligible
  )
  insert into public.learning_mistake_review_items (
    session_id, source_attempt_id, source_attempt_question_id, source_answer_id, display_order
  )
  select created_session.id, source_attempt_id, source_attempt_question_id, source_answer_id, item_order
  from ranked;

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    raise exception using errcode = 'P0002', message = 'reviewable mistakes were not found';
  end if;

  return query select created_session.id, created_session.status, inserted_count, created_session.started_at;
end
$function$;

alter function public.guard_learning_mistake_review_session() owner to postgres;
alter function public.guard_learning_mistake_review_immutable() owner to postgres;
alter function public.start_learning_mistake_review(uuid,uuid,uuid,uuid,text,uuid,text,uuid) owner to postgres;

alter table public.learning_mistake_review_sessions enable row level security;
alter table public.learning_mistake_review_sessions force row level security;
alter table public.learning_mistake_review_items enable row level security;
alter table public.learning_mistake_review_items force row level security;
alter table public.learning_mistake_review_answers enable row level security;
alter table public.learning_mistake_review_answers force row level security;
alter table public.learning_mistake_review_events enable row level security;
alter table public.learning_mistake_review_events force row level security;

revoke all privileges on table
  public.learning_mistake_review_sessions,
  public.learning_mistake_review_items,
  public.learning_mistake_review_answers,
  public.learning_mistake_review_events
from public, anon, authenticated, service_role;
grant select on table
  public.learning_mistake_review_sessions,
  public.learning_mistake_review_items,
  public.learning_mistake_review_answers,
  public.learning_mistake_review_events
to service_role;

revoke all on function public.guard_learning_mistake_review_session()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_learning_mistake_review_immutable()
  from public, anon, authenticated, service_role;
revoke all on function public.start_learning_mistake_review(uuid,uuid,uuid,uuid,text,uuid,text,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.start_learning_mistake_review(uuid,uuid,uuid,uuid,text,uuid,text,uuid)
  to service_role;

commit;
