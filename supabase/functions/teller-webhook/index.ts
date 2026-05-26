// =====================================================================
// teller-webhook Edge Function
//
// Receives webhooks from Teller, updates the affected `accounts` row,
// re-verifies the balance invariant, and broadcasts the result over
// Supabase Realtime to all family clients.
//
// Runs on the Deno runtime inside Supabase Edge Functions.
// =====================================================================

// @ts-nocheck — this file targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

Deno.serve(async (req: Request) => {
  // TODO:
  //   1. Read raw body + `teller-signature` header.
  //   2. Verify HMAC signature using TELLER_SIGNING_SECRET.
  //      Reject with 401 on mismatch BEFORE parsing the body.
  //   3. Parse the JSON payload.
  //   4. Look up the affected `accounts` row by teller_account_id.
  //   5. Update `accounts.current_balance` and `last_synced_at`.
  //   6. Insert a row into `teller_events` (event_type, payload, processed_at).
  //   7. Invoke check-invariant for the affected family_id.
  //   8. If the invariant is violated, write an alert row and surface
  //      it to the admin via a Realtime broadcast channel.
  //   9. Always return 200 once the event has been logged, even on
  //      downstream failures, so Teller does not retry indefinitely.

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  return new Response(JSON.stringify({ ok: true, stub: true }), {
    headers: { 'content-type': 'application/json' },
  })
})
