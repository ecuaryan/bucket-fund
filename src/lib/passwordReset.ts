import { PIN_AUTH_EMAIL_SUFFIX } from '@/lib/pinAuthDomain'

/** Where Supabase sends users after they click the reset link in email. */
export function passwordResetRedirectUrl(): string {
  return `${window.location.origin}/login/reset`
}

/** Admin email/password accounts — not internal PIN-only auth addresses. */
export function isHumanAuthEmail(email: string): boolean {
  return !email.endsWith(PIN_AUTH_EMAIL_SUFFIX)
}
