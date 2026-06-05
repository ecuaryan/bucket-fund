-- =====================================================================
-- Harden revoke_member_sessions (migration 36 already applied on hosted).
--
-- Revoke/delete refresh tokens by user_id, not only via session_id, so we
-- never leave a live token when session rows are missing or out of sync.
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

  update auth.refresh_tokens
     set revoked = true
   where user_id = p_user_id;

  delete from auth.refresh_tokens
   where user_id = p_user_id;

  delete from auth.sessions
   where user_id = p_user_id;
end;
$$;
