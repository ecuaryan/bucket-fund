-- =====================================================================
-- Fix revoke_member_sessions on hosted Supabase (migration 37 regression).
--
-- Migration 37 added `update auth.refresh_tokens set revoked = true`, which
-- can fail with permission denied when the function owner is `postgres`
-- (auth tables are owned by supabase_auth_admin). That caused set-pin to
-- return "Could not sign them out on other devices" for child PIN resets.
--
-- Revert to delete-only revocation. Match refresh tokens by session_id and
-- by user_id (cast to text for Auth versions where user_id is varchar).
-- SECURITY DEFINER (postgres) can delete on hosted; do not ALTER OWNER here
-- (CI/local migrations cannot SET ROLE supabase_auth_admin).
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
grant execute on function public.revoke_member_sessions(uuid, uuid) to service_role;
