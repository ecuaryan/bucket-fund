import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import {
  childFamilyFunding,
  fetchHomeBalanceBreakdown,
  type HomeBalanceBreakdown,
} from '@/lib/availableBalance'
import {
  deleteBucket,
  renameBucket,
  reorderBucket,
} from '@/lib/buckets'
import type { Database } from '@/types/database'
import MoveMoneyDialog from '@/features/buckets/MoveMoneyDialog'
import BucketActionsMenu from '@/features/buckets/BucketActionsMenu'
import { usePostgresChanges } from '@/hooks/usePostgresChanges'

type Bucket = Database['public']['Tables']['buckets']['Row']
type Account = Database['public']['Tables']['accounts']['Row']

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export default function HomePage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [buckets, setBuckets] = useState<Bucket[] | null>(null)
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [balanceBreakdown, setBalanceBreakdown] =
    useState<HomeBalanceBreakdown | null>(null)
  const [balanceUsesFallback, setBalanceUsesFallback] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newBucketName, setNewBucketName] = useState('')
  const [moveBucketId, setMoveBucketId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const member = auth.status === 'signedIn' ? auth.member : null
  const accessToken =
    auth.status === 'signedIn' ? auth.session.access_token : null
  const familyId = member?.family_id ?? null
  const memberId = member?.id ?? null
  const isAdmin = member?.role === 'admin'
  const isChild = member?.role === 'child'
  const canCreateBuckets = isAdmin || isChild
  const canManageStructure = isAdmin || isChild

  const loadGeneration = useRef(0)
  const ensureOrdersDone = useRef(false)

  const loadData = useCallback(async () => {
    const generation = ++loadGeneration.current
    setLoadError(null)

    if (!ensureOrdersDone.current) {
      await supabase.rpc('ensure_member_bucket_orders')
      if (generation !== loadGeneration.current) return
      ensureOrdersDone.current = true
    }

    const [bucketsRes, orderRes, accountsRes] = await Promise.all([
      supabase.from('buckets').select('*'),
      supabase.from('member_bucket_order').select('bucket_id, display_order'),
      supabase.from('accounts').select('*'),
    ])
    if (generation !== loadGeneration.current) return

    if (bucketsRes.error) {
      const msg = bucketsRes.error.message
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
      return
    }
    if (orderRes.error) {
      setLoadError(orderRes.error.message)
      return
    }
    if (accountsRes.error) {
      setLoadError(accountsRes.error.message)
      return
    }
    const orderMap = new Map(
      (orderRes.data ?? []).map((row) => [row.bucket_id, row.display_order]),
    )
    const sorted = [...(bucketsRes.data ?? [])].sort((a, b) => {
      const oa = orderMap.get(a.id) ?? a.display_order
      const ob = orderMap.get(b.id) ?? b.display_order
      if (oa !== ob) return oa - ob
      return a.created_at.localeCompare(b.created_at)
    })

    const accountRows = accountsRes.data ?? []
    setBuckets(sorted)
    setAccounts(accountRows)

    const { breakdown, usedFallback } = await fetchHomeBalanceBreakdown({
      accounts: accountRows,
      buckets: sorted,
    })
    if (generation !== loadGeneration.current) return
    setBalanceBreakdown(breakdown)
    setBalanceUsesFallback(usedFallback)
  }, [])

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
    ensureOrdersDone.current = false
    loadGeneration.current += 1
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
    try {
      await renameBucket(id, next)
      setRenamingId(null)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
  }

  async function handleReorder(id: string, direction: 'up' | 'down') {
    setActionError(null)
    try {
      await reorderBucket(id, direction)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleDelete(b: Bucket) {
    setActionError(null)
    const allocated = Number(b.allocated_amount)
    const message =
      allocated > 0
        ? `Delete "${b.name}"? Its ${currency.format(allocated)} will return to Unallocated.`
        : `Delete "${b.name}"?`
    if (!window.confirm(message)) return
    try {
      await deleteBucket(b.id)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }

  async function onCreateBucket(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!member) return
    const name = newBucketName.trim()
    if (!name) return

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

  if (!member) {
    return (
      <p className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-500/30">
        Signed in, but no family membership found. The sign-up trigger may
        not have run — try signing out and signing up again.
      </p>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-300 ring-1 ring-red-500/30">
        <p className="font-semibold">Could not load buckets</p>
        <p className="mt-1">{loadError}</p>
      </div>
    )
  }

  if (buckets === null || accounts === null || balanceBreakdown === null) {
    return <p className="text-sm text-zinc-400">Loading…</p>
  }

  // Server-side family pool (admin/member share one number). See migration 16.
  const unallocated = balanceBreakdown.unallocated
  const isAdult = !isChild
  const familyFunding = isChild ? childFamilyFunding(balanceBreakdown) : 0
  const showAdultBreakdown =
    isAdult &&
    !balanceUsesFallback &&
    (balanceBreakdown.totalCash > 0 ||
      balanceBreakdown.bucketAllocated > 0 ||
      balanceBreakdown.children.length > 0)
  const showChildBreakdown =
    isChild &&
    !balanceUsesFallback &&
    (balanceBreakdown.totalCash > 0 ||
      balanceBreakdown.bucketAllocated > 0 ||
      familyFunding > 0)
  const showBalanceBreakdown = showAdultBreakdown || showChildBreakdown
  const unallocatedColor =
    unallocated >= 0
      ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'
      : 'bg-red-500/10 text-red-300 ring-red-500/30'

  const cashAccountsCount = accounts.filter(
    (a) => a.current_balance !== null && Number(a.current_balance) > 0,
  ).length

  const unallocatedHint = showBalanceBreakdown
    ? null
    : cashAccountsCount > 0
      ? `${currency.format(balanceBreakdown.totalCash)} across ${cashAccountsCount} linked account${cashAccountsCount === 1 ? '' : 's'}`
      : isChild
        ? 'When a parent sends you money, move it into buckets — or ask them to link your bank account.'
        : isAdmin
          ? 'No linked cash accounts yet — link one from Admin.'
          : 'No linked cash accounts yet — ask your admin to link a family account.'

  return (
    <div className="space-y-6">
      {balanceUsesFallback && (
        <p className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-500/30">
          Balance is estimated from linked accounts only (database update pending).
          Sends may be unavailable until migrations are applied.
        </p>
      )}
      <section
        className={`rounded-2xl px-4 py-5 ring-1 ${unallocatedColor}`}
        aria-label="Unallocated balance"
      >
        <p className="text-xs font-medium uppercase tracking-wide opacity-70">
          Unallocated
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">
          {currency.format(unallocated)}
        </p>
        {unallocatedHint ? (
          <p className="mt-1 text-xs opacity-70">{unallocatedHint}</p>
        ) : null}
        {showBalanceBreakdown && (
          <dl className="mt-3 space-y-1 border-t border-current/10 pt-3 text-xs opacity-90">
            {balanceBreakdown.totalCash > 0 ? (
              <div className="flex justify-between gap-4 tabular-nums">
                <dt>
                  Linked cash
                  {cashAccountsCount > 0
                    ? ` (${cashAccountsCount} account${cashAccountsCount === 1 ? '' : 's'})`
                    : ''}
                </dt>
                <dd>{currency.format(balanceBreakdown.totalCash)}</dd>
              </div>
            ) : null}
            {isChild && familyFunding > 0 ? (
              <div className="flex justify-between gap-4 tabular-nums">
                <dt>From family</dt>
                <dd>{currency.format(familyFunding)}</dd>
              </div>
            ) : null}
            {balanceBreakdown.bucketAllocated > 0 ? (
              <div className="flex justify-between gap-4 tabular-nums">
                <dt>{isChild ? 'In your buckets' : 'In family buckets'}</dt>
                <dd>−{currency.format(balanceBreakdown.bucketAllocated)}</dd>
              </div>
            ) : null}
            {showAdultBreakdown
              ? balanceBreakdown.children.map((child) => (
                  <div
                    key={child.memberId}
                    className="flex justify-between gap-4 tabular-nums"
                  >
                    <dt className="truncate">{child.name}</dt>
                    <dd>−{currency.format(child.amount)}</dd>
                  </div>
                ))
              : null}
          </dl>
        )}
      </section>

      <section aria-label="Buckets">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Buckets</h2>
          <span className="text-xs text-zinc-400">
            {buckets.length} bucket{buckets.length === 1 ? '' : 's'}
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
                : 'Ask your admin to add family buckets.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-2xl bg-zinc-900 ring-1 ring-zinc-800">
            {buckets.map((bucket, idx) => {
              const renaming = renamingId === bucket.id
              return (
                <li
                  key={bucket.id}
                  className="flex items-center gap-2 px-3 py-2"
                >
                  {renaming ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                          if (e.key === 'Enter') void commitRename(bucket.id)
                          if (e.key === 'Escape') cancelRename()
                        }}
                        onBlur={() => void commitRename(bucket.id)}
                        className="flex-1 rounded-lg border-0 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 ring-1 ring-inset ring-emerald-400 focus:outline focus:outline-2 focus:outline-emerald-400"
                      />
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-zinc-500">
                        {currency.format(Number(bucket.allocated_amount))}
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setMoveBucketId(bucket.id)}
                      className="-ml-1 flex flex-1 items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-zinc-800/60 focus:bg-zinc-800/60 focus:outline-none"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-300">
                          {bucket.name}
                        </p>
                        {bucket.owner_member_id === null && (
                          <p className="text-xs text-zinc-400">Family pool</p>
                        )}
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-zinc-300">
                        {currency.format(Number(bucket.allocated_amount))}
                      </p>
                    </button>
                  )}
                  <BucketActionsMenu
                    isFirst={idx === 0}
                    isLast={idx === buckets.length - 1}
                    hasAllocation={Number(bucket.allocated_amount) > 0}
                    canManageStructure={canManageStructure}
                    onViewHistory={() =>
                      navigate(`/history?bucket=${bucket.id}`)
                    }
                    onRename={() => startRename(bucket.id, bucket.name)}
                    onMoveUp={() => void handleReorder(bucket.id, 'up')}
                    onMoveDown={() => void handleReorder(bucket.id, 'down')}
                    onDelete={() => void handleDelete(bucket)}
                  />
                </li>
              )
            })}
          </ul>
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

      <MoveMoneyDialog
        open={moveBucketId !== null}
        buckets={buckets}
        unallocated={unallocated}
        initialBucketId={moveBucketId ?? ''}
        onClose={() => setMoveBucketId(null)}
        onMoved={() => {
          // Realtime will refresh, but trigger an immediate fetch too
          // so optimism kicks in before the WS round-trip.
          void loadData()
        }}
      />
    </div>
  )
}
