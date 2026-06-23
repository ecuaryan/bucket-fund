-- Richer History notes for auto-organize runs: kind + rule name.

create or replace function public.auto_organize_history_note(
  p_kind text,
  p_name text,
  p_auto_organize_type text,
  p_start_date date,
  p_interval_count int,
  p_interval_unit text,
  p_days_of_month int[]
)
returns text
language sql
immutable
as $$
  select
    case coalesce(p_kind, 'organize')
      when 'top_up' then 'Auto top-up'
      when 'save_off' then 'Auto save-off'
      else 'Auto-organize'
    end
    || ' · '
    || public.auto_organize_display_name(
      p_name,
      p_auto_organize_type,
      p_start_date,
      p_interval_count,
      p_interval_unit,
      p_days_of_month
    );
$$;

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

drop view if exists public.transactions_client;

create view public.transactions_client
with (security_invoker = true)
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
  public.client_float_balance_before(t.id)::numeric(14, 2) as float_balance_before,
  public.client_float_balance_after(t.id)::numeric(14, 2) as float_balance_after,
  t.note,
  t.created_at,
  t.auto_organize_run_id,
  r.trigger as auto_organize_run_trigger,
  ao.auto_organize_kind
from public.transactions t
left join public.auto_organize_runs r on r.id = t.auto_organize_run_id
left join public.auto_organizes ao on ao.id = r.auto_organize_id
where public.transaction_visible_to_caller(t.id);

comment on view public.transactions_client is
  'Authenticated SELECT surface for History. security_invoker view; row visibility via '
  'transaction_visible_to_caller. Float snapshots redacted for child role via '
  'client_float_balance_* helpers; float columns are not granted on transactions.';

revoke all on public.transactions_client from public;
grant select on public.transactions_client to authenticated;
grant select on public.transactions_client to service_role;

alter function public.auto_organize_history_note(text, text, text, date, int, text, int[])
  set search_path = public;

revoke all on function public.auto_organize_history_note(text, text, text, date, int, text, int[])
  from public;
