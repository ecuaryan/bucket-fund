/** Minimal member row for Send recipient filtering (matches Send page). */
export type SendRecipientMember = {
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

/** Same rules as SendPage: shared balance → virtual kids only; kids → everyone except linked kids. */
export function filterSendRecipients(
  members: SendRecipientMember[],
  callerMemberId: string,
  callerRole: string,
  linkedChildIds: ReadonlySet<string> = new Set(),
): SendRecipientMember[] {
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

/** Nav + route: adults with kids use the Kids tab instead of Send. */
export function shouldShowKidsNav(callerRole: string, childCount: number): boolean {
  return (
    (callerRole === 'admin' || callerRole === 'member') && childCount > 0
  )
}

/** Nav + route: show Send for virtual kids; linked kids get the explainer page. */
export function shouldShowSendNav(args: {
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
