/** Label for one endpoint of a bucket_move row in History. */
export function bucketEndpointLabel(args: {
  bucketId: string | null
  snapshotName: string | null | undefined
  joinedName: string | null | undefined
}): string {
  if (args.snapshotName) return args.snapshotName
  if (args.joinedName) return args.joinedName
  if (args.bucketId) return 'Bucket'
  return 'Unallocated'
}
