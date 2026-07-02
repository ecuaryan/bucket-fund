/**
 * Balance invariant checker.
 *
 * The system-wide invariant (see CONTEXT.md "Balance Model"):
 *
 *   sum(bucket allocations) + sum(float balances across members)
 *     === sum(cash balances, linked + manual)
 *       − sum(credit card balances, linked + manual)
 *
 * User-facing “rebalance” signal is negative float on Buckets tab (see
 * CONTEXT.md § Data Integrity). Automated operator ledger checks are
 * deferred until a possible paid SaaS (`check-invariant` stub).
 *
 * This client helper is not implemented and MUST NOT be trusted for
 * security decisions.
 */
export type InvariantResult = {
  ok: boolean
  violationAmount: number
}

export async function checkInvariant(familyId: string): Promise<InvariantResult> {
  void familyId
  throw new Error('checkInvariant() not yet implemented')
}
