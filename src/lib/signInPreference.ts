import { isPinBoundDevice } from '@/lib/familyDevice'

const KEY = 'bucketmymoney_sign_in_preference'

export type SignInPreference = 'email' | 'pin'

export function getSignInPreference(): SignInPreference | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'email' || v === 'pin' ? v : null
  } catch {
    return null
  }
}

export function setSignInPreference(pref: SignInPreference): void {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    // private mode
  }
}

export function clearSignInPreference(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // private mode
  }
}

/**
 * After sign-out, send users to PIN sign-in only when this device has a join
 * code and the user last chose PIN (or has not chosen email).
 */
export function shouldDefaultToPinSignIn(): boolean {
  if (!isPinBoundDevice()) return false
  return getSignInPreference() !== 'email'
}
