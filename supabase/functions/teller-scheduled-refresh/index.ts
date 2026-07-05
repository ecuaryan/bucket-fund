// =====================================================================
// teller-scheduled-refresh Edge Function
//
// Cadence sweep that keeps linked balances fresh independent of Teller
// webhook activity (webhooks only fire on NEW transactions; Teller only
// guarantees a daily *poll*, not a webhook). Invoked by pg_cron via
// net.http_post (see migration 81), NOT by end users.
//
// Each invocation drains the STALEST DUE enrollments in bounded batches
// until it runs out, hits a per-invocation enrollment cap, or exhausts a
// wall-clock budget — whichever comes first. The claim RPC
// (claim_stale_enrollments) makes overlapping ticks disjoint and lets a
// crashed tick self-heal, so this scales to thousands of enrollments by
// tuning batch size / tick frequency alone.
//
// Trust model: publicly reachable but authenticated by a shared secret
// (X-Cron-Secret == SCHEDULED_REFRESH_SECRET). Uses the service role to
// bypass RLS. Inert until SCHEDULED_REFRESH_SECRET is configured.
// =====================================================================

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { secretKey } from '../_shared/keys.ts'
import { getBalance } from '../_shared/teller.ts'

// How stale a linked balance may get before the sweep re-pulls it.
const CADENCE_HOURS = Number(Deno.env.get('SCHEDULED_REFRESH_CADENCE_HOURS') ?? '6')
// Enrollments claimed per batch (one claim RPC call).
const BATCH = Number(Deno.env.get('SCHEDULED_REFRESH_BATCH') ?? '50')
// A claim older than this is reclaimable — a tick that died mid-run frees
// its enrollments so they retry, but a broken enrollment isn't hammered
// every tick.
const CLAIM_TTL = '15 minutes'
// Bounds on a single invocation so one tick can't run away.
const TIME_BUDGET_MS = 40_000
const MAX_ENROLLMENTS = 500
// Concurrent Teller balance pulls — polite to Teller's rate limits.
const ACCOUNT_CONCURRENCY = 8

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

  let enrollmentsProcessed = 0
  let accountsUpdated = 0
  const errors: string[] = []

  while (
    Date.now() - start < TIME_BUDGET_MS &&
    enrollmentsProcessed < MAX_ENROLLMENTS
  ) {
    const limit = Math.min(BATCH, MAX_ENROLLMENTS - enrollmentsProcessed)

    const { data: claimed, error: claimError } = await admin.rpc(
      'claim_stale_enrollments',
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

    const tokenByEnrollment = new Map<string, string>(
      claimed.map((e: { id: string; access_token: string }) => [
        e.id,
        e.access_token,
      ]),
    )

    const { data: accounts, error: accountsError } = await admin
      .from('accounts')
      .select('id, teller_account_id, teller_enrollment_id')
      .in('teller_enrollment_id', claimed.map((e: { id: string }) => e.id))
      .eq('source', 'teller')
      .not('teller_account_id', 'is', null)
    if (accountsError) {
      errors.push(`accounts: ${accountsError.message}`)
      break
    }

    const nowIso = new Date().toISOString()
    await mapWithConcurrency(
      accounts ?? [],
      ACCOUNT_CONCURRENCY,
      async (account) => {
        const token = tokenByEnrollment.get(account.teller_enrollment_id)
        if (!token || !account.teller_account_id) return
        try {
          const balance = await getBalance(token, account.teller_account_id)
          const { error: updateError } = await admin
            .from('accounts')
            .update({
              current_balance: Number(balance.ledger),
              last_synced_at: nowIso,
            })
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
      },
    )

    enrollmentsProcessed += claimed.length
    if (claimed.length < limit) break // drained the due set
  }

  return new Response(
    JSON.stringify({
      ok: true,
      enrollmentsProcessed,
      accountsUpdated,
      errorCount: errors.length,
      errors: errors.slice(0, 20),
      elapsedMs: Date.now() - start,
    }),
    { headers: { 'content-type': 'application/json' } },
  )
})
