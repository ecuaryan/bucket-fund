-- =====================================================================
-- Scheduled balance refresh (cadence sweep).
--
-- The Teller webhook only fires on NEW transactions, and Teller only
-- guarantees a *polling* attempt every 24h — not a webhook. So during
-- quiet periods balances (and the "Refreshed X ago" label) go stale even
-- though Teller has fresher data. This adds a periodic sweep that keeps
-- every linked balance current independent of transaction activity.
--
-- Why a "sweep" and not one big nightly job: Teller calls require the
-- mTLS client cert, which only the Edge Function has (Postgres/pg_net
-- can't make that call). So pg_cron can't do the work itself — it pings
-- an Edge Function, which claims a bounded batch of the *stalest due*
-- enrollments and refreshes just those. Over the cadence window every
-- enrollment is covered; steady-state work is bounded by
-- (enrollments / cadence), never a thundering herd. This scales to
-- thousands by tuning batch size / tick frequency, no rearchitecting.
--
-- Safety: shipping this is inert until two Vault secrets are set
-- (scheduled_refresh_url, scheduled_refresh_secret). Until then the cron
-- trigger no-ops with a warning, and the Edge Function rejects any call
-- lacking the shared secret. See README § Production deploy automation.
-- =====================================================================

create extension if not exists pg_net;

-- Claim marker: a tick stamps this when it takes an enrollment, so
-- overlapping ticks never double-work and a tick that dies mid-run frees
-- its claim after the TTL (see claim_stale_enrollments).
alter table public.teller_enrollments
  add column if not exists refresh_claimed_at timestamptz;

-- ---------------------------------------------------------------------
-- claim_stale_enrollments: atomically claim up to p_limit active
-- enrollments whose freshest linked (source='teller') account is older
-- than p_stale_before (or never synced), stalest first. FOR UPDATE SKIP
-- LOCKED + the claim stamp make concurrent ticks disjoint. A claim older
-- than p_claim_ttl is reclaimable so a crashed tick self-heals.
--
-- Service-role only: it returns access_token, which must never reach a
-- client. Called from the teller-scheduled-refresh Edge Function.
-- ---------------------------------------------------------------------
create or replace function public.claim_stale_enrollments(
  p_stale_before timestamptz,
  p_claim_ttl interval,
  p_limit int
)
returns table (id uuid, access_token text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.teller_enrollments te
     set refresh_claimed_at = now()
   where te.id in (
     select e.id
       from public.teller_enrollments e
      where e.status = 'active'
        and (e.refresh_claimed_at is null or e.refresh_claimed_at < now() - p_claim_ttl)
        and exists (
          select 1
            from public.accounts a
           where a.teller_enrollment_id = e.id
             and a.source = 'teller'
             and a.teller_account_id is not null
             and (a.last_synced_at is null or a.last_synced_at < p_stale_before)
        )
      order by (
        select min(a.last_synced_at)
          from public.accounts a
         where a.teller_enrollment_id = e.id
           and a.source = 'teller'
      ) asc nulls first
      limit greatest(p_limit, 0)
      for update skip locked
   )
  returning te.id, te.access_token;
end;
$$;

revoke all on function public.claim_stale_enrollments(timestamptz, interval, int) from public;
revoke all on function public.claim_stale_enrollments(timestamptz, interval, int) from authenticated;
grant execute on function public.claim_stale_enrollments(timestamptz, interval, int) to service_role;

-- ---------------------------------------------------------------------
-- trigger_scheduled_balance_refresh: the cron entry point. Reads the
-- Edge Function URL + shared secret from Vault and fires a fire-and-forget
-- POST (net.http_post is async — the sweep itself runs in the function).
-- No secrets configured → warn and no-op, so the job is safe to schedule
-- before the environment is set up.
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
    from vault.decrypted_secrets where name = 'scheduled_refresh_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'scheduled_refresh_secret';

  if v_url is null or v_secret is null then
    raise warning 'scheduled_refresh_url/secret not set in Vault; skipping balance sweep';
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

revoke all on function public.trigger_scheduled_balance_refresh() from public;
revoke all on function public.trigger_scheduled_balance_refresh() from authenticated;

-- ---------------------------------------------------------------------
-- Schedule: tick every 10 minutes. Each tick drains a bounded number of
-- stalest-due enrollments (batching/time budget live in the Edge
-- Function). Reschedule cleanly if it already exists.
-- ---------------------------------------------------------------------
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
    from cron.job
   where jobname = 'teller-scheduled-balance-refresh'
   limit 1;
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end;
$$;

select cron.schedule(
  'teller-scheduled-balance-refresh',
  '*/10 * * * *',
  $$ select public.trigger_scheduled_balance_refresh(); $$
);
