// =====================================================================
// check-invariant Edge Function
//
// The single source of truth for whether a family's books balance.
//
// Computes:
//   sum(allocated_amount across buckets where family_id = $1)
//     + sum(unallocated balances across members in that family)
//     === sum(current_balance across accounts where family_id = $1)
//
// If the equality does not hold (within a small epsilon for rounding),
// writes an invariant_violation record and returns the discrepancy.
//
// This runs server-side so child clients never see family-wide raw
// balances. The browser client should never reproduce this calculation
// for anything other than optimistic UI feedback.
// =====================================================================

// @ts-nocheck — this file targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

type CheckInvariantRequest = {
  family_id: string
}

type CheckInvariantResponse = {
  ok: boolean
  family_id: string
  total_allocated: number
  total_unallocated: number
  total_real_balance: number
  violation_amount: number
}

Deno.serve(async (req: Request) => {
  // TODO:
  //   1. Authenticate the caller (Supabase JWT in the Authorization header).
  //      Confirm the caller belongs to the family_id they are asking about.
  //   2. Use the service role key to query:
  //        - sum(buckets.allocated_amount) for the family
  //        - sum(accounts.current_balance) for the family
  //        - per-member unallocated = sum(accounts for that member)
  //              - sum(buckets for that member)
  //          (plus virtual sends/receives for members without linked accounts)
  //   3. Compute violation_amount = total_real_balance
  //                                - (total_allocated + total_unallocated)
  //   4. If |violation_amount| > 0.005, insert an invariant_violation row
  //      and broadcast to the family's admin via Realtime.
  //   5. Return the structured result.

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body = (await req.json()) as CheckInvariantRequest
  const stub: CheckInvariantResponse = {
    ok: true,
    family_id: body.family_id,
    total_allocated: 0,
    total_unallocated: 0,
    total_real_balance: 0,
    violation_amount: 0,
  }

  return new Response(JSON.stringify(stub), {
    headers: { 'content-type': 'application/json' },
  })
})
