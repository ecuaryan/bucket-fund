import { useEffect, useMemo, useState } from 'react'
import {
  ACCOUNT_CARD_OWED_SUFFIX,
  BANK_ACCOUNT_MEMBER_FALLBACK,
  BANK_ACCOUNT_SHARED_TAG,
} from '@/lib/brand'
import { bankAccountOwnerTag, isCreditCardAccount } from '@/lib/accounts'
import { useHideAmounts } from '@/lib/HideAmountsProvider'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import BankAccountActivity from '@/features/accounts/BankAccountActivity'

type Account = Database['public']['Tables']['accounts']['Row']

type Props = {
  /** Linked bank accounts visible to the viewer (already RLS-scoped per role). */
  accounts: Account[]
  viewerMemberId: string | null
  /** True when the Bank tab is the active tab (drives the activity fetch). */
  active: boolean
}

/**
 * The Bank tab body: one card per institution, one tappable row per account
 * (name + tag + balance; tapping expands recent activity inline). Adults see
 * every family account; a child sees only their own (enforced by RLS + the
 * edge functions). Household (unassigned) accounts sort first within a card,
 * then accounts assigned to a kid.
 */
export default function BankAccountsTab({
  accounts,
  viewerMemberId,
  active,
}: Props) {
  const { formatMoney } = useHideAmounts()
  const [roles, setRoles] = useState<ReadonlyMap<string, string>>(new Map())
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map())
  const [openAccountIds, setOpenAccountIds] = useState<Set<string>>(
    () => new Set(),
  )

  // Accounts assigned to someone other than the viewer (e.g. a kid). Drives
  // both the member-name lookup and whether to show tags at all — with no such
  // account there is nothing to distinguish, so a solo viewer sees no chips.
  const hasAssignedAccounts = useMemo(
    () =>
      accounts.some(
        (a) => a.owner_member_id && a.owner_member_id !== viewerMemberId,
      ),
    [accounts, viewerMemberId],
  )

  // One card per institution; within a card, household accounts first, then
  // kid-assigned. Institutions keep first-seen order from the account list.
  const institutionGroups = useMemo(() => {
    const ordered = [...accounts].sort(
      (a, b) =>
        Number(Boolean(a.owner_member_id)) - Number(Boolean(b.owner_member_id)),
    )
    const groups = new Map<string, { name: string; accounts: Account[] }>()
    for (const account of ordered) {
      const name = account.institution_name ?? 'Bank'
      const key = name.toLowerCase()
      const group = groups.get(key)
      if (group) group.accounts.push(account)
      else groups.set(key, { name, accounts: [account] })
    }
    return [...groups.values()]
  }, [accounts])

  useEffect(() => {
    if (!active) setOpenAccountIds(new Set())
  }, [active])

  useEffect(() => {
    if (!hasAssignedAccounts) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('family_members')
        .select('id, name, role')
      if (cancelled || error || !data) return
      setRoles(new Map(data.map((m) => [m.id, m.role])))
      setNames(new Map(data.map((m) => [m.id, m.name])))
    })()
    return () => {
      cancelled = true
    }
  }, [hasAssignedAccounts])

  function toggleAccount(accountId: string) {
    setOpenAccountIds((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) next.delete(accountId)
      else next.add(accountId)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {institutionGroups.map((group) => (
        <section
          key={group.name}
          aria-label={group.name}
          className="overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-zinc-800"
        >
          <h3 className="border-b border-zinc-800 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {group.name}
          </h3>
          <ul className="divide-y divide-zinc-800/70">
            {group.accounts.map((a) => {
              const tag = bankAccountOwnerTag(a, roles, names, viewerMemberId, {
                sharedLabel: BANK_ACCOUNT_SHARED_TAG,
                fallbackName: BANK_ACCOUNT_MEMBER_FALLBACK,
              })
              const open = openAccountIds.has(a.id)
              const activityPanelId = `bank-activity-${a.id}`
              return (
                <li key={a.id} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleAccount(a.id)}
                    aria-expanded={open}
                    aria-controls={activityPanelId}
                    className="flex w-full items-center justify-between gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                        className={
                          'h-4 w-4 shrink-0 text-zinc-500 motion-safe:transition-transform motion-safe:duration-200 ' +
                          (open ? 'rotate-180' : '')
                        }
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="truncate text-sm font-medium text-zinc-200">
                        {a.account_name ?? 'Bank account'}
                      </span>
                      {/* Tag only when there's a mix to disambiguate; a kid
                          tag always shows. */}
                      {tag && (tag.kind === 'member' || hasAssignedAccounts) ? (
                        <span
                          className={
                            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ' +
                            (tag.kind === 'shared'
                              ? 'bg-zinc-800 text-zinc-400'
                              : 'bg-sky-500/15 text-sky-300')
                          }
                        >
                          {tag.label}
                        </span>
                      ) : null}
                    </span>
                    {isCreditCardAccount(a) ? (
                      <span className="shrink-0 text-sm font-medium tabular-nums text-rose-300">
                        {formatMoney(Number(a.current_balance))}{' '}
                        <span className="text-xs font-normal text-rose-300/70">
                          {ACCOUNT_CARD_OWED_SUFFIX}
                        </span>
                      </span>
                    ) : (
                      <span className="shrink-0 text-sm font-medium tabular-nums text-zinc-200">
                        {formatMoney(Number(a.current_balance))}
                      </span>
                    )}
                  </button>
                  <div id={activityPanelId}>
                    <BankAccountActivity
                      accountId={a.id}
                      source={a.source}
                      open={open}
                      panelOpen={active}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
