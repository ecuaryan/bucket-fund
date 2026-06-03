-- =====================================================================
-- Block virtual sends when a child has a Teller-linked account.
-- Linked children settle money at the bank; virtual sends would drift
-- the ledger from real balances.
-- =====================================================================

create or replace function public.member_has_linked_account(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.accounts a
     where a.owner_member_id = p_member_id
       and a.source = 'teller'
  );
$$;

revoke all on function public.member_has_linked_account(uuid) from public;
grant execute on function public.member_has_linked_account(uuid) to service_role;

create or replace function public.family_linked_child_member_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct fm.id), '{}'::uuid[])
    from public.family_members fm
    join public.accounts a
      on a.owner_member_id = fm.id
     and a.source = 'teller'
   where fm.family_id = public.auth_family_id()
     and fm.role = 'child';
$$;

revoke all on function public.family_linked_child_member_ids() from public;
grant execute on function public.family_linked_child_member_ids() to authenticated;
grant execute on function public.family_linked_child_member_ids() to service_role;

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
  v_caller_role      text := public.auth_role();
  v_caller_family    uuid := public.auth_family_id();
  v_to_role          text;
  v_to_family        uuid;
  v_available        numeric;
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

  select family_id, role
    into v_to_family, v_to_role
    from public.family_members
   where id = p_to_member_id
   for update;

  if not found then
    raise exception 'recipient not found' using errcode = 'P0002';
  end if;

  if v_to_family <> v_caller_family then
    raise exception 'recipient not in your family' using errcode = '42501';
  end if;

  if public.member_has_linked_account(v_caller_member_id) then
    raise exception 'your linked account settles at the bank, not by sending'
      using errcode = '22023';
  end if;

  if public.member_has_linked_account(p_to_member_id) then
    raise exception 'that member has a linked bank account — settle through the bank'
      using errcode = '22023';
  end if;

  if v_caller_role in ('admin', 'member') and v_to_role in ('admin', 'member') then
    raise exception 'adults share one pool — send to a child instead' using errcode = '22023';
  end if;

  if v_caller_role in ('admin', 'member') and v_to_role = 'child' then
    v_available := public.member_available_balance(v_caller_member_id);
    if coalesce(v_available, 0) < p_amount then
      raise exception 'insufficient unallocated balance' using errcode = '23514';
    end if;
  elsif v_caller_role = 'child' then
    v_available := public.member_available_balance(v_caller_member_id);
    if coalesce(v_available, 0) < p_amount then
      raise exception 'insufficient unallocated balance' using errcode = '23514';
    end if;
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
