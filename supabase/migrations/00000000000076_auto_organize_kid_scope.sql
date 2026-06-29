-- Kid self-serve auto-organize.
--
-- `auto_organizes.owner_member_id`:
--   null      -> household pool rule (admin-owned, targets family-pool buckets) — unchanged.
--   non-null  -> that child's PRIVATE rule, targeting their OWN buckets and moving
--                their OWN Float. Invisible to admins and shared members (RLS below),
--                so "parents don't need to know" holds — same as kids' own buckets today.
--
-- The engine is otherwise identical for both: organize / top_up / save_off,
-- interval / monthly / manual cadences, the hourly cron, and the run RPCs.
-- Linked vs virtual kids need no special-casing — auto-organize only moves
-- Float <-> the owner's buckets and never touches send/give or the bank.

alter table public.auto_organizes
  add column owner_member_id uuid references public.family_members(id) on delete cascade;

create index auto_organizes_owner_member_id_idx
  on public.auto_organizes(owner_member_id);

-- ---------------------------------------------------------------------
-- Float -> bucket apply line, now scoped to the rule's owner instead of
-- hardcoding "family-pool only". p_owner_member_id is the rule's owner:
-- null for household (bucket owner must be null), a member id for a kid
-- (bucket owner must equal that member).
-- ---------------------------------------------------------------------
drop function if exists public._auto_organize_apply_line(
  uuid, uuid, numeric, text, uuid, uuid, uuid
);

create function public._auto_organize_apply_line(
  p_family_id uuid,
  p_owner_member_id uuid,
  p_to_bucket_id uuid,
  p_amount numeric,
  p_note text,
  p_float_member_id uuid,
  p_from_member_id uuid,
  p_auto_organize_run_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_to_family uuid;
  v_to_owner uuid;
  v_to_balance_before numeric;
  v_to_balance_after numeric;
  v_to_name text;
  v_float_before numeric;
  v_float_after numeric;
  v_transaction_id uuid;
begin
  select family_id, owner_member_id, allocated_amount, name
    into v_to_family, v_to_owner, v_to_balance_before, v_to_name
    from public.buckets
   where id = p_to_bucket_id
     for update;

  if not found then
    raise exception 'destination bucket not found' using errcode = 'P0002';
  end if;
  if v_to_family <> p_family_id then
    raise exception 'destination bucket not in family' using errcode = '42501';
  end if;
  if v_to_owner is distinct from p_owner_member_id then
    raise exception 'auto-organize line must target the rule owner''s bucket'
      using errcode = '22023';
  end if;

  v_float_before := public.member_float(p_float_member_id);
  v_to_balance_after := v_to_balance_before + p_amount;

  update public.buckets
     set allocated_amount = allocated_amount + p_amount
   where id = p_to_bucket_id;

  v_float_after := public.member_float(p_float_member_id);

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
    note,
    auto_organize_run_id
  ) values (
    p_family_id,
    'bucket_move',
    p_amount,
    null,
    p_to_bucket_id,
    null,
    v_to_name,
    null,
    null,
    v_to_balance_before,
    v_to_balance_after,
    v_float_before,
    v_float_after,
    p_from_member_id,
    p_note,
    p_auto_organize_run_id
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

revoke all on function public._auto_organize_apply_line(
  uuid, uuid, uuid, numeric, text, uuid, uuid, uuid
) from public;
grant execute on function public._auto_organize_apply_line(
  uuid, uuid, uuid, numeric, text, uuid, uuid, uuid
) to service_role;

-- ---------------------------------------------------------------------
-- save_off sweep line, owner-scoped. Source and (optional) destination
-- buckets must both belong to the rule owner.
-- ---------------------------------------------------------------------
drop function if exists public._auto_organize_sweep_line(
  uuid, uuid, uuid, numeric, text, uuid, uuid, uuid
);

create function public._auto_organize_sweep_line(
  p_family_id uuid,
  p_owner_member_id uuid,
  p_from_bucket_id uuid,
  p_to_bucket_id uuid,
  p_amount numeric,
  p_note text,
  p_float_member_id uuid,
  p_from_member_id uuid,
  p_auto_organize_run_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_family uuid;
  v_from_owner uuid;
  v_from_balance_before numeric;
  v_from_balance_after numeric;
  v_from_name text;
  v_to_family uuid;
  v_to_owner uuid;
  v_to_balance_before numeric;
  v_to_balance_after numeric;
  v_to_name text;
  v_float_before numeric;
  v_float_after numeric;
  v_transaction_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;
  if p_from_bucket_id is null then
    raise exception 'source bucket required' using errcode = '22023';
  end if;
  if p_from_bucket_id is not distinct from p_to_bucket_id then
    raise exception 'source and destination must differ' using errcode = '22023';
  end if;

  select family_id, owner_member_id, allocated_amount, name
    into v_from_family, v_from_owner, v_from_balance_before, v_from_name
    from public.buckets
   where id = p_from_bucket_id
     for update;

  if not found then
    raise exception 'source bucket not found' using errcode = 'P0002';
  end if;
  if v_from_family <> p_family_id then
    raise exception 'source bucket not in family' using errcode = '42501';
  end if;
  if v_from_owner is distinct from p_owner_member_id then
    raise exception 'auto-organize line must target the rule owner''s bucket'
      using errcode = '22023';
  end if;
  if v_from_balance_before < p_amount then
    raise exception 'insufficient funds in source bucket' using errcode = '23514';
  end if;

  v_float_before := public.member_float(p_float_member_id);
  v_from_balance_after := v_from_balance_before - p_amount;

  if p_to_bucket_id is not null then
    select family_id, owner_member_id, allocated_amount, name
      into v_to_family, v_to_owner, v_to_balance_before, v_to_name
      from public.buckets
     where id = p_to_bucket_id
       for update;

    if not found then
      raise exception 'destination bucket not found' using errcode = 'P0002';
    end if;
    if v_to_family <> p_family_id then
      raise exception 'destination bucket not in family' using errcode = '42501';
    end if;
    if v_to_owner is distinct from p_owner_member_id then
      raise exception 'auto-organize destination must be the rule owner''s bucket'
        using errcode = '22023';
    end if;
    v_to_balance_after := v_to_balance_before + p_amount;
  end if;

  update public.buckets
     set allocated_amount = allocated_amount - p_amount
   where id = p_from_bucket_id;

  if p_to_bucket_id is not null then
    update public.buckets
       set allocated_amount = allocated_amount + p_amount
     where id = p_to_bucket_id;
  end if;

  v_float_after := public.member_float(p_float_member_id);

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
    note,
    auto_organize_run_id
  ) values (
    p_family_id,
    'bucket_move',
    p_amount,
    p_from_bucket_id,
    p_to_bucket_id,
    v_from_name,
    v_to_name,
    v_from_balance_before,
    v_from_balance_after,
    v_to_balance_before,
    v_to_balance_after,
    v_float_before,
    v_float_after,
    p_from_member_id,
    p_note,
    p_auto_organize_run_id
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

revoke all on function public._auto_organize_sweep_line(
  uuid, uuid, uuid, uuid, numeric, text, uuid, uuid, uuid
) from public;
grant execute on function public._auto_organize_sweep_line(
  uuid, uuid, uuid, uuid, numeric, text, uuid, uuid, uuid
) to service_role;

-- ---------------------------------------------------------------------
-- run_auto_organize: owner-aware.
--   * Manual: admin runs household (owner null) rules; a child runs their OWN
--     rule (owner = caller). triggered_by must be the caller.
--   * Float member and transaction actor resolve to the owner for kid rules so
--     the move lands in the kid's own Float and History (un-redacted snapshots).
--   * Line/destination validation requires buckets owned by the rule owner.
-- ---------------------------------------------------------------------
create or replace function public.run_auto_organize(
  p_auto_organize_id uuid,
  p_trigger text,
  p_triggered_by_member_id uuid default null,
  p_run_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.auto_organizes%rowtype;
  v_family_tz text;
  v_run_on date;
  v_run_id uuid;
  v_line record;
  v_note text;
  v_float_member_id uuid;
  v_from_member_id uuid;
  v_invalid_bucket uuid;
  v_current numeric;
  v_amt numeric;
begin
  if p_trigger not in ('scheduled', 'manual') then
    raise exception 'invalid trigger' using errcode = '22023';
  end if;

  if p_trigger = 'manual' then
    if auth.uid() is null then
      raise exception 'not authenticated' using errcode = '28000';
    end if;
    if p_triggered_by_member_id is distinct from public.auth_member_id() then
      raise exception 'invalid triggered_by_member_id' using errcode = '22023';
    end if;
  else
    if auth.uid() is not null then
      raise exception 'scheduled runs require service role' using errcode = '42501';
    end if;
  end if;

  select *
    into v_row
    from public.auto_organizes
   where id = p_auto_organize_id
     for update;

  if not found then
    raise exception 'auto-organize not found' using errcode = 'P0002';
  end if;

  -- Manual authorization, now that the owner is known. Household rules
  -- (owner null) are admin-only; a kid rule may be run only by its owner.
  if p_trigger = 'manual' then
    if v_row.family_id <> public.auth_family_id() then
      raise exception 'auto-organize not in your family' using errcode = '42501';
    end if;
    if v_row.owner_member_id is null then
      if public.auth_role() <> 'admin' then
        raise exception 'admin only' using errcode = '42501';
      end if;
    elsif v_row.owner_member_id is distinct from public.auth_member_id() then
      raise exception 'not your auto-organize' using errcode = '42501';
    end if;
  end if;

  if v_row.paused and v_row.auto_organize_type <> 'manual' then
    raise exception 'auto-organize is paused' using errcode = '22023';
  end if;

  select timezone
    into v_family_tz
    from public.families
   where id = v_row.family_id;

  v_run_on := coalesce(p_run_on, (now() at time zone coalesce(v_family_tz, 'UTC'))::date);

  if p_trigger = 'scheduled' and exists (
    select 1
      from public.auto_organize_runs
     where auto_organize_id = p_auto_organize_id
       and run_on = v_run_on
       and trigger = 'scheduled'
  ) then
    raise exception 'auto-organize already scheduled for this date' using errcode = '23505';
  end if;

  select l.bucket_id
    into v_invalid_bucket
    from public.auto_organize_lines l
    left join public.buckets b on b.id = l.bucket_id
   where l.auto_organize_id = p_auto_organize_id
     and (
       b.id is null
       or b.family_id <> v_row.family_id
       or b.owner_member_id is distinct from v_row.owner_member_id
     )
   limit 1;

  if v_invalid_bucket is not null then
    raise exception 'invalid bucket line' using errcode = '22023';
  end if;

  if v_row.auto_organize_kind = 'save_off'
     and v_row.destination_bucket_id is not null then
    if exists (
      select 1
        from public.auto_organize_lines l
       where l.auto_organize_id = p_auto_organize_id
         and l.bucket_id = v_row.destination_bucket_id
    ) then
      raise exception 'save-off destination cannot be a source bucket'
        using errcode = '22023';
    end if;

    select b.id
      into v_invalid_bucket
      from public.buckets b
     where b.id = v_row.destination_bucket_id
       and (
         b.family_id <> v_row.family_id
         or b.owner_member_id is distinct from v_row.owner_member_id
       );

    if v_invalid_bucket is not null then
      raise exception 'invalid save-off destination' using errcode = '22023';
    end if;
  end if;

  if not exists (
    select 1 from public.auto_organize_lines where auto_organize_id = p_auto_organize_id
  ) then
    raise exception 'auto-organize has no lines' using errcode = '22023';
  end if;

  -- Owner's Float for kid rules; created_by / first admin for household rules.
  v_float_member_id := coalesce(
    v_row.owner_member_id,
    v_row.created_by_member_id,
    (
      select id
        from public.family_members
       where family_id = v_row.family_id
         and role = 'admin'
       order by created_at
       limit 1
    )
  );

  -- Attribute the moves: kid rules to the kid (so they appear in the kid's
  -- own History with un-redacted Float snapshots, manual or scheduled);
  -- household rules to the runner on manual, unattributed ('Scheduled') on cron.
  v_from_member_id := coalesce(
    v_row.owner_member_id,
    case when p_trigger = 'manual' then p_triggered_by_member_id else null end
  );

  v_note := public.auto_organize_history_note(
    v_row.auto_organize_kind,
    v_row.name,
    v_row.auto_organize_type,
    v_row.start_date,
    v_row.interval_count,
    v_row.interval_unit,
    v_row.days_of_month
  );

  insert into public.auto_organize_runs (
    auto_organize_id,
    family_id,
    run_on,
    trigger,
    triggered_by_member_id,
    status
  ) values (
    p_auto_organize_id,
    v_row.family_id,
    v_run_on,
    p_trigger,
    p_triggered_by_member_id,
    'completed'
  )
  returning id into v_run_id;

  for v_line in
    select bucket_id, amount
      from public.auto_organize_lines
     where auto_organize_id = p_auto_organize_id
     order by sort_order, id
  loop
    if v_row.auto_organize_kind = 'organize' then
      perform public._auto_organize_apply_line(
        v_row.family_id,
        v_row.owner_member_id,
        v_line.bucket_id,
        v_line.amount,
        v_note,
        v_float_member_id,
        v_from_member_id,
        v_run_id
      );
    elsif v_row.auto_organize_kind = 'top_up' then
      select allocated_amount
        into v_current
        from public.buckets
       where id = v_line.bucket_id
         for update;
      v_amt := greatest(0, v_line.amount - v_current);
      if v_amt > 0 then
        perform public._auto_organize_apply_line(
          v_row.family_id,
          v_row.owner_member_id,
          v_line.bucket_id,
          v_amt,
          v_note,
          v_float_member_id,
          v_from_member_id,
          v_run_id
        );
      end if;
    elsif v_row.auto_organize_kind = 'save_off' then
      select allocated_amount
        into v_current
        from public.buckets
       where id = v_line.bucket_id
         for update;
      v_amt := greatest(0, v_current - v_line.amount);
      if v_amt > 0 then
        perform public._auto_organize_sweep_line(
          v_row.family_id,
          v_row.owner_member_id,
          v_line.bucket_id,
          v_row.destination_bucket_id,
          v_amt,
          v_note,
          v_float_member_id,
          v_from_member_id,
          v_run_id
        );
      end if;
    else
      raise exception 'unknown auto_organize_kind' using errcode = '22023';
    end if;
  end loop;

  return v_run_id;
exception
  when others then
    if v_run_id is not null then
      update public.auto_organize_runs
         set status = 'failed',
             error_message = left(sqlerrm, 500)
       where id = v_run_id;
    end if;
    raise;
end;
$$;

revoke all on function public.run_auto_organize(uuid, text, uuid, date) from public;
grant execute on function public.run_auto_organize(uuid, text, uuid, date) to authenticated;
grant execute on function public.run_auto_organize(uuid, text, uuid, date) to service_role;

-- ---------------------------------------------------------------------
-- RLS: adults see / manage ONLY household (owner null) rules; a child
-- sees / manages ONLY their own. Kid rules stay invisible to parents.
-- ---------------------------------------------------------------------

-- auto_organizes
drop policy if exists "auto_organizes_select_family" on public.auto_organizes;
create policy "auto_organizes_select_family"
  on public.auto_organizes
  for select
  to authenticated
  using (
    family_id = public.auth_family_id()
    and owner_member_id is null
    and public.auth_role() in ('admin', 'member')
  );

create policy "auto_organizes_select_own_child"
  on public.auto_organizes
  for select
  to authenticated
  using (
    family_id = public.auth_family_id()
    and public.auth_role() = 'child'
    and owner_member_id = public.auth_member_id()
  );

drop policy if exists "auto_organizes_insert_admin" on public.auto_organizes;
create policy "auto_organizes_insert_admin"
  on public.auto_organizes
  for insert
  to authenticated
  with check (
    family_id = public.auth_family_id()
    and owner_member_id is null
    and public.auth_role() = 'admin'
  );

create policy "auto_organizes_insert_own_child"
  on public.auto_organizes
  for insert
  to authenticated
  with check (
    family_id = public.auth_family_id()
    and public.auth_role() = 'child'
    and owner_member_id = public.auth_member_id()
  );

drop policy if exists "auto_organizes_update_admin" on public.auto_organizes;
create policy "auto_organizes_update_admin"
  on public.auto_organizes
  for update
  to authenticated
  using (
    family_id = public.auth_family_id()
    and owner_member_id is null
    and public.auth_role() = 'admin'
  )
  with check (
    family_id = public.auth_family_id()
    and owner_member_id is null
    and public.auth_role() = 'admin'
  );

create policy "auto_organizes_update_own_child"
  on public.auto_organizes
  for update
  to authenticated
  using (
    family_id = public.auth_family_id()
    and public.auth_role() = 'child'
    and owner_member_id = public.auth_member_id()
  )
  with check (
    family_id = public.auth_family_id()
    and public.auth_role() = 'child'
    and owner_member_id = public.auth_member_id()
  );

drop policy if exists "auto_organizes_delete_admin" on public.auto_organizes;
create policy "auto_organizes_delete_admin"
  on public.auto_organizes
  for delete
  to authenticated
  using (
    family_id = public.auth_family_id()
    and owner_member_id is null
    and public.auth_role() = 'admin'
  );

create policy "auto_organizes_delete_own_child"
  on public.auto_organizes
  for delete
  to authenticated
  using (
    family_id = public.auth_family_id()
    and public.auth_role() = 'child'
    and owner_member_id = public.auth_member_id()
  );

-- auto_organize_lines
drop policy if exists "auto_organize_lines_select_family" on public.auto_organize_lines;
create policy "auto_organize_lines_select_family"
  on public.auto_organize_lines
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.auto_organizes ao
       where ao.id = auto_organize_id
         and ao.family_id = public.auth_family_id()
         and ao.owner_member_id is null
         and public.auth_role() in ('admin', 'member')
    )
  );

create policy "auto_organize_lines_select_own_child"
  on public.auto_organize_lines
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.auto_organizes ao
       where ao.id = auto_organize_id
         and ao.family_id = public.auth_family_id()
         and public.auth_role() = 'child'
         and ao.owner_member_id = public.auth_member_id()
    )
  );

drop policy if exists "auto_organize_lines_write_admin" on public.auto_organize_lines;
create policy "auto_organize_lines_write_admin"
  on public.auto_organize_lines
  for all
  to authenticated
  using (
    exists (
      select 1
        from public.auto_organizes ao
       where ao.id = auto_organize_id
         and ao.family_id = public.auth_family_id()
         and ao.owner_member_id is null
         and public.auth_role() = 'admin'
    )
  )
  with check (
    exists (
      select 1
        from public.auto_organizes ao
       where ao.id = auto_organize_id
         and ao.family_id = public.auth_family_id()
         and ao.owner_member_id is null
         and public.auth_role() = 'admin'
    )
  );

create policy "auto_organize_lines_write_own_child"
  on public.auto_organize_lines
  for all
  to authenticated
  using (
    exists (
      select 1
        from public.auto_organizes ao
       where ao.id = auto_organize_id
         and ao.family_id = public.auth_family_id()
         and public.auth_role() = 'child'
         and ao.owner_member_id = public.auth_member_id()
    )
  )
  with check (
    exists (
      select 1
        from public.auto_organizes ao
       where ao.id = auto_organize_id
         and ao.family_id = public.auth_family_id()
         and public.auth_role() = 'child'
         and ao.owner_member_id = public.auth_member_id()
    )
  );

-- auto_organize_runs (read-only to clients; rows written by run_auto_organize)
drop policy if exists "auto_organize_runs_select_family" on public.auto_organize_runs;
create policy "auto_organize_runs_select_family"
  on public.auto_organize_runs
  for select
  to authenticated
  using (
    family_id = public.auth_family_id()
    and (
      (
        public.auth_role() in ('admin', 'member')
        and exists (
          select 1
            from public.auto_organizes ao
           where ao.id = auto_organize_id
             and ao.owner_member_id is null
        )
      )
      or (
        public.auth_role() = 'child'
        and exists (
          select 1
            from public.auto_organizes ao
           where ao.id = auto_organize_id
             and ao.owner_member_id = public.auth_member_id()
        )
      )
    )
  );
