-- =====================================================================
-- Table grants for the WebAuthn tables (migration 69).
-- =====================================================================
--
-- Like the rest of the schema (see 00000000000002_table_grants.sql and
-- 00000000000004_service_role_grants.sql), tables created via raw SQL do NOT
-- inherit Supabase's automatic role grants on hosted projects — so without
-- these the Edge Functions' service-role queries fail with "permission denied
-- for table member_passkeys" (surfaced as webauthn-has-passkey 500s), and the
-- client's own passkey delete (Settings → turn off) fails too.
--
-- RLS still enforces row access; these grant only the table-level verbs.
-- =====================================================================

-- Edge Functions (service role) read/write passkeys and challenges.
grant select, insert, update, delete on table public.member_passkeys to service_role;
grant select, insert, update, delete on table public.webauthn_challenges to service_role;

-- A member reads/deletes their own passkeys (RLS-scoped); admins manage their
-- family's. No INSERT/UPDATE for clients — credentials are written only by the
-- service role. Challenges stay service-role only (no client grants).
grant select, delete on table public.member_passkeys to authenticated;
