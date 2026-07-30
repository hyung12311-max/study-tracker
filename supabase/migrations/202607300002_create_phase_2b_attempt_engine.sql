-- Phase 2B-2A: immutable attempt snapshots, answers, and server grading.
-- Additive only. No content, progress unlock, reward, or Realtime changes.

begin;

do $preflight$
declare
  required_relation text;
begin
  foreach required_relation in array array[
    'families',
    'family_members',
    'learning_content_versions',
    'learning_stages',
    'learning_questions',
    'learning_question_options',
    'learning_assignments',
    'learning_stage_progress'
  ]
  loop
    if to_regclass('public.' || required_relation) is null then
      raise exception using
        errcode = 'P0001',
        message = 'phase 2B-2A preflight failed: required relation is missing';
    end if;
  end loop;

  if to_regprocedure(
    'public.cancel_learning_assignment(uuid,uuid,uuid,uuid)'
  ) is null then
    raise exception using
      errcode = 'P0001',
      message = 'phase 2B-2A preflight failed: assignment cancellation function is missing';
  end if;

  if not coalesce((
    select role_row.rolbypassrls
    from pg_catalog.pg_roles role_row
    where role_row.rolname = 'service_role'
  ), false) then
    raise exception using
      errcode = 'P0001',
      message = 'phase 2B-2A preflight failed: service_role must bypass RLS';
  end if;

  if exists (
    select 1
    from (
      values
        ('learning_attempts'),
        ('learning_attempt_questions'),
        ('learning_attempt_answers')
    ) target(table_name)
    where to_regclass('public.' || target.table_name) is not null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'phase 2B-2A preflight failed: a target table already exists';
  end if;

  if exists (
    select 1
    from (
      values
        ('start_or_resume_learning_attempt(uuid,uuid,uuid,uuid,uuid,uuid)'),
        ('submit_learning_attempt_answer(uuid,uuid,uuid,uuid,uuid)'),
        ('finalize_learning_stage_attempt(uuid,uuid,uuid)'),
        ('abandon_learning_attempt(uuid,uuid,uuid,uuid,uuid)')
    ) target(function_identity)
    where to_regprocedure('public.' || target.function_identity) is not null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'phase 2B-2A preflight failed: a target function already exists';
  end if;
end
$preflight$;

create table public.learning_attempts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  assigned_member_id uuid not null,
  assignment_id uuid not null,
  content_version_id uuid not null,
  stage_id uuid not null,
  attempt_no integer not null,
  start_request_id uuid not null,
  status text not null default 'in_progress',
  total_questions integer not null,
  correct_answers integer,
  required_correct_answers integer not null,
  started_at timestamptz not null default now(),
  finalized_at timestamptz,
  abandoned_at timestamptz,
  abandoned_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_attempts_assigned_member_fk
    foreign key (family_id, assigned_member_id)
    references public.family_members(family_id, id)
    on delete restrict,
  constraint learning_attempts_assignment_scope_fk
    foreign key (
      assignment_id,
      family_id,
      assigned_member_id,
      content_version_id
    )
    references public.learning_assignments(
      id,
      family_id,
      assigned_member_id,
      content_version_id
    )
    on delete restrict,
  constraint learning_attempts_stage_version_fk
    foreign key (stage_id, content_version_id)
    references public.learning_stages(id, content_version_id)
    on delete restrict,
  constraint learning_attempts_progress_fk
    foreign key (assignment_id, stage_id)
    references public.learning_stage_progress(assignment_id, stage_id)
    on delete restrict,
  constraint learning_attempts_abandoned_by_fk
    foreign key (family_id, abandoned_by_member_id)
    references public.family_members(family_id, id)
    on delete restrict,
  constraint learning_attempts_scope_key
    unique (id, family_id, assigned_member_id, assignment_id, stage_id),
  constraint learning_attempts_assignment_stage_no_key
    unique (assignment_id, stage_id, attempt_no),
  constraint learning_attempts_member_request_key
    unique (assigned_member_id, start_request_id),
  constraint learning_attempts_number_check check (attempt_no > 0),
  constraint learning_attempts_status_check check (
    status in ('in_progress', 'passed', 'failed', 'abandoned')
  ),
  constraint learning_attempts_counts_check check (
    total_questions > 0
    and required_correct_answers between 1 and total_questions
    and (
      correct_answers is null
      or correct_answers between 0 and total_questions
    )
  ),
  constraint learning_attempts_terminal_check check (
    (
      status = 'in_progress'
      and correct_answers is null
      and finalized_at is null
      and abandoned_at is null
      and abandoned_by_member_id is null
    )
    or
    (
      status in ('passed', 'failed')
      and correct_answers is not null
      and finalized_at is not null
      and finalized_at >= started_at
      and abandoned_at is null
      and abandoned_by_member_id is null
    )
    or
    (
      status = 'abandoned'
      and correct_answers is null
      and finalized_at is null
      and abandoned_at is not null
      and abandoned_at >= started_at
      and abandoned_by_member_id is not null
    )
  )
);

create unique index learning_attempts_active_stage_uidx
  on public.learning_attempts (assignment_id, stage_id)
  where status = 'in_progress';

create index learning_attempts_member_status_idx
  on public.learning_attempts (
    family_id,
    assigned_member_id,
    status,
    started_at desc
  );

create index learning_attempts_assignment_stage_idx
  on public.learning_attempts (
    assignment_id,
    stage_id,
    attempt_no desc
  );

create table public.learning_attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  source_question_id uuid not null,
  display_order integer not null,
  prompt_snapshot text not null,
  explanation_snapshot text not null,
  options_snapshot jsonb not null,
  correct_option_id uuid not null,
  created_at timestamptz not null default now(),
  constraint learning_attempt_questions_attempt_fk
    foreign key (attempt_id)
    references public.learning_attempts(id)
    on delete restrict,
  constraint learning_attempt_questions_source_fk
    foreign key (source_question_id)
    references public.learning_questions(id)
    on delete restrict,
  constraint learning_attempt_questions_attempt_order_key
    unique (attempt_id, display_order),
  constraint learning_attempt_questions_attempt_source_key
    unique (attempt_id, source_question_id),
  constraint learning_attempt_questions_id_attempt_key
    unique (id, attempt_id),
  constraint learning_attempt_questions_order_check check (
    display_order > 0
  ),
  constraint learning_attempt_questions_prompt_check check (
    btrim(prompt_snapshot) = prompt_snapshot
    and char_length(prompt_snapshot) between 1 and 5000
  ),
  constraint learning_attempt_questions_explanation_check check (
    btrim(explanation_snapshot) = explanation_snapshot
    and char_length(explanation_snapshot) between 1 and 5000
  ),
  constraint learning_attempt_questions_options_check check (
    jsonb_typeof(options_snapshot) = 'array'
    and jsonb_array_length(options_snapshot) >= 2
  )
);

create index learning_attempt_questions_attempt_order_idx
  on public.learning_attempt_questions (attempt_id, display_order);

create table public.learning_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  attempt_question_id uuid not null,
  selected_option_id uuid not null,
  is_correct boolean not null,
  client_request_id uuid not null,
  submitted_at timestamptz not null default now(),
  constraint learning_attempt_answers_attempt_fk
    foreign key (attempt_id)
    references public.learning_attempts(id)
    on delete restrict,
  constraint learning_attempt_answers_question_attempt_fk
    foreign key (attempt_question_id, attempt_id)
    references public.learning_attempt_questions(id, attempt_id)
    on delete restrict,
  constraint learning_attempt_answers_question_key
    unique (attempt_id, attempt_question_id),
  constraint learning_attempt_answers_request_key
    unique (attempt_id, client_request_id)
);

create index learning_attempt_answers_attempt_submitted_idx
  on public.learning_attempt_answers (attempt_id, submitted_at);

create function public.guard_learning_attempt_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception using
      errcode = '55000',
      message = 'learning attempts cannot be deleted';
  end if;

  if old.status <> 'in_progress' then
    raise exception using
      errcode = '55000',
      message = 'terminal learning attempts are immutable';
  end if;

  if new.id is distinct from old.id
     or new.family_id is distinct from old.family_id
     or new.assigned_member_id is distinct from old.assigned_member_id
     or new.assignment_id is distinct from old.assignment_id
     or new.content_version_id is distinct from old.content_version_id
     or new.stage_id is distinct from old.stage_id
     or new.attempt_no is distinct from old.attempt_no
     or new.start_request_id is distinct from old.start_request_id
     or new.total_questions is distinct from old.total_questions
     or new.required_correct_answers is distinct from old.required_correct_answers
     or new.started_at is distinct from old.started_at
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '55000',
      message = 'learning attempt identity and grading inputs are immutable';
  end if;

  if new.status not in ('passed', 'failed', 'abandoned') then
    raise exception using
      errcode = '55000',
      message = 'invalid learning attempt transition';
  end if;

  return new;
end
$function$;

create function public.validate_learning_attempt_question_snapshot()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  option_count integer;
  option_id_count integer;
  option_order_count integer;
  correct_count integer;
begin
  select
    count(*),
    count(distinct option_row.id),
    count(distinct option_row."displayOrder"),
    count(*) filter (
      where option_row.id = new.correct_option_id::text
    )
  into
    option_count,
    option_id_count,
    option_order_count,
    correct_count
  from jsonb_to_recordset(new.options_snapshot) as option_row(
    id text,
    "displayOrder" integer,
    text text
  );

  if option_count < 2
     or option_id_count <> option_count
     or option_order_count <> option_count
     or correct_count <> 1
     or exists (
       select 1
       from jsonb_array_elements(new.options_snapshot) item
       where jsonb_typeof(item) <> 'object'
          or not (item ?& array['id', 'displayOrder', 'text'])
          or item - 'id' - 'displayOrder' - 'text' <> '{}'::jsonb
          or jsonb_typeof(item->'id') <> 'string'
          or jsonb_typeof(item->'displayOrder') <> 'number'
          or jsonb_typeof(item->'text') <> 'string'
          or (item->>'displayOrder')::integer < 1
          or btrim(item->>'text') <> item->>'text'
          or char_length(item->>'text') not between 1 and 2000
     ) then
    raise exception using
      errcode = '23514',
      message = 'attempt question snapshot is invalid';
  end if;

  perform (item->>'id')::uuid
  from jsonb_array_elements(new.options_snapshot) item;

  return new;
end
$function$;

create function public.guard_learning_attempt_child_immutable()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  raise exception using
    errcode = '55000',
    message = 'learning attempt snapshots and answers are immutable';
end
$function$;

create trigger learning_attempts_guard_change
before update or delete
on public.learning_attempts
for each row
execute function public.guard_learning_attempt_change();

create trigger learning_attempt_questions_validate_snapshot
before insert
on public.learning_attempt_questions
for each row
execute function public.validate_learning_attempt_question_snapshot();

create trigger learning_attempt_questions_guard_change
before update or delete
on public.learning_attempt_questions
for each row
execute function public.guard_learning_attempt_child_immutable();

create trigger learning_attempt_answers_guard_change
before update or delete
on public.learning_attempt_answers
for each row
execute function public.guard_learning_attempt_child_immutable();

create function public.start_or_resume_learning_attempt(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_assignment_id uuid,
  p_stage_id uuid,
  p_start_request_id uuid
)
returns table (
  attempt_id uuid,
  attempt_status text,
  resumed boolean,
  total_questions integer,
  answered_questions integer,
  required_correct_answers integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  target_assignment public.learning_assignments%rowtype;
  target_progress public.learning_stage_progress%rowtype;
  existing_attempt public.learning_attempts%rowtype;
  created_attempt public.learning_attempts%rowtype;
  question_count integer;
  snapshot_count integer;
  next_attempt_no integer;
begin
  if p_start_request_id is null then
    raise exception using
      errcode = '22004',
      message = 'start request id is required';
  end if;

  select assignment.*
  into target_assignment
  from public.learning_assignments assignment
  where assignment.id = p_assignment_id
    and assignment.family_id = p_family_id
    and assignment.assigned_member_id = p_assigned_member_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'learning assignment was not found';
  end if;

  perform 1
  from public.family_members actor
  where actor.id = p_actor_member_id
    and actor.family_id = target_assignment.family_id
    and actor.is_active = true
    and (
      actor.role = 'parent'
      or (
        actor.role = 'child'
        and actor.id = target_assignment.assigned_member_id
      )
    )
  for update;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'active parent or assigned child is required';
  end if;

  perform 1
  from public.family_members child
  where child.id = target_assignment.assigned_member_id
    and child.family_id = target_assignment.family_id
    and child.role = 'child'
    and child.is_active = true
  for update;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'active assigned child is required';
  end if;

  if target_assignment.status <> 'active' then
    raise exception using
      errcode = '55000',
      message = 'active learning assignment is required';
  end if;

  perform 1
  from public.learning_content_versions version
  where version.id = target_assignment.content_version_id
    and version.status in ('published', 'retired');
  if not found then
    raise exception using
      errcode = '55000',
      message = 'released assignment content is required';
  end if;

  select progress.*
  into target_progress
  from public.learning_stage_progress progress
  where progress.assignment_id = target_assignment.id
    and progress.stage_id = p_stage_id
    and progress.family_id = target_assignment.family_id
    and progress.assigned_member_id = target_assignment.assigned_member_id
    and progress.content_version_id = target_assignment.content_version_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'learning stage progress was not found';
  end if;

  if target_progress.status <> 'unlocked' then
    raise exception using
      errcode = '55000',
      message = 'learning stage is not unlocked';
  end if;

  select attempt.*
  into existing_attempt
  from public.learning_attempts attempt
  where attempt.assigned_member_id = target_assignment.assigned_member_id
    and attempt.start_request_id = p_start_request_id
  for update;
  if found then
    if existing_attempt.assignment_id <> target_assignment.id
       or existing_attempt.stage_id <> target_progress.stage_id then
      raise exception using
        errcode = '23505',
        message = 'start request id was reused for another attempt';
    end if;

    return query
    select
      existing_attempt.id,
      existing_attempt.status,
      true,
      existing_attempt.total_questions,
      (
        select count(*)::integer
        from public.learning_attempt_answers answer
        where answer.attempt_id = existing_attempt.id
      ),
      existing_attempt.required_correct_answers;
    return;
  end if;

  select attempt.*
  into existing_attempt
  from public.learning_attempts attempt
  where attempt.assignment_id = target_assignment.id
    and attempt.stage_id = target_progress.stage_id
    and attempt.status = 'in_progress'
  for update;
  if found then
    return query
    select
      existing_attempt.id,
      existing_attempt.status,
      true,
      existing_attempt.total_questions,
      (
        select count(*)::integer
        from public.learning_attempt_answers answer
        where answer.attempt_id = existing_attempt.id
      ),
      existing_attempt.required_correct_answers;
    return;
  end if;

  select count(*)::integer
  into question_count
  from public.learning_questions question
  where question.stage_id = target_progress.stage_id;

  if question_count < 1
     or exists (
       select 1
       from public.learning_questions question
       where question.stage_id = target_progress.stage_id
         and (
           (
             select count(*)
             from public.learning_question_options option
             where option.question_id = question.id
           ) < 2
           or (
             select count(*)
             from public.learning_question_options option
             where option.question_id = question.id
               and option.is_correct
           ) <> 1
         )
     ) then
    raise exception using
      errcode = '23514',
      message = 'learning stage questions are incomplete';
  end if;

  select coalesce(max(attempt.attempt_no), 0) + 1
  into next_attempt_no
  from public.learning_attempts attempt
  where attempt.assignment_id = target_assignment.id
    and attempt.stage_id = target_progress.stage_id;

  insert into public.learning_attempts (
    family_id,
    assigned_member_id,
    assignment_id,
    content_version_id,
    stage_id,
    attempt_no,
    start_request_id,
    status,
    total_questions,
    required_correct_answers
  )
  values (
    target_assignment.family_id,
    target_assignment.assigned_member_id,
    target_assignment.id,
    target_assignment.content_version_id,
    target_progress.stage_id,
    next_attempt_no,
    p_start_request_id,
    'in_progress',
    question_count,
    ceil(question_count * 8 / 10.0)::integer
  )
  returning * into created_attempt;

  insert into public.learning_attempt_questions (
    attempt_id,
    source_question_id,
    display_order,
    prompt_snapshot,
    explanation_snapshot,
    options_snapshot,
    correct_option_id
  )
  select
    created_attempt.id,
    question.id,
    question.display_order,
    question.prompt,
    question.explanation,
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', option.id::text,
          'displayOrder', option.display_order,
          'text', option.option_text
        )
        order by option.display_order
      )
      from public.learning_question_options option
      where option.question_id = question.id
    ),
    (
      select option.id
      from public.learning_question_options option
      where option.question_id = question.id
        and option.is_correct
    )
  from public.learning_questions question
  where question.stage_id = target_progress.stage_id
  order by question.display_order;

  get diagnostics snapshot_count = row_count;
  if snapshot_count <> question_count then
    raise exception using
      errcode = '23514',
      message = 'attempt question snapshot is incomplete';
  end if;

  return query
  select
    created_attempt.id,
    created_attempt.status,
    false,
    created_attempt.total_questions,
    0,
    created_attempt.required_correct_answers;
end
$function$;

create function public.finalize_learning_stage_attempt(
  p_actor_member_id uuid,
  p_attempt_id uuid,
  p_request_id uuid
)
returns table (
  attempt_id uuid,
  attempt_status text,
  total_questions integer,
  correct_answers integer,
  required_correct_answers integer,
  passed boolean,
  finalized_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  attempt_scope record;
  target_assignment public.learning_assignments%rowtype;
  target_attempt public.learning_attempts%rowtype;
  finalized_attempt public.learning_attempts%rowtype;
  snapshot_count integer;
  answer_count integer;
  computed_correct integer;
begin
  if p_request_id is null then
    raise exception using
      errcode = '22004',
      message = 'finalize request id is required';
  end if;

  select
    attempt.assignment_id,
    attempt.family_id,
    attempt.assigned_member_id
  into attempt_scope
  from public.learning_attempts attempt
  where attempt.id = p_attempt_id;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'learning attempt was not found';
  end if;

  select assignment.*
  into target_assignment
  from public.learning_assignments assignment
  where assignment.id = attempt_scope.assignment_id
    and assignment.family_id = attempt_scope.family_id
    and assignment.assigned_member_id = attempt_scope.assigned_member_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'learning assignment was not found';
  end if;

  perform 1
  from public.family_members actor
  where actor.id = p_actor_member_id
    and actor.family_id = target_assignment.family_id
    and actor.id = target_assignment.assigned_member_id
    and actor.role = 'child'
    and actor.is_active = true
  for update;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'active assigned child is required';
  end if;

  select attempt.*
  into target_attempt
  from public.learning_attempts attempt
  where attempt.id = p_attempt_id
    and attempt.family_id = target_assignment.family_id
    and attempt.assigned_member_id = target_assignment.assigned_member_id
    and attempt.assignment_id = target_assignment.id
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'learning attempt was not found';
  end if;

  if target_attempt.status in ('passed', 'failed') then
    return query
    select
      target_attempt.id,
      target_attempt.status,
      target_attempt.total_questions,
      target_attempt.correct_answers,
      target_attempt.required_correct_answers,
      target_attempt.status = 'passed',
      target_attempt.finalized_at;
    return;
  end if;

  if target_attempt.status = 'abandoned' then
    raise exception using
      errcode = '55000',
      message = 'abandoned learning attempt cannot be finalized';
  end if;

  if target_assignment.status <> 'active' then
    raise exception using
      errcode = '55000',
      message = 'active learning assignment is required';
  end if;

  perform 1
  from public.learning_stage_progress progress
  where progress.assignment_id = target_attempt.assignment_id
    and progress.stage_id = target_attempt.stage_id
    and progress.status = 'unlocked'
  for update;
  if not found then
    raise exception using
      errcode = '55000',
      message = 'unlocked learning stage progress is required';
  end if;

  select count(*)::integer
  into snapshot_count
  from public.learning_attempt_questions question
  where question.attempt_id = target_attempt.id;

  select
    count(*)::integer,
    count(*) filter (where answer.is_correct)::integer
  into answer_count, computed_correct
  from public.learning_attempt_answers answer
  where answer.attempt_id = target_attempt.id;

  if snapshot_count <> target_attempt.total_questions
     or answer_count <> target_attempt.total_questions then
    raise exception using
      errcode = '55000',
      message = 'learning attempt is incomplete';
  end if;

  update public.learning_attempts
  set status = case
        when computed_correct >= target_attempt.required_correct_answers
          then 'passed'
        else 'failed'
      end,
      correct_answers = computed_correct,
      finalized_at = now(),
      updated_at = now()
  where id = target_attempt.id
    and status = 'in_progress'
  returning * into finalized_attempt;

  if finalized_attempt.id is null then
    raise exception using
      errcode = '40001',
      message = 'learning attempt changed concurrently';
  end if;

  return query
  select
    finalized_attempt.id,
    finalized_attempt.status,
    finalized_attempt.total_questions,
    finalized_attempt.correct_answers,
    finalized_attempt.required_correct_answers,
    finalized_attempt.status = 'passed',
    finalized_attempt.finalized_at;
end
$function$;

create function public.submit_learning_attempt_answer(
  p_actor_member_id uuid,
  p_attempt_id uuid,
  p_attempt_question_id uuid,
  p_selected_option_id uuid,
  p_client_request_id uuid
)
returns table (
  answer_id uuid,
  is_correct boolean,
  correct_option_text text,
  explanation text,
  submitted_at timestamptz,
  answered_count integer,
  total_questions integer,
  is_complete boolean,
  attempt_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  attempt_scope record;
  target_assignment public.learning_assignments%rowtype;
  target_attempt public.learning_attempts%rowtype;
  target_question public.learning_attempt_questions%rowtype;
  next_question_id uuid;
  existing_answer public.learning_attempt_answers%rowtype;
  created_answer public.learning_attempt_answers%rowtype;
  selected_exists boolean;
  correct_text text;
  current_answer_count integer;
  final_status text;
begin
  if p_client_request_id is null then
    raise exception using
      errcode = '22004',
      message = 'answer request id is required';
  end if;

  select
    attempt.assignment_id,
    attempt.family_id,
    attempt.assigned_member_id
  into attempt_scope
  from public.learning_attempts attempt
  where attempt.id = p_attempt_id;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'learning attempt was not found';
  end if;

  select assignment.*
  into target_assignment
  from public.learning_assignments assignment
  where assignment.id = attempt_scope.assignment_id
    and assignment.family_id = attempt_scope.family_id
    and assignment.assigned_member_id = attempt_scope.assigned_member_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'learning assignment was not found';
  end if;

  perform 1
  from public.family_members actor
  where actor.id = p_actor_member_id
    and actor.family_id = target_assignment.family_id
    and actor.id = target_assignment.assigned_member_id
    and actor.role = 'child'
    and actor.is_active = true
  for update;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'active assigned child is required';
  end if;

  select attempt.*
  into target_attempt
  from public.learning_attempts attempt
  where attempt.id = p_attempt_id
    and attempt.family_id = target_assignment.family_id
    and attempt.assigned_member_id = target_assignment.assigned_member_id
    and attempt.assignment_id = target_assignment.id
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'learning attempt was not found';
  end if;

  select answer.*
  into existing_answer
  from public.learning_attempt_answers answer
  where answer.attempt_id = target_attempt.id
    and answer.client_request_id = p_client_request_id;
  if found then
    if existing_answer.attempt_question_id <> p_attempt_question_id
       or existing_answer.selected_option_id <> p_selected_option_id then
      raise exception using
        errcode = '23505',
        message = 'answer request id was reused with another payload';
    end if;

    select question.*
    into target_question
    from public.learning_attempt_questions question
    where question.id = existing_answer.attempt_question_id
      and question.attempt_id = target_attempt.id;

    select item->>'text'
    into correct_text
    from jsonb_array_elements(target_question.options_snapshot) item
    where item->>'id' = target_question.correct_option_id::text;

    select count(*)::integer
    into current_answer_count
    from public.learning_attempt_answers answer
    where answer.attempt_id = target_attempt.id;

    return query
    select
      existing_answer.id,
      existing_answer.is_correct,
      correct_text,
      target_question.explanation_snapshot,
      existing_answer.submitted_at,
      current_answer_count,
      target_attempt.total_questions,
      current_answer_count = target_attempt.total_questions,
      target_attempt.status;
    return;
  end if;

  if target_attempt.status <> 'in_progress' then
    raise exception using
      errcode = '55000',
      message = 'learning attempt is not in progress';
  end if;

  if target_assignment.status <> 'active' then
    raise exception using
      errcode = '55000',
      message = 'active learning assignment is required';
  end if;

  select question.*
  into target_question
  from public.learning_attempt_questions question
  where question.id = p_attempt_question_id
    and question.attempt_id = target_attempt.id
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'attempt question was not found';
  end if;

  select answer.*
  into existing_answer
  from public.learning_attempt_answers answer
  where answer.attempt_id = target_attempt.id
    and answer.attempt_question_id = target_question.id;
  if found then
    if existing_answer.selected_option_id <> p_selected_option_id then
      raise exception using
        errcode = '23505',
        message = 'attempt question already has another answer';
    end if;
  else
    select question.id
    into next_question_id
    from public.learning_attempt_questions question
    left join public.learning_attempt_answers answer
      on answer.attempt_id = question.attempt_id
     and answer.attempt_question_id = question.id
    where question.attempt_id = target_attempt.id
      and answer.id is null
    order by question.display_order
    limit 1;

    if next_question_id is distinct from target_question.id then
      raise exception using
        errcode = '55000',
        message = 'answers must be submitted in display order';
    end if;

    select exists (
      select 1
      from jsonb_array_elements(target_question.options_snapshot) item
      where item->>'id' = p_selected_option_id::text
    )
    into selected_exists;

    if not selected_exists then
      raise exception using
        errcode = '23514',
        message = 'selected option is not part of the attempt question';
    end if;

    insert into public.learning_attempt_answers (
      attempt_id,
      attempt_question_id,
      selected_option_id,
      is_correct,
      client_request_id
    )
    values (
      target_attempt.id,
      target_question.id,
      p_selected_option_id,
      p_selected_option_id = target_question.correct_option_id,
      p_client_request_id
    )
    returning * into created_answer;
    existing_answer := created_answer;
  end if;

  select item->>'text'
  into correct_text
  from jsonb_array_elements(target_question.options_snapshot) item
  where item->>'id' = target_question.correct_option_id::text;

  select count(*)::integer
  into current_answer_count
  from public.learning_attempt_answers answer
  where answer.attempt_id = target_attempt.id;

  final_status := target_attempt.status;
  if current_answer_count = target_attempt.total_questions then
    select result.attempt_status
    into final_status
    from public.finalize_learning_stage_attempt(
      p_actor_member_id,
      target_attempt.id,
      p_client_request_id
    ) result;
  end if;

  return query
  select
    existing_answer.id,
    existing_answer.is_correct,
    correct_text,
    target_question.explanation_snapshot,
    existing_answer.submitted_at,
    current_answer_count,
    target_attempt.total_questions,
    current_answer_count = target_attempt.total_questions,
    final_status;
end
$function$;

create function public.abandon_learning_attempt(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_assignment_id uuid,
  p_attempt_id uuid
)
returns public.learning_attempts
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  target_assignment public.learning_assignments%rowtype;
  target_attempt public.learning_attempts%rowtype;
  abandoned_attempt public.learning_attempts%rowtype;
begin
  select assignment.*
  into target_assignment
  from public.learning_assignments assignment
  where assignment.id = p_assignment_id
    and assignment.family_id = p_family_id
    and assignment.assigned_member_id = p_assigned_member_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'learning assignment was not found';
  end if;

  perform 1
  from public.family_members actor
  where actor.id = p_actor_member_id
    and actor.family_id = target_assignment.family_id
    and actor.role = 'parent'
    and actor.is_active = true
  for update;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'active parent member is required';
  end if;

  perform 1
  from public.family_members child
  where child.id = target_assignment.assigned_member_id
    and child.family_id = target_assignment.family_id
    and child.role = 'child'
    and child.is_active = true
  for update;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'active assigned child is required';
  end if;

  if target_assignment.status <> 'active' then
    raise exception using
      errcode = '55000',
      message = 'active learning assignment is required';
  end if;

  select attempt.*
  into target_attempt
  from public.learning_attempts attempt
  where attempt.id = p_attempt_id
    and attempt.assignment_id = target_assignment.id
    and attempt.family_id = target_assignment.family_id
    and attempt.assigned_member_id = target_assignment.assigned_member_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'learning attempt was not found';
  end if;

  if target_attempt.status <> 'in_progress' then
    raise exception using
      errcode = '55000',
      message = 'only in-progress learning attempts can be abandoned';
  end if;

  update public.learning_attempts
  set status = 'abandoned',
      abandoned_at = now(),
      abandoned_by_member_id = p_actor_member_id,
      updated_at = now()
  where id = target_attempt.id
    and status = 'in_progress'
  returning * into abandoned_attempt;

  if abandoned_attempt.id is null then
    raise exception using
      errcode = '40001',
      message = 'learning attempt changed concurrently';
  end if;

  return abandoned_attempt;
end
$function$;

create or replace function public.cancel_learning_assignment(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_assignment_id uuid
)
returns public.learning_assignments
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  target_assignment public.learning_assignments%rowtype;
  cancelled_assignment public.learning_assignments%rowtype;
begin
  perform 1
  from public.family_members actor
  where actor.id = p_actor_member_id
    and actor.family_id = p_family_id
    and actor.role = 'parent'
    and actor.is_active = true
  for update;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'active parent member is required';
  end if;

  select assignment.*
  into target_assignment
  from public.learning_assignments assignment
  where assignment.id = p_assignment_id
    and assignment.family_id = p_family_id
    and assignment.assigned_member_id = p_assigned_member_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'learning assignment was not found';
  end if;

  if target_assignment.status <> 'active' then
    raise exception using
      errcode = '55000',
      message = 'only active learning assignments can be cancelled';
  end if;

  update public.learning_attempts
  set status = 'abandoned',
      abandoned_at = now(),
      abandoned_by_member_id = p_actor_member_id,
      updated_at = now()
  where assignment_id = target_assignment.id
    and family_id = target_assignment.family_id
    and assigned_member_id = target_assignment.assigned_member_id
    and status = 'in_progress';

  update public.learning_assignments
  set status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  where id = target_assignment.id
    and status = 'active'
  returning * into cancelled_assignment;

  if cancelled_assignment.id is null then
    raise exception using
      errcode = '40001',
      message = 'learning assignment changed concurrently';
  end if;

  return cancelled_assignment;
end
$function$;

alter function public.guard_learning_attempt_change() owner to postgres;
alter function public.validate_learning_attempt_question_snapshot()
  owner to postgres;
alter function public.guard_learning_attempt_child_immutable()
  owner to postgres;
alter function public.start_or_resume_learning_attempt(
  uuid, uuid, uuid, uuid, uuid, uuid
) owner to postgres;
alter function public.submit_learning_attempt_answer(
  uuid, uuid, uuid, uuid, uuid
) owner to postgres;
alter function public.finalize_learning_stage_attempt(uuid, uuid, uuid)
  owner to postgres;
alter function public.abandon_learning_attempt(
  uuid, uuid, uuid, uuid, uuid
) owner to postgres;
alter function public.cancel_learning_assignment(uuid, uuid, uuid, uuid)
  owner to postgres;

alter table public.learning_attempts enable row level security;
alter table public.learning_attempts force row level security;
alter table public.learning_attempt_questions enable row level security;
alter table public.learning_attempt_questions force row level security;
alter table public.learning_attempt_answers enable row level security;
alter table public.learning_attempt_answers force row level security;

revoke all privileges on table public.learning_attempts
  from public, anon, authenticated, service_role;
revoke all privileges on table public.learning_attempt_questions
  from public, anon, authenticated, service_role;
revoke all privileges on table public.learning_attempt_answers
  from public, anon, authenticated, service_role;

grant select on table
  public.learning_attempts,
  public.learning_attempt_questions,
  public.learning_attempt_answers
to service_role;

revoke all on function public.guard_learning_attempt_change()
  from public, anon, authenticated, service_role;
revoke all on function public.validate_learning_attempt_question_snapshot()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_learning_attempt_child_immutable()
  from public, anon, authenticated, service_role;
revoke all on function public.start_or_resume_learning_attempt(
  uuid, uuid, uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.submit_learning_attempt_answer(
  uuid, uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.finalize_learning_stage_attempt(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.abandon_learning_attempt(
  uuid, uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.cancel_learning_assignment(
  uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;

grant execute on function public.start_or_resume_learning_attempt(
  uuid, uuid, uuid, uuid, uuid, uuid
) to service_role;
grant execute on function public.submit_learning_attempt_answer(
  uuid, uuid, uuid, uuid, uuid
) to service_role;
grant execute on function public.finalize_learning_stage_attempt(
  uuid, uuid, uuid
) to service_role;
grant execute on function public.abandon_learning_attempt(
  uuid, uuid, uuid, uuid, uuid
) to service_role;
grant execute on function public.cancel_learning_assignment(
  uuid, uuid, uuid, uuid
) to service_role;

commit;
