export type HistoryFilter =
  | { kind: 'all' }
  | { kind: 'send' }
  | { kind: 'bucket'; bucketId: string }

export const SEND_FILTER_VALUE = '__send__'

export function filterFromSearchParams(params: URLSearchParams): HistoryFilter {
  if (params.get('type') === 'send') return { kind: 'send' }
  const bucket = params.get('bucket')
  if (bucket) return { kind: 'bucket', bucketId: bucket }
  return { kind: 'all' }
}

export function searchParamsForFilter(filter: HistoryFilter): Record<string, string> {
  if (filter.kind === 'send') return { type: 'send' }
  if (filter.kind === 'bucket') return { bucket: filter.bucketId }
  return {}
}

/** Stable string for effect / fetch deps — avoids re-fetch loops from object identity. */
export function historyFilterSearchKey(params: URLSearchParams): string {
  return params.toString()
}
