const KEY = 'bucketmymoney:last_pin_member_id'

export function getLastPinMemberId(): string | null {
  try {
    const v = localStorage.getItem(KEY)
    return v && v.length > 0 ? v : null
  } catch {
    return null
  }
}

export function setLastPinMemberId(memberId: string): void {
  try {
    localStorage.setItem(KEY, memberId)
  } catch {
    // private mode
  }
}

export function clearLastPinMemberId(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // private mode
  }
}
