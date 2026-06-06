/**
 * Balance invariant checker.
 *
 * The system-wide invariant (see CONTEXT.md "Balance Model"):
 *
 *   sum(bucket allocations) + sum(unallocated balances across members)
 *     === sum(real Teller balances across all linked accounts)
 *
 * User-facing “rebalance” signal is negative unallocated on Buckets tab (see
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
