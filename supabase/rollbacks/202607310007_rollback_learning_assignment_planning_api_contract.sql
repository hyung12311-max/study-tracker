begin;

do $guard$
begin
  if exists (select 1 from public.learning_assignment_plans)
     or exists (select 1 from public.learning_assignment_stage_targets)
     or exists (select 1 from public.learning_assignment_plan_revisions) then
    raise exception using errcode = '55000', message = 'Phase B-2 planning API rollback blocked: planning data exists';
  end if;
end
$guard$;

drop trigger if exists learning_attempts_guard_plan_pause on public.learning_attempts;
drop function if exists public.guard_learning_attempt_plan_pause();
drop function if exists public.create_learning_assignment_with_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid);

commit;
