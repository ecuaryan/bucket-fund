import { getLastPinMemberId } from '@/lib/lastPinMember'

const FLAG_KEY = 'bucketmymoney:auto_sign_out'

/** Set before a local sign-out triggered by policy (background timeout, revoked session). */
export function markAutoSignOut(): void {
  try {
    sessionStorage.setItem(FLAG_KEY, '1')
  } catch {
    // private mode
  }
}

export function clearAutoSignOut(): void {
  try {
    sessionStorage.removeItem(FLAG_KEY)
  } catch {
    // private mode
  }
}

function consumeAutoSignOut(): boolean {
  try {
    const active = sessionStorage.getItem(FLAG_KEY) === '1'
    sessionStorage.removeItem(FLAG_KEY)
    return active
  } catch {
    return false
  }
}

/** Last PIN member to resume after an automatic sign-out, if any. */
export function takeAutoSignOutResumeMemberId(): string | null {
  if (!consumeAutoSignOut()) return null
  return getLastPinMemberId()
}
