-- Push subscriptions belong to an authenticated family member, regardless of role.
-- Browser clients never write this table directly; server functions use service_role.

alter table public.family_push_subscriptions
  add column if not exists role text,
  add column if not exists device_id text;

update public.family_push_subscriptions subscriptions
set role = members.role
from public.family_members members
where members.id = subscriptions.member_id
  and subscriptions.role is null;

alter table public.family_push_subscriptions
  alter column role set not null;

alter table public.family_push_subscriptions
  drop constraint if exists family_push_subscriptions_role_check;

alter table public.family_push_subscriptions
  add constraint family_push_subscriptions_role_check
  check (role in ('parent', 'child'));

create unique index if not exists family_push_subscriptions_endpoint_key
  on public.family_push_subscriptions(endpoint);

alter table public.family_push_subscriptions enable row level security;

-- Remove historical parent-only/browser-write policies. service_role bypasses RLS.
do $$
declare policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'family_push_subscriptions'
  loop
    execute format('drop policy if exists %I on public.family_push_subscriptions', policy_record.policyname);
  end loop;
end
$$;

revoke all on table public.family_push_subscriptions from anon, authenticated;
grant all on table public.family_push_subscriptions to service_role;

comment on table public.family_push_subscriptions is
  'Server-managed Web Push subscriptions for active parent and child family members.';
