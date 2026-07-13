-- =====================================================================
-- Plaid provider groundwork: plaid_items + claim RPC + sweep wiring.
--
-- Plaid (free trial tier: 10 LIFETIME production Items per team) restores
-- free bank syncing for the owner's household, behind the owner-controlled
-- `plaid` feature flag (docs/FEATURE_FLAGS.md). Deleting an Item never
-- frees a slot, so everything here is designed to preserve Items:
--
--   * Unlink DETACHES locally (accounts rows removed, plaid_items row and
--     its access_token retained, status 'detached') so re-linking the same
--     bank later reuses the Item instead of burning a slot.
--   * Reconnects go through Plaid Link's update mode (repairs the existing
--     Item) — never a fresh link.
--
-- SECURITY: plaid_items.access_token is a bearer credential for the
-- family's bank data. Same posture as simplefin_connections — RLS on,
-- ZERO policies, explicit service_role grants (the hosted project does
-- not auto-grant on raw-SQL tables; see migrations 4 and 86).
-- =====================================================================

create table public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  -- Plaid's item_id (one Item = one institution login).
  item_id text not null,
  access_token text not null,
  institution_name text,
  institution_id text,
  -- 'active'              — syncing normally
  -- 'reconnect_required'  — Plaid returned ITEM_LOGIN_REQUIRED; repair via
  --                         Link update mode (does not consume an Item)
  -- 'detached'            — unlinked in-app; token kept so a future
  --                         re-link reuses this Item instead of a new slot
  status text not null default 'active'
    check (status in ('active', 'reconnect_required', 'detached')),
  last_synced_at timestamptz,
  -- Claim marker for the scheduled sweep (see claim_stale_plaid_items).
  refresh_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (family_id, item_id)
);

create index plaid_items_family_id_idx on public.plaid_items(family_id);

alter table public.plaid_items enable row level security;
-- Intentionally no policies: invisible to every role except those that
-- bypass RLS (service role).

revoke all on table public.plaid_items from authenticated;
revoke all on table public.plaid_items from anon;
grant select, insert, update, delete on table public.plaid_items to service_role;

-- The Plaid Edge Functions gate on the family's `plaid` feature flag via
-- the service role (defense in depth around the 10 lifetime Items) — the
-- flag table only granted SELECT to authenticated before.
grant select on table public.feature_flags to service_role;

-- ---------------------------------------------------------------------
-- accounts linkage columns for Plaid.
-- ---------------------------------------------------------------------
alter table public.accounts
  add column plaid_account_id text,
  add column plaid_item_id uuid
    references public.plaid_items(id) on delete set null;

create unique index accounts_family_plaid_account_id_key
  on public.accounts (family_id, plaid_account_id)
  where plaid_account_id is not null;

create index accounts_plaid_item_id_idx
  on public.accounts(plaid_item_id);

-- A row carries at most one provider linkage; `source` says which one.
alter table public.accounts
  drop constraint accounts_single_provider_linkage;
alter table public.accounts
  add constraint accounts_single_provider_linkage check (
    (teller_account_id is not null)::int
    + (simplefin_account_id is not null)::int
    + (plaid_account_id is not null)::int
    <= 1
  );

-- ---------------------------------------------------------------------
-- claim_stale_plaid_items: mirrors claim_stale_simplefin_connections for
-- the Plaid sweep. One /accounts/balance/get covers a whole Item.
--
-- Service-role only: returns access_token, which must never reach a
-- client. Called from the plaid-scheduled-refresh Edge Function.
-- ---------------------------------------------------------------------
create or replace function public.claim_stale_plaid_items(
  p_stale_before timestamptz,
  p_claim_ttl interval,
  p_limit int
)
returns table (id uuid, family_id uuid, access_token text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.plaid_items pi
     set refresh_claimed_at = now()
   where pi.id in (
     select i.id
       from public.plaid_items i
      where i.status = 'active'
        and (i.refresh_claimed_at is null or i.refresh_claimed_at < now() - p_claim_ttl)
        and exists (
          select 1
            from public.accounts a
           where a.plaid_item_id = i.id
             and a.source = 'plaid'
             and a.plaid_account_id is not null
             and (a.last_synced_at is null or a.last_synced_at < p_stale_before)
        )
      order by (
        select min(a.last_synced_at)
          from public.accounts a
         where a.plaid_item_id = i.id
           and a.source = 'plaid'
      ) asc nulls first
      limit greatest(p_limit, 0)
      for update skip locked
   )
  returning pi.id, pi.family_id, pi.access_token;
end;
$$;

revoke all on function public.claim_stale_plaid_items(timestamptz, interval, int) from public;
revoke all on function public.claim_stale_plaid_items(timestamptz, interval, int) from authenticated;
grant execute on function public.claim_stale_plaid_items(timestamptz, interval, int) to service_role;

-- ---------------------------------------------------------------------
-- Scheduled sweep: post to every configured provider sweep. New Vault
-- secret: plaid_scheduled_refresh_url (full URL of plaid-scheduled-refresh).
-- Each provider stays inert until its URL secret is set; the shared
-- scheduled_refresh_secret authenticates both.
-- ---------------------------------------------------------------------
create or replace function public.trigger_scheduled_balance_refresh()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_url text;
  v_posted boolean := false;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'scheduled_refresh_secret';

  if v_secret is null then
    raise warning 'scheduled_refresh_secret not set in Vault; skipping balance sweep';
    return;
  end if;

  for v_url in
    select decrypted_secret
      from vault.decrypted_secrets
     where name in ('simplefin_scheduled_refresh_url', 'plaid_scheduled_refresh_url')
  loop
    v_posted := true;
    perform net.http_post(
      url := v_url,
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', v_secret
      ),
      timeout_milliseconds := 5000
    );
  end loop;

  if not v_posted then
    raise warning 'no provider sweep URLs set in Vault; skipping balance sweep';
  end if;
end;
$$;
