import type { JoinMember } from '@/lib/memberAuth'

/** Preserve server order (household `created_at`) so tiles stay put when PINs are set. */
export function sortJoinMembers(members: JoinMember[]): JoinMember[] {
  return members
}

/** Poll the roster only while someone on the picker is still waiting on a PIN. */
export function rosterHasPendingPin(members: JoinMember[]): boolean {
  return members.some((member) => !member.hasPin)
}

function memberNeedsStatus(member: JoinMember): boolean {
  return !member.hasPin || member.pinLocked
}

/** Same-row partner in the two-column grid, if any. */
export function pinPickerRowPartnerIndex(
  memberCount: number,
  index: number,
): number | null {
  if (isCenteredSoloTile(memberCount, index)) return null
  const partner = index % 2 === 0 ? index + 1 : index - 1
  if (partner < 0 || partner >= memberCount) return null
  if (isCenteredSoloTile(memberCount, partner)) return null
  return partner
}

export type PinPickerStatusLine = {
  text: string
  visible: boolean
  tone: 'pending' | 'locked' | 'reserve' | 'ready'
}

/** Status copy, or an invisible same-height reserve to align names in a row. */
export function pinPickerStatusLine(
  member: JoinMember,
  members: JoinMember[],
  index: number,
  pendingLabel: string,
): PinPickerStatusLine | null {
  if (!member.hasPin) {
    return { text: pendingLabel, visible: true, tone: 'pending' }
  }
  if (member.pinLocked) {
    return { text: 'Locked', visible: true, tone: 'locked' }
  }
  const partnerIdx = pinPickerRowPartnerIndex(members.length, index)
  if (
    partnerIdx !== null &&
    memberNeedsStatus(members[partnerIdx]!)
  ) {
    return { text: pendingLabel, visible: false, tone: 'reserve' }
  }
  return null
}

function isLonelyLastTile(memberCount: number, index: number): boolean {
  return memberCount > 1 && memberCount % 2 === 1 && index === memberCount - 1
}

function isCenteredSoloTile(memberCount: number, index: number): boolean {
  return memberCount === 1 || isLonelyLastTile(memberCount, index)
}

/** Two-column grid; a lone tile spans both columns and centers at half width. */
export function pinPickerListClass(): string {
  return 'grid grid-cols-2 gap-3 auto-rows-fr'
}

export function pinPickerItemClass(memberCount: number, index: number): string {
  if (isCenteredSoloTile(memberCount, index)) {
    return 'col-span-2 flex justify-center'
  }
  return 'flex'
}

const PIN_PICKER_TILE_BASE =
  'flex flex-col items-center gap-2 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800 transition hover:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-60'

/** Grid tiles stretch to row height; centered solos keep natural height at half width. */
export function pinPickerTileClass(memberCount: number, index: number): string {
  if (isCenteredSoloTile(memberCount, index)) {
    return `${PIN_PICKER_TILE_BASE} w-[calc(50%-0.375rem)]`
  }
  return `${PIN_PICKER_TILE_BASE} h-full w-full`
}
