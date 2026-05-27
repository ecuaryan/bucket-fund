-- Adults (admin + member) share one family pool; sending to each other is not allowed.

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
