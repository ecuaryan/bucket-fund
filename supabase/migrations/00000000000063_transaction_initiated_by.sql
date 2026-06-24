-- Parent-initiated takes share send ledger shape but record who clicked Take.

alter table public.transactions
  add column initiated_by_member_id uuid references public.family_members(id) on delete set null,
  add column initiated_by_member_name text;

create or replace function public.return_from_child(
  p_from_child_id uuid,
  p_amount numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_member_id uuid := public.auth_member_id();
  v_caller_role      text := public.auth_role();
  v_caller_family    uuid := public.auth_family_id();
  v_caller_name      text;
  v_child_role       text;
  v_child_family     uuid;
  v_child_name       text;
  v_available        numeric;
  v_from_member_balance_before numeric;
  v_from_member_balance_after numeric;
  v_float_balance_before numeric;
  v_float_balance_after numeric;
  v_transaction_id   uuid;
begin
  if v_caller_member_id is null or v_caller_family is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if v_caller_role not in ('admin', 'member') then
    raise exception 'only adults can return money from a child' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;

  if p_from_child_id is null then
    raise exception 'child is required' using errcode = '22023';
  end if;

  if p_note is not null and length(p_note) > 280 then
    raise exception 'note too long' using errcode = '22001';
  end if;

  select name
    into v_caller_name
    from public.family_members
   where id = v_caller_member_id;

  select family_id, role, name
    into v_child_family, v_child_role, v_child_name
    from public.family_members
   where id = p_from_child_id
   for update;

  if not found then
    raise exception 'child not found' using errcode = 'P0002';
  end if;

  if v_child_family <> v_caller_family then
    raise exception 'child not in your family' using errcode = '42501';
  end if;

  if v_child_role <> 'child' then
    raise exception 'member is not a child' using errcode = '22023';
  end if;

  if public.member_has_linked_account(p_from_child_id) then
    raise exception 'that child has a linked bank account — settle through the bank'
      using errcode = '22023';
  end if;

  v_available := public.member_float(p_from_child_id);
  if coalesce(v_available, 0) < p_amount then
    raise exception 'insufficient float balance' using errcode = '23514';
  end if;

  v_from_member_balance_before := public.member_child_virtual_balance(p_from_child_id);
  v_from_member_balance_after := v_from_member_balance_before - p_amount;
  v_float_balance_before := public.member_float(v_caller_member_id);

  insert into public.transactions (
    family_id,
    type,
    amount,
    from_member_id,
    to_member_id,
    from_member_name,
    to_member_name,
    initiated_by_member_id,
    initiated_by_member_name,
    from_member_balance_before,
    from_member_balance_after,
    to_member_balance_before,
    to_member_balance_after,
    float_balance_before,
    float_balance_after,
    note
  ) values (
    v_caller_family,
    'send',
    p_amount,
    p_from_child_id,
    v_caller_member_id,
    v_child_name,
    v_caller_name,
    v_caller_member_id,
    v_caller_name,
    v_from_member_balance_before,
    v_from_member_balance_after,
    null,
    null,
    v_float_balance_before,
    null,
    p_note
  )
  returning id into v_transaction_id;

  v_float_balance_after := public.member_float(v_caller_member_id);
  update public.transactions
     set float_balance_after = v_float_balance_after
   where id = v_transaction_id;

  return v_transaction_id;
end;
$$;

revoke all on function public.return_from_child(uuid, numeric, text) from public;
grant execute on function public.return_from_child(uuid, numeric, text) to authenticated;
grant execute on function public.return_from_child(uuid, numeric, text) to service_role;

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
  t.initiated_by_member_id,
  t.initiated_by_member_name,
  t.from_member_balance_before,
  t.from_member_balance_after,
  t.to_member_balance_before,
  t.to_member_balance_after,
  public.client_float_balance_before(t.id)::numeric(14, 2) as float_balance_before,
  public.client_float_balance_after(t.id)::numeric(14, 2) as float_balance_after,
  t.note,
  t.created_at,
  t.auto_organize_run_id,
  r.trigger as auto_organize_run_trigger,
  ao.auto_organize_kind
from public.transactions t
left join public.auto_organize_runs r on r.id = t.auto_organize_run_id
left join public.auto_organizes ao on ao.id = r.auto_organize_id
where public.transaction_visible_to_caller(t.id);

comment on view public.transactions_client is
  'Authenticated SELECT surface for History. security_invoker view; row visibility via '
  'transaction_visible_to_caller. Float snapshots redacted for child role via '
  'client_float_balance_* helpers; float columns are not granted on transactions.';

revoke all on public.transactions_client from public;
grant select on public.transactions_client to authenticated;
grant select on public.transactions_client to service_role;
