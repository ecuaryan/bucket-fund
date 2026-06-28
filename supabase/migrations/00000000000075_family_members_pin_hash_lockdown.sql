-- =====================================================================
-- Lock down family_members.pin_hash from the browser client.
--
-- Migration 2 granted TABLE-level SELECT on family_members to authenticated,
-- and migration 10's `revoke select (pin_hash)` was a no-op because a
-- table-level grant overrides column-level revokes in Postgres (access is
-- allowed if EITHER level permits it). Net effect: any authenticated member
-- could read every family member's bcrypt pin_hash and brute-force the
-- 4-digit PIN offline, then impersonate that member (incl. an admin).
--
-- Fix: drop the table-level SELECT grant and grant SELECT only on the
-- non-secret columns (so the column-level rule actually governs access).
-- INSERT/UPDATE/DELETE table grants are left untouched; pin_hash is still
-- written only by Edge Functions via the service role.
-- =====================================================================

revoke select on public.family_members from authenticated;

grant select (
  id,
  family_id,
  user_id,
  name,
  role,
  avatar_url,
  created_at,
  is_account_owner,
  pin_failed_attempts,
  pin_locked,
  pin_set_at
) on public.family_members to authenticated;

-- get_home_page_data is SECURITY INVOKER, so its member lookup now runs with
-- only column-level access — a whole-row to_jsonb(fm) would hit pin_hash and
-- fail. Rebuild the member object from the explicit non-secret columns (this
-- also stops the hash from ever being shipped to the client). Everything else
-- is unchanged from migration 71.
create or replace function public.get_home_page_data()
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_member_id uuid := public.auth_member_id();
  v_buckets jsonb;
  v_accounts jsonb;
  v_member jsonb;
  v_admin_name text;
begin
  if v_member_id is not null then
    perform public.ensure_member_bucket_orders();
  end if;

  select coalesce(
    jsonb_agg(row_to_json(b.*) order by coalesce(mbo.display_order, b.display_order), b.created_at),
    '[]'::jsonb
  )
    into v_buckets
    from public.buckets b
    left join public.member_bucket_order mbo
      on mbo.bucket_id = b.id
     and mbo.member_id = v_member_id;

  select coalesce(
    jsonb_agg(row_to_json(a.*) order by a.created_at),
    '[]'::jsonb
  )
    into v_accounts
    from public.accounts a;

  -- The caller's own membership row, non-secret columns only (never pin_hash).
  select jsonb_build_object(
    'id', fm.id,
    'family_id', fm.family_id,
    'user_id', fm.user_id,
    'name', fm.name,
    'role', fm.role,
    'avatar_url', fm.avatar_url,
    'created_at', fm.created_at,
    'is_account_owner', fm.is_account_owner,
    'pin_failed_attempts', fm.pin_failed_attempts,
    'pin_locked', fm.pin_locked,
    'pin_set_at', fm.pin_set_at
  )
    into v_member
    from public.family_members fm
    where fm.user_id = auth.uid()
    limit 1;

  select fm.name
    into v_admin_name
    from public.family_members fm
    where fm.role = 'admin'
    limit 1;

  return jsonb_build_object(
    'buckets', coalesce(v_buckets, '[]'::jsonb),
    'accounts', coalesce(v_accounts, '[]'::jsonb),
    'breakdown', public.get_home_balance_breakdown(),
    'member', v_member,
    'household_admin_name', v_admin_name
  );
end;
$$;

revoke all on function public.get_home_page_data() from public;
grant execute on function public.get_home_page_data() to authenticated;
grant execute on function public.get_home_page_data() to service_role;
