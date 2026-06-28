-- =====================================================================
-- Home bootstrap, round 2: also return the caller's own family_members
-- row and the household admin name, so a fresh sign-in can load the
-- member (which gates the app) AND the home screen in ONE round trip
-- instead of three (member fetch -> home data -> admin name).
--
-- Additive only: existing callers that read buckets/accounts/breakdown
-- keep working; the new keys are ignored by older clients, and newer
-- clients fall back to a direct member query when `member` is absent
-- (e.g. during a deploy window before this migration lands).
-- =====================================================================

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

  -- The caller's own membership row. Mirrors the client's
  -- `family_members where user_id = auth.uid()` lookup so applySession can
  -- classify found / absent (removed) exactly as before. NULL => removed.
  select to_jsonb(fm)
    into v_member
    from public.family_members fm
    where fm.user_id = auth.uid()
    limit 1;

  -- Household admin display name (folds in fetchHouseholdAdminName).
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
