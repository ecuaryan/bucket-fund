-- =====================================================================
-- SimpleFIN connections + provider-agnostic groundwork.
--
-- Teller withdrew its API product (July 2026), so linked-bank syncing
-- needs a new provider. SimpleFIN Bridge (beta-bridge.simplefin.org) is
-- the generally-available replacement: the account holder subscribes to
-- SimpleFIN directly and pastes a one-time Setup Token into the app.
--
-- Design: `accounts` stays the provider-neutral core of the ledger.
-- Each provider gets its own credential table (service-role only) and
-- its own linkage columns on `accounts`, discriminated by
-- `accounts.source`. SQL that means "linked to a bank" now says
-- `source <> 'manual'` instead of `source = 'teller'`.
--
-- Teller is QUIESCED, not removed: its rows, tables, and functions stay
-- (balances freeze at last_synced_at), and the scheduled sweep simply
-- stops posting to the Teller edge function. If Teller ships a v2, a
-- small migration re-enables it.
--
-- SECURITY: simplefin_connections.access_url embeds HTTP Basic
-- credentials granting read access to the family's bank data. Same
-- posture as teller_enrollments — RLS on, ZERO policies, no grants to
-- authenticated/anon. Only Edge Functions using the service role touch
-- this table.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. accounts.source gains 'simplefin' (and 'plaid', reserved for the
--    next PR so the check isn't churned twice).
-- ---------------------------------------------------------------------
alter table public.accounts
  drop constraint accounts_source_check;

alter table public.accounts
  add constraint accounts_source_check
    check (source in ('teller', 'manual', 'simplefin', 'plaid'));

-- ---------------------------------------------------------------------
-- 2. 'cash' joins the cash subtypes. SimpleFIN does not classify account
--    types, so the admin marks each imported account cash vs card; cash
--    rows store account_type = 'cash'. Mirrors src/lib/accountTypes.ts
--    and supabase/functions/_shared/cashAccountTypes.ts.
-- ---------------------------------------------------------------------
create or replace function public.is_cash_account_type(p_type text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_type, '')) in (
    'checking',
    'savings',
    'money_market',
    'certificate_of_deposit',
    'cash_management',
    'treasury',
    'manual',
    'cash'
  );
$$;

-- ---------------------------------------------------------------------
-- 3. simplefin_connections: one row per claimed SimpleFIN Setup Token
--    (one Bridge subscription can cover many institutions, so one
--    connection can yield accounts across institutions).
-- ---------------------------------------------------------------------
create table public.simplefin_connections (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  -- Access URL with embedded Basic-auth credentials. NEVER client-visible.
  access_url text not null,
  status text not null default 'active' check (status in ('active', 'disconnected')),
  last_synced_at timestamptz,
  -- Claim marker for the scheduled sweep (see claim_stale_simplefin_connections).
  refresh_claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create index simplefin_connections_family_id_idx
  on public.simplefin_connections(family_id);

alter table public.simplefin_connections enable row level security;

-- Intentionally no policies: with RLS on and zero policies the table is
-- invisible to every role except those that bypass RLS (service role).

revoke all on table public.simplefin_connections from authenticated;
revoke all on table public.simplefin_connections from anon;

-- ---------------------------------------------------------------------
-- 4. accounts linkage columns for SimpleFIN.
-- ---------------------------------------------------------------------
alter table public.accounts
  add column simplefin_account_id text,
  add column simplefin_connection_id uuid
    references public.simplefin_connections(id) on delete set null;

create unique index accounts_family_simplefin_account_id_key
  on public.accounts (family_id, simplefin_account_id)
  where simplefin_account_id is not null;

create index accounts_simplefin_connection_id_idx
  on public.accounts(simplefin_connection_id);

-- A row carries at most one provider linkage; `source` says which one.
alter table public.accounts
  add constraint accounts_single_provider_linkage check (
    not (teller_account_id is not null and simplefin_account_id is not null)
  );

-- ---------------------------------------------------------------------
-- 5. "Linked" now means any non-manual source. These two functions are
--    the SQL predicates behind blocking virtual sends for linked members
--    (give_money / return_from_child) — a SimpleFIN-linked child must be
--    locked down exactly like a Teller-linked one.
-- ---------------------------------------------------------------------
create or replace function public.member_has_linked_account(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.accounts a
     where a.owner_member_id = p_member_id
       and a.source <> 'manual'
  );
$$;

create or replace function public.family_linked_child_member_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct fm.id), '{}'::uuid[])
    from public.family_members fm
    join public.accounts a
      on a.owner_member_id = fm.id
     and a.source <> 'manual'
   where fm.family_id = public.auth_family_id()
     and fm.role = 'child';
$$;

-- ---------------------------------------------------------------------
-- 6. get_home_balance_breakdown: bank_cash / bank_last_synced_at cover
--    every linked provider (`source <> 'manual'`), not just Teller.
--    Everything else is identical to migration 80's definition.
-- ---------------------------------------------------------------------
create or replace function public.get_home_balance_breakdown()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_member_id uuid := public.auth_member_id();
  v_role text := public.auth_role();
  v_family_id uuid := public.auth_family_id();
  v_cash numeric := 0;
  v_bank_cash numeric := 0;
  v_manual_cash numeric := 0;
  v_card_debt numeric := 0;
  v_allocated numeric := 0;
  v_children numeric := 0;
  v_children_json jsonb := '[]'::jsonb;
  v_float numeric := 0;
  v_bank_synced timestamptz := null;
  v_has_linked_bank boolean := false;
begin
  if v_member_id is null or v_family_id is null then
    return jsonb_build_object(
      'float', 0,
      'total_cash', 0,
      'bank_cash', 0,
      'manual_cash', 0,
      'card_debt', 0,
      'bucket_allocated', 0,
      'children_set_aside', 0,
      'children', '[]'::jsonb,
      'bank_last_synced_at', null,
      'has_linked_bank', false
    );
  end if;

  v_float := public.member_float(v_member_id);
  v_has_linked_bank := public.member_has_linked_account(v_member_id);

  -- Linked accounts only: a manual edit is not a refresh.
  select max(a.last_synced_at)
    into v_bank_synced
    from public.accounts a
   where a.family_id = v_family_id
     and a.source <> 'manual'
     and (
       public.is_cash_account_type(a.account_type)
       or public.is_credit_card_account_type(a.account_type)
     );

  if v_role in ('admin', 'member') then
    select coalesce(sum(a.current_balance), 0)
      into v_cash
      from public.accounts a
     where a.family_id = v_family_id
       and public.is_cash_account_type(a.account_type);

    select coalesce(sum(a.current_balance), 0)
      into v_bank_cash
      from public.accounts a
     where a.family_id = v_family_id
       and a.source <> 'manual'
       and public.is_cash_account_type(a.account_type);

    select coalesce(sum(a.current_balance), 0)
      into v_manual_cash
      from public.accounts a
     where a.family_id = v_family_id
       and a.source = 'manual'
       and public.is_cash_account_type(a.account_type);

    select coalesce(sum(a.current_balance), 0)
      into v_card_debt
      from public.accounts a
     where a.family_id = v_family_id
       and public.is_credit_card_account_type(a.account_type);

    select coalesce(sum(b.allocated_amount), 0)
      into v_allocated
      from public.buckets b
     where b.family_id = v_family_id
       and (
         b.owner_member_id is null
         or exists (
           select 1
             from public.family_members fm
            where fm.id = b.owner_member_id
              and fm.role in ('admin', 'member')
         )
       );

    with child_lines as (
      select
        fm.id as member_id,
        fm.name,
        public.member_child_virtual_balance(fm.id) as amount,
        public.member_float(fm.id) as available_float
      from public.family_members fm
     where fm.family_id = v_family_id
       and fm.role = 'child'
    )
    select
      coalesce(sum(amount), 0),
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'member_id', member_id,
            'name', name,
            'amount', amount,
            'available_float', available_float
          )
          order by name
        ),
        '[]'::jsonb
      )
      into v_children, v_children_json
      from child_lines;

  else
    select coalesce(sum(a.current_balance), 0)
      into v_cash
      from public.accounts a
     where a.family_id = v_family_id
     and a.owner_member_id = v_member_id
     and public.is_cash_account_type(a.account_type);

    v_bank_cash := v_cash;
    v_manual_cash := 0;
    v_card_debt := 0;

    select coalesce(sum(b.allocated_amount), 0)
      into v_allocated
      from public.buckets b
     where b.family_id = v_family_id
       and b.owner_member_id = v_member_id;
  end if;

  return jsonb_build_object(
    'float', v_float,
    'total_cash', v_cash,
    'bank_cash', v_bank_cash,
    'manual_cash', v_manual_cash,
    'card_debt', v_card_debt,
    'bucket_allocated', v_allocated,
    'children_set_aside', v_children,
    'children', coalesce(v_children_json, '[]'::jsonb),
    'bank_last_synced_at', v_bank_synced,
    'has_linked_bank', v_has_linked_bank
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 7. claim_stale_simplefin_connections: mirrors claim_stale_enrollments
--    (migration 81) for the SimpleFIN sweep. One SimpleFIN request
--    refreshes a whole connection (GET /accounts?balances-only=1), so
--    the claim unit is the connection.
--
--    Service-role only: returns access_url, which must never reach a
--    client. Called from the simplefin-scheduled-refresh Edge Function.
-- ---------------------------------------------------------------------
create or replace function public.claim_stale_simplefin_connections(
  p_stale_before timestamptz,
  p_claim_ttl interval,
  p_limit int
)
returns table (id uuid, family_id uuid, access_url text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.simplefin_connections sc
     set refresh_claimed_at = now()
   where sc.id in (
     select c.id
       from public.simplefin_connections c
      where c.status = 'active'
        and (c.refresh_claimed_at is null or c.refresh_claimed_at < now() - p_claim_ttl)
        and exists (
          select 1
            from public.accounts a
           where a.simplefin_connection_id = c.id
             and a.source = 'simplefin'
             and a.simplefin_account_id is not null
             and (a.last_synced_at is null or a.last_synced_at < p_stale_before)
        )
      order by (
        select min(a.last_synced_at)
          from public.accounts a
         where a.simplefin_connection_id = c.id
           and a.source = 'simplefin'
      ) asc nulls first
      limit greatest(p_limit, 0)
      for update skip locked
   )
  returning sc.id, sc.family_id, sc.access_url;
end;
$$;

revoke all on function public.claim_stale_simplefin_connections(timestamptz, interval, int) from public;
revoke all on function public.claim_stale_simplefin_connections(timestamptz, interval, int) from authenticated;
grant execute on function public.claim_stale_simplefin_connections(timestamptz, interval, int) to service_role;

-- ---------------------------------------------------------------------
-- 8. Scheduled sweep: post to the SimpleFIN sweep function and STOP
--    posting to the Teller one (Teller is gone; every claim would 502).
--    New Vault secret: simplefin_scheduled_refresh_url — the full URL of
--    the simplefin-scheduled-refresh Edge Function. Reuses the existing
--    scheduled_refresh_secret. Until the URL secret is set this warns
--    and no-ops, exactly like migration 81 before its setup.
--
--    SimpleFIN request budget: Bridge asks for ≤~24 requests/day per
--    connection. The sweep's 6h staleness cadence (edge-side) spends ~4;
--    manual refreshes are server-throttled on top.
-- ---------------------------------------------------------------------
create or replace function public.trigger_scheduled_balance_refresh()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'simplefin_scheduled_refresh_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'scheduled_refresh_secret';

  if v_url is null or v_secret is null then
    raise warning 'simplefin_scheduled_refresh_url/scheduled_refresh_secret not set in Vault; skipping balance sweep';
    return;
  end if;

  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', v_secret
    ),
    timeout_milliseconds := 5000
  );
end;
$$;

-- Rename the cron job to match its provider-agnostic role. Same trigger
-- function, same 10-minute tick (each tick only claims connections whose
-- balances are older than the edge function's staleness cadence).
do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job
     where jobname in ('teller-scheduled-balance-refresh', 'scheduled-balance-refresh')
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'scheduled-balance-refresh',
  '*/10 * * * *',
  $$ select public.trigger_scheduled_balance_refresh(); $$
);
