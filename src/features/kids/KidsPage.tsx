import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { LoadErrorPanel } from '@/components/ui/LoadErrorPanel'
import KidsPageSkeleton from '@/components/KidsPageSkeleton'
import FundKidSheet from '@/features/kids/FundKidSheet'
import ReturnKidSheet from '@/features/kids/ReturnKidSheet'
import { LinkedKidRow, VirtualKidRow } from '@/features/kids/KidMoneyRow'
import { useAuth } from '@/lib/auth'
import { formatLoadErrorMessage, withAuthLockRetry } from '@/lib/authLockError'
import {
  fetchBucketsBalanceBreakdown,
  type BucketsBalanceBreakdown,
} from '@/lib/availableBalance'
import {
  kidsEmptyVirtualBody,
  kidsGiveSuccessToast,
  kidsLinkedSectionBody,
  kidsTakeSuccessToast,
  KIDS_LINKED_ONLY_BODY,
  KIDS_LINKED_SECTION_TITLE,
  VIEW_RECENT_BANK_ACTIVITY,
  KIDS_PAGE_INTRO,
  KIDS_PAGE_TITLE,
  KIDS_VIRTUAL_SECTION_TITLE,
} from '@/lib/brand'
import { fetchHouseholdAdminName } from '@/lib/householdAdmin'
import { subscribeHouseholdRosterRefresh } from '@/lib/householdRosterRefresh'
import { formatRelativeTime } from '@/lib/relativeTime'
import { refreshBalances } from '@/lib/teller'
import RefreshIconButton from '@/components/ui/RefreshIconButton'
import { buildKidsPageModel, type VirtualKidRow as VirtualKidRowData } from '@/lib/kidsPageModel'
import { fetchLinkedChildMemberIds } from '@/lib/give'
import { toast } from '@/lib/toast'
import { supabase } from '@/lib/supabase'
import { usePostgresChanges } from '@/hooks/usePostgresChanges'
import { useHideAmounts, usePeekTarget } from '@/lib/HideAmountsProvider'
import type { Database } from '@/types/database'

type Member = Pick<
  Database['public']['Tables']['family_members']['Row'],
  'id' | 'name' | 'role'
>
type Account = Database['public']['Tables']['accounts']['Row']

export default function KidsPage() {
  const { formatMoney } = useHideAmounts()
  usePeekTarget()
  const auth = useAuth()
  const member = auth.status === 'signedIn' ? auth.member : null
  const accessToken =
    auth.status === 'signedIn' ? auth.session.access_token : null
  const familyId = member?.family_id ?? null
  const memberId = member?.id ?? null

  const [children, setChildren] = useState<Member[] | null>(null)
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [balanceBreakdown, setBalanceBreakdown] =
    useState<BucketsBalanceBreakdown | null>(null)
  const [linkedChildIds, setLinkedChildIds] = useState<Set<string> | null>(null)
  const [householdAdminName, setHouseholdAdminName] = useState<string | null>(
    null,
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fundKid, setFundKid] = useState<VirtualKidRowData | null>(null)
  const [returnKid, setReturnKid] = useState<VirtualKidRowData | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const isAdult =
    member?.role === 'admin' || member?.role === 'member'
  const isAdmin = member?.role === 'admin'

  const loadData = useCallback(async () => {
    if (!memberId || !isAdult) return
    setLoadError(null)
    try {
      await withAuthLockRetry(async () => {
        const [childrenRes, bucketsRes, accountsRes, linkedIds, adminName] =
          await Promise.all([
            supabase
              .from('family_members')
              .select('id, name, role')
              .eq('role', 'child')
              .order('name'),
            supabase.from('buckets').select('allocated_amount'),
            supabase.from('accounts').select('*'),
            fetchLinkedChildMemberIds(),
            fetchHouseholdAdminName(),
          ])
        if (childrenRes.error) throw new Error(childrenRes.error.message)
        if (bucketsRes.error) throw new Error(bucketsRes.error.message)
        if (accountsRes.error) throw new Error(accountsRes.error.message)

        const accountRows = accountsRes.data ?? []
        const { breakdown } = await fetchBucketsBalanceBreakdown({
          accounts: accountRows,
          buckets: bucketsRes.data ?? [],
        })
        setChildren(childrenRes.data ?? [])
        setAccounts(accountRows)
        setLinkedChildIds(linkedIds)
        setHouseholdAdminName(adminName)
        setBalanceBreakdown(breakdown)
      })
    } catch (e) {
      setLoadError(formatLoadErrorMessage(e, 'Could not load kids.'))
    }
  }, [memberId, isAdult])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    return subscribeHouseholdRosterRefresh(() => {
      void loadData()
    })
  }, [loadData])

  const realtimeSpecs = useMemo(() => {
    if (!familyId) return []
    return [
      {
        event: '*' as const,
        table: 'family_members',
        filter: `family_id=eq.${familyId}`,
      },
      {
        event: 'INSERT' as const,
        table: 'transactions',
        filter: `family_id=eq.${familyId}`,
      },
      {
        event: '*' as const,
        table: 'accounts',
        filter: `family_id=eq.${familyId}`,
      },
    ]
  }, [familyId])

  usePostgresChanges(
    accessToken,
    familyId ? `kids:${familyId}` : null,
    realtimeSpecs,
    loadData,
  )

  const model = useMemo(() => {
    if (!children || !accounts || !linkedChildIds || !balanceBreakdown) {
      return null
    }
    return buildKidsPageModel({
      children: children.map((child) => ({ id: child.id, name: child.name })),
      childBalances: balanceBreakdown.children,
      linkedChildIds,
      accounts,
    })
  }, [children, accounts, linkedChildIds, balanceBreakdown])

  const available = balanceBreakdown?.float ?? null
  const bankSyncedLabel = balanceBreakdown
    ? formatRelativeTime(balanceBreakdown.bankLastSyncedAt)
    : null
  const linkedOnly = Boolean(
    model && model.virtualKids.length === 0 && model.linkedKids.length > 0,
  )

  function handleGiveSuccess(kid: VirtualKidRowData, amount: number) {
    toast.success(kidsGiveSuccessToast(formatMoney(amount), kid.name))
    void loadData()
  }

  function handleTakeSuccess(kid: VirtualKidRowData, amount: number) {
    toast.success(kidsTakeSuccessToast(formatMoney(amount), kid.name))
    void loadData()
  }

  async function handleRefreshBalances() {
    setRefreshError(null)
    setSyncing(true)
    try {
      await refreshBalances()
      await loadData()
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
    }
  }

  if (!isAdult) {
    return <Navigate to="/" replace />
  }

  if (loadError) {
    return (
      <LoadErrorPanel
        title="Could not load kids"
        message={loadError}
        onRetry={() => void loadData()}
      />
    )
  }

  if (
    children === null ||
    accounts === null ||
    linkedChildIds === null ||
    balanceBreakdown === null ||
    model === null ||
    available === null
  ) {
    return <KidsPageSkeleton />
  }

  if (children.length === 0) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">{KIDS_PAGE_TITLE}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {linkedOnly ? KIDS_LINKED_ONLY_BODY : KIDS_PAGE_INTRO}
        </p>
      </header>

      {model.virtualKids.length > 0 ? (
        <section
          className="overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-zinc-800"
          aria-label={KIDS_VIRTUAL_SECTION_TITLE}
        >
          <h2 className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-300">
            {KIDS_VIRTUAL_SECTION_TITLE}
          </h2>
          <ul className="divide-y divide-zinc-800">
            {model.virtualKids.map((kid) => (
              <VirtualKidRow
                key={kid.memberId}
                kid={kid}
                formatMoney={formatMoney}
                onGive={() => setFundKid(kid)}
                onTake={() => setReturnKid(kid)}
              />
            ))}
          </ul>
        </section>
      ) : !linkedOnly ? (
        <section
          className="rounded-2xl bg-zinc-900 px-4 py-5 ring-1 ring-zinc-800"
          aria-label="No kids without a linked account"
        >
          <p className="text-sm text-zinc-400">
            {kidsEmptyVirtualBody(isAdmin, householdAdminName)}
          </p>
        </section>
      ) : null}

      {model.linkedKids.length > 0 ? (
        <section
          className="overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-zinc-800"
          aria-label={KIDS_LINKED_SECTION_TITLE}
        >
          <div className="border-b border-zinc-800 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold text-zinc-300">
                {KIDS_LINKED_SECTION_TITLE}
              </h2>
              <RefreshIconButton
                busy={syncing}
                onClick={() => void handleRefreshBalances()}
                className="-mt-0.5 text-zinc-400 hover:text-zinc-200"
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {kidsLinkedSectionBody(isAdmin, householdAdminName)}
              {bankSyncedLabel ? ` · Synced ${bankSyncedLabel}` : ''}
            </p>
            {refreshError ? (
              <p className="mt-1.5 text-[11px] text-red-300/80">
                {refreshError}
              </p>
            ) : null}
          </div>
          <ul className="divide-y divide-zinc-800">
            {model.linkedKids.map((kid) => (
              <LinkedKidRow
                key={kid.memberId}
                kid={kid}
                formatMoney={formatMoney}
              />
            ))}
          </ul>
          <div className="border-t border-zinc-800 px-4 py-3">
            <Link
              to="/?tab=account"
              className="text-xs font-semibold text-emerald-400 transition hover:text-emerald-300"
            >
              {VIEW_RECENT_BANK_ACTIVITY} →
            </Link>
          </div>
        </section>
      ) : null}

      {returnKid ? (
        <ReturnKidSheet
          kidId={returnKid.memberId}
          kidName={returnKid.name}
          available={returnKid.availableFloat}
          open
          formatMoney={formatMoney}
          onClose={() => setReturnKid(null)}
          onSuccess={(amount) => {
            handleTakeSuccess(returnKid, amount)
            setReturnKid(null)
          }}
        />
      ) : null}

      {fundKid ? (
        <FundKidSheet
          kidId={fundKid.memberId}
          kidName={fundKid.name}
          available={available}
          open
          formatMoney={formatMoney}
          onClose={() => setFundKid(null)}
          onSuccess={(amount) => {
            handleGiveSuccess(fundKid, amount)
            setFundKid(null)
          }}
        />
      ) : null}
    </div>
  )
}
