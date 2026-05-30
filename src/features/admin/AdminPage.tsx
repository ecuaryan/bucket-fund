import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { accountAssignmentChildId } from '@/lib/accounts'
import {
  ADMIN_LINKED_ACCOUNTS_EMPTY_DETAIL,
  ADMIN_LINKED_ACCOUNTS_INTRO,
  ADMIN_LINKED_ACCOUNTS_RECONNECT_HINT,
  adminLinkedAccountsMemberGate,
} from '@/lib/brand'
import { pickHouseholdAdminName } from '@/lib/householdAdmin'
import {
  disconnectEnrollment,
  listTellerEnrollments,
  type TellerEnrollmentMeta,
  useTellerConnect,
} from '@/lib/teller'
import AccountAssignmentSelect from '@/features/admin/AccountAssignmentSelect'
import AdminAccountSection from '@/features/admin/AdminAccountSection'
import FamilyJoinSection from '@/features/admin/FamilyJoinSection'
import MembersSection from '@/features/admin/MembersSection'
import { formatAppVersion } from '@/lib/appVersion'
import { BusyOverlay } from '@/components/ui/BusyOverlay'
import type { Database } from '@/types/database'

type Account = Database['public']['Tables']['accounts']['Row']

type FamilyMemberRow = {
  id: string
  name: string
  role: string
}

type EnrollmentGroup = {
  enrollmentId: string
  tellerConnectEnrollmentId: string | null
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

function groupByEnrollment(
  accounts: Account[],
  enrollmentMeta: Map<string, TellerEnrollmentMeta>,
): EnrollmentGroup[] {
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
      const meta = enrollmentMeta.get(a.teller_enrollment_id)
      map.set(a.teller_enrollment_id, {
        enrollmentId: a.teller_enrollment_id,
        tellerConnectEnrollmentId: meta?.enrollmentId ?? null,
        institutionName: a.institution_name ?? meta?.institutionName ?? null,
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
      tellerConnectEnrollmentId: null,
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
  const [enrollmentLoadError, setEnrollmentLoadError] = useState<string | null>(
    null,
  )
  const [assignError, setAssignError] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkInfo, setLinkInfo] = useState<string | null>(null)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)
  const [reconnectingId, setReconnectingId] = useState<string | null>(null)
  const [accountsSyncing, setAccountsSyncing] = useState(false)
  const [enrollmentMeta, setEnrollmentMeta] = useState<
    Map<string, TellerEnrollmentMeta>
  >(new Map())

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

  const loadEnrollments = useCallback(async () => {
    setEnrollmentLoadError(null)
    try {
      const enrollments = await listTellerEnrollments()
      setEnrollmentMeta(new Map(enrollments.map((e) => [e.id, e])))
    } catch (e) {
      setEnrollmentLoadError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    if (!member) return
    void loadAccounts()
    void loadMembers()
    if (member.role === 'admin') {
      void loadEnrollments()
    }
  }, [member, loadAccounts, loadMembers, loadEnrollments])

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

  const householdAdminName = useMemo(
    () => pickHouseholdAdminName(members ?? []),
    [members],
  )

  const groups = useMemo(
    () => (accounts ? groupByEnrollment(accounts, enrollmentMeta) : []),
    [accounts, enrollmentMeta],
  )

  function afterLinkSuccess(count: number, verb: 'Linked' | 'Reconnected') {
    setLinkInfo(
      count === 0
        ? `${verb}, but no accounts came back. Try again.`
        : `${verb} ${count} account${count === 1 ? '' : 's'}.`,
    )
    setAccountsSyncing(true)
    void Promise.all([loadAccounts(), loadEnrollments()]).finally(() =>
      setAccountsSyncing(false),
    )
  }

  function onLink() {
    setLinkError(null)
    setLinkInfo(null)
    teller.open({
      onLinked: (result) => afterLinkSuccess(result.accounts.length, 'Linked'),
      onError: (msg) => setLinkError(msg),
    })
  }

  function onReconnect(group: EnrollmentGroup) {
    if (!group.tellerConnectEnrollmentId) {
      setLinkError('Missing enrollment id for reconnect.')
      return
    }
    setLinkError(null)
    setLinkInfo(null)
    setReconnectingId(group.enrollmentId)
    teller.open(
      {
        onLinked: (result) => {
          setReconnectingId(null)
          afterLinkSuccess(result.accounts.length, 'Reconnected')
        },
        onError: (msg) => {
          setReconnectingId(null)
          setLinkError(msg)
        },
        onExit: () => setReconnectingId(null),
      },
      { enrollmentId: group.tellerConnectEnrollmentId },
    )
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
      setAccounts((prev) =>
        prev
          ? prev.filter((a) => a.teller_enrollment_id !== group.enrollmentId)
          : prev,
      )
      setAccountsSyncing(true)
      try {
        await Promise.all([loadAccounts(), loadEnrollments()])
      } finally {
        setAccountsSyncing(false)
      }
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
        <p className="mt-1">{adminLinkedAccountsMemberGate(householdAdminName)}</p>
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

      <BusyOverlay
        busy={
          unlinkingId !== null ||
          reconnectingId !== null ||
          teller.linking ||
          accountsSyncing
        }
        label={
          teller.linking
            ? reconnectingId
              ? 'Reconnecting…'
              : 'Linking…'
            : 'Updating accounts…'
        }
      >
      <section aria-label="Linked accounts">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Linked accounts</h2>
            <p className="mt-1 text-xs text-zinc-400">
              {ADMIN_LINKED_ACCOUNTS_INTRO} {ADMIN_LINKED_ACCOUNTS_RECONNECT_HINT}
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
        {enrollmentLoadError && (
          <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/30">
            Could not load bank connection details ({enrollmentLoadError}). Linked
            accounts still appear below; Reconnect may be unavailable until this
            clears.
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
              Tap &quot;Link bank&quot; to connect one or more accounts.{' '}
              {ADMIN_LINKED_ACCOUNTS_EMPTY_DETAIL}
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
                    <div className="flex shrink-0 items-center gap-2">
                      {group.tellerConnectEnrollmentId && (
                        <button
                          type="button"
                          onClick={() => onReconnect(group)}
                          disabled={
                            !teller.ready ||
                            teller.linking ||
                            unlinkingId === group.enrollmentId ||
                            reconnectingId === group.enrollmentId
                          }
                          className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {reconnectingId === group.enrollmentId
                            ? 'Reconnecting…'
                            : 'Reconnect'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onUnlink(group)}
                        disabled={unlinkingId === group.enrollmentId}
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {unlinkingId === group.enrollmentId
                          ? 'Unlinking…'
                          : 'Unlink'}
                      </button>
                    </div>
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
      </BusyOverlay>

      <MembersSection onRosterChanged={loadMembers} />
      <FamilyJoinSection />

      <AdminAccountSection />

      <p className="pt-6 text-center text-xs text-zinc-600">
        Version {formatAppVersion()}
      </p>
    </div>
  )
}
