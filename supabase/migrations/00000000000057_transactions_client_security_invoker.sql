-- =====================================================================
-- transactions_client: security invoker (Supabase lint 0010)
-- =====================================================================
--
-- Float column redaction for child role uses security-definer helpers;
-- authenticated reads non-Float columns on transactions via RLS. Float
-- snapshots are not column-granted on the table — only via the view.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Float redaction helpers (security definer reads float columns)
-- ---------------------------------------------------------------------
create or replace function public.client_float_balance_before(p_transaction_id uuid)
returns numeric(14, 2)
language sql
stable
security definer
set search_path = public
as $$
  select (
    case
      when public.auth_role() = 'child'
        and (
          t.type = 'send'
          or t.from_member_id is distinct from public.auth_member_id()
        )
      then null::numeric(14, 2)
      else t.float_balance_before
    end
  )::numeric(14, 2)
  from public.transactions t
  where t.id = p_transaction_id
    and public.transaction_visible_to_caller(t.id);
$$;

create or replace function public.client_float_balance_after(p_transaction_id uuid)
returns numeric(14, 2)
language sql
stable
security definer
set search_path = public
as $$
  select (
    case
      when public.auth_role() = 'child'
        and (
          t.type = 'send'
          or t.from_member_id is distinct from public.auth_member_id()
        )
      then null::numeric(14, 2)
      else t.float_balance_after
    end
  )::numeric(14, 2)
  from public.transactions t
  where t.id = p_transaction_id
    and public.transaction_visible_to_caller(t.id);
$$;

revoke all on function public.client_float_balance_before(uuid) from public;
revoke all on function public.client_float_balance_after(uuid) from public;
revoke all on function public.client_float_balance_before(uuid) from anon;
revoke all on function public.client_float_balance_after(uuid) from anon;
revoke all on function public.client_float_balance_before(uuid) from authenticated;
revoke all on function public.client_float_balance_after(uuid) from authenticated;

-- Used only inside transactions_client; not a direct PostgREST RPC surface.
grant execute on function public.client_float_balance_before(uuid) to authenticated;
grant execute on function public.client_float_balance_after(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- transactions_client: security invoker + helper-based Float columns
-- ---------------------------------------------------------------------
drop view if exists public.transactions_client;

create view public.transactions_client
with (security_invoker = true)
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
  public.client_float_balance_before(t.id)::numeric(14, 2) as float_balance_before,
  public.client_float_balance_after(t.id)::numeric(14, 2) as float_balance_after,
  t.note,
  t.created_at,
  t.auto_organize_run_id,
  r.trigger as auto_organize_run_trigger
from public.transactions t
left join public.auto_organize_runs r on r.id = t.auto_organize_run_id
where public.transaction_visible_to_caller(t.id);

comment on view public.transactions_client is
  'Authenticated SELECT surface for History. security_invoker view; row visibility via '
  'transaction_visible_to_caller. Float snapshots redacted for child role via '
  'client_float_balance_* helpers; float columns are not granted on transactions.';

revoke all on public.transactions_client from public;
grant select on public.transactions_client to authenticated;
grant select on public.transactions_client to service_role;

-- Invoker view: column-level SELECT only (Float columns excluded); RLS filters rows.
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
  auto_organize_run_id
) on table public.transactions to authenticated;

-- Align table RLS with the view filter. Policy helpers revoked in migration 56
-- are not executable by authenticated; transaction_visible_to_caller (security
-- definer) encapsulates the same rules for invoker reads.
drop policy if exists "transactions_select_role_scoped" on public.transactions;

create policy "transactions_select_role_scoped"
  on public.transactions
  for select
  using (public.transaction_visible_to_caller(id));
