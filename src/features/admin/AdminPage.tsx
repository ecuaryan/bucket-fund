import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { disconnectEnrollment, useTellerConnect } from '@/lib/teller'
import type { Database } from '@/types/database'

type Account = Database['public']['Tables']['accounts']['Row']

type EnrollmentGroup = {
  enrollmentId: string
  institutionName: string | null
  accounts: Account[]
  totalBalance: number
  lastSyncedAt: string | null
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function formatLastSynced(iso: string | null): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'unknown'
  return dateFormat.format(d)
}

function groupByEnrollment(accounts: Account[]): EnrollmentGroup[] {
  const map = new Map<string, EnrollmentGroup>()
  const orphans: Account[] = []
  for (const a of accounts) {
    if (!a.teller_enrollment_id) {
      orphans.push(a)
      continue
    }
    const existing = map.get(a.teller_enrollment_id)
    if (existing) {
      existing.accounts.push(a)
      existing.totalBalance += Number(a.current_balance)
      if (
        a.last_synced_at &&
        (!existing.lastSyncedAt || a.last_synced_at > existing.lastSyncedAt)
      ) {
        existing.lastSyncedAt = a.last_synced_at
      }
    } else {
      map.set(a.teller_enrollment_id, {
        enrollmentId: a.teller_enrollment_id,
        institutionName: a.institution_name,
        accounts: [a],
        totalBalance: Number(a.current_balance),
        lastSyncedAt: a.last_synced_at,
      })
    }
  }
  const groups = Array.from(map.values())
  if (orphans.length > 0) {
    groups.push({
      enrollmentId: '',
      institutionName: 'Unlinked',
      accounts: orphans,
      totalBalance: orphans.reduce((s, a) => s + Number(a.current_balance), 0),
      lastSyncedAt: null,
    })
  }
  return groups
}

export default function AdminPage() {
  const auth = useAuth()
  const member = auth.status === 'signedIn' ? auth.member : null
  const teller = useTellerConnect()

  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkInfo, setLinkInfo] = useState<string | null>(null)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)

  const isAdmin = member?.role === 'admin'

  const loadAccounts = useCallback(async () => {
    setLoadError(null)
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) {
      setLoadError(error.message)
      return
    }
    setAccounts(data ?? [])
  }, [])

  useEffect(() => {
    if (!member) return
    void loadAccounts()
  }, [member, loadAccounts])

  const groups = useMemo(
    () => (accounts ? groupByEnrollment(accounts) : []),
    [accounts],
  )

  function onLink() {
    setLinkError(null)
    setLinkInfo(null)
    teller.open({
      onLinked: (result) => {
        const count = result.accounts.length
        setLinkInfo(
          count === 0
            ? 'Linked, but no accounts came back. Try again.'
            : `Linked ${count} account${count === 1 ? '' : 's'}.`,
        )
        void loadAccounts()
      },
      onError: (msg) => setLinkError(msg),
    })
  }

  async function onUnlink(group: EnrollmentGroup) {
    if (!group.enrollmentId) return
    const ok = window.confirm(
      `Unlink ${group.institutionName ?? 'this enrollment'}? ` +
        `${group.accounts.length} account${group.accounts.length === 1 ? '' : 's'} will be removed.`,
    )
    if (!ok) return

    setUnlinkingId(group.enrollmentId)
    setLinkError(null)
    setLinkInfo(null)
    try {
      const result = await disconnectEnrollment(group.enrollmentId)
      setLinkInfo(
        result.tellerDisconnected
          ? `Unlinked ${group.institutionName ?? 'enrollment'} cleanly.`
          : `Unlinked locally, but Teller-side disconnect failed: ${result.tellerError ?? 'unknown'}. You may want to remove this app from your bank's connected-apps list.`,
      )
      await loadAccounts()
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : String(e))
    } finally {
      setUnlinkingId(null)
    }
  }

  if (!member) {
    return <p className="text-sm text-slate-500">Loading family…</p>
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
        <p className="font-semibold">Admins only</p>
        <p className="mt-1">
          Linking bank accounts is restricted to family admins. Ask the
          person who created your family to add the account, then they
          can assign it to you.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">Admin</h1>
          <p className="text-xs text-slate-500">
            Link bank accounts and manage family settings.
          </p>
        </div>
      </header>

      <section aria-label="Linked accounts">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Linked accounts</h2>
          <button
            type="button"
            onClick={onLink}
            disabled={!teller.ready || teller.opening}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {teller.opening
              ? 'Opening…'
              : !teller.ready
                ? 'Loading…'
                : 'Link bank'}
          </button>
        </div>

        {(linkError || teller.error) && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
            {linkError ?? teller.error}
          </p>
        )}
        {linkInfo && (
          <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-200">
            {linkInfo}
          </p>
        )}

        {loadError ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
            {loadError}
          </p>
        ) : accounts === null ? (
          <p className="text-sm text-slate-500">Loading accounts…</p>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
            <p className="text-sm font-medium text-slate-700">
              No accounts linked yet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Tap "Link bank" to connect your first account via Teller.
              Balances will appear on Home once linked.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {groups.map((group) => (
              <li
                key={group.enrollmentId || 'orphans'}
                className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200"
              >
                <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {group.institutionName ?? 'Unknown institution'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {group.accounts.length} account
                      {group.accounts.length === 1 ? '' : 's'} ·{' '}
                      {currency.format(group.totalBalance)} · last synced{' '}
                      {formatLastSynced(group.lastSyncedAt)}
                    </p>
                  </div>
                  {group.enrollmentId && (
                    <button
                      type="button"
                      onClick={() => onUnlink(group)}
                      disabled={unlinkingId === group.enrollmentId}
                      className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {unlinkingId === group.enrollmentId
                        ? 'Unlinking…'
                        : 'Unlink'}
                    </button>
                  )}
                </header>
                <ul className="divide-y divide-slate-100">
                  {group.accounts.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-800">
                          {a.account_name ?? 'Account'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {a.account_type ?? '—'}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-medium tabular-nums text-slate-700">
                        {currency.format(Number(a.current_balance))}
                      </p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
