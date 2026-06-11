// =====================================================================
// check-invariant Edge Function
//
// The single source of truth for whether a family's books balance.
//
// Computes:
//   sum(allocated_amount across buckets where family_id = $1)
//     + sum(spending money balances across members in that family)
//     === sum(current_balance across accounts where family_id = $1)
//
// DEFERRED (family beta): see CONTEXT.md § Data Integrity. User-facing
// rebalancing uses negative spending money on Buckets tab. Before paid SaaS, implement
// operator-side checks here (or in SQL) — logging/alerts, not a duplicate
// of the red-spending-money UX.
//
// If built: verify ledger identity; child clients must not receive family-wide
// raw balances from this path.
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
  total_float: number
  total_real_balance: number
  violation_amount: number
}

Deno.serve(async (req: Request) => {
  // TODO (paid SaaS phase): reuse member_float / cash sums in SQL;
  // operator alert + logging — not an in-app banner for normal negative spending money.

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body = (await req.json()) as CheckInvariantRequest
  const stub: CheckInvariantResponse = {
    ok: true,
    family_id: body.family_id,
    total_allocated: 0,
    total_float: 0,
    total_real_balance: 0,
    violation_amount: 0,
  }

  return new Response(JSON.stringify(stub), {
    headers: { 'content-type': 'application/json' },
  })
})
