-- =====================================================================
-- BucketFund: table-level grants for the `authenticated` role
-- =====================================================================
--
-- Supabase's automatic privilege grants only apply to objects created
-- through the Studio UI or specific default-privilege settings. Tables
-- created via raw SQL migrations don't inherit them, so every query
-- from a logged-in user fails with `42501: permission denied for
-- table <name>` BEFORE RLS even gets a chance to evaluate.
--
-- This migration grants the minimum set of verbs needed for each
-- table. The actual row-level access is still enforced by the RLS
-- policies in 00000000000001_rls_and_auth_bootstrap.sql.
--
-- Verb matrix:
--
--   families        SELECT, UPDATE          (no INSERT/DELETE: trigger only)
--   family_members  SELECT, INSERT, UPDATE, DELETE  (admin gated via RLS)
--   accounts        SELECT, INSERT, UPDATE, DELETE  (admin gated via RLS)
--   buckets         SELECT, INSERT, UPDATE, DELETE  (owner/admin via RLS)
--   transactions    SELECT, INSERT          (append-only: no UPDATE/DELETE)
--   teller_events   SELECT                  (admin-only read; writes use service role)
--
-- =====================================================================

grant select, update on table public.families to authenticated;

grant select, insert, update, delete on table public.family_members to authenticated;

grant select, insert, update, delete on table public.accounts to authenticated;

grant select, insert, update, delete on table public.buckets to authenticated;

grant select, insert on table public.transactions to authenticated;

grant select on table public.teller_events to authenticated;

-- The `anon` role (unauthenticated visitors) gets nothing in the public
-- schema. Sign-in is the only path to any data.

-- Make sure the helper functions are callable from the authenticated
-- role. They are SECURITY DEFINER so they will execute with elevated
-- privileges regardless, but the caller still needs EXECUTE.
grant execute on function public.auth_family_id() to authenticated;
grant execute on function public.auth_role() to authenticated;
grant execute on function public.auth_member_id() to authenticated;
