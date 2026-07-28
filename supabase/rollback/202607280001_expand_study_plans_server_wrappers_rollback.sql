-- EXPAND rollback only.
--
-- Safe preconditions:
--   * the contract migration has not been applied, and
--   * the new application has not been deployed or has already been rolled back.
-- Dropping these wrappers while the new application is live breaks book,
-- reading, and study-completion calls.

begin;

do $preflight$
begin
  if (
    select class.relrowsecurity
    from pg_catalog.pg_class class
    where class.oid = 'public.study_plans'::regclass
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'expand rollback refused: contract RLS appears to be active';
  end if;
  if not (
    has_function_privilege(
      'anon',
      'public.create_book_plan(text,text,text,text,text,date,integer,integer,integer,integer[],text,text)',
      'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'public.create_book_plan(text,text,text,text,text,date,integer,integer,integer,integer[],text,text)',
      'EXECUTE'
    )
    and has_function_privilege(
      'anon',
      'public.complete_study_plan_and_reschedule(bigint,date)',
      'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'public.complete_study_plan_and_reschedule(bigint,date)',
      'EXECUTE'
    )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'expand rollback refused: legacy compatibility grant is absent';
  end if;
end
$preflight$;

drop function if exists public.create_book_plan_for_member(
  uuid, uuid, uuid, text, text, text, text, text, date,
  integer, integer, integer, integer[], text, text
);
drop function if exists public.create_reading_plan_for_member(
  uuid, uuid, uuid, text, text, integer, integer, integer[], date
);
drop function if exists public.reflow_book_plan_for_family(uuid, uuid, uuid, date);
drop function if exists public.add_book_plan_review_for_family(uuid, uuid, uuid, integer, text);
drop function if exists public.update_book_plan_pages_for_family(uuid, uuid, uuid, integer);
drop function if exists public.delete_book_plan_task_for_family(uuid, uuid, text);
drop function if exists public.complete_study_plan_with_reward_for_member(uuid, uuid, bigint, date);

notify pgrst, 'reload schema';

commit;
