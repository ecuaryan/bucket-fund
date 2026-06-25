import { useEffect, useMemo, useState } from 'react'
import {
  BANK_ACCOUNT_MEMBER_FALLBACK,
  BANK_ACCOUNT_SHARED_TAG,
} from '@/lib/brand'
import { bankAccountOwnerTag } from '@/lib/accounts'
import { useHideAmounts } from '@/lib/HideAmountsProvider'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import BankAccountActivity from '@/features/accounts/BankAccountActivity'

type Account = Database['public']['Tables']['accounts']['Row']

type Props = {
  /** Teller accounts visible to the viewer (already RLS-scoped per role). */
  accounts: Account[]
  viewerMemberId: string | null
  /** True when the Bank tab is the active tab (drives the activity fetch). */
  active: boolean
}

/**
 * The Bank tab body: each visible linked account with a summary header (name +
 * balance + a Shared/kid tag) and its recent activity. Adults see every family
 * account; a child sees only their own (enforced by RLS + the edge function).
 */
export default function BankAccountsTab({
  accounts,
  viewerMemberId,
  active,
}: Props) {
  const { formatMoney } = useHideAmounts()
  const [roles, setRoles] = useState<ReadonlyMap<string, string>>(new Map())
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map())

  // Only accounts assigned to someone other than the viewer need a member name
  // to label them; pool accounts tag as "Shared" without a lookup.
  const needsMemberNames = useMemo(
    () =>
      accounts.some(
        (a) => a.owner_member_id && a.owner_member_id !== viewerMemberId,
      ),
    [accounts, viewerMemberId],
  )

  useEffect(() => {
    if (!needsMemberNames) return
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
  }, [needsMemberNames])

  return (
    <div className="space-y-4">
      {accounts.map((a) => {
        const tag = bankAccountOwnerTag(a, roles, names, viewerMemberId, {
          sharedLabel: BANK_ACCOUNT_SHARED_TAG,
          fallbackName: BANK_ACCOUNT_MEMBER_FALLBACK,
        })
        return (
          <div key={a.id}>
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-zinc-200">
                    {a.account_name ?? a.institution_name ?? 'Bank account'}
                  </p>
                  {tag ? (
                    <span
                      className={
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ' +
                        (tag.kind === 'shared'
                          ? 'bg-zinc-800 text-zinc-300'
                          : 'bg-sky-500/15 text-sky-300')
                      }
                    >
                      {tag.label}
                    </span>
                  ) : null}
                </div>
                {a.institution_name && a.account_name ? (
                  <p className="truncate text-xs text-zinc-500">
                    {a.institution_name}
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 text-sm font-medium tabular-nums text-zinc-200">
                {formatMoney(Number(a.current_balance))}
              </p>
            </div>
            <BankAccountActivity
              accountId={a.id}
              panelOpen={active}
              alwaysExpanded
            />
          </div>
        )
      })}
    </div>
  )
}
