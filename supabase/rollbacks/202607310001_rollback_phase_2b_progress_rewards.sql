-- PRE-DATA ONLY rollback for Phase 2B-3A.
-- Never run after first-pass or reward data exists. No destructive production
-- rollback is permitted after the progress/reward engine has been used.

begin;

do $preflight$
begin
  if to_regclass('public.learning_stage_first_passes') is null
     or to_regprocedure(
       'public.finalize_learning_stage_attempt(uuid,uuid,uuid)'
     ) is null then
    raise exception using
      errcode = 'P0001',
      message = 'rollback blocked: the complete Phase 2B-3A engine is not present';
  end if;

  if exists (select 1 from public.learning_stage_first_passes)
     or exists (
       select 1
       from public.sticker_transactions transaction_row
       where transaction_row.source_type = 'learning_stage_first_pass'
     ) then
    raise exception using
      errcode = '55000',
      message = 'rollback blocked: Phase 2B progress or reward data exists';
  end if;
end
$preflight$;

drop function public.finalize_learning_stage_attempt(uuid, uuid, uuid);
drop table public.learning_stage_first_passes;
drop function public.guard_learning_stage_first_pass_immutable();

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

alter function public.finalize_learning_stage_attempt(uuid, uuid, uuid)
  owner to postgres;
revoke all on function public.finalize_learning_stage_attempt(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.finalize_learning_stage_attempt(
  uuid, uuid, uuid
) to service_role;

commit;
