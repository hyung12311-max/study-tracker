begin;

do $guard$
begin
  if (to_regclass('public.learning_mistake_review_sessions') is not null
      and exists (select 1 from public.learning_mistake_review_sessions))
     or (to_regclass('public.learning_mistake_review_items') is not null
      and exists (select 1 from public.learning_mistake_review_items))
     or (to_regclass('public.learning_mistake_review_answers') is not null
      and exists (select 1 from public.learning_mistake_review_answers))
     or (to_regclass('public.learning_mistake_review_events') is not null
      and exists (select 1 from public.learning_mistake_review_events)) then
    raise exception using errcode = '55000', message = 'learning mistake review data is in use';
  end if;
end
$guard$;

drop function public.start_learning_mistake_review(uuid,uuid,uuid,uuid,text,uuid,text,uuid);
drop trigger learning_mistake_review_events_immutable on public.learning_mistake_review_events;
drop trigger learning_mistake_review_answers_immutable on public.learning_mistake_review_answers;
drop trigger learning_mistake_review_items_immutable on public.learning_mistake_review_items;
drop trigger learning_mistake_review_sessions_guard on public.learning_mistake_review_sessions;
drop function public.guard_learning_mistake_review_immutable();
drop function public.guard_learning_mistake_review_session();
drop table public.learning_mistake_review_events;
drop table public.learning_mistake_review_answers;
drop table public.learning_mistake_review_items;
drop table public.learning_mistake_review_sessions;

commit;
