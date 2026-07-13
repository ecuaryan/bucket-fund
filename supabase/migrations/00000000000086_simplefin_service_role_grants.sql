-- =====================================================================
-- service_role grants for simplefin_connections.
--
-- Migration 84 created the table but granted nothing to service_role —
-- repeating the exact bug migration 4 documents: on the hosted project,
-- tables created via raw SQL do NOT inherit the standard service_role
-- ALL grants, so the simplefin-claim Edge Function's insert failed with
-- "permission denied", surfaced to the admin as "Failed to store
-- connection". (Local Docker stacks DO auto-grant via default
-- privileges, which is why every local test and manual run passed —
-- always grant explicitly so prod and local match.)
--
-- RLS posture is unchanged: zero policies, no grants to authenticated
-- or anon — only the service role (which bypasses RLS but still needs
-- verb grants) can touch Access URLs.
-- =====================================================================

grant select, insert, update, delete on table public.simplefin_connections to service_role;
