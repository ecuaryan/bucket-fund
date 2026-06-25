export type HistoryFilter =
  | { kind: 'all' }
  | { kind: 'give' }
  | { kind: 'bucket'; bucketId: string }

export const GIVE_FILTER_VALUE = '__give__'

export function filterFromSearchParams(params: URLSearchParams): HistoryFilter {
  if (params.get('type') === 'give') return { kind: 'give' }
  const bucket = params.get('bucket')
  if (bucket) return { kind: 'bucket', bucketId: bucket }
  return { kind: 'all' }
}

export function searchParamsForFilter(filter: HistoryFilter): Record<string, string> {
  if (filter.kind === 'give') return { type: 'give' }
  if (filter.kind === 'bucket') return { bucket: filter.bucketId }
  return {}
}

/** Stable string for effect / fetch deps — avoids re-fetch loops from object identity. */
export function historyFilterSearchKey(params: URLSearchParams): string {
  return params.toString()
}
