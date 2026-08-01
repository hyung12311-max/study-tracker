begin;

do $guard$
begin
  if (to_regclass('public.learning_assignment_plans') is not null
      and exists (select 1 from public.learning_assignment_plans))
     or (to_regclass('public.learning_assignment_stage_targets') is not null
      and exists (select 1 from public.learning_assignment_stage_targets))
     or (to_regclass('public.learning_assignment_plan_revisions') is not null
      and exists (select 1 from public.learning_assignment_plan_revisions)) then
    raise exception using
      errcode = '55000',
      message = 'learning assignment planning data exists';
  end if;
end
$guard$;

revoke all on function public.create_learning_assignment_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.update_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,date,date,text,jsonb,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.pause_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.resume_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)
  from public, anon, authenticated, service_role;

drop function public.pause_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid);
drop function public.resume_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid);
drop function public.create_learning_assignment_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid);
drop function public.update_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,date,date,text,jsonb,uuid);
drop function public.set_learning_assignment_plan_state(uuid,uuid,uuid,uuid,integer,uuid,text);
drop function public.learning_assignment_plan_snapshot(date,date,text,text,timestamptz,jsonb);
drop function public.normalize_learning_assignment_plan_targets(uuid,date,date,jsonb);
drop function public.is_learning_assignment_plan_paused(uuid);
drop function public.learning_assignment_plan_is_complete(uuid);

drop trigger learning_assignment_plan_revisions_guard_change
  on public.learning_assignment_plan_revisions;
drop function public.guard_learning_assignment_plan_revision_immutable();
drop trigger learning_assignment_stage_targets_validate_set
  on public.learning_assignment_stage_targets;
drop trigger learning_assignment_plans_validate_targets
  on public.learning_assignment_plans;
drop function public.validate_learning_assignment_plan_stage_targets();
drop trigger learning_assignment_stage_targets_guard_row
  on public.learning_assignment_stage_targets;
drop function public.guard_learning_assignment_stage_target_row();
drop trigger learning_assignment_plans_guard_row
  on public.learning_assignment_plans;
drop function public.guard_learning_assignment_plan_row();

drop table public.learning_assignment_plan_revisions;
drop table public.learning_assignment_stage_targets;
drop table public.learning_assignment_plans;

commit;
