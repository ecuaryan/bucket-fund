-- Display name for auto-organize rows: custom name, else cadence summary (matches client).

create or replace function public.format_auto_organize_day_of_month(p_day int)
returns text
language sql
immutable
as $$
  select case p_day
    when 0 then 'last day'
    when 1 then '1st'
    when 2 then '2nd'
    when 3 then '3rd'
    when 4 then '4th'
    when 5 then '5th'
    when 6 then '6th'
    when 7 then '7th'
    when 8 then '8th'
    when 9 then '9th'
    when 10 then '10th'
    when 11 then '11th'
    when 12 then '12th'
    when 13 then '13th'
    when 14 then '14th'
    when 15 then '15th'
    when 16 then '16th'
    when 17 then '17th'
    when 18 then '18th'
    when 19 then '19th'
    when 20 then '20th'
    when 21 then '21st'
    when 22 then '22nd'
    when 23 then '23rd'
    when 24 then '24th'
    when 25 then '25th'
    when 26 then '26th'
    when 27 then '27th'
    when 28 then '28th'
    when 29 then '29th'
    when 30 then '30th'
    when 31 then '31st'
    else p_day::text || 'th'
  end;
$$;

create or replace function public.auto_organize_days_key(p_days int[])
returns text
language sql
immutable
as $$
  select coalesce(
    string_agg(
      case when d = 0 then '0' else d::text end,
      ','
      order by case when d = 0 then 99 else d end
    ),
    ''
  )
  from unnest(coalesce(p_days, '{}'::int[])) as d;
$$;

create or replace function public.auto_organize_cadence_summary(
  p_auto_organize_type text,
  p_start_date date,
  p_interval_count int,
  p_interval_unit text,
  p_days_of_month int[]
)
returns text
language plpgsql
immutable
as $$
declare
  v_key text;
  v_labels text;
begin
  if p_auto_organize_type = 'monthly' then
    if coalesce(array_length(p_days_of_month, 1), 0) = 0 then
      return 'Monthly';
    end if;

    if array_length(p_days_of_month, 1) = 1 then
      return 'Once a month · '
        || public.format_auto_organize_day_of_month(p_days_of_month[1]);
    end if;

    v_key := public.auto_organize_days_key(p_days_of_month);

    if v_key = '1,15' then return 'Twice a month · 1st & 15th'; end if;
    if v_key = '2,16' then return 'Twice a month · 2nd & 16th'; end if;
    if v_key = '1,16' then return 'Twice a month · 1st & 16th'; end if;
    if v_key = '15,0' then return 'Twice a month · 15th & last day'; end if;
    if v_key = '16,0' then return 'Twice a month · 16th & last day'; end if;

    select string_agg(
             public.format_auto_organize_day_of_month(d),
             ' & '
             order by case when d = 0 then 99 else d end
           )
      into v_labels
      from unnest(p_days_of_month) as d;

    return 'Twice a month · ' || v_labels;
  end if;

  if p_auto_organize_type = 'interval' then
    if coalesce(p_interval_unit, 'week') = 'week'
       and coalesce(p_interval_count, 1) = 1 then
      return 'Every week';
    end if;
    if coalesce(p_interval_unit, 'week') = 'week' and p_interval_count = 2 then
      return 'Every 2 weeks';
    end if;
    if coalesce(p_interval_unit, 'week') = 'month'
       and coalesce(p_interval_count, 1) = 1 then
      return 'Every month';
    end if;
    return 'Every '
      || coalesce(p_interval_count, 1)::text
      || ' '
      || coalesce(p_interval_unit, 'week')
      || 's';
  end if;

  return 'Auto-organize';
end;
$$;

create or replace function public.auto_organize_display_name(
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
  select coalesce(
    nullif(trim(p_name), ''),
    public.auto_organize_cadence_summary(
      p_auto_organize_type,
      p_start_date,
      p_interval_count,
      p_interval_unit,
      p_days_of_month
    )
  );
$$;

-- Use cadence summary (not generic "Auto-organize") for unnamed rules in History notes.
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
    perform public._auto_organize_apply_line(
      v_row.family_id,
      v_line.bucket_id,
      v_line.amount,
      v_note,
      v_float_member_id,
      v_from_member_id,
      v_run_id
    );
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
