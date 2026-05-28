import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { accountAssignmentChildId } from '@/lib/accounts'
import { ADMIN_LINKED_ACCOUNTS_INTRO, HOUSEHOLD_POOL_LABEL } from '@/lib/brand'
import { disconnectEnrollment, useTellerConnect } from '@/lib/teller'
import AccountAssignmentSelect from '@/features/admin/AccountAssignmentSelect'
import FamilyJoinSection from '@/features/admin/FamilyJoinSection'
import MembersSection from '@/features/admin/MembersSection'
import type { Database } from '@/types/database'

type Account = Database['public']['Tables']['accounts']['Row']

type FamilyMemberRow = {
  id: string
  name: string
  role: string
}

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

/** Stable list order (bulk enroll often shares the same created_at). */
function sortAccountsStable(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => {
    const byTime = a.created_at.localeCompare(b.created_at)
    if (byTime !== 0) return byTime
    return a.id.localeCompare(b.id)
  })
}

function groupByEnrollment(accounts: Account[]): EnrollmentGroup[] {
  const map = new Map<string, EnrollmentGroup>()
  const orphans: Account[] = []
  for (const a of sortAccountsStable(accounts)) {
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
  const groups = Array.from(map.values()).sort((a, b) => {
    const nameA = a.institutionName ?? ''
    const nameB = b.institutionName ?? ''
    if (nameA !== nameB) return nameA.localeCompare(nameB)
    return a.enrollmentId.localeCompare(b.enrollmentId)
  })
  for (const group of groups) {
    group.accounts = sortAccountsStable(group.accounts)
  }
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
  const [members, setMembers] = useState<FamilyMemberRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [assignError, setAssignError] = useState<string | null>(null)
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
      .order('id', { ascending: true })
    if (error) {
      setLoadError(error.message)
      return
    }
    setAccounts(data ?? [])
  }, [])

  const loadMembers = useCallback(async () => {
    const { data, error } = await supabase
      .from('family_members')
      .select('id, name, role')
      .order('created_at', { ascending: true })
    if (error) {
      setLoadError(error.message)
      return
    }
    setMembers(data ?? [])
  }, [])

  useEffect(() => {
    if (!member) return
    void loadAccounts()
    void loadMembers()
  }, [member, loadAccounts, loadMembers])

  const memberRolesById = useMemo(
    () => new Map((members ?? []).map((m) => [m.id, m.role])),
    [members],
  )

  const childMembers = useMemo(
    () =>
      (members ?? [])
        .filter((m) => m.role === 'child')
        .map((m) => ({ id: m.id, name: m.name })),
    [members],
  )

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
    return <p className="text-sm text-zinc-400">Loading household…</p>
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-200 ring-1 ring-amber-500/30">
        <p className="font-semibold">Admins only</p>
        <p className="mt-1">
          Linking bank accounts is restricted to the household admin. Ask the
          person who set up this household to add the account, then they
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
          <p className="text-xs text-zinc-400">
            Read-only bank link and household settings.
          </p>
        </div>
      </header>

      <FamilyJoinSection />
      <MembersSection onRosterChanged={loadMembers} />

      <section aria-label="Linked accounts">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Linked accounts</h2>
            <p className="mt-1 text-xs text-zinc-400">
              {ADMIN_LINKED_ACCOUNTS_INTRO}
            </p>
          </div>
          <button
            type="button"
            onClick={onLink}
            disabled={!teller.ready || teller.linking}
            className="shrink-0 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {teller.linking
              ? 'Linking…'
              : !teller.ready
                ? 'Loading…'
                : 'Link bank'}
          </button>
        </div>

        {(linkError || teller.error || assignError) && (
          <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">
            {linkError ?? teller.error ?? assignError}
          </p>
        )}
        {linkInfo && (
          <p className="mb-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 ring-1 ring-emerald-500/30">
            {linkInfo}
          </p>
        )}

        {loadError ? (
          <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300 ring-1 ring-red-500/30">
            {loadError}
          </p>
        ) : accounts === null ? (
          <p className="text-sm text-zinc-400">Loading accounts…</p>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 p-6 text-center">
            <p className="text-sm font-medium text-zinc-300">
              No accounts linked yet
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Tap &quot;Link bank&quot; to connect checking or savings.
              Balances count toward the {HOUSEHOLD_POOL_LABEL.toLowerCase()}{' '}
              until you assign an account
              to a child.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {groups.map((group) => (
              <li
                key={group.enrollmentId || 'orphans'}
                className="overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-zinc-800"
              >
                <header className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-300">
                      {group.institutionName ?? 'Unknown institution'}
                    </p>
                    <p className="text-xs text-zinc-400">
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
                      className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {unlinkingId === group.enrollmentId
                        ? 'Unlinking…'
                        : 'Unlink'}
                    </button>
                  )}
                </header>
                <ul className="divide-y divide-zinc-800">
                  {group.accounts.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-zinc-300">
                          {a.account_name ?? 'Account'}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {a.account_type ?? '—'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <AccountAssignmentSelect
                          accountId={a.id}
                          assignedChildId={accountAssignmentChildId(
                            a,
                            memberRolesById,
                          )}
                          children={childMembers}
                          onAssigned={(ownerMemberId) => {
                            setAssignError(null)
                            setAccounts((prev) =>
                              prev
                                ? prev.map((row) =>
                                    row.id === a.id
                                      ? {
                                          ...row,
                                          owner_member_id: ownerMemberId,
                                        }
                                      : row,
                                  )
                                : prev,
                            )
                          }}
                          onError={setAssignError}
                        />
                        <p className="text-sm font-medium tabular-nums text-zinc-300">
                          {currency.format(Number(a.current_balance))}
                        </p>
                      </div>
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
