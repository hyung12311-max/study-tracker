-- Phase 2B-3A: atomically record first stage passes, unlock progress, and award stickers.
-- Additive only. Existing learning and wallet rows are not backfilled or rewritten.

begin;

do $preflight$
declare
  required_table text;
begin
  foreach required_table in array array[
    'families',
    'family_members',
    'sticker_transactions',
    'learning_content_versions',
    'learning_stages',
    'learning_assignments',
    'learning_stage_progress',
    'learning_attempts',
    'learning_attempt_questions',
    'learning_attempt_answers'
  ]
  loop
    if to_regclass('public.' || required_table) is null then
      raise exception using
        errcode = 'P0001',
        message = 'Phase 2B-3A prerequisite table is missing: ' || required_table;
    end if;
  end loop;

  if to_regclass('public.learning_stage_first_passes') is not null then
    raise exception using
      errcode = 'P0001',
      message = 'learning_stage_first_passes already exists';
  end if;

  if to_regprocedure(
    'public.finalize_learning_stage_attempt(uuid,uuid,uuid)'
  ) is null then
    raise exception using
      errcode = 'P0001',
      message = 'finalize_learning_stage_attempt prerequisite is missing';
  end if;

  perform 1
  from pg_catalog.pg_attribute attribute_row
  where attribute_row.attrelid = 'public.sticker_transactions'::regclass
    and attribute_row.attname in (
      'id', 'family_id', 'member_id', 'amount', 'transaction_type',
      'source_type', 'source_id', 'description', 'metadata', 'created_at'
    )
    and not attribute_row.attisdropped
  group by attribute_row.attrelid
  having count(*) = 10;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'sticker_transactions ledger contract is incomplete';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'public.sticker_transactions'::regclass
      and constraint_row.contype = 'u'
      and pg_get_constraintdef(constraint_row.oid)
        = 'UNIQUE (member_id, source_type, source_id)'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'sticker_transactions idempotency contract changed';
  end if;
end
$preflight$;

create table public.learning_stage_first_passes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  assigned_member_id uuid not null,
  assignment_id uuid not null,
  content_version_id uuid not null,
  stage_id uuid not null,
  attempt_id uuid not null,
  difficulty text not null,
  reward_amount integer not null,
  reward_transaction_id uuid not null,
  passed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint learning_stage_first_passes_assigned_member_fk
    foreign key (family_id, assigned_member_id)
    references public.family_members(family_id, id)
    on delete restrict,
  constraint learning_stage_first_passes_assignment_scope_fk
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
  constraint learning_stage_first_passes_stage_version_fk
    foreign key (stage_id, content_version_id)
    references public.learning_stages(id, content_version_id)
    on delete restrict,
  constraint learning_stage_first_passes_attempt_scope_fk
    foreign key (
      attempt_id,
      family_id,
      assigned_member_id,
      assignment_id,
      stage_id
    )
    references public.learning_attempts(
      id,
      family_id,
      assigned_member_id,
      assignment_id,
      stage_id
    )
    on delete restrict,
  constraint learning_stage_first_passes_reward_transaction_fk
    foreign key (reward_transaction_id)
    references public.sticker_transactions(id)
    on delete restrict
    deferrable initially deferred,
  constraint learning_stage_first_passes_assignment_stage_key
    unique (assignment_id, stage_id),
  constraint learning_stage_first_passes_attempt_key
    unique (attempt_id),
  constraint learning_stage_first_passes_reward_transaction_key
    unique (reward_transaction_id),
  constraint learning_stage_first_passes_reward_check check (
    (difficulty = 'seed' and reward_amount = 1)
    or (difficulty = 'leaf' and reward_amount = 2)
    or (difficulty = 'tree' and reward_amount = 3)
    or (difficulty = 'crown' and reward_amount = 5)
  ),
  constraint learning_stage_first_passes_timestamp_check check (
    passed_at <= created_at
  )
);

create index learning_stage_first_passes_member_passed_idx
  on public.learning_stage_first_passes (
    family_id,
    assigned_member_id,
    passed_at desc
  );

create function public.guard_learning_stage_first_pass_immutable()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  raise exception using
    errcode = '55000',
    message = 'learning stage first passes are immutable';
end
$function$;

create trigger learning_stage_first_passes_guard_change
before update or delete
on public.learning_stage_first_passes
for each row
execute function public.guard_learning_stage_first_pass_immutable();

drop function public.finalize_learning_stage_attempt(uuid, uuid, uuid);

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
  finalized_at timestamptz,
  first_pass boolean,
  reward_granted boolean,
  reward_amount integer,
  unlocked_stage_id uuid,
  assignment_completed boolean
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
  target_progress public.learning_stage_progress%rowtype;
  target_stage public.learning_stages%rowtype;
  next_stage public.learning_stages%rowtype;
  first_pass_row public.learning_stage_first_passes%rowtype;
  snapshot_count integer;
  answer_count integer;
  computed_correct integer;
  calculated_reward integer;
  created_first_pass boolean := false;
  ledger_exists boolean := false;
  generated_first_pass_id uuid := gen_random_uuid();
  generated_ledger_id uuid := gen_random_uuid();
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

  -- Fixed lock order: assignment, actor, attempt, progress, first-pass/ledger.
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

  if target_attempt.status = 'abandoned' then
    raise exception using
      errcode = '55000',
      message = 'abandoned learning attempt cannot be finalized';
  end if;

  if target_attempt.status = 'failed' then
    return query select
      target_attempt.id,
      target_attempt.status,
      target_attempt.total_questions,
      target_attempt.correct_answers,
      target_attempt.required_correct_answers,
      false,
      target_attempt.finalized_at,
      false,
      false,
      0,
      null::uuid,
      target_assignment.status = 'completed';
    return;
  end if;

  if target_attempt.status = 'in_progress'
     and target_assignment.status <> 'active' then
    raise exception using
      errcode = '55000',
      message = 'active learning assignment is required';
  end if;

  select progress.*
  into target_progress
  from public.learning_stage_progress progress
  where progress.assignment_id = target_attempt.assignment_id
    and progress.stage_id = target_attempt.stage_id
    and progress.family_id = target_attempt.family_id
    and progress.assigned_member_id = target_attempt.assigned_member_id
    and progress.status in ('unlocked', 'passed')
  for update;
  if not found then
    raise exception using
      errcode = '55000',
      message = 'unlocked or passed learning stage progress is required';
  end if;

  if target_attempt.status = 'in_progress' then
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
    target_attempt := finalized_attempt;
  end if;

  if target_attempt.status = 'failed' then
    return query select
      target_attempt.id,
      target_attempt.status,
      target_attempt.total_questions,
      target_attempt.correct_answers,
      target_attempt.required_correct_answers,
      false,
      target_attempt.finalized_at,
      false,
      false,
      0,
      null::uuid,
      false;
    return;
  end if;

  if target_attempt.status <> 'passed' then
    raise exception using
      errcode = '55000',
      message = 'learning attempt did not reach a terminal result';
  end if;

  select stage.*
  into target_stage
  from public.learning_stages stage
  where stage.id = target_attempt.stage_id
    and stage.content_version_id = target_attempt.content_version_id;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'learning stage was not found';
  end if;

  calculated_reward := case target_stage.difficulty
    when 'seed' then 1
    when 'leaf' then 2
    when 'tree' then 3
    when 'crown' then 5
    else null
  end;
  if calculated_reward is null then
    raise exception using
      errcode = '23514',
      message = 'learning stage difficulty has no reward contract';
  end if;

  insert into public.learning_stage_first_passes (
    id,
    family_id,
    assigned_member_id,
    assignment_id,
    content_version_id,
    stage_id,
    attempt_id,
    difficulty,
    reward_amount,
    reward_transaction_id,
    passed_at
  ) values (
    generated_first_pass_id,
    target_attempt.family_id,
    target_attempt.assigned_member_id,
    target_attempt.assignment_id,
    target_attempt.content_version_id,
    target_attempt.stage_id,
    target_attempt.id,
    target_stage.difficulty,
    calculated_reward,
    generated_ledger_id,
    target_attempt.finalized_at
  )
  on conflict (assignment_id, stage_id) do nothing
  returning * into first_pass_row;

  created_first_pass := first_pass_row.id is not null;
  if created_first_pass then
    insert into public.sticker_transactions (
      id,
      family_id,
      member_id,
      amount,
      transaction_type,
      source_type,
      source_id,
      description,
      metadata
    ) values (
      generated_ledger_id,
      target_attempt.family_id,
      target_attempt.assigned_member_id,
      calculated_reward,
      'earn',
      'learning_stage_first_pass',
      generated_first_pass_id::text,
      target_stage.display_title || ' 최초 통과',
      jsonb_build_object(
        'assignment_id', target_attempt.assignment_id,
        'stage_id', target_attempt.stage_id,
        'attempt_id', target_attempt.id,
        'difficulty', target_stage.difficulty
      )
    );

    update public.learning_stage_progress
    set status = 'passed',
        passed_at = target_attempt.finalized_at,
        updated_at = now()
    where id = target_progress.id
      and status = 'unlocked';

    select stage.*
    into next_stage
    from public.learning_stages stage
    where stage.content_version_id = target_stage.content_version_id
      and stage.display_order > target_stage.display_order
    order by stage.display_order
    limit 1;

    if next_stage.id is not null then
      update public.learning_stage_progress
      set status = 'unlocked',
          unlocked_at = now(),
          updated_at = now()
      where assignment_id = target_attempt.assignment_id
        and family_id = target_attempt.family_id
        and assigned_member_id = target_attempt.assigned_member_id
        and content_version_id = target_attempt.content_version_id
        and stage_id = next_stage.id
        and status = 'locked';
      if not found then
        raise exception using
          errcode = '40001',
          message = 'next learning stage could not be unlocked';
      end if;
    else
      update public.learning_assignments
      set status = 'completed',
          completed_at = target_attempt.finalized_at,
          updated_at = now()
      where id = target_attempt.assignment_id
        and family_id = target_attempt.family_id
        and assigned_member_id = target_attempt.assigned_member_id
        and status = 'active';
      if not found and target_assignment.status <> 'completed' then
        raise exception using
          errcode = '40001',
          message = 'learning assignment could not be completed';
      end if;
    end if;
  else
    select first_pass.*
    into first_pass_row
    from public.learning_stage_first_passes first_pass
    where first_pass.assignment_id = target_attempt.assignment_id
      and first_pass.stage_id = target_attempt.stage_id
    for key share;
  end if;

  select exists (
    select 1
    from public.sticker_transactions transaction_row
    where transaction_row.id = first_pass_row.reward_transaction_id
      and transaction_row.family_id = first_pass_row.family_id
      and transaction_row.member_id = first_pass_row.assigned_member_id
      and transaction_row.amount = first_pass_row.reward_amount
      and transaction_row.transaction_type = 'earn'
      and transaction_row.source_type = 'learning_stage_first_pass'
      and transaction_row.source_id = first_pass_row.id::text
  ) into ledger_exists;

  select stage.*
  into next_stage
  from public.learning_stages stage
  where stage.content_version_id = target_stage.content_version_id
    and stage.display_order > target_stage.display_order
  order by stage.display_order
  limit 1;

  select assignment.*
  into target_assignment
  from public.learning_assignments assignment
  where assignment.id = target_attempt.assignment_id;

  return query select
    target_attempt.id,
    target_attempt.status,
    target_attempt.total_questions,
    target_attempt.correct_answers,
    target_attempt.required_correct_answers,
    true,
    target_attempt.finalized_at,
    first_pass_row.attempt_id = target_attempt.id,
    first_pass_row.attempt_id = target_attempt.id and ledger_exists,
    case
      when first_pass_row.attempt_id = target_attempt.id
        then first_pass_row.reward_amount
      else 0
    end,
    case
      when first_pass_row.attempt_id = target_attempt.id
        then next_stage.id
      else null::uuid
    end,
    target_assignment.status = 'completed';
end
$function$;

alter table public.learning_stage_first_passes enable row level security;
alter table public.learning_stage_first_passes force row level security;

alter function public.guard_learning_stage_first_pass_immutable()
  owner to postgres;
alter function public.finalize_learning_stage_attempt(uuid, uuid, uuid)
  owner to postgres;

revoke all privileges on table public.learning_stage_first_passes
  from public, anon, authenticated, service_role;
grant select on table public.learning_stage_first_passes
  to service_role;

revoke all on function public.guard_learning_stage_first_pass_immutable()
  from public, anon, authenticated, service_role;
revoke all on function public.finalize_learning_stage_attempt(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.finalize_learning_stage_attempt(
  uuid, uuid, uuid
) to service_role;

commit;
