import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePostgresChanges } from '@/hooks/usePostgresChanges'
import { useAuth } from '@/lib/auth'
import type { Database } from '@/types/database'

// Pulled-back transaction shape, with bucket / member name joins.
// We don't lean on the generated Database type here because PostgREST's
// embedded-resource syntax returns shapes the generator doesn't infer.
type TxRow = {
  id: string
  family_id: string
  type: 'bucket_move' | 'send'
  amount: string | number
  from_bucket_id: string | null
  to_bucket_id: string | null
  from_member_id: string | null
  to_member_id: string | null
  note: string | null
  created_at: string
  from_bucket: { name: string } | null
  to_bucket: { name: string } | null
  from_member: { name: string } | null
  to_member: { name: string } | null
}

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

// PostgREST select expression for the embedded joins. Pulled out as a
// constant so every page fetch uses the exact same shape.
const TX_SELECT =
  '*, from_bucket:buckets!from_bucket_id(name), to_bucket:buckets!to_bucket_id(name), from_member:family_members!from_member_id(name), to_member:family_members!to_member_id(name)'

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
})

export default function HistoryPage() {
  const auth = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const bucketFilter = searchParams.get('bucket')

  const [rows, setRows] = useState<TxRow[] | null>(null)
  const [buckets, setBuckets] = useState<Bucket[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const member = auth.status === 'signedIn' ? auth.member : null
  const accessToken =
    auth.status === 'signedIn' ? auth.session.access_token : null
  const familyId = member?.family_id ?? null

  // PostgREST embedded resources: alias:table!fk_column(cols). Two FKs
  // to the same target table (buckets), so we disambiguate by FK column
  // name. RLS scopes everything to this family already.
  //
  // The same base query is used by all three loaders below; the filter
  // (when set) matches transactions where the bucket is either the
  // source or the destination.
  const fetchPage = useCallback(
    async (
      beforeCreatedAt: string | null,
      limit: number,
    ): Promise<TxRow[] | null> => {
      let query = supabase
        .from('transactions')
        .select(TX_SELECT)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (beforeCreatedAt) query = query.lt('created_at', beforeCreatedAt)
      if (bucketFilter) {
        query = query.or(
          `from_bucket_id.eq.${bucketFilter},to_bucket_id.eq.${bucketFilter}`,
        )
      }
      const { data, error } = await query
      if (error) {
        setLoadError(error.message)
        return null
      }
      return (data ?? []) as unknown as TxRow[]
    },
    [bucketFilter],
  )

  // Initial load (also re-runs on filter change). Replaces the list.
  const loadFirstPage = useCallback(async () => {
    setLoadError(null)
    const next = await fetchPage(null, INITIAL_PAGE_SIZE)
    if (!next) return
    setRows(next)
    setHasMore(next.length === INITIAL_PAGE_SIZE)
  }, [fetchPage])

  // Load older rows beneath the current oldest. Cursor pagination on
  // created_at (rather than OFFSET) avoids skipping/duplicating rows
  // when Realtime inserts new transactions while the user is paging.
  const loadMore = useCallback(async () => {
    if (loadingMore || rows === null || rows.length === 0) return
    setLoadingMore(true)
    const next = await fetchPage(
      rows[rows.length - 1].created_at,
      MORE_PAGE_SIZE,
    )
    setLoadingMore(false)
    if (!next) return
    setRows((prev) => (prev ? [...prev, ...next] : next))
    setHasMore(next.length === MORE_PAGE_SIZE)
  }, [fetchPage, loadingMore, rows])

  // Realtime handler. Re-fetches only the head and merges with any
  // older rows the user already paginated to, so we don't blow away
  // their scroll state on a new insert.
  const refreshHead = useCallback(async () => {
    const head = await fetchPage(null, INITIAL_PAGE_SIZE)
    if (!head) return
    setRows((prev) => {
      if (!prev) return head
      if (head.length === 0) return prev
      const headIds = new Set(head.map((r) => r.id))
      const oldestInHead = head[head.length - 1].created_at
      // Keep older paginated rows; the head replaces everything within
      // its time window.
      const tail = prev.filter(
        (r) => !headIds.has(r.id) && r.created_at < oldestInHead,
      )
      return [...head, ...tail]
    })
  }, [fetchPage])

  // Bucket list is for the filter picker. We don't need it for
  // rendering rows (the row query already joins names) but it lets
  // us populate the dropdown and resolve the active filter's name.
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
    void loadFirstPage()
  }, [familyId, loadFirstPage])

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
    if (!bucketFilter || !buckets) return null
    const found = buckets.find((b) => b.id === bucketFilter)
    return found?.name ?? null
  }, [bucketFilter, buckets])

  function setBucketFilter(next: string | null) {
    if (next) {
      setSearchParams({ bucket: next })
    } else {
      // Clear: replace search with empty params so we don't leave a
      // stale ?bucket= in the URL.
      setSearchParams({})
    }
  }

  if (!member) {
    return (
      <p className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-500/30">
        Signed in, but no family membership found.
      </p>
    )
  }

  if (loadError) {
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
              ? 'No transactions yet'
              : `${rows.length}${hasMore ? '+' : ''} ${rows.length === 1 ? 'transaction' : 'transactions'}`}
        </p>
      </header>

      <FilterBar
        buckets={buckets ?? []}
        activeBucketId={bucketFilter}
        activeBucketName={filteredBucketName}
        onChange={setBucketFilter}
      />

      {rows === null ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 p-6 text-center">
          <p className="text-sm font-medium text-zinc-300">
            {bucketFilter ? 'No moves for this bucket yet' : 'Nothing here yet'}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {bucketFilter
              ? 'Move money in or out of this bucket and it will appear here.'
              : 'Bucket moves and sends will show up here as you make them.'}
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
  activeBucketId,
  activeBucketName,
  onChange,
}: {
  buckets: Bucket[]
  activeBucketId: string | null
  activeBucketName: string | null
  onChange: (id: string | null) => void
}) {
  // When the URL has a bucket id that's no longer in our local list
  // (e.g., deleted), surface that gracefully instead of vanishing.
  const showOrphanedFilter =
    activeBucketId !== null && activeBucketName === null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs font-medium text-zinc-400" htmlFor="bucket-filter">
        Filter
      </label>
      <select
        id="bucket-filter"
        value={activeBucketId ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        className="rounded-lg border-0 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-300 ring-1 ring-inset ring-zinc-700 focus:outline focus:outline-2 focus:outline-emerald-400"
      >
        <option value="">All transactions</option>
        {buckets.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
        {showOrphanedFilter && (
          <option value={activeBucketId ?? ''}>(deleted bucket)</option>
        )}
      </select>

      {activeBucketId && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30">
          {activeBucketName ?? 'Deleted bucket'}
          <button
            type="button"
            aria-label="Clear filter"
            onClick={() => onChange(null)}
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
      )}
    </div>
  )
}

function TxItem({
  row,
  currentMemberId,
}: {
  row: TxRow
  currentMemberId: string
}) {
  const [noteExpanded, setNoteExpanded] = useState(false)
  const amount = currency.format(Number(row.amount))
  const time = timeFormatter.format(new Date(row.created_at))

  let title: string
  let subtitle: string | null = null

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
          // Tap to toggle full text. We always render as a button rather
          // than trying to detect truncation — short notes simply toggle
          // a no-op visually, and we get a consistent affordance.
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
  // FK still set but join missed (RLS scoping). Fall back gracefully.
  if (id) return 'Bucket'
  // FK is NULL: either it was always Unallocated, or the bucket was
  // since deleted (ON DELETE SET NULL). We can't tell them apart
  // without denormalising the name; "Unallocated" is the right read
  // for fresh data, and historical orphan rows are rare enough to
  // accept the ambiguity.
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
