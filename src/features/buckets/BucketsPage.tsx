import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import {
  BUCKETS_ADD_SOURCE_ADMIN_BODY,
  BUCKETS_ADD_SOURCE_LINK_ACTION,
  BUCKETS_ADD_SOURCE_MANUAL_ACTION,
  BUCKETS_ADD_SOURCE_TITLE,
  bucketsAddSourceMemberBody,
  bucketsDeleteBucketConfirm,
  bucketsDeleteBucketEffectUnallocated,
  bucketsDeleteBucketSheetIntro,
  bucketsDeleteBucketSheetTitle,
  BUCKETS_DELETE_BUCKET_EFFECT_HISTORY,
  BUCKETS_DELETE_BUCKET_EFFECT_LABEL,
  BUCKETS_DELETE_BUCKET_WHAT_HAPPENS,
  bucketsKidUnallocatedHint,
  BUCKETS_DB_UPDATE_PENDING_BODY,
  bucketsMemberNoBucketsHint,
} from '@/lib/brand'
import ManualSourceDialog from '@/features/admin/ManualSourceDialog'
import { Sheet } from '@/components/ui/Sheet'
import { isCashAccount } from '@/lib/accounts'
import BucketsPageSkeleton from '@/components/BucketsPageSkeleton'
import { BusyOverlay } from '@/components/ui/BusyOverlay'
import { ClearableInput } from '@/components/ui/ClearableInput'
import RefreshIconButton from '@/components/ui/RefreshIconButton'
import {
  childTotalBalance,
  type BucketsBalanceBreakdown,
} from '@/lib/availableBalance'
import {
  isAppBackgroundExpired,
  isSessionGateActive,
} from '@/lib/backgroundSignOut'
import { readBucketsPageCache, writeBucketsPageCache } from '@/lib/bucketsPageCache'
import { formatRelativeTime } from '@/lib/relativeTime'
import { loadBucketsPage } from '@/lib/bucketsPageLoad'
import {
  renameBucketInList,
  reorderBucketList,
  swapBucketOrder,
} from '@/lib/bucketsPageOptimistic'
import {
  deleteBucket,
  BUCKET_NAME_MAX_LENGTH,
  renameBucket,
  reorderBucket,
  reorderBuckets,
  validateBucketName,
} from '@/lib/buckets'
import type { Database } from '@/types/database'
import MoveMoneyDialog from '@/features/buckets/MoveMoneyDialog'
import SortableBucketList from '@/features/buckets/SortableBucketList'
import { ReorderHintProvider } from '@/features/buckets/ReorderHintContext'
import { usePostgresChanges } from '@/hooks/usePostgresChanges'
import { useFlipList } from '@/hooks/useFlipList'
import { useHideAmounts } from '@/lib/HideAmountsProvider'
import { refreshBalances } from '@/lib/teller'
import {
  buildUnallocatedLines,
  formatBucketsHeaderSubtitle,
  formatUnallocatedSummary,
  unallocatedSummary,
} from '@/lib/unallocatedBreakdown'
import {
  readUnallocatedDetailsOpen,
  writeUnallocatedDetailsOpen,
} from '@/lib/unallocatedDetailsStorage'

type Bucket = Database['public']['Tables']['buckets']['Row']
type Account = Database['public']['Tables']['accounts']['Row']

export default function BucketsPage() {
  const { formatMoney } = useHideAmounts()
  const auth = useAuth()
  const navigate = useNavigate()
  const [buckets, setBuckets] = useState<Bucket[] | null>(null)
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [balanceBreakdown, setBalanceBreakdown] =
    useState<BucketsBalanceBreakdown | null>(null)
  const [balanceUsesFallback, setBalanceUsesFallback] = useState(false)
  const [householdAdminName, setHouseholdAdminName] = useState<string | null>(
    null,
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newBucketName, setNewBucketName] = useState('')
  const [moveBucketId, setMoveBucketId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [manualSourceOpen, setManualSourceOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Bucket | null>(null)
  const [deletingBucket, setDeletingBucket] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [prevDetailsMemberId, setPrevDetailsMemberId] = useState<string | null>(
    null,
  )

  const member = auth.status === 'signedIn' ? auth.member : null
  const accessToken =
    auth.status === 'signedIn' ? auth.session.access_token : null
  const familyId = member?.family_id ?? null
  const memberId = member?.id ?? null

  if (memberId !== prevDetailsMemberId) {
    setPrevDetailsMemberId(memberId)
    setDetailsOpen(memberId ? readUnallocatedDetailsOpen(memberId) : false)
  }

  const isAdmin = member?.role === 'admin'
  const isChild = member?.role === 'child'
  const canCreateBuckets = isAdmin || isChild
  const canManageStructure = isAdmin || isChild

  const loadGeneration = useRef(0)
  const { listRef, prepareFlip } = useFlipList(buckets)
  const detailsPanelId = useId()

  const loadData = useCallback(async () => {
    if (!familyId || !memberId) return
    const generation = ++loadGeneration.current
    setLoadError(null)

    try {
      const data = await loadBucketsPage()
      if (generation !== loadGeneration.current) return
      setBuckets(data.buckets)
      setAccounts(data.accounts)
      setBalanceBreakdown(data.breakdown)
      setBalanceUsesFallback(data.usedFallback)
      setHouseholdAdminName(data.householdAdminName)
      writeBucketsPageCache(familyId, memberId, {
        buckets: data.buckets,
        accounts: data.accounts,
        breakdown: data.breakdown,
        balanceUsesFallback: data.usedFallback,
        householdAdminName: data.householdAdminName,
      })
    } catch (e) {
      if (generation !== loadGeneration.current) return
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.toLowerCase().includes('permission denied')) {
        const { data: userData } = await supabase.auth.getUser()
        await supabase.auth.signOut()
        navigate('/login', {
          replace: true,
          state: {
            info: 'Your session expired. Sign in again.',
            email: userData.user?.email ?? '',
          },
        })
        return
      }
      setLoadError(msg)
    }
  }, [familyId, memberId, navigate])

  const realtimeReloadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const debouncedLoadData = useCallback(() => {
    clearTimeout(realtimeReloadTimer.current)
    realtimeReloadTimer.current = setTimeout(() => {
      void loadData()
    }, 300)
  }, [loadData])

  useEffect(() => {
    loadGeneration.current += 1
    if (!familyId || !memberId) {
      setBuckets(null)
      setAccounts(null)
      setBalanceBreakdown(null)
      setHouseholdAdminName(null)
      return
    }
    if (isAppBackgroundExpired() || isSessionGateActive()) return

    const cached = readBucketsPageCache(familyId, memberId)
    if (cached) {
      setBuckets(cached.buckets)
      setAccounts(cached.accounts)
      setBalanceBreakdown(cached.breakdown)
      setBalanceUsesFallback(cached.balanceUsesFallback)
      setHouseholdAdminName(cached.householdAdminName ?? null)
    }
  }, [familyId, memberId])

  useEffect(
    () => () => {
      clearTimeout(realtimeReloadTimer.current)
    },
    [],
  )

  useEffect(() => {
    if (!familyId) return
    void loadData()
  }, [familyId, loadData])

  const realtimeSpecs = useMemo(() => {
    if (!familyId) return []
    const specs = [
      {
        event: '*' as const,
        table: 'buckets',
        filter: `family_id=eq.${familyId}`,
      },
      {
        event: '*' as const,
        table: 'accounts',
        filter: `family_id=eq.${familyId}`,
      },
      {
        event: 'INSERT' as const,
        table: 'transactions',
        filter: `family_id=eq.${familyId}`,
      },
    ]
    if (memberId) {
      specs.push({
        event: '*' as const,
        table: 'member_bucket_order',
        filter: `member_id=eq.${memberId}`,
      })
    }
    return specs
  }, [familyId, memberId])

  usePostgresChanges(
    accessToken,
    familyId ? `home:${familyId}` : null,
    realtimeSpecs,
    debouncedLoadData,
  )

  function startRename(id: string, currentName: string) {
    setRenameValue(currentName)
    setRenamingId(id)
    setActionError(null)
  }

  async function commitRename(id: string) {
    const next = renameValue.trim()
    if (!next) {
      setRenamingId(null)
      return
    }
    const invalid = validateBucketName(next)
    if (invalid) {
      setActionError(invalid)
      return
    }
    const previous = buckets?.find((b) => b.id === id)?.name
    if (!previous || previous === next) {
      setRenamingId(null)
      return
    }
    setRenamingId(null)
    setActionError(null)
    setBuckets((prev) => (prev ? renameBucketInList(prev, id, next) : prev))
    try {
      await renameBucket(id, next)
      void loadData()
    } catch (e) {
      setBuckets((prev) =>
        prev ? renameBucketInList(prev, id, previous) : prev,
      )
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
  }

  async function handleReorder(id: string, direction: 'up' | 'down') {
    setActionError(null)
    prepareFlip()
    const snapshot = buckets
    setBuckets((prev) => (prev ? swapBucketOrder(prev, id, direction) : prev))
    try {
      await reorderBucket(id, direction)
      void loadData()
    } catch (e) {
      setBuckets(snapshot)
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleDragReorder(orderedIds: string[]) {
    setActionError(null)
    const snapshot = buckets
    setBuckets((prev) => (prev ? reorderBucketList(prev, orderedIds) : prev))
    try {
      await reorderBuckets(orderedIds)
      void loadData()
    } catch (e) {
      setBuckets(snapshot)
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleRefreshBalances() {
    setRefreshError(null)
    setSyncing(true)
    try {
      await refreshBalances()
      await loadData()
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
    }
  }

  async function performDeleteBucket(
    b: Bucket,
    reportError: (message: string) => void,
  ) {
    const snapshot = buckets
    if (renamingId === b.id) setRenamingId(null)
    if (moveBucketId === b.id) setMoveBucketId(null)
    setBuckets((prev) => (prev ? prev.filter((x) => x.id !== b.id) : prev))
    setSyncing(true)
    try {
      await deleteBucket(b.id)
      setDeleteTarget(null)
      await loadData()
    } catch (e) {
      setBuckets(snapshot)
      reportError(e instanceof Error ? e.message : String(e))
    } finally {
      setDeletingBucket(false)
      setSyncing(false)
    }
  }

  function requestDeleteBucket(b: Bucket) {
    setActionError(null)
    if (Number(b.allocated_amount) > 0) {
      setDeleteError(null)
      setDeleteTarget(b)
      return
    }
    void performDeleteBucket(b, setActionError)
  }

  function closeDeleteConfirm() {
    if (deletingBucket) return
    setDeleteTarget(null)
    setDeleteError(null)
  }

  async function confirmDeleteBucket() {
    if (!deleteTarget) return
    setDeletingBucket(true)
    setDeleteError(null)
    await performDeleteBucket(deleteTarget, setDeleteError)
  }

  async function onCreateBucket(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!member) return
    const name = newBucketName.trim()
    if (!name) return
    const invalid = validateBucketName(name)
    if (invalid) {
      setCreateError(invalid)
      return
    }

    setCreating(true)
    setCreateError(null)
    const { data, error } = await supabase
      .from('buckets')
      .insert({
        family_id: member.family_id,
        owner_member_id: isChild ? member.id : null,
        name,
        allocated_amount: 0,
      })
      .select()
      .single()

    setCreating(false)
    if (error) {
      setCreateError(error.message)
      return
    }
    setBuckets((prev) => (prev ? [...prev, data] : [data]))
    setNewBucketName('')
  }

  if (loadError) {
    return (
      <div className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-300 ring-1 ring-red-500/30">
        <p className="font-semibold">Could not load buckets</p>
        <p className="mt-1">{loadError}</p>
      </div>
    )
  }

  const authLoading =
    auth.status === 'signedIn' && auth.memberLoading
  if (
    authLoading ||
    !familyId ||
    buckets === null ||
    accounts === null ||
    balanceBreakdown === null
  ) {
    return <BucketsPageSkeleton />
  }

  // Server-side family pool (admin/member share one number). See migration 16.
  const unallocated = balanceBreakdown.unallocated
  const isAdult = !isChild
  const childTotal = isChild ? childTotalBalance(balanceBreakdown) : 0
  const showAdultBreakdown =
    isAdult &&
    !balanceUsesFallback &&
    (balanceBreakdown.totalCash > 0 ||
      balanceBreakdown.bucketAllocated > 0 ||
      balanceBreakdown.children.length > 0)
  const showChildBreakdown =
    isChild &&
    !balanceUsesFallback &&
    (childTotal > 0 || balanceBreakdown.bucketAllocated > 0)
  const showBalanceBreakdown = showAdultBreakdown || showChildBreakdown
  const hasMoneySources = accounts.length > 0
  // Once money is in a bucket it is "organized" — show the negative red
  // unallocated rebalance signal rather than the getting-started CTA. Only
  // adults with nothing set up at all (no sources, nothing allocated) see it.
  const hasAllocations = balanceBreakdown.bucketAllocated > 0
  const showAddSourceCard = isAdult && !hasMoneySources && !hasAllocations
  const unallocatedColor =
    unallocated >= 0
      ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'
      : 'bg-red-500/10 text-red-300 ring-red-500/30'

  const cashAccounts = accounts.filter(
    (a) => isCashAccount(a) && Number(a.current_balance) > 0,
  )
  const cashAccountsCount = cashAccounts.length
  const bankAccountsCount = cashAccounts.filter((a) => a.source === 'teller').length
  const manualAccountsCount = cashAccounts.filter((a) => a.source === 'manual').length

  // Family-wide bank sync time. Comes from the breakdown RPC so every role —
  // including children, who can't read the accounts table — sees the same value.
  const bankSyncedLabel = formatRelativeTime(balanceBreakdown.bankLastSyncedAt)

  const unallocatedHint =
    showAddSourceCard || showBalanceBreakdown
      ? null
      : cashAccountsCount > 0
        ? `${formatMoney(balanceBreakdown.totalCash)} across ${cashAccountsCount} money source${cashAccountsCount === 1 ? '' : 's'}`
        : isChild
          ? bucketsKidUnallocatedHint(householdAdminName)
          : null

  const breakdownOpts = {
    isChild,
    cashAccountsCount,
    bankAccountsCount,
    manualAccountsCount,
    childTotal,
  }
  const breakdownLines = buildUnallocatedLines(balanceBreakdown, breakdownOpts)
  const collapsedSummary = unallocatedSummary(balanceBreakdown, breakdownOpts)

  function toggleDetailsOpen() {
    if (!memberId) return
    setDetailsOpen((prev) => {
      const next = !prev
      writeUnallocatedDetailsOpen(memberId, next)
      return next
    })
  }

  const freshnessFooter =
    bankSyncedLabel || (isAdult && hasMoneySources) ? (
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {bankSyncedLabel ? (
          <p className="text-[11px] opacity-50">
            Balances refreshed {bankSyncedLabel}
          </p>
        ) : null}
        {isAdult && hasMoneySources && bankAccountsCount > 0 ? (
          <RefreshIconButton
            busy={syncing}
            disabled={syncing}
            onClick={() => void handleRefreshBalances()}
          />
        ) : null}
        {refreshError ? (
          <p className="w-full text-[11px] text-red-300/80">{refreshError}</p>
        ) : null}
      </div>
    ) : null

  return (
    <>
      <BusyOverlay
        busy={syncing && moveBucketId === null && !manualSourceOpen}
        label="Updating…"
      >
        <div className="space-y-6">
      {balanceUsesFallback && (
        <p className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-500/30">
          {BUCKETS_DB_UPDATE_PENDING_BODY}
        </p>
      )}
      {showAddSourceCard ? (
        <section
          className="rounded-2xl bg-emerald-500/10 px-4 py-5 ring-1 ring-emerald-500/30"
          aria-label="Add a money source"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-300/70">
            Getting started
          </p>
          <h2 className="mt-1 text-lg font-semibold text-emerald-100">
            {BUCKETS_ADD_SOURCE_TITLE}
          </h2>
          <p className="mt-2 text-sm text-emerald-200/80">
            {isAdmin
              ? BUCKETS_ADD_SOURCE_ADMIN_BODY
              : bucketsAddSourceMemberBody(householdAdminName)}
          </p>
          {balanceBreakdown.bucketAllocated > 0 ? (
            <p className="mt-2 text-xs text-emerald-200/60">
              {formatMoney(balanceBreakdown.bucketAllocated)} allocated
              across {buckets.length} bucket{buckets.length === 1 ? '' : 's'}.
            </p>
          ) : null}
          {isAdmin ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setManualSourceOpen(true)}
                className="inline-flex rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
              >
                {BUCKETS_ADD_SOURCE_MANUAL_ACTION}
              </button>
              <Link
                to="/admin"
                className="inline-flex rounded-lg border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/10"
              >
                {BUCKETS_ADD_SOURCE_LINK_ACTION}
              </Link>
            </div>
          ) : null}
        </section>
      ) : (
        <section
          className={`rounded-2xl px-4 py-5 ring-1 ${unallocatedColor}`}
          aria-label="Unallocated balance"
        >
          <p className="text-xs font-medium uppercase tracking-wide opacity-70">
            Unallocated
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {formatMoney(unallocated)}
          </p>
          {unallocatedHint ? (
            <p className="mt-1 text-xs opacity-70">{unallocatedHint}</p>
          ) : null}
          {showBalanceBreakdown && (
            <>
              <button
                type="button"
                aria-expanded={detailsOpen}
                aria-controls={detailsPanelId}
                onClick={toggleDetailsOpen}
                className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg py-1 text-left text-xs opacity-70 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              >
                <span className="min-w-0 truncate">
                  {detailsOpen
                    ? 'Breakdown'
                    : collapsedSummary
                      ? formatUnallocatedSummary(collapsedSummary, formatMoney)
                      : 'Breakdown'}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                  className={
                    'h-4 w-4 shrink-0 motion-safe:transition-transform motion-safe:duration-200 ' +
                    (detailsOpen ? 'rotate-180' : '')
                  }
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              <div
                id={detailsPanelId}
                className={
                  'grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 ' +
                  (detailsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')
                }
              >
                <div className="min-h-0 overflow-hidden">
                  <dl className="space-y-1 border-t border-current/10 pt-3 text-xs opacity-90">
                    {breakdownLines.map((line) => (
                      <div
                        key={line.key}
                        className={
                          'flex justify-between gap-4 tabular-nums ' +
                          (line.indent ? 'pl-4' : '')
                        }
                      >
                        <dt
                          className={
                            'truncate ' + (line.indent ? 'opacity-80' : '')
                          }
                        >
                          {line.label}
                        </dt>
                        <dd>
                          {line.kind === 'subtract' ? '−' : ''}
                          {formatMoney(line.amount)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {freshnessFooter ? (
                    <div className="mt-3 border-t border-current/10 pt-2">
                      {freshnessFooter}
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}
          {!showBalanceBreakdown && freshnessFooter ? (
            <div className="mt-2">{freshnessFooter}</div>
          ) : null}
        </section>
      )}

      <ReorderHintProvider
        reorderable={buckets.length >= 2 && renamingId === null}
      >
      <section aria-label="Buckets">
        <header className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Buckets</h2>
          <span className="text-right text-xs text-zinc-400">
            {formatBucketsHeaderSubtitle(
              buckets.length,
              balanceBreakdown.bucketAllocated,
              formatMoney,
            )}
          </span>
        </header>

        {buckets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 p-6 text-center">
            <p className="text-sm font-medium text-zinc-300">
              {canCreateBuckets ? 'Start organizing your money' : 'No buckets yet'}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              {canCreateBuckets
                ? 'Create your first bucket below.'
                : bucketsMemberNoBucketsHint(householdAdminName)}
            </p>
          </div>
        ) : (
          <SortableBucketList
            buckets={buckets}
            listRef={listRef}
            renamingId={renamingId}
            renameValue={renameValue}
            canManageStructure={canManageStructure}
            formatMoney={formatMoney}
            onRenameValueChange={setRenameValue}
            onCommitRename={commitRename}
            onCancelRename={cancelRename}
            onMoveMoney={setMoveBucketId}
            onViewHistory={(id) => navigate(`/history?bucket=${id}`)}
            onRename={startRename}
            onMoveUp={(id) => void handleReorder(id, 'up')}
            onMoveDown={(id) => void handleReorder(id, 'down')}
            onDelete={requestDeleteBucket}
            onDragReorder={(ids) => void handleDragReorder(ids)}
          />
        )}
        {actionError && (
          <p className="mt-2 text-xs text-red-300">{actionError}</p>
        )}

        {canCreateBuckets && (
          <>
            <form onSubmit={onCreateBucket} className="mt-4 flex gap-2">
              <ClearableInput
                wrapperClassName="min-w-0 flex-1"
                type="text"
                value={newBucketName}
                maxLength={BUCKET_NAME_MAX_LENGTH}
                onValueChange={setNewBucketName}
                placeholder="New bucket name"
                inputClassName="w-full rounded-lg border-0 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 ring-1 ring-inset ring-zinc-700 placeholder:text-zinc-500 focus:outline focus:outline-2 focus:outline-emerald-400"
              />
              <button
                type="submit"
                disabled={creating || newBucketName.trim().length === 0}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? 'Adding…' : 'Add'}
              </button>
            </form>
            {createError && (
              <p className="mt-2 text-xs text-red-300">{createError}</p>
            )}
          </>
        )}
      </section>
      </ReorderHintProvider>
        </div>
      </BusyOverlay>

      <MoveMoneyDialog
        open={moveBucketId !== null}
        buckets={buckets}
        unallocated={unallocated}
        initialBucketId={moveBucketId ?? ''}
        onClose={() => setMoveBucketId(null)}
        onMoved={async () => {
          setSyncing(true)
          try {
            await loadData()
          } finally {
            setSyncing(false)
          }
        }}
      />

      {deleteTarget ? (
        <Sheet
          open
          onClose={closeDeleteConfirm}
          aria-label={bucketsDeleteBucketSheetTitle(deleteTarget.name)}
        >
          <header className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-zinc-300">
              {bucketsDeleteBucketSheetTitle(deleteTarget.name)}
            </h2>
            <button
              type="button"
              onClick={closeDeleteConfirm}
              disabled={deletingBucket}
              className="rounded p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
              aria-label="Close"
            >
              ×
            </button>
          </header>

          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              {bucketsDeleteBucketSheetIntro(
                formatMoney(Number(deleteTarget.allocated_amount)),
              )}
            </p>

            <div>
              <h3 className="text-sm font-medium text-zinc-300">
                {BUCKETS_DELETE_BUCKET_WHAT_HAPPENS}
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-zinc-400">
                <li>
                  {bucketsDeleteBucketEffectUnallocated(
                    formatMoney(Number(deleteTarget.allocated_amount)),
                  )}
                </li>
                <li>{BUCKETS_DELETE_BUCKET_EFFECT_LABEL}</li>
                <li>{BUCKETS_DELETE_BUCKET_EFFECT_HISTORY}</li>
              </ul>
            </div>

            {deleteError ? (
              <p
                role="alert"
                className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/30"
              >
                {deleteError}
              </p>
            ) : null}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                disabled={deletingBucket}
                className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteBucket()}
                disabled={deletingBucket}
                className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
              >
                {deletingBucket
                  ? 'Deleting…'
                  : bucketsDeleteBucketConfirm(deleteTarget.name)}
              </button>
            </div>
          </div>
        </Sheet>
      ) : null}

      {isAdmin ? (
        <ManualSourceDialog
          open={manualSourceOpen}
          mode="create"
          onClose={() => setManualSourceOpen(false)}
          onSaved={async () => {
            setSyncing(true)
            try {
              await loadData()
            } finally {
              setSyncing(false)
            }
          }}
        />
      ) : null}
    </>
  )
}
