-- =====================================================================
-- Credit cards as liabilities (docs/CREDIT_CARDS.md).
--
-- The ledger identity becomes:
--
--   cash − credit card balances = bucket allocations + Unbucketed
--
-- Card spending behaves like debit spending: a swipe raises card debt,
-- Unbucketed dips, the user covers it from a bucket; paying the
-- statement moves cash and debt down together and nets to zero.
--
-- Sign convention: `accounts.current_balance` on a credit-card row is
-- the amount owed (positive = debt), as Teller reports the ledger
-- balance for credit accounts. A negative card balance (the bank owes
-- the holder after a refund) correctly ADDS to Unbucketed through the
-- same subtraction. Manual cards store the user-entered amount owed.
--
-- Scope (decided 2026-07): credit cards only — loans/mortgages/lines of
-- credit remain excluded from the ledger. Cards are household-level:
-- they can never be assigned to a kid, so kid balance math
-- (`member_child_virtual_balance`, child branch of `member_float`) is
-- intentionally untouched.
-- =====================================================================

-- 1. Classification, beside is_cash_account_type.
create or replace function public.is_credit_card_account_type(p_type text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_type, '')) = 'credit_card';
$$;

-- 2. Cards stay on the household balance — reject child assignment at
--    the database layer (the UI also hides cards from the kid picker,
--    but RLS-layer truth is the contract; see AGENTS.md).
create or replace function public.accounts_reject_child_card_owner()
returns trigger
language plpgsql
as $$
begin
  if new.owner_member_id is not null
     and public.is_credit_card_account_type(new.account_type)
     and exists (
       select 1
         from public.family_members fm
        where fm.id = new.owner_member_id
          and fm.role = 'child'
     ) then
    raise exception 'credit cards stay on the household balance'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists accounts_no_child_card_owner on public.accounts;
create trigger accounts_no_child_card_owner
  before insert or update of owner_member_id, account_type
  on public.accounts
  for each row
  execute function public.accounts_reject_child_card_owner();

-- 3. member_float: household branch subtracts family card debt.
--    Child branch unchanged — kids cannot own cards (trigger above).
create or replace function public.member_float(p_member_id uuid)
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
  v_card_debt   numeric := 0;
  v_allocated   numeric := 0;
  v_child_draw  numeric := 0;
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

    select coalesce(sum(a.current_balance), 0)
      into v_card_debt
      from public.accounts a
     where a.family_id = v_family_id
       and public.is_credit_card_account_type(a.account_type);

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

    select coalesce(sum(public.member_child_virtual_balance(fm.id)), 0)
      into v_child_draw
      from public.family_members fm
     where fm.family_id = v_family_id
       and fm.role = 'child';

    return v_cash - v_card_debt - v_allocated - v_child_draw;
  end if;

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
     and t.type = 'give';

  return v_cash + v_send_net - v_allocated;
end;
$$;

-- 4. Home breakdown: expose family card debt so the hero can show the
--    subtraction. Child branch reports 0 — a child must never read the
--    household's liabilities (same privacy line as shared-pool cash).
create or replace function public.get_home_balance_breakdown()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_member_id uuid := public.auth_member_id();
  v_role text := public.auth_role();
  v_family_id uuid := public.auth_family_id();
  v_cash numeric := 0;
  v_bank_cash numeric := 0;
  v_manual_cash numeric := 0;
  v_card_debt numeric := 0;
  v_allocated numeric := 0;
  v_children numeric := 0;
  v_children_json jsonb := '[]'::jsonb;
  v_float numeric := 0;
  v_bank_synced timestamptz := null;
  v_has_linked_bank boolean := false;
begin
  if v_member_id is null or v_family_id is null then
    return jsonb_build_object(
      'float', 0,
      'total_cash', 0,
      'bank_cash', 0,
      'manual_cash', 0,
      'card_debt', 0,
      'bucket_allocated', 0,
      'children_set_aside', 0,
      'children', '[]'::jsonb,
      'bank_last_synced_at', null,
      'has_linked_bank', false
    );
  end if;

  v_float := public.member_float(v_member_id);
  v_has_linked_bank := public.member_has_linked_account(v_member_id);

  select max(a.last_synced_at)
    into v_bank_synced
    from public.accounts a
   where a.family_id = v_family_id
     and public.is_cash_account_type(a.account_type);

  if v_role in ('admin', 'member') then
    select coalesce(sum(a.current_balance), 0)
      into v_cash
      from public.accounts a
     where a.family_id = v_family_id
       and public.is_cash_account_type(a.account_type);

    select coalesce(sum(a.current_balance), 0)
      into v_bank_cash
      from public.accounts a
     where a.family_id = v_family_id
       and a.source = 'teller'
       and public.is_cash_account_type(a.account_type);

    select coalesce(sum(a.current_balance), 0)
      into v_manual_cash
      from public.accounts a
     where a.family_id = v_family_id
       and a.source = 'manual'
       and public.is_cash_account_type(a.account_type);

    select coalesce(sum(a.current_balance), 0)
      into v_card_debt
      from public.accounts a
     where a.family_id = v_family_id
       and public.is_credit_card_account_type(a.account_type);

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

    with child_lines as (
      select
        fm.id as member_id,
        fm.name,
        public.member_child_virtual_balance(fm.id) as amount,
        public.member_float(fm.id) as available_float
      from public.family_members fm
     where fm.family_id = v_family_id
       and fm.role = 'child'
    )
    select
      coalesce(sum(amount), 0),
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'member_id', member_id,
            'name', name,
            'amount', amount,
            'available_float', available_float
          )
          order by name
        ),
        '[]'::jsonb
      )
      into v_children, v_children_json
      from child_lines;

  else
    select coalesce(sum(a.current_balance), 0)
      into v_cash
      from public.accounts a
     where a.family_id = v_family_id
     and a.owner_member_id = v_member_id
     and public.is_cash_account_type(a.account_type);

    v_bank_cash := v_cash;
    v_manual_cash := 0;
    v_card_debt := 0;

    select coalesce(sum(b.allocated_amount), 0)
      into v_allocated
      from public.buckets b
     where b.family_id = v_family_id
       and b.owner_member_id = v_member_id;
  end if;

  return jsonb_build_object(
    'float', v_float,
    'total_cash', v_cash,
    'bank_cash', v_bank_cash,
    'manual_cash', v_manual_cash,
    'card_debt', v_card_debt,
    'bucket_allocated', v_allocated,
    'children_set_aside', v_children,
    'children', coalesce(v_children_json, '[]'::jsonb),
    'bank_last_synced_at', v_bank_synced,
    'has_linked_bank', v_has_linked_bank
  );
end;
$$;

-- 5. Manual credit cards: add_manual_account grows a kind. The old
--    two-argument signature is dropped (a default on the new parameter
--    would leave two candidates and PostgREST rejects the ambiguity).
drop function if exists public.add_manual_account(numeric, text);

create or replace function public.add_manual_account(
  p_amount numeric,
  p_label text,
  p_kind text default 'cash'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.auth_family_id();
  v_role text := public.auth_role();
  v_label text := nullif(btrim(p_label), '');
  v_id uuid;
begin
  if v_family_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_role <> 'admin' then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'amount must be zero or positive' using errcode = '22023';
  end if;
  if v_label is null or length(v_label) > 60 then
    raise exception 'label required (<= 60 chars)' using errcode = '22023';
  end if;
  if p_kind not in ('cash', 'card') then
    raise exception 'kind must be cash or card' using errcode = '22023';
  end if;

  insert into public.accounts (
    family_id,
    owner_member_id,
    source,
    account_type,
    institution_name,
    account_name,
    current_balance,
    teller_account_id,
    teller_enrollment_id,
    last_synced_at
  ) values (
    v_family_id,
    null,
    'manual',
    case p_kind when 'card' then 'credit_card' else 'manual' end,
    v_label,
    v_label,
    p_amount,
    null,
    null,
    now()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.add_manual_account(numeric, text, text) from public;
grant execute on function public.add_manual_account(numeric, text, text) to authenticated;
grant execute on function public.add_manual_account(numeric, text, text) to service_role;
