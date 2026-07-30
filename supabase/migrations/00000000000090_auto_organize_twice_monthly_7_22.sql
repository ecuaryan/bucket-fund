-- Add 7th & 22nd to twice-a-month cadence summary presets (matches client).

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
    if v_key = '7,22' then return 'Twice a month · 7th & 22nd'; end if;
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
