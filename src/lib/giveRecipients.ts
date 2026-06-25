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
