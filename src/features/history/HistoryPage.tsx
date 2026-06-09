import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePostgresChanges } from '@/hooks/usePostgresChanges'
import { useSendRecipients } from '@/hooks/useSendRecipients'
import { useAuth } from '@/lib/auth'
import {
  HISTORY_EMPTY_BODY,
  HISTORY_EMPTY_BUCKET_BODY,
  HISTORY_EMPTY_SENDS_BODY,
  HISTORY_FILTER_SENT_MONEY,
  HISTORY_NOTE_ADD,
  HISTORY_NOTE_CLEAR,
  HISTORY_NOTE_EDIT,
  HISTORY_NOTE_SAVED,
  HISTORY_NOTE_SHEET_TITLE_ADD,
  HISTORY_NOTE_SHEET_TITLE_EDIT,
  LOADING_STATUS_LABEL,
  TRANSACTION_NOTE_FIELD_LABEL,
  TRANSACTION_NOTE_PLACEHOLDER,
} from '@/lib/brand'
import { LoadErrorPanel } from '@/components/ui/LoadErrorPanel'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { LoadingStatus } from '@/components/ui/LoadingStatus'
import { ClearableInput } from '@/components/ui/ClearableInput'
import { FieldLabel } from '@/components/ui/FieldLabel'
import { Sheet } from '@/components/ui/Sheet'
import { useHideAmounts } from '@/lib/HideAmountsProvider'
import { scrollFocusedIntoView } from '@/lib/keyboardViewport'
import { updateTransactionNote } from '@/lib/transactions'
import { toast } from '@/lib/toast'
import type { Database } from '@/types/database'
import {
  filterFromSearchParams,
  historyFilterSearchKey,
  searchParamsForFilter,
  SEND_FILTER_VALUE,
  type HistoryFilter,
} from '@/features/history/historyFilters'
import { fetchHistoryPage, type HistoryTxRow } from '@/features/history/historyQueries'
import { withAuthLockRetry } from '@/lib/authLockError'
import {
  bucketEndpointLabel,
  historyBucketMoveSubtitle,
  historySendSubtitle,
  sendMemberEndpointLabel,
} from '@/lib/historyLabels'
import { HistoryEntityTransfer } from '@/features/history/HistoryEntityTransfer'
import { historyBalanceSides } from '@/lib/historyBalanceSides'

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
  const { sendReady, showSendNav } = useSendRecipients()
  const showSendFilter = sendReady && showSendNav

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
    try {
      await withAuthLockRetry(async () => {
        const { data, error } = await supabase
          .from('buckets')
          .select('id, name, display_order, created_at')
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: true })
        if (error) return // non-fatal; picker just stays empty
        setBuckets(data ?? [])
      })
    } catch {
      // non-fatal; picker just stays empty
    }
  }, [])

  const loadInitialHistory = useCallback(async () => {
    if (!familyId) return

    const generation = ++listGeneration.current
    const activeFilter = filterForKey(filterKey)

    setLoadError(null)
    setLoadMoreError(null)
    setRows(null)
    setHasMore(true)
    setLoadingMore(false)

    const result = await fetchHistoryPage(activeFilter, null, INITIAL_PAGE_SIZE)
    if (generation !== listGeneration.current) return
    if (!result.ok) {
      setLoadError(result.error)
      return
    }
    setRows(result.rows)
    setHasMore(result.rows.length === INITIAL_PAGE_SIZE)
  }, [familyId, filterKey])

  useEffect(() => {
    void loadInitialHistory()
  }, [loadInitialHistory])

  useEffect(() => {
    if (!familyId) return
    void loadBuckets()
  }, [familyId, loadBuckets])

  useEffect(() => {
    if (!sendReady || showSendNav || filter.kind !== 'send') return
    setSearchParams({})
  }, [sendReady, showSendNav, filter.kind, setSearchParams])

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

  const handleNoteUpdated = useCallback(
    (transactionId: string, note: string | null) => {
      setRows((prev) =>
        prev
          ? prev.map((row) =>
              row.id === transactionId ? { ...row, note } : row,
            )
          : prev,
      )
    },
    [],
  )

  if (!member) return null

  if (loadError && rows === null) {
    return (
      <LoadErrorPanel
        title="Could not load history"
        message={loadError}
        onRetry={() => void loadInitialHistory()}
      />
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-semibold">History</h1>
        <p className="mt-0.5 text-xs text-zinc-400">
          {rows === null
            ? LOADING_STATUS_LABEL
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
        showSendFilter={showSendFilter}
        onChange={setFilter}
      />

      {rows === null ? (
        <LoadingStatus className="py-8" />
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
              <ul className="flex flex-col gap-2">
                {group.rows.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-2xl bg-zinc-900 px-3 py-3 ring-1 ring-zinc-800"
                  >
                    <TxItem
                      row={row}
                      currentMemberId={member.id}
                      viewerRole={member.role}
                      onNoteUpdated={handleNoteUpdated}
                    />
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
              {loadingMore ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <LoadingSpinner className="h-3.5 w-3.5" />
                  {LOADING_STATUS_LABEL}
                </span>
              ) : (
                'Load older'
              )}
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
  showSendFilter,
  onChange,
}: {
  buckets: Bucket[]
  filter: HistoryFilter
  activeBucketName: string | null
  showSendFilter: boolean
  onChange: (filter: HistoryFilter) => void
}) {
  const selectValue =
    filter.kind === 'send'
      ? showSendFilter
        ? SEND_FILTER_VALUE
        : ''
      : filter.kind === 'bucket'
        ? filter.bucketId
        : ''

  const showOrphanedFilter =
    filter.kind === 'bucket' && activeBucketName === null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        htmlFor="history-filter"
        className="text-sm font-medium text-zinc-300"
      >
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
        {showSendFilter ? (
          <option value={SEND_FILTER_VALUE}>{HISTORY_FILTER_SENT_MONEY}</option>
        ) : null}
        {buckets.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
        {showOrphanedFilter && (
          <option value={filter.bucketId}>(deleted bucket)</option>
        )}
      </select>

      {showSendFilter && filter.kind === 'send' && (
        <ActiveFilterChip
          label={HISTORY_FILTER_SENT_MONEY}
          onClear={() => onChange({ kind: 'all' })}
        />
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
  viewerRole,
  onNoteUpdated,
}: {
  row: TxRow
  currentMemberId: string
  viewerRole: string
  onNoteUpdated: (transactionId: string, note: string | null) => void
}) {
  const { formatMoney } = useHideAmounts()
  const [noteExpanded, setNoteExpanded] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  const [draftNote, setDraftNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)
  const time = timeFormatter.format(new Date(row.created_at))
  const showActor = viewerRole === 'admin' || viewerRole === 'member'

  let title: string
  let subtitle: string
  let fromLabel: string
  let toLabel: string
  let actorMemberId: string | null
  let actorName: string | null | undefined

  if (row.type === 'bucket_move') {
    fromLabel = bucketEndpointLabel({
      bucketId: row.from_bucket_id,
      snapshotName: row.from_bucket_name,
      joinedName: row.from_bucket?.name,
    })
    toLabel = bucketEndpointLabel({
      bucketId: row.to_bucket_id,
      snapshotName: row.to_bucket_name,
      joinedName: row.to_bucket?.name,
    })
    title = `${fromLabel} → ${toLabel}`
    actorMemberId = row.from_member_id
    actorName = row.from_member?.name
    subtitle = historyBucketMoveSubtitle({
      time,
      actorMemberId,
      actorName,
      currentMemberId,
      showActor,
    })
  } else {
    const fromIsMe = row.from_member_id === currentMemberId
    const toIsMe = row.to_member_id === currentMemberId
    fromLabel = sendMemberEndpointLabel({
      snapshotName: row.from_member_name,
      joinedName: row.from_member?.name,
      isMe: fromIsMe,
    })
    toLabel = sendMemberEndpointLabel({
      snapshotName: row.to_member_name,
      joinedName: row.to_member?.name,
      isMe: toIsMe,
    })
    title = `${fromLabel} → ${toLabel}`
    actorMemberId = row.from_member_id
    actorName = row.from_member_name ?? row.from_member?.name
    subtitle = historySendSubtitle({
      time,
      actorMemberId,
      actorName,
      currentMemberId,
      showActor,
    })
  }

  const amountValue = Number(row.amount)
  const balanceSides = historyBalanceSides(row, {
    fromLabel,
    toLabel,
    amount: amountValue,
    currentMemberId,
  })
  const showTwoSidedBalance = balanceSides.length >= 2

  const sheetTitle = row.note
    ? HISTORY_NOTE_SHEET_TITLE_EDIT
    : HISTORY_NOTE_SHEET_TITLE_ADD

  function closeNoteEditor() {
    if (savingNote) return
    setEditingNote(false)
    setNoteError(null)
  }

  function openNoteEditor() {
    setDraftNote(row.note ?? '')
    setNoteError(null)
    setEditingNote(true)
  }

  async function saveNote(e: FormEvent) {
    e.preventDefault()
    setSavingNote(true)
    setNoteError(null)
    try {
      const trimmed = draftNote.trim()
      const next = trimmed === '' ? null : trimmed
      await updateTransactionNote(row.id, next)
      onNoteUpdated(row.id, next)
      setEditingNote(false)
      setNoteExpanded(Boolean(next))
      toast.success(HISTORY_NOTE_SAVED)
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Could not save note')
    } finally {
      setSavingNote(false)
    }
  }

  const noteQuote = row.note ? (
    <button
      type="button"
      onClick={() => setNoteExpanded((v) => !v)}
      aria-expanded={noteExpanded}
      aria-label={noteExpanded ? 'Collapse note' : 'Expand note'}
      className={
        'block w-full text-left text-xs italic leading-snug text-zinc-400 transition hover:text-zinc-300 focus:outline-none focus-visible:text-zinc-300 ' +
        (noteExpanded ? 'whitespace-pre-wrap break-words' : 'truncate')
      }
    >
      “{row.note}”
    </button>
  ) : null

  const noteFooter = (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <button
          type="button"
          onClick={openNoteEditor}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          {row.note ? HISTORY_NOTE_EDIT : HISTORY_NOTE_ADD}
        </button>
      </div>
      <p className="shrink-0 text-xs text-zinc-500">{subtitle}</p>
    </div>
  )

  return (
    <>
      <div className="min-w-0">
        {showTwoSidedBalance ? null : (
          <p className="truncate text-sm font-medium text-zinc-300">{title}</p>
        )}
        <HistoryEntityTransfer
          sides={balanceSides}
          amount={amountValue}
          formatMoney={formatMoney}
        />
        <div className="mt-5 flex flex-col gap-1">
          {noteQuote}
          {noteFooter}
        </div>
      </div>

      <Sheet
        open={editingNote}
        onClose={closeNoteEditor}
        aria-label={sheetTitle}
      >
        <form onSubmit={saveNote} className="space-y-4">
          <header className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-zinc-300">{sheetTitle}</h2>
            <button
              type="button"
              onClick={closeNoteEditor}
              disabled={savingNote}
              className="rounded p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
              aria-label="Close"
            >
              ×
            </button>
          </header>

          <label className="block">
            <FieldLabel optional>{TRANSACTION_NOTE_FIELD_LABEL}</FieldLabel>
            <ClearableInput
              type="text"
              maxLength={280}
              value={draftNote}
              onValueChange={setDraftNote}
              onFocus={(e) => scrollFocusedIntoView(e.currentTarget)}
              placeholder={TRANSACTION_NOTE_PLACEHOLDER}
              autoFocus
              disabled={savingNote}
              clearAriaLabel={HISTORY_NOTE_CLEAR}
              inputClassName="w-full rounded-lg border-0 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 ring-1 ring-inset ring-zinc-700 placeholder:text-zinc-500 focus:outline focus:outline-2 focus:outline-emerald-400"
            />
          </label>

          {noteError && (
            <p
              role="alert"
              className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30"
            >
              {noteError}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={closeNoteEditor}
              disabled={savingNote}
              className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingNote}
              className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {savingNote ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Sheet>
    </>
  )
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
