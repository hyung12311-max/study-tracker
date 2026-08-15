\set ON_ERROR_STOP on
\ir phase1_batch5b_isolated_bootstrap.sql
update public.reward_settings set reward_name=null;
\ir ../../supabase/migrations/202608150002_reward_auth_expand_contract.sql
