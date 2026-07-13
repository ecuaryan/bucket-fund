import { isCreditCardAccountType } from '@/lib/accountTypes'
import type { Database } from '@/types/database'
import type { TellerEnrollmentMeta } from '@/lib/teller'

type Account = Database['public']['Tables']['accounts']['Row']

/** Linked provider behind a group; null for manual sources and orphans. */
export type InstitutionGroupProvider = 'teller' | 'simplefin' | null

export type InstitutionGroup = {
  groupKey: string
  institutionName: string | null
  accounts: Account[]
  /** Cash minus card balances — a card's balance counts as owed, not held. */
  totalBalance: number
  lastSyncedAt: string | null
  provider: InstitutionGroupProvider
  /** Internal enrollment id used for busy state (Teller groups). */
  primaryEnrollmentId: string
  tellerConnectEnrollmentId: string | null
  /** All Teller enrollments backing this institution (for Unlink). */
  enrollmentIds: string[]
  /** All SimpleFIN connections backing this institution (refresh/unlink). */
  simplefinConnectionIds: string[]
  /** Manual money sources (no bank link). */
  isManual: boolean
}

export function normalizeInstitutionKey(name: string | null | undefined): string {
  return (name ?? 'unknown').toLowerCase().trim()
}

type AccountSortRow = {
  id: string
  current_balance: number | string
  account_name: string | null
  account_type: string | null
}

/** A card's balance is owed — it subtracts from the group total and sorts last. */
function signedBalance(account: AccountSortRow): number {
  const balance = Number(account.current_balance)
  return isCreditCardAccountType(account.account_type) ? -balance : balance
}

/** Signed balance high → low (cards last), then account name A–Z, then id. */
export function compareAccountsByBalanceThenName(
  a: AccountSortRow,
  b: AccountSortRow,
): number {
  const balA = signedBalance(a)
  const balB = signedBalance(b)
  if (balB !== balA) return balB - balA
  const byName = (a.account_name ?? '').localeCompare(b.account_name ?? '', undefined, {
    sensitivity: 'base',
  })
  if (byName !== 0) return byName
  return a.id.localeCompare(b.id)
}

function sortAccountsByBalanceThenName<T extends AccountSortRow>(accounts: T[]): T[] {
  return [...accounts].sort(compareAccountsByBalanceThenName)
}

function compareInstitutionGroups(
  a: InstitutionGroup,
  b: InstitutionGroup,
): number {
  if (a.isManual !== b.isManual) return a.isManual ? -1 : 1
  if (a.groupKey === 'unlinked') return 1
  if (b.groupKey === 'unlinked') return -1
  if (b.totalBalance !== a.totalBalance) return b.totalBalance - a.totalBalance
  return (a.institutionName ?? '').localeCompare(b.institutionName ?? '', undefined, {
    sensitivity: 'base',
  })
}

function pickPrimaryEnrollmentId(
  accounts: Account[],
  enrollmentMeta: Map<string, TellerEnrollmentMeta>,
): string {
  const counts = new Map<string, number>()
  for (const account of accounts) {
    if (!account.teller_enrollment_id) continue
    counts.set(
      account.teller_enrollment_id,
      (counts.get(account.teller_enrollment_id) ?? 0) + 1,
    )
  }

  let primaryId = ''
  let bestCount = -1
  let bestSynced = ''
  for (const [enrollmentId, count] of counts) {
    const synced = enrollmentMeta.get(enrollmentId)?.lastSyncedAt ?? ''
    if (
      count > bestCount ||
      (count === bestCount && synced.localeCompare(bestSynced) > 0)
    ) {
      primaryId = enrollmentId
      bestCount = count
      bestSynced = synced
    }
  }
  return primaryId
}

function latestSyncedAt(accounts: Account[]): string | null {
  let latest: string | null = null
  for (const account of accounts) {
    if (account.last_synced_at && (!latest || account.last_synced_at > latest)) {
      latest = account.last_synced_at
    }
  }
  return latest
}

/**
 * Group accounts for the Admin Money sources list: manual sources first,
 * then one group per (provider, institution) — a Teller "Chase" and a
 * SimpleFIN "Chase" stay separate because their available actions differ —
 * then provider orphans (linked rows whose connection row is gone).
 */
export function groupAccountsByInstitution(
  accounts: Account[],
  enrollmentMeta: Map<string, TellerEnrollmentMeta>,
): InstitutionGroup[] {
  const byProviderInstitution = new Map<
    string,
    { provider: Exclude<InstitutionGroupProvider, null>; accounts: Account[] }
  >()
  const orphans: Account[] = []
  const manualAccounts: Account[] = []

  for (const account of accounts) {
    if (account.source === 'manual') {
      manualAccounts.push(account)
      continue
    }
    const provider: InstitutionGroupProvider =
      account.source === 'teller' && account.teller_enrollment_id
        ? 'teller'
        : account.source === 'simplefin' && account.simplefin_connection_id
          ? 'simplefin'
          : null
    if (!provider) {
      orphans.push(account)
      continue
    }
    const institutionName =
      account.institution_name ??
      (provider === 'teller'
        ? (enrollmentMeta.get(account.teller_enrollment_id as string)
            ?.institutionName ?? null)
        : null)
    const key = `${provider}:${normalizeInstitutionKey(institutionName)}`
    const bucket = byProviderInstitution.get(key)
    if (bucket) bucket.accounts.push(account)
    else byProviderInstitution.set(key, { provider, accounts: [account] })
  }

  const groups: InstitutionGroup[] = []
  for (const [groupKey, entry] of byProviderInstitution) {
    const sorted = sortAccountsByBalanceThenName(entry.accounts)
    const enrollmentIds = [
      ...new Set(
        sorted
          .map((a) => a.teller_enrollment_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ]
    const simplefinConnectionIds = [
      ...new Set(
        sorted
          .map((a) => a.simplefin_connection_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ]
    const primaryEnrollmentId = pickPrimaryEnrollmentId(sorted, enrollmentMeta)
    const primaryMeta = enrollmentMeta.get(primaryEnrollmentId)

    groups.push({
      groupKey,
      institutionName:
        sorted[0]?.institution_name ?? primaryMeta?.institutionName ?? null,
      accounts: sorted,
      totalBalance: sorted.reduce((sum, a) => sum + signedBalance(a), 0),
      lastSyncedAt: latestSyncedAt(sorted),
      provider: entry.provider,
      primaryEnrollmentId,
      tellerConnectEnrollmentId: primaryMeta?.enrollmentId ?? null,
      enrollmentIds,
      simplefinConnectionIds,
      isManual: false,
    })
  }

  if (manualAccounts.length > 0) {
    const sorted = sortAccountsByBalanceThenName(manualAccounts)
    groups.unshift({
      groupKey: 'manual',
      institutionName: null,
      accounts: sorted,
      totalBalance: sorted.reduce((sum, a) => sum + signedBalance(a), 0),
      lastSyncedAt: latestSyncedAt(sorted),
      provider: null,
      primaryEnrollmentId: '',
      tellerConnectEnrollmentId: null,
      enrollmentIds: [],
      simplefinConnectionIds: [],
      isManual: true,
    })
  }

  if (orphans.length > 0) {
    groups.push({
      groupKey: 'unlinked',
      institutionName: 'Unlinked',
      accounts: sortAccountsByBalanceThenName(orphans),
      totalBalance: orphans.reduce((sum, a) => sum + signedBalance(a), 0),
      lastSyncedAt: null,
      provider: null,
      primaryEnrollmentId: '',
      tellerConnectEnrollmentId: null,
      enrollmentIds: [],
      simplefinConnectionIds: [],
      isManual: false,
    })
  }

  groups.sort(compareInstitutionGroups)

  return groups
}
