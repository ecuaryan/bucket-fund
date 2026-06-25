-- =====================================================================
-- BucketFund: rename the transaction "send" type value to "give"
-- =====================================================================
--
-- The user-facing flow and route are already "Give"; this renames the
-- internal datum to match. transactions.type 'send' -> 'give', and the
-- send_money() RPC -> give_money(). Every security-definer function that
-- inserts or filters the type value is redefined in lockstep. Function
-- bodies are reproduced verbatim from their latest definitions with only
-- the 'send' value token swapped (and the RPC name / a few error
-- messages). The full DB test suite covers balances, visibility,
-- give_money, and return_from_child.
-- =====================================================================

-- 1. Swap the allowed-values CHECK and migrate existing rows.
alter table public.transactions
  drop constraint if exists transactions_type_check;
update public.transactions set type = 'give' where type = 'send';
alter table public.transactions
  add constraint transactions_type_check check (type in ('bucket_move', 'give'));

-- 2. Shape trigger: accept 'give' (was 'send').
create or replace function public.transactions_validate_shape()
returns trigger
language plpgsql
as $$
begin
  if new.type = 'bucket_move' then
    if new.from_bucket_id is null and new.to_bucket_id is null then
      raise exception 'bucket_move requires at least one of from_bucket_id or to_bucket_id'
        using errcode = '22023';
    end if;
  elsif new.type = 'give' then
    if new.from_member_id is null or new.to_member_id is null then
      raise exception 'give requires both from_member_id and to_member_id'
        using errcode = '22023';
    end if;
  else
    raise exception 'unknown transaction type: %', new.type
      using errcode = '22023';
  end if;
  return new;
end;
$$;

-- 3. Child virtual balance (net gives).
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
     and t.type = 'give';

  -- Total funded to this child (linked cash + net sends). Child bucket
  -- allocations are internal; adults must not "reclaim" unallocated when
  -- a child moves money into their own buckets.
  return v_cash + v_send_net;
end;
$$;

-- 4. Member float (net gives).
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
     and t.type = 'give';

  return v_cash + v_send_net - v_allocated;
end;
$$;

-- 5. Transaction visibility (give rows).
create or replace function public.transaction_visible_to_caller(p_transaction_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.transactions t
     where t.id = p_transaction_id
       and t.family_id = public.auth_family_id()
       and (
         (
           public.auth_role() = 'admin'
           and (
             t.type = 'give'
             or (
               t.type = 'bucket_move'
               and not public.bucket_move_is_child_internal(
                 t.from_member_id,
                 t.from_bucket_id,
                 t.to_bucket_id
               )
             )
           )
         )
         or (
           public.auth_role() = 'member'
           and (
             t.type = 'give'
             or (
               t.type = 'bucket_move'
               and (
                 t.from_bucket_id is null
                 or public.bucket_visible_to_adults(t.from_bucket_id)
               )
               and (
                 t.to_bucket_id is null
                 or public.bucket_visible_to_adults(t.to_bucket_id)
               )
             )
           )
         )
         or (
           public.auth_role() = 'child'
           and (
             t.from_member_id = public.auth_member_id()
             or t.to_member_id = public.auth_member_id()
             or t.from_bucket_id in (
               select id
                 from public.buckets
                where owner_member_id = public.auth_member_id()
             )
             or t.to_bucket_id in (
               select id
                 from public.buckets
                where owner_member_id = public.auth_member_id()
             )
           )
         )
       )
  );
$$;

-- 6. Client float snapshots (give rows).
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
          t.type = 'give'
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
          t.type = 'give'
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

-- 7. give_money() RPC (was send_money), inserts type 'give'.
create or replace function public.give_money(
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
  v_caller_name      text;
  v_to_role          text;
  v_to_family        uuid;
  v_to_name          text;
  v_available        numeric;
  v_float_member_id uuid;
  v_from_member_balance_before numeric;
  v_from_member_balance_after numeric;
  v_to_member_balance_before numeric;
  v_to_member_balance_after numeric;
  v_float_balance_before numeric;
  v_float_balance_after numeric;
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
    raise exception 'cannot give to yourself' using errcode = '22023';
  end if;

  if p_note is not null and length(p_note) > 280 then
    raise exception 'note too long' using errcode = '22001';
  end if;

  select name
    into v_caller_name
    from public.family_members
   where id = v_caller_member_id;

  select family_id, role, name
    into v_to_family, v_to_role, v_to_name
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
    raise exception 'your linked account settles at the bank, not by giving'
      using errcode = '22023';
  end if;

  if public.member_has_linked_account(p_to_member_id) then
    raise exception 'that member has a linked bank account — settle through the bank'
      using errcode = '22023';
  end if;

  if v_caller_role in ('admin', 'member') and v_to_role in ('admin', 'member') then
    raise exception 'adults share one pool — give to a child instead' using errcode = '22023';
  end if;

  if v_caller_role in ('admin', 'member') and v_to_role = 'child' then
    v_available := public.member_float(v_caller_member_id);
    if coalesce(v_available, 0) < p_amount then
      raise exception 'insufficient float balance' using errcode = '23514';
    end if;
    v_float_member_id := v_caller_member_id;
    v_float_balance_before := v_available;
    v_to_member_balance_before := public.member_child_virtual_balance(p_to_member_id);
    v_to_member_balance_after := v_to_member_balance_before + p_amount;
  elsif v_caller_role = 'child' then
    v_available := public.member_float(v_caller_member_id);
    if coalesce(v_available, 0) < p_amount then
      raise exception 'insufficient float balance' using errcode = '23514';
    end if;
    v_from_member_balance_before := public.member_child_virtual_balance(v_caller_member_id);
    v_from_member_balance_after := v_from_member_balance_before - p_amount;
    if v_to_role = 'child' then
      v_to_member_balance_before := public.member_child_virtual_balance(p_to_member_id);
      v_to_member_balance_after := v_to_member_balance_before + p_amount;
    elsif v_to_role in ('admin', 'member') then
      v_float_member_id := p_to_member_id;
      v_float_balance_before := public.member_float(p_to_member_id);
    end if;
  end if;

  insert into public.transactions (
    family_id,
    type,
    amount,
    from_member_id,
    to_member_id,
    from_member_name,
    to_member_name,
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
    v_caller_member_id,
    p_to_member_id,
    v_caller_name,
    v_to_name,
    v_from_member_balance_before,
    v_from_member_balance_after,
    v_to_member_balance_before,
    v_to_member_balance_after,
    v_float_balance_before,
    null,
    p_note
  )
  returning id into v_transaction_id;

  if v_float_member_id is not null then
    v_float_balance_after :=
      public.member_float(v_float_member_id);
    update public.transactions
       set float_balance_after = v_float_balance_after
     where id = v_transaction_id;
  end if;

  return v_transaction_id;
end;
$$;

revoke all on function public.give_money(uuid, numeric, text) from public;
grant execute on function public.give_money(uuid, numeric, text) to authenticated;
grant execute on function public.give_money(uuid, numeric, text) to service_role;
drop function if exists public.send_money(uuid, numeric, text);

-- 8. return_from_child(): take shares the give ledger shape.
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
