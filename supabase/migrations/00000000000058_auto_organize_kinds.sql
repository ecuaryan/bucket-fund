-- Auto-organize kinds: organize | top_up | save_off
-- top_up: Float -> bucket, fill to target (max(0, target - balance))
-- save_off: bucket -> pool bucket or Float, sweep excess (max(0, balance - keep))

alter table public.auto_organizes
  add column auto_organize_kind text not null default 'organize'
    check (auto_organize_kind in ('organize', 'top_up', 'save_off')),
  add column destination_bucket_id uuid references public.buckets(id) on delete restrict;

alter table public.auto_organizes
  add constraint auto_organizes_destination_only_for_save_off
  check (auto_organize_kind = 'save_off' or destination_bucket_id is null);

alter table public.auto_organize_lines
  drop constraint if exists auto_organize_lines_amount_check;

alter table public.auto_organize_lines
  add constraint auto_organize_lines_amount_check check (amount >= 0);

-- ---------------------------------------------------------------------
-- Bucket -> bucket or bucket -> Float for save_off runs (no auth session).
-- ---------------------------------------------------------------------
create or replace function public._auto_organize_sweep_line(
  p_family_id uuid,
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
  if v_from_owner is not null then
    raise exception 'auto-organize lines must target family-pool buckets'
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
    if v_to_owner is not null then
      raise exception 'auto-organize destination must be a family-pool bucket'
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
  uuid, uuid, uuid, numeric, text, uuid, uuid, uuid
) from public;
grant execute on function public._auto_organize_sweep_line(
  uuid, uuid, uuid, numeric, text, uuid, uuid, uuid
) to service_role;

-- ---------------------------------------------------------------------
-- Execute one auto-organize (manual Run now or scheduled tick).
-- Branches by auto_organize_kind.
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
    if public.auth_role() <> 'admin' then
      raise exception 'admin only' using errcode = '42501';
    end if;
    if p_triggered_by_member_id is distinct from public.auth_member_id() then
      raise exception 'invalid triggered_by_member_id' using errcode = '22023';
    end if;
    if auth.uid() is null then
      raise exception 'not authenticated' using errcode = '28000';
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

  if p_trigger = 'manual' and v_row.family_id <> public.auth_family_id() then
    raise exception 'auto-organize not in your family' using errcode = '42501';
  end if;

  if v_row.paused then
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
       or b.owner_member_id is not null
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
         or b.owner_member_id is not null
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

  v_float_member_id := coalesce(
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

  v_from_member_id := case when p_trigger = 'manual' then p_triggered_by_member_id else null end;
  v_note := public.auto_organize_display_name(
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
-- Hourly cron: save_off before organize/top_up on the same local day.
-- ---------------------------------------------------------------------
create or replace function public.run_due_auto_organizes(
  p_as_of timestamptz default now()
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_row record;
  v_local_ts timestamp;
  v_local_date date;
  v_local_hour int;
begin
  if auth.uid() is not null then
    raise exception 'service role only' using errcode = '42501';
  end if;

  for v_row in
    select ao.*, f.timezone, f.auto_organize_run_hour
      from public.auto_organizes ao
      join public.families f on f.id = ao.family_id
     where ao.paused = false
     order by
       case ao.auto_organize_kind when 'save_off' then 0 else 1 end,
       ao.created_at,
       ao.id
  loop
    v_local_ts := p_as_of at time zone coalesce(v_row.timezone, 'UTC');
    v_local_date := v_local_ts::date;
    v_local_hour := extract(hour from v_local_ts)::int;

    if v_local_hour < v_row.auto_organize_run_hour then
      continue;
    end if;

    if not public.auto_organize_is_due_on(
      v_row.auto_organize_type,
      v_row.start_date,
      v_row.interval_count,
      v_row.interval_unit,
      v_row.days_of_month,
      v_local_date
    ) then
      continue;
    end if;

    if exists (
      select 1
        from public.auto_organize_runs r
       where r.auto_organize_id = v_row.id
         and r.run_on = v_local_date
    ) then
      continue;
    end if;

    begin
      perform public.run_auto_organize(v_row.id, 'scheduled', null, v_local_date);
      v_count := v_count + 1;
    exception
      when others then
        null;
    end;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.run_due_auto_organizes(timestamptz) from public;
grant execute on function public.run_due_auto_organizes(timestamptz) to service_role;

-- ---------------------------------------------------------------------
-- delete_bucket: also remove save-off rules that target this bucket.
-- ---------------------------------------------------------------------
create or replace function public.delete_bucket(p_bucket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_family uuid := public.auth_family_id();
  v_caller_role   text := public.auth_role();
  v_member        uuid := public.auth_member_id();
  v_bucket        public.buckets%rowtype;
  v_affected      uuid[];
begin
  if v_caller_family is null or v_member is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select *
    into v_bucket
    from public.buckets
   where id = p_bucket_id
     and family_id = v_caller_family
   for update;

  if not found then
    raise exception 'bucket not found' using errcode = 'P0002';
  end if;

  if v_caller_role = 'admin' then
    null;
  elsif v_caller_role = 'child' then
    if v_bucket.owner_member_id is distinct from v_member then
      raise exception 'not authorized' using errcode = '42501';
    end if;
  else
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct l.auto_organize_id), '{}'::uuid[])
    into v_affected
    from public.auto_organize_lines l
    join public.auto_organizes ao on ao.id = l.auto_organize_id
   where l.bucket_id = p_bucket_id
     and ao.family_id = v_caller_family;

  delete from public.auto_organize_lines
   where bucket_id = p_bucket_id
     and auto_organize_id = any(v_affected);

  delete from public.auto_organizes ao
   where ao.id = any(v_affected)
     and ao.family_id = v_caller_family
     and not exists (
       select 1
         from public.auto_organize_lines l
        where l.auto_organize_id = ao.id
     );

  delete from public.auto_organizes
   where destination_bucket_id = p_bucket_id
     and family_id = v_caller_family;

  if v_bucket.allocated_amount > 0 then
    perform public.move_money(
      p_bucket_id,
      null,
      v_bucket.allocated_amount,
      'Bucket deleted'
    );
  end if;

  delete from public.buckets
   where id = p_bucket_id
     and family_id = v_caller_family;
end;
$$;

revoke all on function public.delete_bucket(uuid) from public;
grant execute on function public.delete_bucket(uuid) to authenticated;
grant execute on function public.delete_bucket(uuid) to service_role;
