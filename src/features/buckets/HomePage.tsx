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
  HOME_LINK_BANK_ADMIN_ACTION,
  HOME_LINK_BANK_ADMIN_BODY,
  HOME_LINK_BANK_TITLE,
  homeChildUnallocatedHint,
  homeLinkBankMemberBody,
  homeMemberNoBucketsHint,
} from '@/lib/brand'
import HomePageSkeleton from '@/components/HomePageSkeleton'
import { BusyOverlay } from '@/components/ui/BusyOverlay'
import RefreshIconButton from '@/components/ui/RefreshIconButton'
import {
  childTotalBalance,
  type HomeBalanceBreakdown,
} from '@/lib/availableBalance'
import { readHomeCache, writeHomeCache } from '@/lib/homeCache'
import { formatRelativeTime } from '@/lib/relativeTime'
import { loadHomePage } from '@/lib/homePage'
import {
  renameBucketInList,
  reorderBucketList,
  swapBucketOrder,
} from '@/lib/homeOptimistic'
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

export default function HomePage() {
  const { formatMoney } = useHideAmounts()
  const auth = useAuth()
  const navigate = useNavigate()
  const [buckets, setBuckets] = useState<Bucket[] | null>(null)
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [balanceBreakdown, setBalanceBreakdown] =
    useState<HomeBalanceBreakdown | null>(null)
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
      const data = await loadHomePage()
      if (generation !== loadGeneration.current) return
      setBuckets(data.buckets)
      setAccounts(data.accounts)
      setBalanceBreakdown(data.breakdown)
      setBalanceUsesFallback(data.usedFallback)
      setHouseholdAdminName(data.householdAdminName)
      writeHomeCache(familyId, memberId, {
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
    const cached = readHomeCache(familyId, memberId)
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

  async function handleDelete(b: Bucket) {
    setActionError(null)
    const allocated = Number(b.allocated_amount)
    const message =
      allocated > 0
        ? `Delete "${b.name}"? Its ${formatMoney(allocated)} will return to Unallocated.`
        : `Delete "${b.name}"?`
    if (!window.confirm(message)) return
    const snapshot = buckets
    if (renamingId === b.id) setRenamingId(null)
    if (moveBucketId === b.id) setMoveBucketId(null)
    setBuckets((prev) => (prev ? prev.filter((x) => x.id !== b.id) : prev))
    setSyncing(true)
    try {
      await deleteBucket(b.id)
      await loadData()
    } catch (e) {
      setBuckets(snapshot)
      setActionError(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
    }
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
    return <HomePageSkeleton />
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
  const hasLinkedAccounts = accounts.length > 0
  const showLinkBankCard = isAdult && !hasLinkedAccounts
  const unallocatedColor =
    unallocated >= 0
      ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'
      : 'bg-red-500/10 text-red-300 ring-red-500/30'

  const cashAccountsCount = accounts.filter(
    (a) => a.current_balance !== null && Number(a.current_balance) > 0,
  ).length

  // Family-wide bank sync time. Comes from the breakdown RPC so every role —
  // including children, who can't read the accounts table — sees the same value.
  const bankSyncedLabel = formatRelativeTime(balanceBreakdown.bankLastSyncedAt)

  const unallocatedHint =
    showLinkBankCard || showBalanceBreakdown
      ? null
      : cashAccountsCount > 0
        ? `${formatMoney(balanceBreakdown.totalCash)} across ${cashAccountsCount} linked account${cashAccountsCount === 1 ? '' : 's'}`
        : isChild
          ? homeChildUnallocatedHint(householdAdminName)
          : null

  const breakdownOpts = {
    isChild,
    cashAccountsCount,
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
    bankSyncedLabel || (isAdult && hasLinkedAccounts) ? (
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {bankSyncedLabel ? (
          <p className="text-[11px] opacity-50">
            Balances refreshed {bankSyncedLabel}
          </p>
        ) : null}
        {isAdult && hasLinkedAccounts ? (
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
      <BusyOverlay busy={syncing} label="Updating…">
        <div className="space-y-6">
      {balanceUsesFallback && (
        <p className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-500/30">
          Balance is estimated from linked accounts only (database update pending).
          Sends may be unavailable until migrations are applied.
        </p>
      )}
      {showLinkBankCard ? (
        <section
          className="rounded-2xl bg-emerald-500/10 px-4 py-5 ring-1 ring-emerald-500/30"
          aria-label="Link a bank account"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-300/70">
            Getting started
          </p>
          <h2 className="mt-1 text-lg font-semibold text-emerald-100">
            {HOME_LINK_BANK_TITLE}
          </h2>
          <p className="mt-2 text-sm text-emerald-200/80">
            {isAdmin
              ? HOME_LINK_BANK_ADMIN_BODY
              : homeLinkBankMemberBody(householdAdminName)}
          </p>
          {balanceBreakdown.bucketAllocated > 0 ? (
            <p className="mt-2 text-xs text-emerald-200/60">
              {formatMoney(balanceBreakdown.bucketAllocated)} allocated
              across {buckets.length} bucket{buckets.length === 1 ? '' : 's'}.
            </p>
          ) : null}
          {isAdmin ? (
            <Link
              to="/admin"
              className="mt-4 inline-flex rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
            >
              {HOME_LINK_BANK_ADMIN_ACTION}
            </Link>
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
              No buckets yet
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              {canCreateBuckets
                ? 'Create your first one below.'
                : homeMemberNoBucketsHint(householdAdminName)}
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
            onDelete={handleDelete}
            onDragReorder={(ids) => void handleDragReorder(ids)}
          />
        )}
        {actionError && (
          <p className="mt-2 text-xs text-red-300">{actionError}</p>
        )}

        {canCreateBuckets && (
          <>
            <form onSubmit={onCreateBucket} className="mt-4 flex gap-2">
              <input
                type="text"
                value={newBucketName}
                maxLength={BUCKET_NAME_MAX_LENGTH}
                onChange={(e) => setNewBucketName(e.target.value)}
                placeholder="New bucket name"
                className="flex-1 rounded-lg border-0 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 ring-1 ring-inset ring-zinc-700 placeholder:text-zinc-500 focus:outline focus:outline-2 focus:outline-emerald-400"
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
    </>
  )
}
