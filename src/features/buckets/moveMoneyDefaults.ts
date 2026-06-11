export const FLOAT_ENDPOINT_KEY = '__float__'

export function endpointKey(id: string | null): string {
  return id ?? FLOAT_ENDPOINT_KEY
}

/** Default From/To when opening Move money from a tapped bucket row. */
export function defaultMoveMoneyEndpoints(
  initialBucketId: string,
  float: number,
  bucketBalanceById: ReadonlyMap<string, number>,
): { fromKey: string; toKey: string } {
  const tappedKey = initialBucketId
  const otherKey = FLOAT_ENDPOINT_KEY
  const tappedBalance = bucketBalanceById.get(initialBucketId) ?? 0
  const otherBalance = float

  const tappedIsZero = tappedBalance === 0
  const otherIsZero = otherBalance === 0

  if (tappedIsZero && !otherIsZero) {
    return { fromKey: otherKey, toKey: tappedKey }
  }
  if (otherIsZero && !tappedIsZero) {
    return { fromKey: tappedKey, toKey: otherKey }
  }

  // Both zero or both non-zero — tapped bucket is usually the intent anchor.
  return { fromKey: tappedKey, toKey: otherKey }
}
