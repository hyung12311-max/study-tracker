-- EXPAND rollback only.
-- Run only when the Academy API application has not been deployed and the
-- 202607280004 CONTRACT has not been applied. Existing data, table access,
-- legacy functions, and the 202607280001/002 wrappers remain unchanged.

begin;

drop function if exists public.complete_academy_schedule_for_assignee(
  uuid, uuid, uuid, uuid, date
);
drop function if exists public.delete_academy_schedule_for_assignee(
  uuid, uuid, uuid, uuid
);
drop function if exists public.update_academy_schedule_for_assignee(
  uuid, uuid, uuid, uuid, text, integer, time without time zone, text, integer
);
drop function if exists public.create_academy_schedule_for_assignee(
  uuid, uuid, uuid, text, integer, time without time zone, text, integer
);

notify pgrst, 'reload schema';

commit;
