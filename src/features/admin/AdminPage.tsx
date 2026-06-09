import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LoadErrorPanel } from '@/components/ui/LoadErrorPanel'
import { formatLoadErrorMessage, withAuthLockRetry } from '@/lib/authLockError'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { accountAssignmentChildId, deleteManualAccount } from '@/lib/accounts'
import {
  ADMIN_ADD_MONEY_SOURCE_ACTION,
  ADMIN_ADD_SOURCE_LINK_OPTION,
  ADMIN_ADD_SOURCE_MANUAL_OPTION,
  ADMIN_LINKED_ACCOUNTS_EMPTY_DETAIL,
  ADMIN_LINKED_ACCOUNTS_INTRO,
  ADMIN_LINKED_ACCOUNTS_RECONNECT_HINT_PREFIX,
  ADMIN_LINKED_ACCOUNTS_RECONNECT_HINT_SUFFIX,
  ADMIN_MONEY_SOURCES_INTRO,
  ADMIN_MANUAL_GROUP_TITLE,
  ADMIN_MONEY_SOURCES_SECTION_TITLE,
  ADMIN_LINK_BANK_CONFIRM_ACTION,
  ADMIN_LINK_BANK_CONFIRM_EFFECTS,
  ADMIN_LINK_BANK_CONFIRM_SHEET_INTRO,
  ADMIN_LINK_BANK_CONFIRM_SHEET_TITLE,
  ADMIN_LINK_BANK_CONFIRM_WHAT_TO_KNOW,
  ADMIN_REMOVE_MANUAL_SOURCE_CONFIRM,
  ADMIN_REMOVE_MANUAL_SOURCE_INTRO,
  ADMIN_UNLINK_INSTITUTION_CONFIRM,
  adminLinkedAccountsMemberGate,
  adminMoneySourceGroupExpandLabel,
  adminRemoveManualSourceSheetTitle,
  adminUnlinkInstitutionSheetIntro,
  adminUnlinkInstitutionSheetTitle,
  manualSourceAddedSuccess,
  manualSourceRemovedSuccess,
  manualSourceUpdatedSuccess,
} from '@/lib/brand'
import { toast } from '@/lib/toast'
import {
  groupAccountsByInstitution,
  type InstitutionGroup,
} from '@/lib/adminLinkedAccounts'
import { pickHouseholdAdminName } from '@/lib/householdAdmin'
import {
  disconnectEnrollment,
  listTellerEnrollments,
  refreshBalances,
  type TellerEnrollmentMeta,
  useTellerConnect,
} from '@/lib/teller'
import RefreshIconButton from '@/components/ui/RefreshIconButton'
import RefreshIcon from '@/components/ui/RefreshIcon'
import AccountAssignmentSelect from '@/features/admin/AccountAssignmentSelect'
import ManualSourceDialog from '@/features/admin/ManualSourceDialog'
import AdminAccountSection from '@/features/admin/AdminAccountSection'
import FamilyJoinSection from '@/features/admin/FamilyJoinSection'
import MembersSection from '@/features/admin/MembersSection'
import AppVersionFooter from '@/components/AppVersionFooter'
import { Sheet } from '@/components/ui/Sheet'
import { useHideAmounts } from '@/lib/HideAmountsProvider'
import { BusyOverlay } from '@/components/ui/BusyOverlay'
import { LoadingStatus } from '@/components/ui/LoadingStatus'
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
  const [unlinkingKey, setUnlinkingKey] = useState<string | null>(null)
  const [reconnectingKey, setReconnectingKey] = useState<string | null>(null)
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null)
  const [accountsSyncing, setAccountsSyncing] = useState(false)
  const [enrollmentMeta, setEnrollmentMeta] = useState<
    Map<string, TellerEnrollmentMeta>
  >(new Map())
  const [enrollmentsLoaded, setEnrollmentsLoaded] = useState(false)
  const [addSourceOpen, setAddSourceOpen] = useState(false)
  const [manualDialog, setManualDialog] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; accountId: string; label: string; amount: number }
    | null
  >(null)
  const addSourceMenuRef = useRef<HTMLDivElement | null>(null)
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(
    () => new Set(),
  )
  const [linkBankConfirmOpen, setLinkBankConfirmOpen] = useState(false)
  const [removeManualTarget, setRemoveManualTarget] = useState<{
    id: string
    label: string
  } | null>(null)
  const [removingManual, setRemovingManual] = useState(false)
  const [removeManualError, setRemoveManualError] = useState<string | null>(null)
  const [unlinkTarget, setUnlinkTarget] = useState<InstitutionGroup | null>(null)

  const isAdmin = member?.role === 'admin'

  function toggleGroupExpanded(groupKey: string) {
    setExpandedGroupKeys((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }

  useEffect(() => {
    if (!addSourceOpen) return
    function onDocClick(e: MouseEvent) {
      if (!addSourceMenuRef.current) return
      if (!addSourceMenuRef.current.contains(e.target as Node)) {
        setAddSourceOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAddSourceOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [addSourceOpen])

  const loadAccounts = useCallback(async () => {
    setLoadError(null)
    try {
      await withAuthLockRetry(async () => {
        const { data, error } = await supabase
          .from('accounts')
          .select('*')
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
        if (error) throw new Error(error.message)
        setAccounts(data ?? [])
      })
    } catch (e) {
      setLoadError(formatLoadErrorMessage(e, 'Could not load accounts.'))
    }
  }, [])

  const loadMembers = useCallback(async () => {
    try {
      await withAuthLockRetry(async () => {
        const { data, error } = await supabase
          .from('family_members')
          .select('id, name, role')
          .order('created_at', { ascending: true })
        if (error) throw new Error(error.message)
        setMembers(data ?? [])
      })
    } catch (e) {
      setLoadError(formatLoadErrorMessage(e, 'Could not load household members.'))
    }
  }, [])

  const retryAdminLoad = useCallback(() => {
    void loadAccounts()
    void loadMembers()
  }, [loadAccounts, loadMembers])

  const loadEnrollments = useCallback(async () => {
    setEnrollmentLoadError(null)
    setEnrollmentsLoaded(false)
    try {
      const enrollments = await listTellerEnrollments()
      setEnrollmentMeta(new Map(enrollments.map((e) => [e.id, e])))
    } catch (e) {
      setEnrollmentLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setEnrollmentsLoaded(true)
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
    if (count === 0) {
      toast.error(`${verb}, but no accounts came back. Try again.`)
    } else {
      toast.success(`${verb} ${count} account${count === 1 ? '' : 's'}.`)
    }
    setAccountsSyncing(true)
    void Promise.all([loadAccounts(), loadEnrollments()]).finally(() =>
      setAccountsSyncing(false),
    )
  }

  function startLinkBank() {
    teller.open({
      onLinked: (result) => afterLinkSuccess(result.accounts.length, 'Linked'),
      onError: (msg) => toast.error(msg),
    })
  }

  function requestLinkBank() {
    if (hasLinkedBanks) {
      setLinkBankConfirmOpen(true)
      return
    }
    startLinkBank()
  }

  function confirmLinkBank() {
    setLinkBankConfirmOpen(false)
    startLinkBank()
  }

  function onReconnect(group: InstitutionGroup) {
    if (!group.tellerConnectEnrollmentId) {
      toast.error('Missing enrollment id for reconnect.')
      return
    }
    setReconnectingKey(group.groupKey)
    teller.open(
      {
        onLinked: (result) => {
          setReconnectingKey(null)
          afterLinkSuccess(result.accounts.length, 'Reconnected')
        },
        onError: (msg) => {
          setReconnectingKey(null)
          toast.error(msg)
        },
        onExit: () => setReconnectingKey(null),
      },
      { enrollmentId: group.tellerConnectEnrollmentId },
    )
  }

  async function onRefresh(group: InstitutionGroup) {
    if (group.enrollmentIds.length === 0) return
    setRefreshingKey(group.groupKey)
    setAccountsSyncing(true)
    try {
      await refreshBalances(group.enrollmentIds)
      await Promise.all([loadAccounts(), loadEnrollments()])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setRefreshingKey(null)
      setAccountsSyncing(false)
    }
  }

  function requestRemoveManualSource(accountId: string, label: string) {
    setRemoveManualError(null)
    setRemoveManualTarget({ id: accountId, label })
  }

  async function confirmRemoveManualSource() {
    if (!removeManualTarget) return
    setRemovingManual(true)
    setRemoveManualError(null)
    setAccountsSyncing(true)
    const removedLabel = removeManualTarget.label
    try {
      await deleteManualAccount(removeManualTarget.id)
      setRemoveManualTarget(null)
      toast.success(manualSourceRemovedSuccess(removedLabel))
      await loadAccounts()
    } catch (e) {
      setRemoveManualError(e instanceof Error ? e.message : String(e))
    } finally {
      setRemovingManual(false)
      setAccountsSyncing(false)
    }
  }

  function requestUnlinkInstitution(group: InstitutionGroup) {
    if (group.enrollmentIds.length === 0) return
    setUnlinkTarget(group)
  }

  async function confirmUnlinkInstitution() {
    if (!unlinkTarget || unlinkTarget.enrollmentIds.length === 0) return
    const group = unlinkTarget
    setUnlinkTarget(null)
    setUnlinkingKey(group.groupKey)
    try {
      let lastResult: Awaited<ReturnType<typeof disconnectEnrollment>> | null =
        null
      for (const enrollmentId of group.enrollmentIds) {
        lastResult = await disconnectEnrollment(enrollmentId)
      }
      if (lastResult?.tellerDisconnected) {
        toast.success(`Unlinked ${group.institutionName ?? 'bank'} cleanly.`)
      } else {
        toast.error(
          `Unlinked locally, but Teller-side disconnect may have failed: ${lastResult?.tellerError ?? 'unknown'}. You may want to remove this app from your bank's connected-apps list.`,
        )
      }
      setAccountsSyncing(true)
      try {
        await Promise.all([loadAccounts(), loadEnrollments()])
      } finally {
        setAccountsSyncing(false)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setUnlinkingKey(null)
    }
  }

  if (!member) {
    return <LoadingStatus label="Loading household…" className="py-8" />
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
          manualDialog === null &&
          (unlinkingKey !== null ||
            reconnectingKey !== null ||
            refreshingKey !== null ||
            teller.linking ||
            accountsSyncing)
        }
        label={
          teller.linking
            ? reconnectingKey
              ? 'Reconnecting…'
              : 'Linking…'
            : refreshingKey
              ? 'Refreshing balances…'
              : 'Updating accounts…'
        }
      >
      <section aria-label="Money sources">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">
              {ADMIN_MONEY_SOURCES_SECTION_TITLE}
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              {ADMIN_MONEY_SOURCES_INTRO}
            </p>
            {hasLinkedBanks && (
              <p className="mt-1 text-xs text-zinc-400">
                {ADMIN_LINKED_ACCOUNTS_INTRO}{' '}
                {ADMIN_LINKED_ACCOUNTS_RECONNECT_HINT_PREFIX}
                <span
                  className="mx-0.5 inline-flex align-text-bottom"
                  aria-hidden="true"
                >
                  <RefreshIcon className="h-3 w-3" />
                </span>
                {ADMIN_LINKED_ACCOUNTS_RECONNECT_HINT_SUFFIX}
              </p>
            )}
          </div>
          <div ref={addSourceMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setAddSourceOpen((v) => !v)}
              disabled={teller.linking}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ADMIN_ADD_MONEY_SOURCE_ACTION}
            </button>
            {addSourceOpen ? (
              <div className="absolute right-0 z-10 mt-1 w-max min-w-[12rem] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-lg">
                <button
                  type="button"
                  className="block w-full whitespace-nowrap px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                  onClick={() => {
                    setAddSourceOpen(false)
                    setManualDialog({ mode: 'create' })
                  }}
                >
                  {ADMIN_ADD_SOURCE_MANUAL_OPTION}
                </button>
                <button
                  type="button"
                  disabled={!teller.ready || teller.linking}
                  className="block w-full whitespace-nowrap px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                  onClick={() => {
                    setAddSourceOpen(false)
                    requestLinkBank()
                  }}
                >
                  {teller.linking ? 'Linking…' : ADMIN_ADD_SOURCE_LINK_OPTION}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {enrollmentLoadError && (
          <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/30">
            Could not load bank connection details ({enrollmentLoadError}). Linked
            accounts still appear below; Reconnect may be unavailable until this
            clears.
          </p>
        )}
        {loadError ? (
          <LoadErrorPanel
            title="Could not load money sources"
            message={loadError}
            onRetry={retryAdminLoad}
            className="rounded-lg p-3"
          />
        ) : accounts === null ? (
          <LoadingStatus label="Loading accounts…" className="py-6" />
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 p-6 text-center">
            <p className="text-sm font-medium text-zinc-300">
              No money sources yet
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Add a money source to link a bank or enter an amount manually.{' '}
              {ADMIN_LINKED_ACCOUNTS_EMPTY_DETAIL}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {groups.map((group) => {
              const expanded = expandedGroupKeys.has(group.groupKey)
              const accountsPanelId = `admin-group-${group.groupKey}-accounts`
              return (
              <li
                key={group.groupKey}
                className="overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-zinc-800"
              >
                <header
                  className={`flex items-center justify-between gap-3 px-4 py-3 ${
                    expanded ? 'border-b border-zinc-800' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleGroupExpanded(group.groupKey)}
                    aria-expanded={expanded}
                    aria-controls={accountsPanelId}
                    aria-label={adminMoneySourceGroupExpandLabel(
                      expanded,
                      group.accounts.length,
                    )}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                      className={
                        'h-4 w-4 shrink-0 text-zinc-400 motion-safe:transition-transform motion-safe:duration-200 ' +
                        (expanded ? 'rotate-180' : '')
                      }
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-300">
                        {group.isManual
                          ? ADMIN_MANUAL_GROUP_TITLE
                          : (group.institutionName ?? 'Unknown institution')}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {group.accounts.length} account
                        {group.accounts.length === 1 ? '' : 's'} ·{' '}
                        {formatMoney(group.totalBalance)} · last refreshed{' '}
                        {formatLastSynced(group.lastSyncedAt)}
                      </p>
                    </div>
                  </button>
                  {group.enrollmentIds.length > 0 && (
                    <div className="flex shrink-0 items-center gap-2">
                      <RefreshIconButton
                        busy={refreshingKey === group.groupKey}
                        disabled={
                          refreshingKey === group.groupKey ||
                          teller.linking ||
                          unlinkingKey === group.groupKey ||
                          reconnectingKey === group.groupKey
                        }
                        onClick={() => void onRefresh(group)}
                        className="text-zinc-400 hover:text-zinc-200"
                      />
                      {(group.tellerConnectEnrollmentId || !enrollmentsLoaded) && (
                        <button
                          type="button"
                          onClick={() => onReconnect(group)}
                          disabled={
                            !group.tellerConnectEnrollmentId ||
                            !teller.ready ||
                            teller.linking ||
                            unlinkingKey === group.groupKey ||
                            reconnectingKey === group.groupKey ||
                            refreshingKey === group.groupKey
                          }
                          aria-hidden={!group.tellerConnectEnrollmentId}
                          tabIndex={group.tellerConnectEnrollmentId ? 0 : -1}
                          className={`rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 ${
                            group.tellerConnectEnrollmentId ? '' : 'invisible'
                          }`}
                        >
                          {reconnectingKey === group.groupKey
                            ? 'Reconnecting…'
                            : 'Reconnect'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => requestUnlinkInstitution(group)}
                        disabled={
                          unlinkingKey === group.groupKey ||
                          refreshingKey === group.groupKey
                        }
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {unlinkingKey === group.groupKey
                          ? 'Unlinking…'
                          : 'Unlink'}
                      </button>
                    </div>
                  )}
                </header>
                {expanded ? (
                <ul
                  id={accountsPanelId}
                  className="divide-y divide-zinc-800"
                >
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
                        {group.isManual ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setManualDialog({
                                  mode: 'edit',
                                  accountId: a.id,
                                  label:
                                    a.account_name ??
                                    a.institution_name ??
                                    '',
                                  amount: Number(a.current_balance),
                                })
                              }
                              className="rounded-lg border border-zinc-600 px-2 py-1 text-xs font-semibold text-zinc-200"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                requestRemoveManualSource(
                                  a.id,
                                  a.account_name ?? 'this source',
                                )
                              }
                              className="rounded-lg border border-red-500/30 px-2 py-1 text-xs font-semibold text-red-300"
                            >
                              Remove
                            </button>
                          </>
                        ) : (
                          <AccountAssignmentSelect
                            accountId={a.id}
                            assignedChildId={accountAssignmentChildId(
                              a,
                              memberRolesById,
                            )}
                            children={childMembers}
                            onAssigned={(ownerMemberId) => {
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
                            onError={(msg) => toast.error(msg)}
                          />
                        )}
                        <p className="text-sm font-medium tabular-nums text-zinc-300">
                          {formatMoney(Number(a.current_balance))}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                ) : null}
              </li>
            )})}
          </ul>
        )}
      </section>
      </BusyOverlay>

      <ManualSourceDialog
        open={manualDialog !== null}
        mode={manualDialog?.mode ?? 'create'}
        accountId={
          manualDialog?.mode === 'edit' ? manualDialog.accountId : undefined
        }
        initialLabel={
          manualDialog?.mode === 'edit' ? manualDialog.label : undefined
        }
        initialAmount={
          manualDialog?.mode === 'edit' ? manualDialog.amount : undefined
        }
        onClose={() => setManualDialog(null)}
        onSaved={async ({ label, mode }) => {
          toast.success(
            mode === 'create'
              ? manualSourceAddedSuccess(label)
              : manualSourceUpdatedSuccess(label),
          )
          setAccountsSyncing(true)
          try {
            await loadAccounts()
          } finally {
            setAccountsSyncing(false)
          }
        }}
      />

      <Sheet
        open={linkBankConfirmOpen}
        onClose={() => setLinkBankConfirmOpen(false)}
        aria-label={ADMIN_LINK_BANK_CONFIRM_SHEET_TITLE}
      >
        <header className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-300">
            {ADMIN_LINK_BANK_CONFIRM_SHEET_TITLE}
          </h2>
          <button
            type="button"
            onClick={() => setLinkBankConfirmOpen(false)}
            className="rounded p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            {ADMIN_LINK_BANK_CONFIRM_SHEET_INTRO}
          </p>

          <div>
            <h3 className="text-sm font-medium text-zinc-300">
              {ADMIN_LINK_BANK_CONFIRM_WHAT_TO_KNOW}
            </h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-zinc-400">
              {ADMIN_LINK_BANK_CONFIRM_EFFECTS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setLinkBankConfirmOpen(false)}
              className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmLinkBank}
              className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-semibold text-black transition hover:bg-amber-400"
            >
              {ADMIN_LINK_BANK_CONFIRM_ACTION}
            </button>
          </div>
        </div>
      </Sheet>

      {removeManualTarget ? (
        <Sheet
          open
          onClose={() => {
            if (removingManual) return
            setRemoveManualTarget(null)
            setRemoveManualError(null)
          }}
          aria-label={adminRemoveManualSourceSheetTitle(removeManualTarget.label)}
        >
          <header className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-zinc-300">
              {adminRemoveManualSourceSheetTitle(removeManualTarget.label)}
            </h2>
            <button
              type="button"
              onClick={() => {
                if (removingManual) return
                setRemoveManualTarget(null)
                setRemoveManualError(null)
              }}
              disabled={removingManual}
              className="rounded p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
              aria-label="Close"
            >
              ×
            </button>
          </header>

          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              {ADMIN_REMOVE_MANUAL_SOURCE_INTRO}
            </p>

            {removeManualError ? (
              <p
                role="alert"
                className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/30"
              >
                {removeManualError}
              </p>
            ) : null}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (removingManual) return
                  setRemoveManualTarget(null)
                  setRemoveManualError(null)
                }}
                disabled={removingManual}
                className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmRemoveManualSource()}
                disabled={removingManual}
                className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
              >
                {removingManual ? 'Removing…' : ADMIN_REMOVE_MANUAL_SOURCE_CONFIRM}
              </button>
            </div>
          </div>
        </Sheet>
      ) : null}

      {unlinkTarget ? (
        <Sheet
          open
          onClose={() => setUnlinkTarget(null)}
          aria-label={adminUnlinkInstitutionSheetTitle(
            unlinkTarget.institutionName,
          )}
        >
          <header className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-zinc-300">
              {adminUnlinkInstitutionSheetTitle(unlinkTarget.institutionName)}
            </h2>
            <button
              type="button"
              onClick={() => setUnlinkTarget(null)}
              disabled={unlinkingKey !== null}
              className="rounded p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
              aria-label="Close"
            >
              ×
            </button>
          </header>

          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              {adminUnlinkInstitutionSheetIntro(
                unlinkTarget.institutionName,
                unlinkTarget.accounts.length,
              )}
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setUnlinkTarget(null)}
                disabled={unlinkingKey !== null}
                className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmUnlinkInstitution()}
                disabled={unlinkingKey !== null}
                className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
              >
                {unlinkingKey !== null ? 'Unlinking…' : ADMIN_UNLINK_INSTITUTION_CONFIRM}
              </button>
            </div>
          </div>
        </Sheet>
      ) : null}

      <MembersSection onRosterChanged={loadMembers} />
      <FamilyJoinSection />

      <AdminAccountSection />

      <AppVersionFooter />
    </div>
  )
}
