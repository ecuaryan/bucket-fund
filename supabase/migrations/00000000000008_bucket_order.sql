-- =====================================================================
-- BucketFund: bucket display order + reorder helper
-- =====================================================================
--
-- Buckets need a stable, user-controlled order. Sorting by
-- `created_at` works as a default but doesn't let people put their
-- most-used bucket at the top.
--
-- Strategy:
--   - Add `display_order` int. Smaller values render first.
--   - Backfill it from `created_at` (oldest first) so existing rows
--     keep their current order.
--   - Default new buckets to the next slot in their family
--     (`max(display_order) + 1`) via a BEFORE INSERT trigger so the
--     client doesn't have to know.
--   - Provide `reorder_bucket(bucket_id, direction)` to swap a
--     bucket with its immediate neighbor, atomically. It validates
--     family scope and silently no-ops at the edges so the UI
--     doesn't have to special-case "already at top/bottom".
--
-- We deliberately don't expose direct UPDATE on `display_order` to
-- clients — the swap function is the only path. That keeps the
-- order space dense (no float-sparse-keys trick needed) and avoids
-- a malicious client setting `display_order = -1` to jump the line.
-- =====================================================================

alter table public.buckets
  add column display_order integer not null default 0;

-- Backfill: each family gets a contiguous 1..N order based on creation time.
with ordered as (
  select id,
         row_number() over (partition by family_id order by created_at, id) as rn
    from public.buckets
)
update public.buckets b
   set display_order = o.rn
  from ordered o
 where b.id = o.id;

create index buckets_family_order_idx
  on public.buckets(family_id, display_order);


-- ---------------------------------------------------------------------
-- Auto-assign display_order on insert if the caller didn't specify one.
-- ---------------------------------------------------------------------
create or replace function public.buckets_assign_display_order()
returns trigger
language plpgsql
as $$
begin
  if new.display_order is null or new.display_order = 0 then
    select coalesce(max(display_order), 0) + 1
      into new.display_order
      from public.buckets
     where family_id = new.family_id;
  end if;
  return new;
end;
$$;

create trigger buckets_assign_display_order_trg
before insert on public.buckets
for each row execute function public.buckets_assign_display_order();


-- ---------------------------------------------------------------------
-- reorder_bucket: atomic neighbor swap.
-- ---------------------------------------------------------------------
create or replace function public.reorder_bucket(
  p_bucket_id uuid,
  p_direction text  -- 'up' or 'down'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_family uuid := public.auth_family_id();
  v_caller_role   text := public.auth_role();
  v_family        uuid;
  v_order         int;
  v_neighbor_id   uuid;
  v_neighbor_order int;
begin
  if v_caller_family is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_caller_role = 'child' then
    raise exception 'children cannot reorder buckets' using errcode = '42501';
  end if;
  if p_direction not in ('up', 'down') then
    raise exception 'direction must be up or down' using errcode = '22023';
  end if;

  select family_id, display_order
    into v_family, v_order
    from public.buckets
   where id = p_bucket_id
     for update;
  if not found then
    raise exception 'bucket not found' using errcode = 'P0002';
  end if;
  if v_family <> v_caller_family then
    raise exception 'bucket not in your family' using errcode = '42501';
  end if;

  -- Find the neighbor in the requested direction.
  if p_direction = 'up' then
    select id, display_order
      into v_neighbor_id, v_neighbor_order
      from public.buckets
     where family_id = v_family
       and display_order < v_order
     order by display_order desc
     limit 1
       for update;
  else
    select id, display_order
      into v_neighbor_id, v_neighbor_order
      from public.buckets
     where family_id = v_family
       and display_order > v_order
     order by display_order asc
     limit 1
       for update;
  end if;

  -- No neighbor in that direction — silent no-op so the UI doesn't
  -- need to disable the button at the edges.
  if v_neighbor_id is null then
    return;
  end if;

  -- Swap. The unique-on-(family_id, display_order) constraint isn't
  -- enforced (intentionally — no constraint to fight during swaps),
  -- so we can update both rows in either order.
  update public.buckets
     set display_order = v_neighbor_order
   where id = p_bucket_id;
  update public.buckets
     set display_order = v_order
   where id = v_neighbor_id;
end;
$$;

revoke all on function public.reorder_bucket(uuid, text) from public;
grant execute on function public.reorder_bucket(uuid, text) to authenticated;
grant execute on function public.reorder_bucket(uuid, text) to service_role;
