-- =====================================================================
-- Settle a linked kid's leftover VIRTUAL money via Take.
--
-- A kid's balance is linked cash + net gives (member_child_virtual_
-- balance). The model assumes a kid is either virtual OR linked — but a
-- kid can end up with both (real case: gives accumulated while the
-- Teller outage left kids unlinked, then re-linking via SimpleFIN
-- stacked bank cash on top of the old gives, double-counting money and
-- depressing family Unbucketed via child_draw).
--
-- return_from_child previously blocked linked kids entirely ("settle
-- through the bank"), leaving NO in-app way to clear that residue. Now:
--
--   * virtual kid  → Take caps at their TOTAL balance (migration 85)
--   * linked kid   → Take caps at their NET GIVES only — the virtual
--     component. Bank cash stays untouchable virtually; real money
--     still moves at the real bank.
--
-- We deliberately do NOT auto-clear gives when an account is assigned:
-- the app can't know whether the virtual dollars were actually
-- deposited into the kid's real account. The adult decides, and the
-- Take leaves a normal visible transaction either way.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. member_child_give_net: net gives for a child (positive = family
--    has funded them). The send-net half of member_child_virtual_balance,
--    extracted so return_from_child and the breakdown can reuse it.
-- ---------------------------------------------------------------------
create or replace function public.member_child_give_net(p_child_member_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
           case
             when t.to_member_id = p_child_member_id then t.amount
             when t.from_member_id = p_child_member_id then -t.amount
             else 0
           end
         ), 0)
    from public.transactions t
    join public.family_members fm
      on fm.id = p_child_member_id
     and fm.role = 'child'
   where t.family_id = fm.family_id
     and t.type = 'give';
$$;

revoke all on function public.member_child_give_net(uuid) from public;
revoke all on function public.member_child_give_net(uuid) from authenticated;
grant execute on function public.member_child_give_net(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 2. return_from_child: linked kids may have their virtual component
--    taken back. Identical to migration 85 except the linked-kid branch.
-- ---------------------------------------------------------------------
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
    -- Linked kid: only the VIRTUAL component (net gives) is takeable —
    -- bank cash moves at the real bank. This is the settle path for a
    -- kid who accumulated gives while unlinked and then re-linked.
    v_available := public.member_child_give_net(p_from_child_id);
    if coalesce(v_available, 0) < p_amount then
      raise exception 'amount exceeds the child''s virtual money — bank money moves at the bank'
        using errcode = '23514';
    end if;
  else
    -- Virtual kid: cap at their TOTAL balance (migration 85). Bucket
    -- labels don't shield money; the kid rebalances afterwards.
    v_available := public.member_child_virtual_balance(p_from_child_id);
    if coalesce(v_available, 0) < p_amount then
      raise exception 'amount exceeds the child''s balance' using errcode = '23514';
    end if;
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
    'give',
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

-- ---------------------------------------------------------------------
-- 3. get_home_balance_breakdown: child lines gain give_net so the Kids
--    page can offer Take on a linked kid carrying virtual money (and cap
--    the sheet at it). Otherwise identical to migration 84's definition.
-- ---------------------------------------------------------------------
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

  -- Linked accounts only: a manual edit is not a refresh.
  select max(a.last_synced_at)
    into v_bank_synced
    from public.accounts a
   where a.family_id = v_family_id
     and a.source <> 'manual'
     and (
       public.is_cash_account_type(a.account_type)
       or public.is_credit_card_account_type(a.account_type)
     );

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
       and a.source <> 'manual'
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
        public.member_float(fm.id) as available_float,
        public.member_child_give_net(fm.id) as give_net
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
            'available_float', available_float,
            'give_net', give_net
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
