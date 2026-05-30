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
}

export function normalizeInstitutionKey(name: string | null | undefined): string {
  return (name ?? 'unknown').toLowerCase().trim()
}

function sortAccountsStable<T extends { created_at: string; id: string }>(
  accounts: T[],
): T[] {
  return [...accounts].sort((a, b) => {
    const byTime = a.created_at.localeCompare(b.created_at)
    if (byTime !== 0) return byTime
    return a.id.localeCompare(b.id)
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
  const orphans: Account[] = []

  for (const account of sortAccountsStable(accounts)) {
    if (!account.teller_enrollment_id) {
      orphans.push(account)
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
    const sorted = sortAccountsStable(institutionAccounts)
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
    })
  }

  groups.sort((a, b) =>
    (a.institutionName ?? '').localeCompare(b.institutionName ?? ''),
  )

  if (orphans.length > 0) {
    groups.push({
      groupKey: 'unlinked',
      institutionName: 'Unlinked',
      accounts: sortAccountsStable(orphans),
      totalBalance: orphans.reduce((sum, a) => sum + Number(a.current_balance), 0),
      lastSyncedAt: null,
      primaryEnrollmentId: '',
      tellerConnectEnrollmentId: null,
      enrollmentIds: [],
    })
  }

  return groups
}
