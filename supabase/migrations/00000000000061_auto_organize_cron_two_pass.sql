-- Cron: run save_off rules in a dedicated pass before organize/top_up.
-- A single ORDER BY pass was not reliable in production (same-timestamp runs
-- showed top_up before save_off); two explicit loops match the product rule.

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
  v_pass int;
  v_row record;
  v_local_ts timestamp;
  v_local_date date;
  v_local_hour int;
begin
  if auth.uid() is not null then
    raise exception 'service role only' using errcode = '42501';
  end if;

  for v_pass in 1..2 loop
    for v_row in
      select ao.*, f.timezone, f.auto_organize_run_hour
        from public.auto_organizes ao
        join public.families f on f.id = ao.family_id
       where ao.paused = false
         and (
           (v_pass = 1 and ao.auto_organize_kind = 'save_off')
           or (v_pass = 2 and ao.auto_organize_kind <> 'save_off')
         )
       order by ao.created_at, ao.id
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
  end loop;

  return v_count;
end;
$$;

revoke all on function public.run_due_auto_organizes(timestamptz) from public;
grant execute on function public.run_due_auto_organizes(timestamptz) to service_role;
