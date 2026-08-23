begin;
select to_regclass('public.family_invites'),to_regclass('public.family_invite_exchange_attempts');
select relname,relrowsecurity,relforcerowsecurity from pg_class where oid in('public.family_invites'::regclass,'public.family_invite_exchange_attempts'::regclass);
select column_name from information_schema.columns where table_schema='public' and table_name='family_invites' and column_name in('raw_invite','invite_code');
select grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name in('family_invites','family_invite_exchange_attempts') order by table_name,grantee,privilege_type;
select routine_name,grantee,privilege_type from information_schema.role_routine_grants where specific_schema='public' and routine_name in('create_product_family_invite','exchange_product_family_invite','revoke_product_family_invite') order by routine_name,grantee;
select to_regprocedure('public.create_product_family_invite(uuid,uuid,text)'),to_regprocedure('public.exchange_product_family_invite(text,text)'),to_regprocedure('public.revoke_product_family_invite(uuid,uuid,uuid)');
select pg_get_functiondef('public.exchange_product_family_invite(text,text)'::regprocedure) ~* 'for update' as atomic_lock,
       pg_get_functiondef('public.exchange_product_family_invite(text,text)'::regprocedure) ~* 'used_at is null' as single_use,
       pg_get_functiondef('public.exchange_product_family_invite(text,text)'::regprocedure) ~* 'expires_at > now\(\)' as expiry_guard,
       pg_get_functiondef('public.exchange_product_family_invite(text,text)'::regprocedure) ~* 'revoked_at is null' as revoke_guard,
       pg_get_functiondef('public.exchange_product_family_invite(text,text)'::regprocedure) ~* 'INVITE_RATE_LIMITED' as durable_rate_limit;
rollback;
