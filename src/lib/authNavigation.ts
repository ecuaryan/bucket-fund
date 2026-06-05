import { takeAutoSignOutResumeMemberId } from '@/lib/autoSignOut'
import { shouldDefaultToPinSignIn } from '@/lib/signInPreference'

/**
 * Router state for /login and /login/family.
 *
 * Post-sign-out routing (RequireAuth):
 * - No join code on device → /login (email)
 * - Join code + last sign-in was PIN (or never chose) → /login/family
 *   (automatic sign-out skips the person picker when the last PIN member is known)
 * - Join code + user chose email (sign-in or “Admin email sign-in”) → /login
 *
 * Orphan PIN member (removed from household) → /login/family with info message.
 *
 * `from` is preserved across sign-out so login screens know where the user came
 * from; successful sign-in always lands on buckets (home).
 */
export type AuthLocationState = {
  from?: string
  /** User chose admin email on the PIN screen — do not bounce to /login/family. */
  preferEmailSignIn?: boolean
  info?: string
  /** Prefill login email (must look like an address). */
  email?: string
  /** After automatic sign-out, open PIN entry for this member when still on the roster. */
  resumeMemberId?: string
}

export function loginEmailFromQuery(
  stateEmail: string | undefined,
  queryEmail: string | null,
): string {
  if (stateEmail) return stateEmail
  if (queryEmail && queryEmail.includes('@')) return queryEmail
  return ''
}

/** Where to send the user after a successful sign-in (email or PIN). */
export function postSignInPath(): string {
  return '/'
}

/** Where RequireAuth sends signed-out users. */
export function signedOutRedirectTarget(
  pathname: string,
  orphanNotice: string | null,
): { to: string; state: AuthLocationState } {
  if (orphanNotice) {
    return {
      to: '/login/family',
      state: { from: pathname, info: orphanNotice },
    }
  }
  if (shouldDefaultToPinSignIn()) {
    const resumeMemberId = takeAutoSignOutResumeMemberId() ?? undefined
    return {
      to: '/login/family',
      state: { from: pathname, ...(resumeMemberId ? { resumeMemberId } : {}) },
    }
  }
  return { to: '/login', state: { from: pathname } }
}

/** Whether /login should immediately forward to PIN sign-in. */
export function shouldRedirectLoginToPin(
  options: {
    preferEmailSignIn: boolean
    isSignUpMode: boolean
    pendingFreshSignIn: boolean
    signedOut: boolean
  },
): boolean {
  return (
    options.signedOut &&
    !options.pendingFreshSignIn &&
    !options.isSignUpMode &&
    !options.preferEmailSignIn &&
    shouldDefaultToPinSignIn()
  )
}
