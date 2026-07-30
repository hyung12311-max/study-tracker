-- PRE-DATA ONLY rollback for Phase 2B-2A.
-- Never run automatically. It restores the Phase 2B-1A cancellation function.

begin;

do $preflight$
begin
  if to_regclass('public.learning_attempts') is null
     or to_regclass('public.learning_attempt_questions') is null
     or to_regclass('public.learning_attempt_answers') is null then
    raise exception using
      errcode = 'P0001',
      message = 'rollback blocked: the complete Phase 2B-2A attempt engine is not present';
  end if;

  if exists (select 1 from public.learning_attempt_answers)
     or exists (select 1 from public.learning_attempt_questions)
     or exists (select 1 from public.learning_attempts) then
    raise exception using
      errcode = '55000',
      message = 'rollback blocked: Phase 2B attempt data exists';
  end if;
end
$preflight$;

drop function public.abandon_learning_attempt(
  uuid, uuid, uuid, uuid, uuid
);
drop function public.submit_learning_attempt_answer(
  uuid, uuid, uuid, uuid, uuid
);
drop function public.finalize_learning_stage_attempt(uuid, uuid, uuid);
drop function public.start_or_resume_learning_attempt(
  uuid, uuid, uuid, uuid, uuid, uuid
);

drop table public.learning_attempt_answers;
drop table public.learning_attempt_questions;
drop table public.learning_attempts;

drop function public.guard_learning_attempt_child_immutable();
drop function public.validate_learning_attempt_question_snapshot();
drop function public.guard_learning_attempt_change();

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

alter function public.cancel_learning_assignment(uuid, uuid, uuid, uuid)
  owner to postgres;
revoke all on function public.cancel_learning_assignment(
  uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.cancel_learning_assignment(
  uuid, uuid, uuid, uuid
) to service_role;

commit;
