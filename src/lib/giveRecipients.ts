/** Minimal member row for Give recipient filtering (matches Give page). */
export type GiveRecipientMember = {
  id: string
  name: string
  role: string
}

export function isLinkedChild(
  memberId: string,
  role: string,
  linkedChildIds: ReadonlySet<string>,
): boolean {
  return role === 'child' && linkedChildIds.has(memberId)
}

/** Same rules as GivePage: shared balance → virtual kids only; kids → everyone except linked kids. */
export function filterGiveRecipients(
  members: GiveRecipientMember[],
  callerMemberId: string,
  callerRole: string,
  linkedChildIds: ReadonlySet<string> = new Set(),
): GiveRecipientMember[] {
  if (isLinkedChild(callerMemberId, callerRole, linkedChildIds)) {
    return []
  }

  const others = members.filter((m) => m.id !== callerMemberId)
  if (callerRole === 'admin' || callerRole === 'member') {
    return others.filter(
      (m) => m.role === 'child' && !linkedChildIds.has(m.id),
    )
  }
  return others.filter((m) => !linkedChildIds.has(m.id))
}

/**
 * Roster after a load attempt FAILS. A refetch runs on every `accounts`
 * Realtime event — a money-move fires one right as its confirmation toast
 * shows — so a transient failure (auth-lock contention, network blip) must
 * keep the last good roster: wiping it to [] zeroes childCount, drops the
 * Kids/Give tab, reorders Buckets, and makes the bottom-nav bubble jump.
 * Only a roster that never loaded falls back to empty-but-ready, so pages
 * gated on `giveReady` (History) still render after a failed first load.
 */
export function rosterAfterFailedLoad(
  prev: GiveRecipientMember[] | null,
): GiveRecipientMember[] {
  return prev ?? []
}

/** Nav + route: adults with kids use the Kids tab instead of Give. */
export function shouldShowKidsNav(callerRole: string, childCount: number): boolean {
  return (
    (callerRole === 'admin' || callerRole === 'member') && childCount > 0
  )
}

/** Nav + route: show Give for virtual kids; linked kids get the explainer page. */
export function shouldShowGiveNav(args: {
  callerRole: string
  callerIsLinkedChild: boolean
  recipientCount: number
}): boolean {
  if (args.callerRole === 'admin' || args.callerRole === 'member') {
    return false
  }
  if (args.recipientCount > 0) return true
  return args.callerIsLinkedChild
}
