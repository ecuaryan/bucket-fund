-- =====================================================================
-- Move the two read-only, pre-auth login lookups off Edge Functions onto
-- the always-on RPC layer. Measured on prod: each Edge Function call costs
-- ~400-500ms of overhead even warm, while a direct RPC is ~100ms. These
-- two only READ data (no session minting), so they don't need to be edge.
--
--   validate-join-code      -> login_roster(code)
--   webauthn-has-passkey    -> member_login_methods(family_id, member_id)
--
-- Both are SECURITY DEFINER and granted to anon (login screens are
-- pre-session, exactly like the Edge Functions they replace). They expose
-- the same data those endpoints already exposed to anon — the join code is
-- still the gate — so there is no new exposure, just a faster path.
-- =====================================================================

-- Roster for a household join code: family + members with their fast-login
-- flags. Mirrors validate-join-code, plus hasPasskey so the family screen no
-- longer needs a second call. Returns NULL for a missing/invalid code.
create or replace function public.login_roster(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
  v_family_name text;
  v_members jsonb;
  v_code text := upper(trim(coalesce(p_code, '')));
begin
  if length(v_code) < 6 then
    return null;
  end if;

  select id, name into v_family_id, v_family_name
  from public.families
  where join_code = v_code;

  if v_family_id is null then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'name', m.name,
        'role', m.role,
        'avatarUrl', m.avatar_url,
        'hasPin', (m.pin_set_at is not null),
        'pinLocked', m.pin_locked,
        'isAccountOwner', coalesce(m.is_account_owner, false),
        'hasPasskey', exists(
          select 1 from public.member_passkeys p where p.member_id = m.id
        )
      )
      order by m.created_at asc
    ),
    '[]'::jsonb
  )
  into v_members
  from public.family_members m
  where m.family_id = v_family_id
    and m.role in ('admin', 'member', 'child');

  return jsonb_build_object(
    'familyId', v_family_id,
    'familyName', v_family_name,
    'members', v_members
  );
end;
$$;

revoke all on function public.login_roster(text) from public;
grant execute on function public.login_roster(text) to anon;
grant execute on function public.login_roster(text) to authenticated;
grant execute on function public.login_roster(text) to service_role;

-- Which fast methods a member has (passkey + PIN), by family+member. Mirrors
-- webauthn-has-passkey for the email login screen, which has no join code.
create or replace function public.member_login_methods(
  p_family_id uuid,
  p_member_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'exists', exists(
      select 1 from public.member_passkeys p
      where p.member_id = p_member_id and p.family_id = p_family_id
    ),
    'hasPin', exists(
      select 1 from public.family_members m
      where m.id = p_member_id
        and m.family_id = p_family_id
        and m.pin_set_at is not null
    )
  );
$$;

revoke all on function public.member_login_methods(uuid, uuid) from public;
grant execute on function public.member_login_methods(uuid, uuid) to anon;
grant execute on function public.member_login_methods(uuid, uuid) to authenticated;
grant execute on function public.member_login_methods(uuid, uuid) to service_role;
