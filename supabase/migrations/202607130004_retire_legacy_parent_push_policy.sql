-- The old /api/push/subscribe route now delegates to the authenticated family API.
-- Keep the legacy table inaccessible to browser roles.
drop policy if exists "allow parent push subscription insert" on public.push_subscriptions;
revoke all on table public.push_subscriptions from anon, authenticated;
grant all on table public.push_subscriptions to service_role;
