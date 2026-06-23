-- Manual-only auto-organize: save a rule without a schedule; runs only via Run now.

alter table public.auto_organizes
  drop constraint if exists auto_organizes_auto_organize_type_check;

alter table public.auto_organizes
  add constraint auto_organizes_auto_organize_type_check
  check (auto_organize_type in ('interval', 'monthly', 'manual'));

alter table public.auto_organizes
  drop constraint if exists auto_organizes_interval_shape;

alter table public.auto_organizes
  add constraint auto_organizes_interval_shape check (
    (auto_organize_type = 'interval'
      and start_date is not null
      and interval_count is not null
      and interval_unit is not null
      and days_of_month is null)
    or (auto_organize_type = 'monthly'
      and days_of_month is not null
      and array_length(days_of_month, 1) >= 1)
    or (auto_organize_type = 'manual'
      and start_date is null
      and interval_count is null
      and interval_unit is null
      and days_of_month is null)
  );

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
  if p_auto_organize_type = 'manual' then
    return 'Manual only';
  end if;

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

create or replace function public.auto_organize_is_due_on(
  p_auto_organize_type text,
  p_start_date date,
  p_interval_count int,
  p_interval_unit text,
  p_days_of_month int[],
  p_local_date date
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_months int;
  v_target_day int;
  v_last_day date;
  v_day int;
begin
  if p_auto_organize_type = 'manual' then
    return false;
  end if;

  if p_auto_organize_type = 'interval' then
    if p_start_date is null
      or p_interval_count is null
      or p_interval_unit is null
      or p_local_date < p_start_date then
      return false;
    end if;

    if p_interval_unit = 'week' then
      return ((p_local_date - p_start_date) % (p_interval_count * 7)) = 0;
    end if;

    if p_interval_unit = 'month' then
      v_months :=
        (extract(year from p_local_date)::int * 12 + extract(month from p_local_date)::int)
        - (extract(year from p_start_date)::int * 12 + extract(month from p_start_date)::int);
      if v_months < 0 or v_months % p_interval_count <> 0 then
        return false;
      end if;
      v_target_day := least(
        extract(day from p_start_date)::int,
        extract(
          day from (
            date_trunc('month', p_local_date) + interval '1 month' - interval '1 day'
          )
        )::int
      );
      return extract(day from p_local_date)::int = v_target_day;
    end if;

    return false;
  end if;

  if p_auto_organize_type = 'monthly' then
    if p_days_of_month is null or array_length(p_days_of_month, 1) is null then
      return false;
    end if;
    v_day := extract(day from p_local_date)::int;
    v_last_day := (
      date_trunc('month', p_local_date) + interval '1 month' - interval '1 day'
    )::date;
    if 0 = any (p_days_of_month) and p_local_date = v_last_day then
      return true;
    end if;
    return v_day = any (p_days_of_month);
  end if;

  return false;
end;
$$;
