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

/** Nav + route: show Send when there are recipients, or a static explainer (linked kid / adults with only linked kids). */
export function shouldShowSendNav(args: {
  callerRole: string
  callerIsLinkedChild: boolean
  recipientCount: number
  linkedChildCount: number
}): boolean {
  if (args.recipientCount > 0) return true
  if (args.callerIsLinkedChild) return true
  return (
    (args.callerRole === 'admin' || args.callerRole === 'member') &&
    args.linkedChildCount > 0
  )
}
