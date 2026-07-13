-- =====================================================================
-- Take from a kid caps at their TOTAL balance, not their Unbucketed.
--
-- Previously return_from_child required the amount to fit in the kid's
-- own float (member_float), so a kid could block a parent's Take just by
-- moving everything into buckets. That inverted the household authority
-- model — and contradicted how the app treats every other cash movement:
-- money moves first, buckets stay put, and a negative red Unbucketed is
-- the signal for the OWNER of those buckets to rebalance on purpose.
--
-- New rule: an adult may take any amount up to the kid's total virtual
-- balance (member_child_virtual_balance). If the kid's bucket labels
-- exceed what's left, their Unbucketed goes red and they decide which
-- bucket fills the hole — same trade-off adults face after overspending.
-- Taking MORE than the kid's total stays blocked: that would flip the
-- kid's balance negative (a debt the model doesn't have).
--
-- Everything except the availability check is identical to the prior
-- definition (migrations 62/63/66).
-- =====================================================================

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

  -- Cap at the kid's TOTAL balance, not their Unbucketed: bucket labels
  -- don't shield money from an adult Take. The kid rebalances afterwards
  -- (negative red Unbucketed), exactly like an adult who overspent.
  v_available := public.member_child_virtual_balance(p_from_child_id);
  if coalesce(v_available, 0) < p_amount then
    raise exception 'amount exceeds the child''s balance' using errcode = '23514';
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
