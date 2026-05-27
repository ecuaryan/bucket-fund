-- =====================================================================
-- BucketFund: service_role table grants
-- =====================================================================
--
-- Edge Functions like `teller-enroll` and `teller-webhook` use the
-- Supabase service role to bypass RLS when persisting bank-side data.
-- "Bypassing RLS" only handles the policy layer — the role still
-- needs table-level GRANTs for the verbs it executes. Tables created
-- via raw SQL (rather than via the dashboard) do NOT inherit the
-- standard `service_role` ALL grants by default, so Edge Function
-- writes fail with a generic "permission denied" surfaced to the
-- caller as "Failed to store enrollment" / similar.
--
-- This migration explicitly grants the service role what it needs on
-- every public-schema table it touches.
-- =====================================================================

grant select, insert, update, delete on table public.families to service_role;
grant select, insert, update, delete on table public.family_members to service_role;
grant select, insert, update, delete on table public.accounts to service_role;
grant select, insert, update, delete on table public.buckets to service_role;
grant select, insert, update, delete on table public.transactions to service_role;
grant select, insert, update, delete on table public.teller_enrollments to service_role;
grant select, insert, update, delete on table public.teller_events to service_role;

grant execute on function public.auth_family_id() to service_role;
grant execute on function public.auth_role() to service_role;
grant execute on function public.auth_member_id() to service_role;
