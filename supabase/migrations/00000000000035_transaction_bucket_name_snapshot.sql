-- =====================================================================
-- Snapshot bucket names on bucket_move rows for durable History labels.
-- Live joins break when a bucket is deleted (ON DELETE SET NULL) or when
-- both endpoints were unallocated-adjacent and one side nulls out.
-- =====================================================================

alter table public.transactions
  add column from_bucket_name text,
  add column to_bucket_name text;

update public.transactions t
   set from_bucket_name = b.name
  from public.buckets b
 where t.type = 'bucket_move'
   and t.from_bucket_id = b.id;

update public.transactions t
   set to_bucket_name = b.name
  from public.buckets b
 where t.type = 'bucket_move'
   and t.to_bucket_id = b.id;

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
  v_from_name        text;
  v_to_name          text;
  v_unallocated      numeric;
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
  elsif v_caller_role = 'child' then
    v_unallocated := public.member_available_balance(v_caller_member_id);
    if v_unallocated < p_amount then
      raise exception 'insufficient unallocated balance' using errcode = '23514';
    end if;
  end if;

  if p_to_bucket_id is not null then
    select family_id, owner_member_id, name
      into v_to_family, v_to_owner, v_to_name
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

  insert into public.transactions (
    family_id,
    type,
    amount,
    from_bucket_id,
    to_bucket_id,
    from_bucket_name,
    to_bucket_name,
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
    v_caller_member_id,
    p_note
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;
