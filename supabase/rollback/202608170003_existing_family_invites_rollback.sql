begin;
do $guard$ begin if exists(select 1 from public.family_invites) then raise exception 'Rollback refused: family invite history exists.';end if;end $guard$;
drop function if exists public.revoke_product_family_invite(uuid,uuid,uuid);
drop function if exists public.exchange_product_family_invite(text,text);
drop function if exists public.create_product_family_invite(uuid,uuid,text);
drop table if exists public.family_invite_exchange_attempts;
drop table if exists public.family_invites;
notify pgrst,'reload schema';
commit;
