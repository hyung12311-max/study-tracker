-- Run only when the v2 application has not been deployed and the Contract
-- phase has not been applied. This rollback intentionally leaves every
-- 202607280001 wrapper unchanged.

begin;

drop function if exists public.reflow_book_plan_for_assignee(
  uuid, uuid, uuid, uuid, date
);
drop function if exists public.add_book_plan_review_for_assignee(
  uuid, uuid, uuid, uuid, integer, text
);
drop function if exists public.update_book_plan_pages_for_assignee(
  uuid, uuid, uuid, uuid, integer
);
drop function if exists public.delete_book_plan_task_for_assignee(
  uuid, uuid, uuid, text
);

notify pgrst, 'reload schema';

commit;
