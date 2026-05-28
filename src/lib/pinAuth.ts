export const ORPHAN_MEMBER_STORAGE_KEY = 'bucketfund_auth_notice'

import { HOUSEHOLD_ADMIN_PHRASE } from '@/lib/brand'

export const ORPHAN_MEMBER_MESSAGE =
  `This account was removed from your household. Sign in again with your join code and PIN—or ask ${HOUSEHOLD_ADMIN_PHRASE} to add you back.`

export function isPinAuthEmail(email: string | undefined): boolean {
  return Boolean(email?.endsWith('@pin.bucketfund.internal'))
}

export function takeOrphanMemberNotice(): string | null {
  try {
    const msg = sessionStorage.getItem(ORPHAN_MEMBER_STORAGE_KEY)
    if (msg) sessionStorage.removeItem(ORPHAN_MEMBER_STORAGE_KEY)
    return msg
  } catch {
    return null
  }
}

export function stashOrphanMemberNotice(message: string): void {
  try {
    sessionStorage.setItem(ORPHAN_MEMBER_STORAGE_KEY, message)
  } catch {
    // ignore quota / private mode
  }
}
