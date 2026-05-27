import type { Session } from '@supabase/supabase-js'

/** True while the user is in Supabase's password-recovery session (email link). */
export function isPasswordRecoverySession(session: Session): boolean {
  return Boolean(session.user.recovery_sent_at)
}
