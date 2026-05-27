-- =====================================================================
-- BucketFund: enable Realtime for the tables clients subscribe to
-- =====================================================================
--
-- Supabase only broadcasts Postgres change events for tables that are
-- explicitly added to the `supabase_realtime` publication. The tables
-- below need to fan out to clients so a second admin sees a bucket
-- move (or a webhook-driven balance refresh) within a second.
--
-- We deliberately do NOT publish:
--   - `teller_enrollments` — contains access tokens and is service-
--     role-only by RLS. There's no client subscription to forward to.
--   - `teller_events` — large, low-value to clients.
--   - `families` / `family_members` — change rarely; clients can
--     refetch on demand.
-- =====================================================================

alter publication supabase_realtime add table public.buckets;
alter publication supabase_realtime add table public.accounts;
alter publication supabase_realtime add table public.transactions;
