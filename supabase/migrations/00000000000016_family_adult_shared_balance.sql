-- =====================================================================
-- Admin + member share one family-pool unallocated number on Home.
--
-- Internal sends between adults are history-only (zero sum for the pool).
-- Sends to children reduce the shared adult unallocated (virtual funding).
-- =====================================================================

create or replace function public.member_child_virtual_balance(p_child_member_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_cash numeric := 0;
  v_allocated numeric := 0;
  v_send_net numeric := 0;
begin
  select fm.family_id into v_family_id
    from public.family_members fm
   where fm.id = p_child_member_id
     and fm.role = 'child';

  if not found then
    return 0;
  end if;

  select coalesce(sum(a.current_balance), 0)
    into v_cash
    from public.accounts a
   where a.family_id = v_family_id
     and a.owner_member_id = p_child_member_id
     and public.is_cash_account_type(a.account_type);

  select coalesce(sum(b.allocated_amount), 0)
    into v_allocated
    from public.buckets b
   where b.family_id = v_family_id
     and b.owner_member_id = p_child_member_id;

  select coalesce(sum(
           case
             when t.to_member_id = p_child_member_id then t.amount
             when t.from_member_id = p_child_member_id then -t.amount
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

revoke all on function public.member_child_virtual_balance(uuid) from public;
grant execute on function public.member_child_virtual_balance(uuid) to service_role;

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

    return v_cash - v_allocated - v_child_draw;
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
     and t.type = 'send';

  return v_cash + v_send_net - v_allocated;
end;
$$;

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
  -- Adult → adult: internal transfer; shared pool unallocated unchanged.

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
