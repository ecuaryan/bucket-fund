import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { accountAssignmentChildId } from '@/lib/accounts'
import {
  ADMIN_LINKED_ACCOUNTS_EMPTY_DETAIL,
  ADMIN_LINKED_ACCOUNTS_INTRO,
  ADMIN_LINKED_ACCOUNTS_RECONNECT_HINT,
  adminLinkBankConfirmMessage,
  adminLinkedAccountsMemberGate,
  adminUnlinkInstitutionConfirm,
} from '@/lib/brand'
import {
  groupAccountsByInstitution,
  type InstitutionGroup,
} from '@/lib/adminLinkedAccounts'
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
import { useHideAmounts } from '@/lib/HideAmountsProvider'
import { BusyOverlay } from '@/components/ui/BusyOverlay'
import type { Database } from '@/types/database'

type Account = Database['public']['Tables']['accounts']['Row']

type FamilyMemberRow = {
  id: string
  name: string
  role: string
}

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

export default function AdminPage() {
  const { formatMoney } = useHideAmounts()
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
  const [unlinkingKey, setUnlinkingKey] = useState<string | null>(null)
  const [reconnectingKey, setReconnectingKey] = useState<string | null>(null)
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
    () =>
      accounts ? groupAccountsByInstitution(accounts, enrollmentMeta) : [],
    [accounts, enrollmentMeta],
  )

  const hasLinkedBanks = useMemo(
    () => groups.some((group) => group.enrollmentIds.length > 0),
    [groups],
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
    if (hasLinkedBanks && !window.confirm(adminLinkBankConfirmMessage())) {
      return
    }
    setLinkError(null)
    setLinkInfo(null)
    teller.open({
      onLinked: (result) => afterLinkSuccess(result.accounts.length, 'Linked'),
      onError: (msg) => setLinkError(msg),
    })
  }

  function onReconnect(group: InstitutionGroup) {
    if (!group.tellerConnectEnrollmentId) {
      setLinkError('Missing enrollment id for reconnect.')
      return
    }
    setLinkError(null)
    setLinkInfo(null)
    setReconnectingKey(group.groupKey)
    teller.open(
      {
        onLinked: (result) => {
          setReconnectingKey(null)
          afterLinkSuccess(result.accounts.length, 'Reconnected')
        },
        onError: (msg) => {
          setReconnectingKey(null)
          setLinkError(msg)
        },
        onExit: () => setReconnectingKey(null),
      },
      { enrollmentId: group.tellerConnectEnrollmentId },
    )
  }

  async function onUnlink(group: InstitutionGroup) {
    if (group.enrollmentIds.length === 0) return
    const ok = window.confirm(
      adminUnlinkInstitutionConfirm(group.institutionName, group.accounts.length),
    )
    if (!ok) return

    setUnlinkingKey(group.groupKey)
    setLinkError(null)
    setLinkInfo(null)
    try {
      let lastResult: Awaited<ReturnType<typeof disconnectEnrollment>> | null =
        null
      for (const enrollmentId of group.enrollmentIds) {
        lastResult = await disconnectEnrollment(enrollmentId)
      }
      setLinkInfo(
        lastResult?.tellerDisconnected
          ? `Unlinked ${group.institutionName ?? 'bank'} cleanly.`
          : `Unlinked locally, but Teller-side disconnect may have failed: ${lastResult?.tellerError ?? 'unknown'}. You may want to remove this app from your bank's connected-apps list.`,
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
      setUnlinkingKey(null)
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
          unlinkingKey !== null ||
          reconnectingKey !== null ||
          teller.linking ||
          accountsSyncing
        }
        label={
          teller.linking
            ? reconnectingKey
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
                key={group.groupKey}
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
                      {formatMoney(group.totalBalance)} · last synced{' '}
                      {formatLastSynced(group.lastSyncedAt)}
                    </p>
                  </div>
                  {group.enrollmentIds.length > 0 && (
                    <div className="flex shrink-0 items-center gap-2">
                      {group.tellerConnectEnrollmentId && (
                        <button
                          type="button"
                          onClick={() => onReconnect(group)}
                          disabled={
                            !teller.ready ||
                            teller.linking ||
                            unlinkingKey === group.groupKey ||
                            reconnectingKey === group.groupKey
                          }
                          className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {reconnectingKey === group.groupKey
                            ? 'Reconnecting…'
                            : 'Reconnect'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onUnlink(group)}
                        disabled={unlinkingKey === group.groupKey}
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {unlinkingKey === group.groupKey
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
                          {formatMoney(Number(a.current_balance))}
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
