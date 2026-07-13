// =====================================================================
// simplefin-scheduled-refresh Edge Function
//
// Cadence sweep that keeps SimpleFIN-linked balances fresh (SimpleFIN
// has no webhooks at all). Invoked by pg_cron via net.http_post — see
// migration 84's trigger_scheduled_balance_refresh — NOT by end users.
// Mirrors teller-scheduled-refresh: each invocation drains the stalest
// due connections in bounded batches via claim_stale_simplefin_connections,
// so overlapping ticks are disjoint and a crashed tick self-heals.
//
// Request budget: SimpleFIN asks for ≲24 requests/day per connection.
// One request refreshes a whole connection, so the 6h staleness cadence
// spends ~4/day, leaving plenty for manual refreshes (30-min throttle).
//
// Trust model: publicly reachable but authenticated by a shared secret
// (X-Cron-Secret == SCHEDULED_REFRESH_SECRET). Uses the service role to
// bypass RLS. Inert until SCHEDULED_REFRESH_SECRET is configured.
// =====================================================================

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { secretKey } from '../_shared/keys.ts'
import { isCreditCardAccountType } from '../_shared/cashAccountTypes.ts'
import { fetchAccounts, isReconnectError, normalizeBalance } from '../_shared/simplefin.ts'

// How stale a linked balance may get before the sweep re-pulls it.
const CADENCE_HOURS = Number(Deno.env.get('SCHEDULED_REFRESH_CADENCE_HOURS') ?? '6')
// Connections claimed per batch (one claim RPC call).
const BATCH = Number(Deno.env.get('SCHEDULED_REFRESH_BATCH') ?? '25')
// A claim older than this is reclaimable — a tick that died mid-run frees
// its connections so they retry, but a broken connection isn't hammered
// every tick.
const CLAIM_TTL = '15 minutes'
// Bounds on a single invocation so one tick can't run away.
const TIME_BUDGET_MS = 40_000
const MAX_CONNECTIONS = 200
// Concurrent SimpleFIN pulls — polite to the Bridge.
const CONNECTION_CONCURRENCY = 4

// Constant-time string compare for the shared secret.
function secretsEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++]
      await fn(item)
    }
  })
  await Promise.all(workers)
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const expected = Deno.env.get('SCHEDULED_REFRESH_SECRET') ?? ''
  if (!expected) {
    console.error('SCHEDULED_REFRESH_SECRET not configured')
    return new Response('scheduled refresh secret not configured', { status: 500 })
  }
  const provided = req.headers.get('X-Cron-Secret') ?? ''
  if (!secretsEqual(provided, expected)) {
    return new Response('unauthorized', { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, secretKey())

  const start = Date.now()
  const staleBefore = new Date(
    Date.now() - CADENCE_HOURS * 60 * 60 * 1000,
  ).toISOString()

  let connectionsProcessed = 0
  let accountsUpdated = 0
  const errors: string[] = []

  while (
    Date.now() - start < TIME_BUDGET_MS &&
    connectionsProcessed < MAX_CONNECTIONS
  ) {
    const limit = Math.min(BATCH, MAX_CONNECTIONS - connectionsProcessed)

    const { data: claimed, error: claimError } = await admin.rpc(
      'claim_stale_simplefin_connections',
      {
        p_stale_before: staleBefore,
        p_claim_ttl: CLAIM_TTL,
        p_limit: limit,
      },
    )
    if (claimError) {
      errors.push(`claim: ${claimError.message}`)
      break
    }
    if (!claimed || claimed.length === 0) break

    const { data: accounts, error: accountsError } = await admin
      .from('accounts')
      .select('id, simplefin_account_id, simplefin_connection_id, account_type')
      .in('simplefin_connection_id', claimed.map((c: { id: string }) => c.id))
      .eq('source', 'simplefin')
      .not('simplefin_account_id', 'is', null)
    if (accountsError) {
      errors.push(`accounts: ${accountsError.message}`)
      break
    }

    const accountsByConnection = new Map<string, typeof accounts>()
    for (const account of accounts ?? []) {
      const bucket = accountsByConnection.get(account.simplefin_connection_id)
      if (bucket) bucket.push(account)
      else accountsByConnection.set(account.simplefin_connection_id, [account])
    }

    const nowIso = new Date().toISOString()
    await mapWithConcurrency(
      claimed,
      CONNECTION_CONCURRENCY,
      async (connection: { id: string; access_url: string }) => {
        const linked = accountsByConnection.get(connection.id) ?? []
        if (linked.length === 0) return
        try {
          const accountSet = await fetchAccounts(connection.access_url, {
            balancesOnly: true,
            accountIds: linked.map((a) => a.simplefin_account_id),
          })
          const byId = new Map(accountSet.accounts.map((a) => [a.id, a]))
          for (const account of linked) {
            const sfAccount = byId.get(account.simplefin_account_id)
            if (!sfAccount) {
              errors.push(`${account.id}: missing from SimpleFIN response`)
              continue
            }
            try {
              const kind = isCreditCardAccountType(account.account_type)
                ? 'card'
                : 'cash'
              const balance = normalizeBalance(kind, sfAccount.balance)
              const { error: updateError } = await admin
                .from('accounts')
                .update({ current_balance: balance, last_synced_at: nowIso })
                .eq('id', account.id)
              if (updateError) {
                errors.push(`${account.id}: ${updateError.message}`)
              } else {
                accountsUpdated++
              }
            } catch (err) {
              errors.push(
                `${account.id}: ${err instanceof Error ? err.message : String(err)}`,
              )
            }
          }
          await admin
            .from('simplefin_connections')
            .update({ last_synced_at: nowIso })
            .eq('id', connection.id)
        } catch (err) {
          if (isReconnectError(err)) {
            // Credentials rejected — stop sweeping this connection until
            // it's reconnected (status gate in the claim RPC).
            await admin
              .from('simplefin_connections')
              .update({ status: 'disconnected' })
              .eq('id', connection.id)
          }
          errors.push(
            `${connection.id}: ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      },
    )

    connectionsProcessed += claimed.length
    if (claimed.length < limit) break // drained the due set
  }

  return new Response(
    JSON.stringify({
      ok: true,
      connectionsProcessed,
      accountsUpdated,
      errorCount: errors.length,
      errors: errors.slice(0, 20),
      elapsedMs: Date.now() - start,
    }),
    { headers: { 'content-type': 'application/json' } },
  )
})
