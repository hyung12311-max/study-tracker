-- Read-only verification. Run only after the matching migration is applied.

select to_regclass('public.hangul_daily_completions') as completion_table;

select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'hangul_daily_completions'
order by ordinal_position;

select conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.hangul_daily_completions'::regclass
order by conname;

select relrowsecurity as rls_enabled
from pg_class
where oid = 'public.hangul_daily_completions'::regclass;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'hangul_daily_completions'
order by grantee, privilege_type;

select
  p.proname,
  p.prosecdef as security_definer,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type,
  p.proconfig as function_settings,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'complete_hangul_daily_with_reward';

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.sticker_transactions'::regclass
  and pg_get_constraintdef(oid) ilike '%source_type%';

select count(*) as existing_hangul_completions
from public.hangul_daily_completions;

select count(*) as existing_hangul_sticker_transactions
from public.sticker_transactions
where source_type = 'hangul_daily_complete';
