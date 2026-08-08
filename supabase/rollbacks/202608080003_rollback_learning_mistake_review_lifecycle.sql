begin;

do $guard$
begin
  if exists (select 1 from public.learning_mistake_review_answers)
     or exists (
       select 1 from public.learning_mistake_review_events where event_type = 'session_abandoned'
     )
     or exists (
       select 1 from public.learning_mistake_review_sessions where status <> 'in_progress'
     ) then
    raise exception using errcode = '55000', message = 'learning mistake review lifecycle data is in use';
  end if;
end
$guard$;

drop function public.abandon_learning_mistake_review(uuid,uuid,uuid,uuid);
drop function public.submit_learning_mistake_review_answer(uuid,uuid,uuid,uuid,uuid,uuid);
alter table public.learning_mistake_review_events
  drop constraint learning_mistake_review_events_type_check,
  add constraint learning_mistake_review_events_type_check
    check (event_type = 'solution_revealed');

commit;
