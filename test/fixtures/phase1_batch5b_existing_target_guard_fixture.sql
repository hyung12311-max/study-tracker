\set ON_ERROR_STOP on
\ir phase1_batch5b_isolated_bootstrap.sql
insert into public.family_reward_settings(family_id,target_stickers,reward_name)
values('10000000-0000-4000-8000-000000000001',99,'Existing setting');
\ir ../../supabase/migrations/202608150002_reward_auth_expand_contract.sql
