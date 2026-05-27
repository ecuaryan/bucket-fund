-- =====================================================================
-- BucketFund: send_money() — virtual member-to-member transfers
-- =====================================================================
--
-- Sends move purchasing power between family members without touching
-- bucket allocations. Available balance for the sender mirrors Home:
--   cash (role-scoped accounts) + net sends − bucket allocations.
--
-- Inserts are only allowed through this function (and move_money);
-- direct INSERT on transactions is revoked from authenticated.
-- =====================================================================

create or replace function public.is_cash_account_type(p_type text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_type, '')) in (
    'checking',
    'savings',
    'money_market',
    'certificate_of_deposit',
    'cash_management',
    'treasury'
  );
$$;

-- Internal: spending power for a member (matches Home unallocated logic).
create or replace function public.member_available_balance(p_member_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_family_id   uuid;
  v_role        text;
  v_cash        numeric := 0;
  v_allocated   numeric := 0;
  v_send_net    numeric := 0;
begin
  select fm.family_id, fm.role
    into v_family_id, v_role
    from public.family_members fm
   where fm.id = p_member_id;

  if not found then
    return 0;
  end if;

  if v_role in ('admin', 'member') then
    select coalesce(sum(a.current_balance), 0)
      into v_cash
      from public.accounts a
     where a.family_id = v_family_id
       and public.is_cash_account_type(a.account_type);

    select coalesce(sum(b.allocated_amount), 0)
      into v_allocated
      from public.buckets b
     where b.family_id = v_family_id
       and (
         b.owner_member_id is null
         or exists (
           select 1
             from public.family_members fm
            where fm.id = b.owner_member_id
              and fm.role in ('admin', 'member')
         )
       );
  else
    select coalesce(sum(a.current_balance), 0)
      into v_cash
      from public.accounts a
     where a.family_id = v_family_id
       and a.owner_member_id = p_member_id
       and public.is_cash_account_type(a.account_type);

    select coalesce(sum(b.allocated_amount), 0)
      into v_allocated
      from public.buckets b
     where b.family_id = v_family_id
       and b.owner_member_id = p_member_id;
  end if;

  select coalesce(sum(
           case
             when t.to_member_id = p_member_id then t.amount
             when t.from_member_id = p_member_id then -t.amount
             else 0
           end
         ), 0)
    into v_send_net
    from public.transactions t
   where t.family_id = v_family_id
     and t.type = 'send';

  return v_cash + v_send_net - v_allocated;
end;
$$;

revoke all on function public.member_available_balance(uuid) from public;
grant execute on function public.member_available_balance(uuid) to service_role;

create or replace function public.get_available_balance()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.member_available_balance(public.auth_member_id());
$$;

revoke all on function public.get_available_balance() from public;
grant execute on function public.get_available_balance() to authenticated;
grant execute on function public.get_available_balance() to service_role;

create or replace function public.send_money(
  p_to_member_id uuid,
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
  v_caller_family    uuid := public.auth_family_id();
  v_available        numeric;
  v_to_family        uuid;
  v_transaction_id   uuid;
begin
  if v_caller_member_id is null or v_caller_family is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;

  if p_to_member_id is null then
    raise exception 'recipient is required' using errcode = '22023';
  end if;

  if p_to_member_id = v_caller_member_id then
    raise exception 'cannot send to yourself' using errcode = '22023';
  end if;

  if p_note is not null and length(p_note) > 280 then
    raise exception 'note too long' using errcode = '22001';
  end if;

  select family_id
    into v_to_family
    from public.family_members
   where id = p_to_member_id
   for update;

  if not found then
    raise exception 'recipient not found' using errcode = 'P0002';
  end if;

  if v_to_family <> v_caller_family then
    raise exception 'recipient not in your family' using errcode = '42501';
  end if;

  v_available := public.member_available_balance(v_caller_member_id);

  if coalesce(v_available, 0) < p_amount then
    raise exception 'insufficient unallocated balance' using errcode = '23514';
  end if;

  insert into public.transactions (
    family_id,
    type,
    amount,
    from_member_id,
    to_member_id,
    note
  ) values (
    v_caller_family,
    'send',
    p_amount,
    v_caller_member_id,
    p_to_member_id,
    p_note
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

revoke all on function public.send_money(uuid, numeric, text) from public;
grant execute on function public.send_money(uuid, numeric, text) to authenticated;
grant execute on function public.send_money(uuid, numeric, text) to service_role;

-- Only move_money / send_money may append transactions.
revoke insert on table public.transactions from authenticated;

drop policy if exists "transactions_insert_self" on public.transactions;
