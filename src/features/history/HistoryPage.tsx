import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePostgresChanges } from '@/hooks/usePostgresChanges'
import { useAuth } from '@/lib/auth'
import {
  HISTORY_EMPTY_BODY,
  HISTORY_EMPTY_BUCKET_BODY,
  HISTORY_EMPTY_SENDS_BODY,
} from '@/lib/brand'
import { useHideAmounts } from '@/lib/HideAmountsProvider'
import type { Database } from '@/types/database'
import {
  filterFromSearchParams,
  historyFilterSearchKey,
  searchParamsForFilter,
  SEND_FILTER_VALUE,
  type HistoryFilter,
} from '@/features/history/historyFilters'
import { fetchHistoryPage, type HistoryTxRow } from '@/features/history/historyQueries'

type TxRow = HistoryTxRow

type Bucket = Pick<
  Database['public']['Tables']['buckets']['Row'],
  'id' | 'name' | 'display_order' | 'created_at'
>

// Initial render and Realtime refreshes pull only the most recent few
// rows — most sessions just want "what happened today" and a tiny
// payload makes that snappier. Tapping "Load older" pulls larger
// pages from there on, since at that point the user is intentionally
// digging through history.
const INITIAL_PAGE_SIZE = 10
const MORE_PAGE_SIZE = 50

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
})

function filterForKey(filterKey: string): HistoryFilter {
  return filterFromSearchParams(new URLSearchParams(filterKey))
}

export default function HistoryPage() {
  const auth = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const filterKey = historyFilterSearchKey(searchParams)
  const filter = useMemo(() => filterForKey(filterKey), [filterKey])

  const [rows, setRows] = useState<TxRow[] | null>(null)
  const [buckets, setBuckets] = useState<Bucket[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Bump when family or filter changes so stale async work cannot mutate state.
  const listGeneration = useRef(0)

  const member = auth.status === 'signedIn' ? auth.member : null
  const accessToken =
    auth.status === 'signedIn' ? auth.session.access_token : null
  const familyId = member?.family_id ?? null

  const loadMore = useCallback(async () => {
    if (loadingMore || rows === null || rows.length === 0) return

    const generation = listGeneration.current
    const activeFilter = filterForKey(filterKey)

    setLoadingMore(true)
    setLoadMoreError(null)

    const result = await fetchHistoryPage(
      activeFilter,
      rows[rows.length - 1].created_at,
      MORE_PAGE_SIZE,
    )

    setLoadingMore(false)
    if (generation !== listGeneration.current) return

    if (!result.ok) {
      setLoadMoreError(result.error)
      return
    }

    setRows((prev) => (prev ? [...prev, ...result.rows] : result.rows))
    setHasMore(result.rows.length === MORE_PAGE_SIZE)
  }, [filterKey, loadingMore, rows])

  const refreshHead = useCallback(async () => {
    const generation = listGeneration.current
    const activeFilter = filterForKey(filterKey)
    const result = await fetchHistoryPage(activeFilter, null, INITIAL_PAGE_SIZE)

    if (generation !== listGeneration.current) return
    if (!result.ok) return

    setRows((prev) => {
      if (!prev) return result.rows
      if (result.rows.length === 0) return prev
      const headIds = new Set(result.rows.map((r) => r.id))
      const oldestInHead = result.rows[result.rows.length - 1].created_at
      const tail = prev.filter(
        (r) => !headIds.has(r.id) && r.created_at < oldestInHead,
      )
      return [...result.rows, ...tail]
    })
  }, [filterKey])

  const loadBuckets = useCallback(async () => {
    const { data, error } = await supabase
      .from('buckets')
      .select('id, name, display_order, created_at')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) return // non-fatal; picker just stays empty
    setBuckets(data ?? [])
  }, [])

  useEffect(() => {
    if (!familyId) return

    const generation = ++listGeneration.current
    const activeFilter = filterForKey(filterKey)

    setLoadError(null)
    setLoadMoreError(null)
    setRows(null)
    setHasMore(true)
    setLoadingMore(false)

    void (async () => {
      const result = await fetchHistoryPage(activeFilter, null, INITIAL_PAGE_SIZE)
      if (generation !== listGeneration.current) return
      if (!result.ok) {
        setLoadError(result.error)
        return
      }
      setRows(result.rows)
      setHasMore(result.rows.length === INITIAL_PAGE_SIZE)
    })()
  }, [familyId, filterKey])

  useEffect(() => {
    if (!familyId) return
    void loadBuckets()
  }, [familyId, loadBuckets])

  usePostgresChanges(
    accessToken,
    familyId ? `history:${familyId}` : null,
    familyId
      ? [
          {
            event: 'INSERT',
            table: 'transactions',
            filter: `family_id=eq.${familyId}`,
          },
        ]
      : [],
    refreshHead,
  )

  const grouped = useMemo(() => groupByDay(rows ?? []), [rows])

  const filteredBucketName = useMemo(() => {
    const activeFilter = filterForKey(filterKey)
    if (activeFilter.kind !== 'bucket' || !buckets) return null
    const found = buckets.find((b) => b.id === activeFilter.bucketId)
    return found?.name ?? null
  }, [filterKey, buckets])

  function setFilter(next: HistoryFilter) {
    setSearchParams(searchParamsForFilter(next))
  }

  if (!member) return null

  if (loadError && rows === null) {
    return (
      <div className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-300 ring-1 ring-red-500/30">
        <p className="font-semibold">Could not load history</p>
        <p className="mt-1">{loadError}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-semibold">History</h1>
        <p className="mt-0.5 text-xs text-zinc-400">
          {rows === null
            ? 'Loading…'
            : rows.length === 0
              ? filter.kind === 'send'
                ? 'No sends yet'
                : 'No transactions yet'
              : filter.kind === 'send'
                ? `${rows.length}${hasMore ? '+' : ''} ${rows.length === 1 ? 'send' : 'sends'}`
                : `${rows.length}${hasMore ? '+' : ''} ${rows.length === 1 ? 'transaction' : 'transactions'}`}
        </p>
      </header>

      <FilterBar
        buckets={buckets ?? []}
        filter={filter}
        activeBucketName={filteredBucketName}
        onChange={setFilter}
      />

      {rows === null ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 p-6 text-center">
          <p className="text-sm font-medium text-zinc-300">
            {filter.kind === 'send'
              ? 'No sends yet'
              : filter.kind === 'bucket'
                ? 'No moves for this bucket yet'
                : 'Nothing here yet'}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {filter.kind === 'send'
              ? HISTORY_EMPTY_SENDS_BODY
              : filter.kind === 'bucket'
                ? HISTORY_EMPTY_BUCKET_BODY
                : HISTORY_EMPTY_BODY}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                {group.label}
              </h2>
              <ul className="divide-y divide-zinc-800 rounded-2xl bg-zinc-900 ring-1 ring-zinc-800">
                {group.rows.map((row) => (
                  <li key={row.id} className="px-3 py-3">
                    <TxItem row={row} currentMemberId={member.id} />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {loadMoreError && (
            <p className="text-center text-xs text-red-300">{loadMoreError}</p>
          )}

          {hasMore && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-300 ring-1 ring-zinc-800 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load older'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function FilterBar({
  buckets,
  filter,
  activeBucketName,
  onChange,
}: {
  buckets: Bucket[]
  filter: HistoryFilter
  activeBucketName: string | null
  onChange: (filter: HistoryFilter) => void
}) {
  const selectValue =
    filter.kind === 'send'
      ? SEND_FILTER_VALUE
      : filter.kind === 'bucket'
        ? filter.bucketId
        : ''

  const showOrphanedFilter =
    filter.kind === 'bucket' && activeBucketName === null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs font-medium text-zinc-400" htmlFor="history-filter">
        Filter
      </label>
      <select
        id="history-filter"
        value={selectValue}
        onChange={(e) => {
          const value = e.target.value
          if (value === '') onChange({ kind: 'all' })
          else if (value === SEND_FILTER_VALUE) onChange({ kind: 'send' })
          else onChange({ kind: 'bucket', bucketId: value })
        }}
        className="rounded-lg border-0 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-300 ring-1 ring-inset ring-zinc-700 focus:outline focus:outline-2 focus:outline-emerald-400"
      >
        <option value="">All transactions</option>
        <option value={SEND_FILTER_VALUE}>Sends only</option>
        {buckets.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
        {showOrphanedFilter && (
          <option value={filter.bucketId}>(deleted bucket)</option>
        )}
      </select>

      {filter.kind === 'send' && (
        <ActiveFilterChip label="Sends only" onClear={() => onChange({ kind: 'all' })} />
      )}

      {filter.kind === 'bucket' && (
        <ActiveFilterChip
          label={activeBucketName ?? 'Deleted bucket'}
          onClear={() => onChange({ kind: 'all' })}
        />
      )}
    </div>
  )
}

function ActiveFilterChip({
  label,
  onClear,
}: {
  label: string
  onClear: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30">
      {label}
      <button
        type="button"
        aria-label="Clear filter"
        onClick={onClear}
        className="-mr-0.5 flex h-4 w-4 items-center justify-center rounded-full text-emerald-300 hover:bg-emerald-500/20"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className="h-3 w-3"
        >
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </span>
  )
}

function TxItem({
  row,
  currentMemberId,
}: {
  row: TxRow
  currentMemberId: string
}) {
  const { formatMoney } = useHideAmounts()
  const [noteExpanded, setNoteExpanded] = useState(false)
  const amount = formatMoney(Number(row.amount))
  const time = timeFormatter.format(new Date(row.created_at))

  let title: string
  let subtitle: string

  if (row.type === 'bucket_move') {
    const fromLabel = bucketEndpointLabel(row.from_bucket_id, row.from_bucket)
    const toLabel = bucketEndpointLabel(row.to_bucket_id, row.to_bucket)
    title = `${fromLabel} → ${toLabel}`
    subtitle = 'Bucket move'
  } else {
    const fromIsMe = row.from_member_id === currentMemberId
    const toIsMe = row.to_member_id === currentMemberId
    const fromLabel = memberEndpointLabel(row.from_member, fromIsMe)
    const toLabel = memberEndpointLabel(row.to_member, toIsMe)
    title = `${fromLabel} → ${toLabel}`
    subtitle = 'Send'
  }

  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-300">{title}</p>
        <p className="text-xs text-zinc-400">
          {subtitle} · {time}
        </p>
        {row.note && (
          <button
            type="button"
            onClick={() => setNoteExpanded((v) => !v)}
            aria-expanded={noteExpanded}
            aria-label={noteExpanded ? 'Collapse note' : 'Expand note'}
            className={
              'mt-1 block w-full text-left text-xs italic text-zinc-400 transition hover:text-zinc-300 focus:outline-none focus-visible:text-zinc-300 ' +
              (noteExpanded
                ? 'whitespace-pre-wrap break-words'
                : 'truncate')
            }
          >
            “{row.note}”
          </button>
        )}
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-zinc-300">
        {amount}
      </p>
    </div>
  )
}

function bucketEndpointLabel(
  id: string | null,
  joined: { name: string } | null,
): string {
  if (joined?.name) return joined.name
  if (id) return 'Bucket'
  return 'Unallocated'
}

function memberEndpointLabel(
  joined: { name: string } | null,
  isMe: boolean,
): string {
  if (isMe) return 'You'
  if (joined?.name) return joined.name
  return 'Someone'
}

function groupByDay(
  rows: TxRow[],
): Array<{ key: string; label: string; rows: TxRow[] }> {
  if (rows.length === 0) return []

  const groups = new Map<string, TxRow[]>()
  for (const row of rows) {
    const d = new Date(row.created_at)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const arr = groups.get(key)
    if (arr) arr.push(row)
    else groups.set(key, [row])
  }

  const now = new Date()
  const today = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`

  return Array.from(groups.entries()).map(([key, groupRows]) => {
    const sample = new Date(groupRows[0].created_at)
    let label: string
    if (key === today) label = 'Today'
    else if (key === yesterdayKey) label = 'Yesterday'
    else label = dayFormatter.format(sample)
    return { key, label, rows: groupRows }
  })
}
