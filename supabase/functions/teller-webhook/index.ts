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
import { getBalance, verifyWebhookSignature } from '../_shared/teller.ts'

type TellerWebhookPayload = {
  id: string
  type: string
  timestamp: string
  payload?: Record<string, unknown>
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const signingSecret = Deno.env.get('TELLER_SIGNING_SECRET') ?? ''
  if (!signingSecret) {
    console.error('TELLER_SIGNING_SECRET not configured')
    // 500 is intentional — refuse to acknowledge events when we cannot
    // authenticate them. Teller will retry; the operator must fix
    // the secret.
    return new Response('signing secret not configured', { status: 500 })
  }

  // Read the raw body once — we need it for HMAC and for JSON parsing.
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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceRoleKey)

  // Resolve the family + enrollment + account this event belongs to.
  // Teller event payloads vary by type but commonly contain
  // enrollment_id and/or account_id. We look those up so we can scope
  // the teller_events row correctly.
  const accountId = (event.payload?.account_id as string | undefined) ?? null
  const enrollmentId =
    (event.payload?.enrollment_id as string | undefined) ?? null

  let dbAccountId: string | null = null
  let dbFamilyId: string | null = null
  let accessToken: string | null = null

  if (accountId) {
    const { data } = await admin
      .from('accounts')
      .select('id, family_id, teller_enrollment_id')
      .eq('teller_account_id', accountId)
      .maybeSingle()
    if (data) {
      dbAccountId = data.id
      dbFamilyId = data.family_id
      if (data.teller_enrollment_id) {
        const { data: enr } = await admin
          .from('teller_enrollments')
          .select('access_token')
          .eq('id', data.teller_enrollment_id)
          .maybeSingle()
        accessToken = enr?.access_token ?? null
      }
    }
  } else if (enrollmentId) {
    const { data } = await admin
      .from('teller_enrollments')
      .select('id, family_id, access_token')
      .eq('enrollment_id', enrollmentId)
      .maybeSingle()
    if (data) {
      dbFamilyId = data.family_id
      accessToken = data.access_token
    }
  }

  // Always log the raw event first so we have a tamper-evident audit
  // trail even if downstream side-effects fail.
  await admin.from('teller_events').insert({
    family_id: dbFamilyId,
    account_id: dbAccountId,
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>,
    processed_at: new Date().toISOString(),
  })

  // Side effects per event type. Keep the switch small and explicit;
  // unknown events are still logged above.
  try {
    switch (event.type) {
      case 'account.balance.updated':
      case 'transactions.processed': {
        if (dbAccountId && accessToken && accountId) {
          const balance = await getBalance(accessToken, accountId)
          await admin
            .from('accounts')
            .update({
              current_balance: Number(balance.ledger),
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', dbAccountId)
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
        // Unhandled events are just logged. That's intentional: we
        // don't want to noisily fail on event types Teller adds
        // later.
        break
    }
  } catch (err) {
    // Side-effect failures: log but still 200 to Teller so the event
    // doesn't retry forever. The teller_events row remains a record
    // of the failed processing attempt.
    console.error('Failed to apply webhook side-effect:', err)
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  })
})
