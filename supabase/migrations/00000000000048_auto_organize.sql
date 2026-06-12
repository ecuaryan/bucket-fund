-- Auto-organize: schema, move_money Float rule, run RPCs, RLS.

alter table public.families
  add column if not exists timezone text not null default 'UTC',
  add column if not exists auto_organize_run_hour smallint not null default 3;

alter table public.families
  add constraint families_auto_organize_run_hour_check
  check (auto_organize_run_hour between 0 and 23);

create table public.auto_organizes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text,
  paused boolean not null default false,
  auto_organize_type text not null check (auto_organize_type in ('interval', 'monthly')),
  start_date date,
  interval_count int check (interval_count is null or interval_count > 0),
  interval_unit text check (interval_unit is null or interval_unit in ('week', 'month')),
  days_of_month int[],
  created_by_member_id uuid references public.family_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auto_organizes_interval_shape check (
    (auto_organize_type = 'interval'
      and start_date is not null
      and interval_count is not null
      and interval_unit is not null
      and days_of_month is null)
    or (auto_organize_type = 'monthly'
      and days_of_month is not null
      and array_length(days_of_month, 1) >= 1)
  )
);

create index auto_organizes_family_id_idx on public.auto_organizes(family_id);

create table public.auto_organize_lines (
  id uuid primary key default gen_random_uuid(),
  auto_organize_id uuid not null references public.auto_organizes(id) on delete cascade,
  bucket_id uuid not null references public.buckets(id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  sort_order int not null check (sort_order >= 0)
);

create index auto_organize_lines_auto_organize_id_idx
  on public.auto_organize_lines(auto_organize_id);

create table public.auto_organize_runs (
  id uuid primary key default gen_random_uuid(),
  auto_organize_id uuid not null references public.auto_organizes(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  run_on date not null,
  trigger text not null check (trigger in ('scheduled', 'manual')),
  triggered_by_member_id uuid references public.family_members(id) on delete set null,
  status text not null check (status in ('completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  unique (auto_organize_id, run_on)
);

create index auto_organize_runs_family_id_idx on public.auto_organize_runs(family_id);

alter table public.transactions
  add column auto_organize_run_id uuid references public.auto_organize_runs(id) on delete set null;

create index transactions_auto_organize_run_id_idx
  on public.transactions(auto_organize_run_id);

-- ---------------------------------------------------------------------
-- Cadence: does this auto-organize fire on a local calendar date?
-- ---------------------------------------------------------------------
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

revoke all on function public.auto_organize_is_due_on(text, date, int, text, int[], date)
  from public;
grant execute on function public.auto_organize_is_due_on(text, date, int, text, int[], date)
  to service_role;

-- ---------------------------------------------------------------------
-- Float → bucket move for auto-organize runs (no auth session).
-- ---------------------------------------------------------------------
create or replace function public._auto_organize_apply_line(
  p_family_id uuid,
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
  if v_to_owner is not null then
    raise exception 'auto-organize lines must target family-pool buckets'
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
  uuid, uuid, numeric, text, uuid, uuid, uuid
) from public;
grant execute on function public._auto_organize_apply_line(
  uuid, uuid, numeric, text, uuid, uuid, uuid
) to service_role;

-- ---------------------------------------------------------------------
-- move_money: allow Float → bucket even when Float goes negative (all roles).
-- ---------------------------------------------------------------------
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
  v_from_owner       uuid;
  v_to_owner         uuid;
  v_from_balance     numeric;
  v_from_balance_after numeric;
  v_to_balance_before numeric;
  v_to_balance_after numeric;
  v_from_name        text;
  v_to_name          text;
  v_float_before numeric;
  v_float_after numeric;
  v_transaction_id   uuid;
begin
  if v_caller_member_id is null or v_caller_family is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;
  if p_from_bucket_id is null and p_to_bucket_id is null then
    raise exception 'at least one bucket must be specified' using errcode = '22023';
  end if;
  if p_from_bucket_id is not distinct from p_to_bucket_id then
    raise exception 'source and destination must differ' using errcode = '22023';
  end if;
  if p_note is not null and length(p_note) > 280 then
    raise exception 'note too long' using errcode = '22001';
  end if;

  if p_from_bucket_id is null or p_to_bucket_id is null then
    v_float_before := public.member_float(v_caller_member_id);
  end if;

  if p_from_bucket_id is not null then
    select family_id, owner_member_id, allocated_amount, name
      into v_from_family, v_from_owner, v_from_balance, v_from_name
      from public.buckets
     where id = p_from_bucket_id
       for update;
    if not found then
      raise exception 'source bucket not found' using errcode = 'P0002';
    end if;
    if v_from_family <> v_caller_family then
      raise exception 'source bucket not in your family' using errcode = '42501';
    end if;
    if v_caller_role = 'child' and v_from_owner is distinct from v_caller_member_id then
      raise exception 'children can only move from their own buckets'
        using errcode = '42501';
    end if;
    if v_from_balance < p_amount then
      raise exception 'insufficient funds in source bucket' using errcode = '23514';
    end if;
    v_from_balance_after := v_from_balance - p_amount;
  end if;

  if p_to_bucket_id is not null then
    select family_id, owner_member_id, allocated_amount, name
      into v_to_family, v_to_owner, v_to_balance_before, v_to_name
      from public.buckets
     where id = p_to_bucket_id
       for update;
    if not found then
      raise exception 'destination bucket not found' using errcode = 'P0002';
    end if;
    if v_to_family <> v_caller_family then
      raise exception 'destination bucket not in your family' using errcode = '42501';
    end if;
    if v_caller_role = 'child' and v_to_owner is distinct from v_caller_member_id then
      raise exception 'children can only move to their own buckets'
        using errcode = '42501';
    end if;
    v_to_balance_after := v_to_balance_before + p_amount;
  end if;

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

  if p_from_bucket_id is null or p_to_bucket_id is null then
    v_float_after := public.member_float(v_caller_member_id);
  end if;

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
    note
  ) values (
    v_caller_family,
    'bucket_move',
    p_amount,
    p_from_bucket_id,
    p_to_bucket_id,
    v_from_name,
    v_to_name,
    v_from_balance,
    v_from_balance_after,
    v_to_balance_before,
    v_to_balance_after,
    v_float_before,
    v_float_after,
    v_caller_member_id,
    p_note
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Execute one auto-organize (manual Run now or scheduled tick).
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
  v_local_ts timestamptz;
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

  if exists (
    select 1
      from public.auto_organize_runs
     where auto_organize_id = p_auto_organize_id
       and run_on = v_run_on
  ) then
    raise exception 'auto-organize already ran for this date' using errcode = '23505';
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

revoke all on function public.run_auto_organize(uuid, text, uuid, date) from public;
grant execute on function public.run_auto_organize(uuid, text, uuid, date) to authenticated;
grant execute on function public.run_auto_organize(uuid, text, uuid, date) to service_role;

-- ---------------------------------------------------------------------
-- Hourly cron entry: run due auto-organizes once per local morning.
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
-- RLS
-- ---------------------------------------------------------------------
alter table public.auto_organizes enable row level security;
alter table public.auto_organize_lines enable row level security;
alter table public.auto_organize_runs enable row level security;

create policy "auto_organizes_select_family"
  on public.auto_organizes
  for select
  to authenticated
  using (
    family_id = public.auth_family_id()
    and public.auth_role() in ('admin', 'member')
  );

create policy "auto_organizes_insert_admin"
  on public.auto_organizes
  for insert
  to authenticated
  with check (
    family_id = public.auth_family_id()
    and public.auth_role() = 'admin'
  );

create policy "auto_organizes_update_admin"
  on public.auto_organizes
  for update
  to authenticated
  using (
    family_id = public.auth_family_id()
    and public.auth_role() = 'admin'
  )
  with check (
    family_id = public.auth_family_id()
    and public.auth_role() = 'admin'
  );

create policy "auto_organizes_delete_admin"
  on public.auto_organizes
  for delete
  to authenticated
  using (
    family_id = public.auth_family_id()
    and public.auth_role() = 'admin'
  );

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
         and public.auth_role() in ('admin', 'member')
    )
  );

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
         and public.auth_role() = 'admin'
    )
  )
  with check (
    exists (
      select 1
        from public.auto_organizes ao
       where ao.id = auto_organize_id
         and ao.family_id = public.auth_family_id()
         and public.auth_role() = 'admin'
    )
  );

create policy "auto_organize_runs_select_family"
  on public.auto_organize_runs
  for select
  to authenticated
  using (
    family_id = public.auth_family_id()
    and public.auth_role() in ('admin', 'member')
  );

grant select, insert, update, delete on table public.auto_organizes to authenticated;
grant select, insert, update, delete on table public.auto_organize_lines to authenticated;
grant select on table public.auto_organize_runs to authenticated;

-- ---------------------------------------------------------------------
-- transactions_client: expose auto-organize run metadata for History.
-- ---------------------------------------------------------------------
create or replace view public.transactions_client
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
  case
    when public.auth_role() = 'child'
      and (
        t.type = 'send'
        or t.from_member_id is distinct from public.auth_member_id()
      )
    then null::numeric(14, 2)
    else t.float_balance_before
  end as float_balance_before,
  case
    when public.auth_role() = 'child'
      and (
        t.type = 'send'
        or t.from_member_id is distinct from public.auth_member_id()
      )
    then null::numeric(14, 2)
    else t.float_balance_after
  end as float_balance_after,
  t.note,
  t.created_at,
  t.auto_organize_run_id,
  r.trigger as auto_organize_run_trigger
from public.transactions t
left join public.auto_organize_runs r on r.id = t.auto_organize_run_id
where public.transaction_visible_to_caller(t.id);

comment on view public.transactions_client is
  'Authenticated SELECT surface for transactions. Redacts shared-pool Float snapshots for child role.';

revoke all on public.transactions_client from public;
grant select on public.transactions_client to authenticated;
grant select on public.transactions_client to service_role;

revoke select on table public.transactions from authenticated;
