-- API files are application code and are not affected by this SQL rollback.
-- DO NOT run while completion or ledger rows exist. This rollback deliberately
-- refuses to delete earned stickers or operational completion data.

begin;

do $$
begin
  if to_regclass('public.hangul_daily_completions') is not null
     and exists (select 1 from public.hangul_daily_completions) then
    raise exception 'Rollback blocked: hangul_daily_completions contains operational data.';
  end if;
  if exists (
    select 1 from public.sticker_transactions
    where source_type = 'hangul_daily_complete'
  ) then
    raise exception 'Rollback blocked: Hangul sticker transactions exist and will not be deleted automatically.';
  end if;
end
$$;

drop function if exists public.complete_hangul_daily_with_reward(uuid, uuid, date, integer, integer, text, jsonb);
drop table if exists public.hangul_daily_completions;

commit;
