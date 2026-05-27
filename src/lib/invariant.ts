/**
 * Balance invariant checker.
 *
 * The system-wide invariant (see CONTEXT.md "Balance Model"):
 *
 *   sum(bucket allocations) + sum(unallocated balances across members)
 *     === sum(real Teller balances across all linked accounts)
 *
 * Authoritative check runs server-side in the `check-invariant` Edge
 * Function so child clients never see family-wide raw balances. This
 * client-side helper is for optimistic UI feedback only and MUST NOT be
 * trusted for security decisions.
 *
 * TODO:
 *   - Call the `check-invariant` Edge Function with the current family_id
 *   - Surface a prominent admin error when violation_amount !== 0
 */
export type InvariantResult = {
  ok: boolean
  violationAmount: number
}

export async function checkInvariant(familyId: string): Promise<InvariantResult> {
  void familyId
  throw new Error('checkInvariant() not yet implemented')
}
