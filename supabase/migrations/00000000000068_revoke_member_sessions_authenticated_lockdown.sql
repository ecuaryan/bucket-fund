-- =====================================================================
-- Lock down revoke_member_sessions: service role only.
-- =====================================================================
--
-- revoke_member_sessions(p_user_id, p_family_id) deletes a user's auth
-- sessions and refresh tokens (a force-logout primitive). Its only
-- internal guard was that (p_user_id, p_family_id) is a valid membership
-- pair -- it never checked the *caller*.
--
-- Migration 56 (db_linter_security_hardening) re-granted EXECUTE to
-- `authenticated` while re-asserting the intentional RPC surface. That
-- was a mistake: the function had been service-role only since migrations
-- 36/38, and its sole caller is the set-pin Edge Function, which invokes
-- it with the service role. Combined with the missing caller check, any
-- authenticated user -- including a child -- could read another member's
-- user_id/family_id (both SELECT-able within a family) and force-log-out
-- the admin: a child could boot a parent.
--
-- Fix:
--   1. Revoke EXECUTE from public/anon/authenticated; keep service_role.
--   2. Add an internal guard as defense-in-depth so that even if EXECUTE
--      is ever re-granted, a non-service caller must be an admin acting
--      within their own family. The service role has no end-user identity
--      (auth.uid() is null), so it bypasses the guard -- exactly the
--      signal run_auto_organize already uses to tell scheduled (service)
--      runs from manual (client) ones.
--
-- Function body is otherwise reproduced verbatim from migration 38
-- (delete-only revocation that works on hosted Supabase).
-- =====================================================================

create or replace function public.revoke_member_sessions(
  p_user_id uuid,
  p_family_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if p_user_id is null or p_family_id is null then
    raise exception 'user and family required' using errcode = '22023';
  end if;

  -- Only the service role (Edge Functions; auth.uid() is null) may revoke
  -- sessions. Any non-service caller must be an admin acting within their
  -- own family. Defense in depth: EXECUTE is revoked from authenticated
  -- below, so a client cannot reach this function at all today.
  if auth.uid() is not null then
    if public.auth_role() <> 'admin'
       or public.auth_family_id() is distinct from p_family_id then
      raise exception 'admins only' using errcode = '42501';
    end if;
  end if;

  if not exists (
    select 1
      from public.family_members
     where user_id = p_user_id
       and family_id = p_family_id
  ) then
    raise exception 'member not in family' using errcode = '42501';
  end if;

  delete from auth.refresh_tokens
   where session_id in (
     select id from auth.sessions where user_id = p_user_id
   );

  delete from auth.refresh_tokens
   where user_id::text = p_user_id::text;

  delete from auth.sessions
   where user_id = p_user_id;
end;
$$;

revoke all on function public.revoke_member_sessions(uuid, uuid) from public;
revoke all on function public.revoke_member_sessions(uuid, uuid) from anon;
revoke all on function public.revoke_member_sessions(uuid, uuid) from authenticated;
grant execute on function public.revoke_member_sessions(uuid, uuid) to service_role;
