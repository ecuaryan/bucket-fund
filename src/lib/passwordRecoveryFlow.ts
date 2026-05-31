const KEY = 'bucketmymoney:password_recovery_flow'

/** Set when Supabase emits PASSWORD_RECOVERY (reset email link), not PIN login. */
export function markPasswordRecoveryFlow(): void {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    // private mode
  }
}

export function clearPasswordRecoveryFlow(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // private mode
  }
}

export function isPasswordRecoveryFlowActive(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
