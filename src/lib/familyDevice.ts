import { setLastPinMemberId } from '@/lib/lastPinMember'
import { setSignInPreference } from '@/lib/signInPreference'

const FAMILY_ID_KEY = 'bucketmymoney_family_id'
const JOIN_CODE_KEY = 'bucketmymoney_join_code'

export function getBoundFamilyId(): string | null {
  try {
    return localStorage.getItem(FAMILY_ID_KEY)
  } catch {
    return null
  }
}

export function getBoundJoinCode(): string | null {
  try {
    return localStorage.getItem(JOIN_CODE_KEY)
  } catch {
    return null
  }
}

/** True after this device completed join / family PIN setup (not email-only admin). */
export function isPinBoundDevice(): boolean {
  return Boolean(getBoundJoinCode()?.trim())
}

export function bindFamily(familyId: string, joinCode: string): void {
  localStorage.setItem(FAMILY_ID_KEY, familyId)
  localStorage.setItem(JOIN_CODE_KEY, joinCode.toUpperCase())
}

/** Persist household link + PIN sign-in prefs for this device (admin self-PIN, code rotation). */
export function bindDeviceForPinSignIn(
  familyId: string,
  joinCode: string,
  memberId: string,
): void {
  bindFamily(familyId, joinCode)
  setSignInPreference('pin')
  setLastPinMemberId(memberId)
}

export function clearBoundFamily(): void {
  localStorage.removeItem(FAMILY_ID_KEY)
  localStorage.removeItem(JOIN_CODE_KEY)
}
