-- Rename spending_money ledger naming to float (ubiquitous language with UI).
-- NULL bucket id in move_money still means the Float pool.

drop view if exists public.transactions_client;

alter table public.transactions
  rename column spending_money_balance_before to float_balance_before;

alter table public.transactions
  rename column spending_money_balance_after to float_balance_after;

-- Same formula as member_available_balance (migration 16); renamed for ubiquitous language.
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
     and t.type = 'send';

  return v_cash + v_send_net - v_allocated;
end;
$$;

revoke all on function public.member_float(uuid) from public, anon, authenticated;
grant execute on function public.member_float(uuid) to service_role;

-- Same Supabase default-grant gap as member_float (migration 16).
revoke all on function public.member_child_virtual_balance(uuid) from public, anon, authenticated;
grant execute on function public.member_child_virtual_balance(uuid) to service_role;

create or replace function public.get_float_balance()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.member_float(public.auth_member_id());
$$;

revoke all on function public.get_float_balance() from public;
grant execute on function public.get_float_balance() to authenticated;
grant execute on function public.get_float_balance() to service_role;

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
  v_allocated numeric := 0;
  v_children numeric := 0;
  v_children_json jsonb := '[]'::jsonb;
  v_float numeric := 0;
  v_bank_synced timestamptz := null;
begin
  if v_member_id is null or v_family_id is null then
    return jsonb_build_object(
      'float', 0,
      'total_cash', 0,
      'bank_cash', 0,
      'manual_cash', 0,
      'bucket_allocated', 0,
      'children_set_aside', 0,
      'children', '[]'::jsonb,
      'bank_last_synced_at', null
    );
  end if;

  v_float := public.member_float(v_member_id);

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
        public.member_child_virtual_balance(fm.id) as amount
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
            'amount', amount
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
    'bucket_allocated', v_allocated,
    'children_set_aside', v_children,
    'children', coalesce(v_children_json, '[]'::jsonb),
    'bank_last_synced_at', v_bank_synced
  );
end;
$$;

create or replace function public.move_money(
  p_from_bucket_id uuid,
  p_to_bucket_id uuid,
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
  v_from_family      uuid;
  v_to_family        uuid;
  v_from_owner       uuid;
  v_to_owner         uuid;
  v_from_balance     numeric;
  v_from_balance_after numeric;
  v_to_balance_before numeric;
  v_to_balance_after numeric;
  v_from_name        text;
  v_to_name          text;
  v_float_before numeric;
  v_float_after numeric;
  v_float   numeric;
  v_transaction_id   uuid;
begin
  if v_caller_member_id is null or v_caller_family is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;
  if p_from_bucket_id is null and p_to_bucket_id is null then
    raise exception 'at least one bucket must be specified' using errcode = '22023';
  end if;
  if p_from_bucket_id is not distinct from p_to_bucket_id then
    raise exception 'source and destination must differ' using errcode = '22023';
  end if;
  if p_note is not null and length(p_note) > 280 then
    raise exception 'note too long' using errcode = '22001';
  end if;

  if p_from_bucket_id is null or p_to_bucket_id is null then
    v_float_before := public.member_float(v_caller_member_id);
  end if;

  if p_from_bucket_id is not null then
    select family_id, owner_member_id, allocated_amount, name
      into v_from_family, v_from_owner, v_from_balance, v_from_name
      from public.buckets
     where id = p_from_bucket_id
       for update;
    if not found then
      raise exception 'source bucket not found' using errcode = 'P0002';
    end if;
    if v_from_family <> v_caller_family then
      raise exception 'source bucket not in your family' using errcode = '42501';
    end if;
    if v_caller_role = 'child' and v_from_owner is distinct from v_caller_member_id then
      raise exception 'children can only move from their own buckets'
        using errcode = '42501';
    end if;
    if v_from_balance < p_amount then
      raise exception 'insufficient funds in source bucket' using errcode = '23514';
    end if;
    v_from_balance_after := v_from_balance - p_amount;
  elsif v_caller_role = 'child' then
    v_float := public.member_float(v_caller_member_id);
    if v_float < p_amount then
      raise exception 'insufficient float balance' using errcode = '23514';
    end if;
  end if;

  if p_to_bucket_id is not null then
    select family_id, owner_member_id, allocated_amount, name
      into v_to_family, v_to_owner, v_to_balance_before, v_to_name
      from public.buckets
     where id = p_to_bucket_id
       for update;
    if not found then
      raise exception 'destination bucket not found' using errcode = 'P0002';
    end if;
    if v_to_family <> v_caller_family then
      raise exception 'destination bucket not in your family' using errcode = '42501';
    end if;
    if v_caller_role = 'child' and v_to_owner is distinct from v_caller_member_id then
      raise exception 'children can only move to their own buckets'
        using errcode = '42501';
    end if;
    v_to_balance_after := v_to_balance_before + p_amount;
  end if;

  if p_from_bucket_id is not null then
    update public.buckets
       set allocated_amount = allocated_amount - p_amount
     where id = p_from_bucket_id;
  end if;
  if p_to_bucket_id is not null then
    update public.buckets
       set allocated_amount = allocated_amount + p_amount
     where id = p_to_bucket_id;
  end if;

  if p_from_bucket_id is null or p_to_bucket_id is null then
    v_float_after := public.member_float(v_caller_member_id);
  end if;

  insert into public.transactions (
    family_id,
    type,
    amount,
    from_bucket_id,
    to_bucket_id,
    from_bucket_name,
    to_bucket_name,
    from_bucket_balance_before,
    from_bucket_balance_after,
    to_bucket_balance_before,
    to_bucket_balance_after,
    float_balance_before,
    float_balance_after,
    from_member_id,
    note
  ) values (
    v_caller_family,
    'bucket_move',
    p_amount,
    p_from_bucket_id,
    p_to_bucket_id,
    v_from_name,
    v_to_name,
    v_from_balance,
    v_from_balance_after,
    v_to_balance_before,
    v_to_balance_after,
    v_float_before,
    v_float_after,
    v_caller_member_id,
    p_note
  )
  returning id into v_transaction_id;

  return v_transaction_id;
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
    raise exception 'cannot send to yourself' using errcode = '22023';
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
    'send',
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


drop function if exists public.member_spending_money(uuid);
drop function if exists public.get_spending_money_balance();

-- Client-facing transaction reads: visibility matches transaction_visible_to_caller,
-- and kids never receive shared-pool Float snapshot columns (API/DevTools).

create or replace view public.transactions_client
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
  case
    when public.auth_role() = 'child'
      and (
        t.type = 'send'
        or t.from_member_id is distinct from public.auth_member_id()
      )
    then null::numeric(14, 2)
    else t.float_balance_before
  end as float_balance_before,
  case
    when public.auth_role() = 'child'
      and (
        t.type = 'send'
        or t.from_member_id is distinct from public.auth_member_id()
      )
    then null::numeric(14, 2)
    else t.float_balance_after
  end as float_balance_after,
  t.note,
  t.created_at
from public.transactions t
where public.transaction_visible_to_caller(t.id);

comment on view public.transactions_client is
  'Authenticated SELECT surface for transactions. Redacts shared-pool Float snapshots for child role.';

revoke all on public.transactions_client from public;
grant select on public.transactions_client to authenticated;
grant select on public.transactions_client to service_role;

-- Force reads through the view so redaction cannot be bypassed in DevTools.
revoke select on table public.transactions from authenticated;
