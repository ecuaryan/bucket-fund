import { shouldDefaultToPinSignIn } from '@/lib/signInPreference'

/**
 * Router state for /login and /login/family.
 *
 * Post-sign-out routing (RequireAuth):
 * - No join code on device → /login (email)
 * - Join code + last sign-in was PIN (or never chose) → /login/family
 * - Join code + user chose email (sign-in or “Admin email sign-in”) → /login
 *
 * Orphan PIN member (removed from household) → /login/family with info message.
 */
export type AuthLocationState = {
  from?: string
  /** User chose admin email on the PIN screen — do not bounce to /login/family. */
  preferEmailSignIn?: boolean
  info?: string
  /** Prefill login email (must look like an address). */
  email?: string
}

export function loginEmailFromQuery(
  stateEmail: string | undefined,
  queryEmail: string | null,
): string {
  if (stateEmail) return stateEmail
  if (queryEmail && queryEmail.includes('@')) return queryEmail
  return ''
}

/** Paths that require role=admin after sign-in (e.g. preserved across sign-out). */
const ADMIN_ONLY_PATHS = ['/admin'] as const

/**
 * Where to send the user after auth. Strips admin-only destinations unless
 * the signed-in member is the household admin.
 */
export function postSignInPath(
  from: string | undefined,
  role: string | null | undefined,
): string {
  const dest = from?.trim() || '/'
  if (!dest.startsWith('/') || dest.startsWith('//')) return '/'
  const adminOnly = ADMIN_ONLY_PATHS.some(
    (p) => dest === p || dest.startsWith(`${p}/`),
  )
  if (adminOnly && role !== 'admin') return '/'
  return dest
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
    return { to: '/login/family', state: { from: pathname } }
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
