-- CONTRACT emergency recovery only. This restores the verified pre-contract
-- browser-access contract and therefore reopens direct REST risk.
-- Prefer fixing or rolling forward the application/wrappers. The v2 and
-- Academy wrappers deliberately remain installed. academy_completion_history
-- was not changed by the CONTRACT and is not changed here.

begin;

lock table
  public.study_plans,
  public.book_plans,
  public.academy_schedules
in share row exclusive mode;

alter table public.study_plans disable row level security;
grant select, insert, update, delete on table public.study_plans to anon, authenticated;

drop policy if exists "book_plans_existing_app_access" on public.book_plans;
create policy "book_plans_existing_app_access"
  on public.book_plans
  for all
  to anon, authenticated
  using (true)
  with check (true);
alter table public.book_plans enable row level security;
alter table public.book_plans no force row level security;
grant select, insert, update, delete on table public.book_plans to anon, authenticated;

drop policy if exists "academy_schedules_existing_app_access"
  on public.academy_schedules;
create policy "academy_schedules_existing_app_access"
  on public.academy_schedules
  for all
  to anon, authenticated
  using (true)
  with check (true);
alter table public.academy_schedules enable row level security;
alter table public.academy_schedules no force row level security;
grant select, insert, update, delete on table public.academy_schedules
  to anon, authenticated;

grant execute on function public.create_book_plan(
  text, text, text, text, text, date, integer, integer, integer, integer[], text, text
) to anon, authenticated;
grant execute on function public.complete_study_plan_and_reschedule(bigint, date)
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;
