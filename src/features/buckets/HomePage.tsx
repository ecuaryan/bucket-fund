import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { sumCashBalance } from '@/lib/accounts'
import {
  deleteBucket,
  renameBucket,
  reorderBucket,
} from '@/lib/buckets'
import type { Database } from '@/types/database'
import MoveMoneyDialog from '@/features/buckets/MoveMoneyDialog'
import BucketActionsMenu from '@/features/buckets/BucketActionsMenu'

type Bucket = Database['public']['Tables']['buckets']['Row']
type Account = Database['public']['Tables']['accounts']['Row']

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export default function HomePage() {
  const auth = useAuth()
  const [buckets, setBuckets] = useState<Bucket[] | null>(null)
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newBucketName, setNewBucketName] = useState('')
  const [moveBucketId, setMoveBucketId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const member = auth.status === 'signedIn' ? auth.member : null
  const familyId = member?.family_id ?? null

  const loadData = useCallback(async () => {
    setLoadError(null)
    const [bucketsRes, accountsRes] = await Promise.all([
      supabase
        .from('buckets')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('accounts').select('*'),
    ])
    if (bucketsRes.error) {
      setLoadError(bucketsRes.error.message)
      return
    }
    if (accountsRes.error) {
      setLoadError(accountsRes.error.message)
      return
    }
    setBuckets(bucketsRes.data ?? [])
    setAccounts(accountsRes.data ?? [])
  }, [])

  useEffect(() => {
    if (!familyId) return
    void loadData()
  }, [familyId, loadData])

  // Realtime: any bucket or account change in the family triggers a
  // reload. We could splice deltas in directly for less network, but
  // a fetch is < 50ms and we get correct ordering for free.
  useEffect(() => {
    if (!familyId) return
    const channel = supabase
      .channel(`family:${familyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'buckets',
          filter: `family_id=eq.${familyId}`,
        },
        () => {
          void loadData()
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounts',
          filter: `family_id=eq.${familyId}`,
        },
        () => {
          void loadData()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [familyId, loadData])

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
        owner_member_id: member.id,
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
      <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
        Signed in, but no family membership found. The sign-up trigger may
        not have run — try signing out and signing up again.
      </p>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
        <p className="font-semibold">Could not load buckets</p>
        <p className="mt-1">{loadError}</p>
      </div>
    )
  }

  if (buckets === null || accounts === null) {
    return <p className="text-sm text-slate-500">Loading…</p>
  }

  const allocated = buckets.reduce(
    (sum, b) => sum + Number(b.allocated_amount),
    0,
  )
  // Cash accounts only — credit cards / loans / investments are not
  // money you can allocate to envelopes. See `lib/accounts.ts`.
  const realBalance = sumCashBalance(accounts)
  const unallocated = realBalance - allocated
  const unallocatedColor =
    unallocated >= 0
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : 'bg-red-50 text-red-700 ring-red-200'

  const cashAccountsCount = accounts.filter(
    (a) => a.current_balance !== null && Number(a.current_balance) > 0,
  ).length

  return (
    <div className="space-y-6">
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
        <p className="mt-1 text-xs opacity-70">
          {cashAccountsCount === 0
            ? 'No linked cash accounts yet — link one from the Admin tab.'
            : `${currency.format(realBalance)} across ${cashAccountsCount} linked account${cashAccountsCount === 1 ? '' : 's'}`}
        </p>
      </section>

      <section aria-label="Buckets">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Buckets</h2>
          <span className="text-xs text-slate-500">
            {buckets.length} total · {currency.format(allocated)} allocated
          </span>
        </header>

        {buckets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
            <p className="text-sm font-medium text-slate-700">
              No buckets yet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Create your first one below — e.g. Groceries, Rent, Fun.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-2xl bg-white ring-1 ring-slate-200">
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
                        className="flex-1 rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-emerald-300 focus:outline focus:outline-2 focus:outline-emerald-500"
                      />
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-400">
                        {currency.format(Number(bucket.allocated_amount))}
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setMoveBucketId(bucket.id)}
                      className="-ml-1 flex flex-1 items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {bucket.name}
                        </p>
                        {bucket.owner_member_id === null && (
                          <p className="text-xs text-slate-500">Family pool</p>
                        )}
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">
                        {currency.format(Number(bucket.allocated_amount))}
                      </p>
                    </button>
                  )}
                  <BucketActionsMenu
                    isFirst={idx === 0}
                    isLast={idx === buckets.length - 1}
                    hasAllocation={Number(bucket.allocated_amount) > 0}
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
          <p className="mt-2 text-xs text-red-700">{actionError}</p>
        )}

        <form onSubmit={onCreateBucket} className="mt-4 flex gap-2">
          <input
            type="text"
            value={newBucketName}
            onChange={(e) => setNewBucketName(e.target.value)}
            placeholder="New bucket name"
            className="flex-1 rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline focus:outline-2 focus:outline-emerald-500"
          />
          <button
            type="submit"
            disabled={creating || newBucketName.trim().length === 0}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? 'Adding…' : 'Add'}
          </button>
        </form>
        {createError && (
          <p className="mt-2 text-xs text-red-700">{createError}</p>
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
