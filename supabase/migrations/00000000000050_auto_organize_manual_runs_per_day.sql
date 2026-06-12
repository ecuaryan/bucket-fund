-- Manual Run now: multiple executions per local day.
-- Scheduled/cron: still at most one run per auto-organize per local day.

alter table public.auto_organize_runs
  drop constraint if exists auto_organize_runs_auto_organize_id_run_on_key;

create unique index auto_organize_runs_one_scheduled_per_day_idx
  on public.auto_organize_runs (auto_organize_id, run_on)
  where trigger = 'scheduled';

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
  v_note := coalesce(nullif(trim(v_row.name), ''), 'Auto-organize');

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
