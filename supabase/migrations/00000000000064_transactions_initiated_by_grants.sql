-- Migration 63 exposed initiated_by_* on transactions_client but omitted them
-- from the column-level SELECT grant (migration 57). Invoker-view reads then
-- failed with "permission denied for table transactions".
--
-- When adding columns to transactions_client, extend this grant list too.

revoke select on table public.transactions from authenticated;

grant select (
  id,
  family_id,
  type,
  amount,
  from_bucket_id,
  to_bucket_id,
  from_member_id,
  to_member_id,
  note,
  created_at,
  from_bucket_name,
  to_bucket_name,
  from_member_name,
  to_member_name,
  from_bucket_balance_before,
  from_bucket_balance_after,
  to_bucket_balance_before,
  to_bucket_balance_after,
  from_member_balance_before,
  from_member_balance_after,
  to_member_balance_before,
  to_member_balance_after,
  auto_organize_run_id,
  initiated_by_member_id,
  initiated_by_member_name
) on table public.transactions to authenticated;
