import type { Database } from '@/types/database'
import type { TellerEnrollmentMeta } from '@/lib/teller'

type Account = Database['public']['Tables']['accounts']['Row']

export type InstitutionGroup = {
  groupKey: string
  institutionName: string | null
  accounts: Account[]
  totalBalance: number
  lastSyncedAt: string | null
  /** Internal enrollment id used for Reconnect / busy state. */
  primaryEnrollmentId: string
  tellerConnectEnrollmentId: string | null
  /** All enrollments backing this institution (for Unlink). */
  enrollmentIds: string[]
  /** Manual money sources (no Teller enrollment). */
  isManual: boolean
}

export function normalizeInstitutionKey(name: string | null | undefined): string {
  return (name ?? 'unknown').toLowerCase().trim()
}

type AccountSortRow = {
  id: string
  current_balance: number | string
  account_name: string | null
}

/** Balance high → low, then account name A–Z, then id for stability. */
export function compareAccountsByBalanceThenName(
  a: AccountSortRow,
  b: AccountSortRow,
): number {
  const balA = Number(a.current_balance)
  const balB = Number(b.current_balance)
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

export function groupAccountsByInstitution(
  accounts: Account[],
  enrollmentMeta: Map<string, TellerEnrollmentMeta>,
): InstitutionGroup[] {
  const byInstitution = new Map<string, Account[]>()
  const tellerOrphans: Account[] = []
  const manualAccounts: Account[] = []

  for (const account of accounts) {
    if (account.source === 'manual') {
      manualAccounts.push(account)
      continue
    }
    if (!account.teller_enrollment_id) {
      tellerOrphans.push(account)
      continue
    }
    const meta = enrollmentMeta.get(account.teller_enrollment_id)
    const institutionName =
      account.institution_name ?? meta?.institutionName ?? null
    const key = normalizeInstitutionKey(institutionName)
    const bucket = byInstitution.get(key)
    if (bucket) bucket.push(account)
    else byInstitution.set(key, [account])
  }

  const groups: InstitutionGroup[] = []
  for (const [groupKey, institutionAccounts] of byInstitution) {
    const sorted = sortAccountsByBalanceThenName(institutionAccounts)
    const enrollmentIds = [
      ...new Set(
        sorted
          .map((a) => a.teller_enrollment_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ]
    const primaryEnrollmentId = pickPrimaryEnrollmentId(sorted, enrollmentMeta)
    const primaryMeta = enrollmentMeta.get(primaryEnrollmentId)
    let lastSyncedAt: string | null = null
    let totalBalance = 0
    for (const account of sorted) {
      totalBalance += Number(account.current_balance)
      if (
        account.last_synced_at &&
        (!lastSyncedAt || account.last_synced_at > lastSyncedAt)
      ) {
        lastSyncedAt = account.last_synced_at
      }
    }

    groups.push({
      groupKey,
      institutionName: sorted[0]?.institution_name ?? primaryMeta?.institutionName ?? null,
      accounts: sorted,
      totalBalance,
      lastSyncedAt,
      primaryEnrollmentId,
      tellerConnectEnrollmentId: primaryMeta?.enrollmentId ?? null,
      enrollmentIds,
      isManual: false,
    })
  }

  if (manualAccounts.length > 0) {
    const sorted = sortAccountsByBalanceThenName(manualAccounts)
    let lastSyncedAt: string | null = null
    let totalBalance = 0
    for (const account of sorted) {
      totalBalance += Number(account.current_balance)
      if (
        account.last_synced_at &&
        (!lastSyncedAt || account.last_synced_at > lastSyncedAt)
      ) {
        lastSyncedAt = account.last_synced_at
      }
    }
    groups.unshift({
      groupKey: 'manual',
      institutionName: null,
      accounts: sorted,
      totalBalance,
      lastSyncedAt,
      primaryEnrollmentId: '',
      tellerConnectEnrollmentId: null,
      enrollmentIds: [],
      isManual: true,
    })
  }

  if (tellerOrphans.length > 0) {
    groups.push({
      groupKey: 'unlinked',
      institutionName: 'Unlinked',
      accounts: sortAccountsByBalanceThenName(tellerOrphans),
      totalBalance: tellerOrphans.reduce(
        (sum, a) => sum + Number(a.current_balance),
        0,
      ),
      lastSyncedAt: null,
      primaryEnrollmentId: '',
      tellerConnectEnrollmentId: null,
      enrollmentIds: [],
      isManual: false,
    })
  }

  groups.sort(compareInstitutionGroups)

  return groups
}
