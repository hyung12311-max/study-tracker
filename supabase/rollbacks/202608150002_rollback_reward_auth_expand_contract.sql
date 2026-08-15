begin;

-- Preserve the deterministic family_reward_settings backfill. It is valid
-- family-scoped business data and removing it would reintroduce legacy fallback.
drop function if exists public.create_reward_exchange_request_v2(uuid,uuid,uuid,uuid,text);
drop function if exists public.set_family_member_pin_v2(uuid,uuid,uuid,text);

commit;
