// =====================================================================
// teller-webhook Edge Function
//
// Receives webhooks from Teller, verifies the signature, updates
// affected `accounts` rows, and logs the raw event to teller_events.
//
// Trust model:
//   - This endpoint is publicly reachable (Teller calls it). It must
//     authenticate inbound requests via HMAC signature verification
//     using TELLER_SIGNING_SECRET BEFORE doing any work — including
//     before parsing the body.
//   - We always return 200 once we've persisted the event so Teller
//     does not retry. Downstream errors (e.g. unknown account) are
//     logged but do not cause retries.
//   - This function uses the service role to bypass RLS. The RLS
//     model deliberately has no client-facing INSERT policy on
//     teller_events.
// =====================================================================

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { secretKey } from '../_shared/keys.ts'
import { getBalance, verifyWebhookSignature } from '../_shared/teller.ts'

type TellerWebhookPayload = {
  id: string
  type: string
  timestamp: string
  payload?: Record<string, unknown>
}

type TellerTransactionPayload = {
  account_id?: string
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const signingSecret = Deno.env.get('TELLER_SIGNING_SECRET') ?? ''
  if (!signingSecret) {
    console.error('TELLER_SIGNING_SECRET not configured')
    return new Response('signing secret not configured', { status: 500 })
  }

  const rawBody = await req.text()
  const verification = await verifyWebhookSignature(
    rawBody,
    req.headers.get('Teller-Signature'),
    signingSecret,
  )
  if (!verification.ok) {
    console.warn('Rejecting webhook:', verification.reason)
    return new Response('signature verification failed', { status: 401 })
  }

  let event: TellerWebhookPayload
  try {
    event = JSON.parse(rawBody) as TellerWebhookPayload
  } catch {
    return new Response('invalid JSON', { status: 400 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, secretKey())

  const enrollmentId =
    (event.payload?.enrollment_id as string | undefined) ?? null

  let dbAccountId: string | null = null
  let dbFamilyId: string | null = null
  let dbEnrollmentInternalId: string | null = null
  let accessToken: string | null = null

  if (enrollmentId) {
    const { data } = await admin
      .from('teller_enrollments')
      .select('id, family_id, access_token')
      .eq('enrollment_id', enrollmentId)
      .maybeSingle()
    if (data) {
      dbFamilyId = data.family_id
      dbEnrollmentInternalId = data.id
      accessToken = data.access_token
    }
  }

  await admin.from('teller_events').insert({
    family_id: dbFamilyId,
    account_id: dbAccountId,
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>,
    processed_at: new Date().toISOString(),
  })

  async function refreshAccountBalance(
    tellerAccountId: string,
  ): Promise<void> {
    if (!accessToken) return

    const { data: account } = await admin
      .from('accounts')
      .select('id, family_id')
      .eq('teller_account_id', tellerAccountId)
      .maybeSingle()
    if (!account) return

    dbAccountId = account.id
    dbFamilyId = account.family_id

    const balance = await getBalance(accessToken, tellerAccountId)
    await admin
      .from('accounts')
      .update({
        current_balance: Number(balance.ledger),
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', account.id)
  }

  try {
    switch (event.type) {
      case 'transactions.processed': {
        if (!accessToken) break

        const transactions =
          (event.payload?.transactions as TellerTransactionPayload[] | undefined) ??
          []
        const tellerAccountIds = new Set<string>()
        for (const txn of transactions) {
          if (txn.account_id) tellerAccountIds.add(txn.account_id)
        }

        if (tellerAccountIds.size === 0 && dbEnrollmentInternalId) {
          const { data: enrollmentAccounts } = await admin
            .from('accounts')
            .select('teller_account_id')
            .eq('teller_enrollment_id', dbEnrollmentInternalId)
          for (const row of enrollmentAccounts ?? []) {
            tellerAccountIds.add(row.teller_account_id)
          }
        }

        // Isolate each account: a single failing balance pull (e.g. a
        // closed card returning 404) must not abort the rest of the batch.
        for (const tellerAccountId of tellerAccountIds) {
          try {
            await refreshAccountBalance(tellerAccountId)
          } catch (err) {
            console.error(
              `Failed to refresh balance for account ${tellerAccountId}:`,
              err,
            )
          }
        }
        break
      }
      case 'enrollment.disconnected': {
        if (enrollmentId) {
          await admin
            .from('teller_enrollments')
            .update({ status: 'disconnected' })
            .eq('enrollment_id', enrollmentId)
        }
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error('Failed to apply webhook side-effect:', err)
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  })
})
