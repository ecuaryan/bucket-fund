// Pure Plaid mapping helpers. Mirrors the corresponding helpers in
// supabase/functions/_shared/plaid.ts (which runs on Deno and can't be
// imported here) — keep the two in sync.

/**
 * Plaid (type, subtype) → the app's account_type vocabulary
 * (is_cash_account_type / is_credit_card_account_type). Cash subtypes map
 * onto the existing set; anything else (loans, investments) keeps a
 * normalized subtype so it's visible but excluded from the cash pool.
 */
export function mapPlaidAccountType(
  type: string,
  subtype: string | null,
): string {
  const t = (type ?? '').toLowerCase()
  const s = (subtype ?? '').toLowerCase().trim()
  if (t === 'credit') return 'credit_card'
  if (t === 'depository') {
    if (s === 'checking') return 'checking'
    if (s === 'savings') return 'savings'
    if (s === 'money market') return 'money_market'
    if (s === 'cd') return 'certificate_of_deposit'
    if (s === 'cash management') return 'cash_management'
    // hsa, ebt, prepaid, … — spendable-ish but not classic cash; treat as
    // cash so the balance counts (matches how Teller treated depository).
    return 'cash'
  }
  return (s || t).replace(/\s+/g, '_')
}

/**
 * App-convention balance for a Plaid account. `current` for parity with
 * the Teller/SimpleFIN behavior. Plaid reports credit-card `current` as
 * positive-owed already — no sign flip (unlike SimpleFIN).
 */
export function pickPlaidBalance(balances: {
  current: number | null
  available: number | null
}): number {
  const value = balances.current ?? balances.available
  if (value == null || !Number.isFinite(value)) {
    throw new Error('Plaid returned no usable balance')
  }
  return value
}
