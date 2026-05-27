-- =====================================================================
-- BucketFund: move_money() — the headline operation
-- =====================================================================
--
-- Allocating money between buckets (or between a bucket and the
-- "unallocated" pool) is the atomic core of this app. We expose it
-- as a SECURITY DEFINER function so:
--
--   - The bucket update + transaction insert happen inside a single
--     SQL statement, so an interleaved request can never see the
--     buckets in an inconsistent half-moved state. We explicitly
--     `for update` the affected rows to serialise concurrent moves
--     against the same buckets.
--   - All authorization (role, family scope, source balance) is
--     enforced server-side. The client RPC interface is the only
--     write path, which gives us one place to audit.
--   - As defense in depth we also revoke the `UPDATE` privilege on
--     `buckets.allocated_amount` from `authenticated`, so a
--     malicious client that bypasses the function entirely still
--     cannot move money. They can still rename buckets etc. via
--     a column-scoped grant on the safe columns.
--
-- Conventions:
--   - `p_from_bucket_id IS NULL` means "from the unallocated pool".
--   - `p_to_bucket_id   IS NULL` means "to the unallocated pool".
--   - At least one of from/to must be a real bucket, otherwise the
--     move is a no-op against the pool, which we reject.
--   - Children are blocked. Members + admins can move money for
--     buckets in their own family.
-- =====================================================================

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
  v_from_balance     numeric;
  v_transaction_id   uuid;
begin
  -- AuthN/AuthZ -------------------------------------------------------
  if v_caller_member_id is null or v_caller_family is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_caller_role = 'child' then
    raise exception 'children cannot move money' using errcode = '42501';
  end if;

  -- Validation --------------------------------------------------------
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;
  if p_from_bucket_id is null and p_to_bucket_id is null then
    raise exception 'at least one bucket must be specified' using errcode = '22023';
  end if;
  if p_from_bucket_id is not distinct from p_to_bucket_id then
    raise exception 'source and destination must differ' using errcode = '22023';
  end if;
  -- Note length cap mirrors common UI sizing; tweak if the UX changes.
  if p_note is not null and length(p_note) > 280 then
    raise exception 'note too long' using errcode = '22001';
  end if;

  -- Lock and verify source bucket -------------------------------------
  if p_from_bucket_id is not null then
    select family_id, allocated_amount
      into v_from_family, v_from_balance
      from public.buckets
     where id = p_from_bucket_id
       for update;
    if not found then
      raise exception 'source bucket not found' using errcode = 'P0002';
    end if;
    if v_from_family <> v_caller_family then
      raise exception 'source bucket not in your family' using errcode = '42501';
    end if;
    if v_from_balance < p_amount then
      raise exception 'insufficient funds in source bucket' using errcode = '23514';
    end if;
  end if;

  -- Lock and verify destination bucket --------------------------------
  if p_to_bucket_id is not null then
    select family_id
      into v_to_family
      from public.buckets
     where id = p_to_bucket_id
       for update;
    if not found then
      raise exception 'destination bucket not found' using errcode = 'P0002';
    end if;
    if v_to_family <> v_caller_family then
      raise exception 'destination bucket not in your family' using errcode = '42501';
    end if;
  end if;

  -- Apply the move ----------------------------------------------------
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

  -- Audit -------------------------------------------------------------
  insert into public.transactions (
    family_id,
    type,
    amount,
    from_bucket_id,
    to_bucket_id,
    from_member_id,
    note
  ) values (
    v_caller_family,
    'bucket_move',
    p_amount,
    p_from_bucket_id,
    p_to_bucket_id,
    v_caller_member_id,
    p_note
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

revoke all on function public.move_money(uuid, uuid, numeric, text) from public;
grant execute on function public.move_money(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.move_money(uuid, uuid, numeric, text) to service_role;


-- ---------------------------------------------------------------------
-- Lock down direct mutation of `buckets.allocated_amount`.
--
-- Without this, a malicious client could call
-- `update buckets set allocated_amount = 1000000 where ...` directly
-- and bypass the move_money invariant entirely. RLS still applies but
-- RLS doesn't gate columns — only rows. Postgres column-level grants
-- do, so we revoke UPDATE wholesale and re-grant it only on the
-- columns that are safe for clients to modify.
-- ---------------------------------------------------------------------
revoke update on public.buckets from authenticated;
grant update (name, owner_member_id) on public.buckets to authenticated;
