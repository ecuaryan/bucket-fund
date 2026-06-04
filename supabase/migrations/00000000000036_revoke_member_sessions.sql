-- =====================================================================
-- Revoke all auth sessions for a household member (service-role only).
--
-- `auth.admin.signOut()` in the JS SDK requires the *member's own JWT* — it
-- cannot sign a user out by user id from the server. Passing a user id there
-- silently fails, which is why resetting another member's PIN never actually
-- signed them out on their other devices.
--
-- Deleting the member's rows from auth.sessions revokes their refresh tokens
-- (refresh_tokens cascade on session delete), so other devices drop on their
-- next token refresh. The access-token JWT they hold stays valid until its
-- normal expiry (Supabase default), same as any sign-out.
--
-- Authorization (caller must be an admin of the member's family) is enforced
-- by the set-pin Edge Function before this runs; execute is granted to
-- service_role only. The family check below is defense in depth so a stray
-- service-role call cannot revoke sessions for a user outside the family.
-- =====================================================================

create or replace function public.revoke_member_sessions(
  p_user_id uuid,
  p_family_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
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

  delete from auth.sessions where user_id = p_user_id;
end;
$$;

revoke all on function public.revoke_member_sessions(uuid, uuid) from public;
grant execute on function public.revoke_member_sessions(uuid, uuid) to service_role;
