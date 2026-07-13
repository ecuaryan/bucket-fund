// Pure SimpleFIN parsing helpers. Mirrors the corresponding helpers in
// supabase/functions/_shared/simplefin.ts (which runs on Deno and can't be
// imported here) — keep the two in sync. Client-side these power inline
// Setup Token validation before we ever call the claim Edge Function.

/** The Setup Token wasn't a base64-encoded https claim URL. */
export class SimpleFinSetupTokenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SimpleFinSetupTokenError'
  }
}

/** Decode a Setup Token (base64 claim URL). Throws SimpleFinSetupTokenError. */
export function decodeSetupToken(setupToken: string): string {
  const trimmed = (setupToken ?? '').trim()
  if (!trimmed) {
    throw new SimpleFinSetupTokenError('Setup Token is empty')
  }
  let claimUrl: string
  try {
    claimUrl = atob(trimmed).trim()
  } catch {
    throw new SimpleFinSetupTokenError('Setup Token is not valid base64')
  }
  if (!/^https:\/\/\S+$/.test(claimUrl)) {
    throw new SimpleFinSetupTokenError(
      'Setup Token did not decode to an https claim URL',
    )
  }
  return claimUrl
}

/** True when a pasted string looks like a valid SimpleFIN Setup Token. */
export function isValidSetupToken(setupToken: string): boolean {
  try {
    decodeSetupToken(setupToken)
    return true
  } catch {
    return false
  }
}

export type NormalizedKind = 'cash' | 'card'

/**
 * App-convention balance for a SimpleFIN account. SimpleFIN reports
 * liabilities NEGATIVE (a card with $500 owed has balance "-500.00");
 * the app stores card balances as positive-owed (docs/CREDIT_CARDS.md).
 * Cash passes through; cards flip sign — a card in credit goes negative,
 * which the ledger treats as money back (correct).
 */
export function normalizeBalance(kind: NormalizedKind, raw: string): number {
  const value = Number(raw)
  // Number('') is 0 — reject blank input explicitly.
  if (typeof raw !== 'string' || raw.trim() === '' || !Number.isFinite(value)) {
    throw new Error(`SimpleFIN balance is not numeric: ${JSON.stringify(raw)}`)
  }
  return kind === 'card' ? -value : value
}
