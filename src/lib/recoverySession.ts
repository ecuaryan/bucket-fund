import { isPasswordRecoveryFlowActive } from '@/lib/passwordRecoveryFlow'

/**
 * True only during the forgot-password email flow — not PIN or magic-link sign-in.
 * We track PASSWORD_RECOVERY explicitly; `recovery_sent_at` alone is unreliable.
 */
export function isPasswordRecoverySession(): boolean {
  return isPasswordRecoveryFlowActive()
}
