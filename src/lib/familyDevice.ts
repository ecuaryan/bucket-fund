const FAMILY_ID_KEY = 'bucketfund_family_id'
const JOIN_CODE_KEY = 'bucketfund_join_code'

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

export function clearBoundFamily(): void {
  localStorage.removeItem(FAMILY_ID_KEY)
  localStorage.removeItem(JOIN_CODE_KEY)
}
