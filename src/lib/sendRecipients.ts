/** Minimal member row for Send recipient filtering (matches Send page). */
export type SendRecipientMember = {
  id: string
  name: string
  role: string
}

/** Same rules as SendPage: adults → children only; children → everyone else. */
export function filterSendRecipients(
  members: SendRecipientMember[],
  callerMemberId: string,
  callerRole: string,
): SendRecipientMember[] {
  const others = members.filter((m) => m.id !== callerMemberId)
  if (callerRole === 'admin' || callerRole === 'member') {
    return others.filter((m) => m.role === 'child')
  }
  return others
}
