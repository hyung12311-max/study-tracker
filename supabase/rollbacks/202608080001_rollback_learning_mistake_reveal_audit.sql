begin;

do $guard$
begin
  if to_regclass('public.learning_mistake_reveal_events') is not null
     and exists (select 1 from public.learning_mistake_reveal_events) then
    raise exception using errcode = '55000', message = 'learning mistake reveal audit is in use';
  end if;
end
$guard$;

drop function public.reveal_learning_mistake_solution(uuid, uuid, uuid, uuid, uuid);
drop trigger learning_mistake_reveal_events_immutable on public.learning_mistake_reveal_events;
drop function public.guard_learning_mistake_reveal_event();
drop table public.learning_mistake_reveal_events;

commit;
