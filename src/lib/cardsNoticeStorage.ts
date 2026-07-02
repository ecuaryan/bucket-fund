// One-time "card balances count against your number" acknowledgment.
// Set when the notice sheet is shown (post-link in Admin, or first sight
// of pre-existing card debt on the Buckets tab after the ledger change) —
// the number must never change meaning silently (docs/CREDIT_CARDS.md).

export const CARDS_NOTICE_STORAGE_PREFIX = 'bucketmymoney_cards_notice_seen:'

export function cardsNoticeStorageKey(memberId: string): string {
  return `${CARDS_NOTICE_STORAGE_PREFIX}${memberId}`
}

export function readCardsNoticeSeen(memberId: string): boolean {
  try {
    return localStorage.getItem(cardsNoticeStorageKey(memberId)) === '1'
  } catch {
    return false
  }
}

export function writeCardsNoticeSeen(memberId: string): void {
  try {
    localStorage.setItem(cardsNoticeStorageKey(memberId), '1')
  } catch {
    // private mode
  }
}
