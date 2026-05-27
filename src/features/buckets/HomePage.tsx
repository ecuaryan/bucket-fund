import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import type { Database } from '@/types/database'

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

  const member = auth.status === 'signedIn' ? auth.member : null

  useEffect(() => {
    if (!member) return

    let active = true

    async function loadData() {
      setLoadError(null)
      const [bucketsRes, accountsRes] = await Promise.all([
        supabase.from('buckets').select('*').order('created_at'),
        supabase.from('accounts').select('*'),
      ])

      if (!active) return

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
    }

    void loadData()

    return () => {
      active = false
    }
  }, [member])

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
  // For now: assume the signed-in admin is the only person with accounts.
  // The real "unallocated" calc per CONTEXT.md will live in the
  // check-invariant Edge Function once members and child members exist.
  const realBalance = accounts.reduce(
    (sum, a) => sum + Number(a.current_balance),
    0,
  )
  const unallocated = realBalance - allocated
  const unallocatedColor =
    unallocated >= 0
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : 'bg-red-50 text-red-700 ring-red-200'

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
          {accounts.length === 0
            ? 'No linked bank accounts yet — link one from the Admin tab.'
            : `Across ${accounts.length} linked account${accounts.length === 1 ? '' : 's'}`}
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
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            {buckets.map((bucket) => (
              <li
                key={bucket.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {bucket.name}
                  </p>
                  {bucket.owner_member_id === null && (
                    <p className="text-xs text-slate-500">Family pool</p>
                  )}
                </div>
                <p className="text-sm font-semibold tabular-nums text-slate-700">
                  {currency.format(Number(bucket.allocated_amount))}
                </p>
              </li>
            ))}
          </ul>
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
    </div>
  )
}
