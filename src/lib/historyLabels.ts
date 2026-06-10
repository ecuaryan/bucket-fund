import { SPENDING_MONEY_LABEL } from '@/lib/brand'

/** Label for one endpoint of a bucket_move row in History. */
export function bucketEndpointLabel(args: {
  bucketId: string | null
  snapshotName: string | null | undefined
  joinedName: string | null | undefined
}): string {
  if (args.snapshotName) return args.snapshotName
  if (args.joinedName) return args.joinedName
  if (args.bucketId) return 'Bucket'
  return SPENDING_MONEY_LABEL
}

/** Label for one endpoint of a send row in History. */
export function sendMemberEndpointLabel(args: {
  snapshotName: string | null | undefined
  joinedName: string | null | undefined
  isMe: boolean
}): string {
  if (args.isMe) return 'You'
  if (args.snapshotName) return args.snapshotName
  if (args.joinedName) return args.joinedName
  return 'Someone'
}

/** Who performed a bucket move, for shared-balance History subtitles (admin + Shared). */
export function historyMoveActorLabel(args: {
  actorMemberId: string | null | undefined
  actorName: string | null | undefined
  currentMemberId: string
  showActor: boolean
}): string | null {
  if (!args.showActor || !args.actorMemberId) return null
  if (args.actorMemberId === args.currentMemberId) return 'you'
  if (args.actorName) return args.actorName
  return 'Someone'
}

function historyTxSubtitle(args: {
  kind: 'Bucket move' | 'Send'
  time: string
  actorMemberId: string | null | undefined
  actorName: string | null | undefined
  currentMemberId: string
  showActor: boolean
}): string {
  const actor = historyMoveActorLabel(args)
  if (actor) return `${args.kind} · by ${actor} · ${args.time}`
  return `${args.kind} · ${args.time}`
}

export function historyBucketMoveSubtitle(args: {
  time: string
  actorMemberId: string | null | undefined
  actorName: string | null | undefined
  currentMemberId: string
  showActor: boolean
}): string {
  return historyTxSubtitle({ ...args, kind: 'Bucket move' })
}

export function historySendSubtitle(args: {
  time: string
  actorMemberId: string | null | undefined
  actorName: string | null | undefined
  currentMemberId: string
  showActor: boolean
}): string {
  return historyTxSubtitle({ ...args, kind: 'Send' })
}
