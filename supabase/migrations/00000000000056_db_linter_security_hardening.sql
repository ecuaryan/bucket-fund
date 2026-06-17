-- =====================================================================
-- Database linter hardening (Supabase Advisor)
-- =====================================================================
--
-- - Pin search_path on helpers/triggers flagged by lint 0011
-- - Revoke anon/authenticated EXECUTE on internal and trigger-only RPCs
-- - Deny-all RLS policy on teller_enrollments (lint 0008; behavior unchanged)
-- - Document intentional security-definer transactions_client view (lint 0010)
-- =====================================================================

-- ---------------------------------------------------------------------
-- search_path: lint 0011
-- ---------------------------------------------------------------------
alter function public.buckets_assign_display_order() set search_path = public;
alter function public.transactions_validate_shape() set search_path = public;
alter function public.generate_join_code() set search_path = public;
alter function public.is_cash_account_type(text) set search_path = public;
alter function public.auto_organize_is_due_on(text, date, int, text, int[], date)
  set search_path = public;
alter function public.format_auto_organize_day_of_month(int) set search_path = public;
alter function public.auto_organize_days_key(int[]) set search_path = public;
alter function public.auto_organize_cadence_summary(text, date, int, text, int[])
  set search_path = public;
alter function public.auto_organize_display_name(text, text, date, int, text, int[])
  set search_path = public;

-- ---------------------------------------------------------------------
-- RPC surface: revoke default PUBLIC/anon execute (lint 0028)
-- ---------------------------------------------------------------------
do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke all on function %s from anon', fn);
  end loop;
end $$;

-- Trigger-only and policy-only helpers: not callable via PostgREST.
revoke all on function public.handle_new_user() from authenticated;
revoke all on function public.generate_join_code() from authenticated;
revoke all on function public.buckets_assign_display_order() from authenticated;
revoke all on function public.transactions_validate_shape() from authenticated;
revoke all on function public.guard_account_owner_member() from authenticated;

revoke all on function public.bucket_move_is_child_internal(uuid, uuid, uuid)
  from authenticated;
revoke all on function public.bucket_visible_to_adults(uuid)
  from authenticated;
revoke all on function public.member_has_linked_account(uuid)
  from authenticated;
revoke all on function public.is_cash_account_type(text)
  from authenticated;

revoke all on function public.auto_organize_is_due_on(text, date, int, text, int[], date)
  from authenticated;
revoke all on function public.format_auto_organize_day_of_month(int)
  from authenticated;
revoke all on function public.auto_organize_days_key(int[])
  from authenticated;
revoke all on function public.auto_organize_cadence_summary(text, date, int, text, int[])
  from authenticated;
revoke all on function public.auto_organize_display_name(text, text, date, int, text, int[])
  from authenticated;

revoke all on function public._auto_organize_apply_line(
  uuid, uuid, numeric, text, uuid, uuid, uuid
) from authenticated;
revoke all on function public.run_due_auto_organizes(timestamptz)
  from authenticated;

-- Supabase platform helper when present.
do $$
begin
  revoke all on function public.rls_auto_enable() from authenticated;
exception
  when undefined_function then null;
end $$;

-- Re-assert grants on intentional authenticated RPCs and RLS/view helpers.
grant execute on function public.auth_family_id() to authenticated;
grant execute on function public.auth_role() to authenticated;
grant execute on function public.auth_member_id() to authenticated;
grant execute on function public.transaction_visible_to_caller(uuid) to authenticated;

grant execute on function public.move_money(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.send_money(uuid, numeric, text) to authenticated;
grant execute on function public.delete_bucket(uuid) to authenticated;
grant execute on function public.reorder_bucket(uuid, text) to authenticated;
grant execute on function public.reorder_buckets(uuid[]) to authenticated;
grant execute on function public.get_float_balance() to authenticated;
grant execute on function public.get_home_balance_breakdown() to authenticated;
grant execute on function public.get_home_page_data() to authenticated;
grant execute on function public.add_manual_account(numeric, text) to authenticated;
grant execute on function public.update_manual_account(uuid, numeric, text) to authenticated;
grant execute on function public.delete_manual_account(uuid) to authenticated;
grant execute on function public.rotate_family_join_code() to authenticated;
grant execute on function public.revoke_member_sessions(uuid, uuid) to authenticated;
grant execute on function public.update_transaction_note(uuid, text) to authenticated;
grant execute on function public.run_auto_organize(uuid, text, uuid, date) to authenticated;
grant execute on function public.ensure_member_bucket_orders() to authenticated;
grant execute on function public.family_linked_child_member_ids() to authenticated;

-- service_role retains explicit grants from earlier migrations; re-assert
-- helpers Edge Functions and cron jobs rely on.
grant execute on function public.auth_family_id() to service_role;
grant execute on function public.auth_role() to service_role;
grant execute on function public.auth_member_id() to service_role;
grant execute on function public.auto_organize_is_due_on(text, date, int, text, int[], date)
  to service_role;
grant execute on function public._auto_organize_apply_line(
  uuid, uuid, numeric, text, uuid, uuid, uuid
) to service_role;
grant execute on function public.run_due_auto_organizes(timestamptz) to service_role;
grant execute on function public.run_auto_organize(uuid, text, uuid, date) to service_role;
grant execute on function public.member_float(uuid) to service_role;
grant execute on function public.member_child_virtual_balance(uuid) to service_role;
grant execute on function public.family_linked_child_member_ids() to service_role;

-- ---------------------------------------------------------------------
-- teller_enrollments: lint 0008 (RLS on, zero policies is intentional)
-- ---------------------------------------------------------------------
create policy "teller_enrollments_deny_all"
  on public.teller_enrollments
  for all
  to authenticated, anon
  using (false)
  with check (false);

-- ---------------------------------------------------------------------
-- transactions_client: lint 0010 (security definer view is intentional)
-- ---------------------------------------------------------------------
comment on view public.transactions_client is
  'Authenticated SELECT surface for transactions. Redacts shared-pool Float snapshots for child role. '
  'Runs as view owner so authenticated cannot SELECT public.transactions directly (column redaction). '
  'Supabase lint 0010 (security definer view) is accepted for this reason.';
