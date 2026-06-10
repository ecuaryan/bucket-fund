-- Client-facing transaction reads: visibility matches transaction_visible_to_caller,
-- and kids never receive shared-pool spending_money snapshot columns (API/DevTools).

create or replace view public.transactions_client
as
select
  t.id,
  t.family_id,
  t.type,
  t.amount,
  t.from_bucket_id,
  t.to_bucket_id,
  t.from_member_id,
  t.to_member_id,
  t.from_bucket_name,
  t.to_bucket_name,
  t.from_bucket_balance_before,
  t.from_bucket_balance_after,
  t.to_bucket_balance_before,
  t.to_bucket_balance_after,
  t.from_member_name,
  t.to_member_name,
  t.from_member_balance_before,
  t.from_member_balance_after,
  t.to_member_balance_before,
  t.to_member_balance_after,
  case
    when public.auth_role() = 'child'
      and (
        t.type = 'send'
        or t.from_member_id is distinct from public.auth_member_id()
      )
    then null::numeric(14, 2)
    else t.spending_money_balance_before
  end as spending_money_balance_before,
  case
    when public.auth_role() = 'child'
      and (
        t.type = 'send'
        or t.from_member_id is distinct from public.auth_member_id()
      )
    then null::numeric(14, 2)
    else t.spending_money_balance_after
  end as spending_money_balance_after,
  t.note,
  t.created_at
from public.transactions t
where public.transaction_visible_to_caller(t.id);

comment on view public.transactions_client is
  'Authenticated SELECT surface for transactions. Redacts shared-pool spending_money snapshots for child role.';

revoke all on public.transactions_client from public;
grant select on public.transactions_client to authenticated;
grant select on public.transactions_client to service_role;

-- Force reads through the view so redaction cannot be bypassed in DevTools.
revoke select on table public.transactions from authenticated;
