begin;

do $guard$
begin
  if exists (select 1 from public.learning_review_schedule_overrides)
     or exists (select 1 from public.learning_review_schedule_events) then
    raise exception using errcode = '55000', message = 'learning review schedule data is in use';
  end if;
end
$guard$;

drop function public.set_learning_review_schedule_override(uuid,uuid,uuid,uuid,text,text,integer,uuid);
drop trigger learning_review_schedule_events_immutable on public.learning_review_schedule_events;
drop trigger learning_review_schedule_overrides_guard on public.learning_review_schedule_overrides;
drop function public.guard_learning_review_schedule_event();
drop function public.guard_learning_review_schedule_override();
drop table public.learning_review_schedule_events;
drop table public.learning_review_schedule_overrides;

commit;
