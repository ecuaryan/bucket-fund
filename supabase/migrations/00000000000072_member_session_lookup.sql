-- =====================================================================
-- member_session_lookup: the credential-less login path (pin-login,
-- webauthn-login-verify) needs the member row AND the member's auth email
-- to mint a session. It used to take the member row in one DB query and
-- then a SECOND round trip to the GoTrue Admin API (getUserById) purely to
-- read the email. This folds the email into the single DB lookup the
-- function already makes, dropping one network hop per login.
--
-- SECURITY DEFINER so it can read auth.users; EXECUTE is granted to
-- service_role ONLY (Edge Functions run as service_role). It is never
-- exposed to authenticated/anon, so clients cannot use it to harvest
-- emails. service_role can already read auth.users via the Admin API, so
-- this grants it no new capability — only a cheaper shape.
-- =====================================================================

create or replace function public.member_session_lookup(
  p_family_id uuid,
  p_member_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(fm) || jsonb_build_object('auth_email', u.email)
  from public.family_members fm
  left join auth.users u on u.id = fm.user_id
  where fm.id = p_member_id
    and fm.family_id = p_family_id
$$;

revoke all on function public.member_session_lookup(uuid, uuid) from public;
revoke all on function public.member_session_lookup(uuid, uuid) from anon;
revoke all on function public.member_session_lookup(uuid, uuid) from authenticated;
grant execute on function public.member_session_lookup(uuid, uuid) to service_role;
