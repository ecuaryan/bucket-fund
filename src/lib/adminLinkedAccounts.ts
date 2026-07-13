import { isCreditCardAccountType } from '@/lib/accountTypes'
import type { Database } from '@/types/database'
import type { TellerEnrollmentMeta } from '@/lib/teller'
import type { PlaidItemMeta } from '@/lib/plaid'

type Account = Database['public']['Tables']['accounts']['Row']

/** Linked provider behind a group; null for manual sources and orphans. */
export type InstitutionGroupProvider = 'teller' | 'simplefin' | 'plaid' | null

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
  /** All SimpleFIN connections backing this group (refresh/unlink). */
  simplefinConnectionIds: string[]
  /** All Plaid Items backing this group (refresh/reconnect/unlink). */
  plaidItemIds: string[]
  /** Plaid: the Item needs a Link update-mode repair. */
  plaidReconnectRequired: boolean
  /**
   * True when one SimpleFIN connection covers several institutions — rows
   * then show their own institution so the mix stays readable.
   */
  spansInstitutions: boolean
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
 * then one group per linked unit, then provider orphans (linked rows whose
 * connection row is gone).
 *
 * The grouping unit matches what Unlink actually removes: for Teller that
 * is the institution (one enrollment per bank); for SimpleFIN it is the
 * **connection** (one Setup Token can cover several banks — SimpleFIN has
 * no per-bank revoke, so a per-bank card would promise an unlink scope we
 * can't deliver). A multi-bank connection titles itself with the joined
 * institution names.
 */
export function groupAccountsByInstitution(
  accounts: Account[],
  enrollmentMeta: Map<string, TellerEnrollmentMeta>,
  plaidItemMeta: Map<string, PlaidItemMeta> = new Map(),
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
          : account.source === 'plaid' && account.plaid_item_id
            ? 'plaid'
            : null
    if (!provider) {
      orphans.push(account)
      continue
    }
    // Teller groups by institution (one enrollment per bank); SimpleFIN
    // groups by connection and Plaid by Item — the units Unlink actually
    // operates on.
    const key =
      provider === 'simplefin'
        ? `simplefin:${account.simplefin_connection_id}`
        : provider === 'plaid'
          ? `plaid:${account.plaid_item_id}`
          : `teller:${normalizeInstitutionKey(
              account.institution_name ??
                enrollmentMeta.get(account.teller_enrollment_id as string)
                  ?.institutionName ??
                null,
            )}`
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
    const plaidItemIds = [
      ...new Set(
        sorted
          .map((a) => a.plaid_item_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ]
    const primaryEnrollmentId = pickPrimaryEnrollmentId(sorted, enrollmentMeta)
    const primaryMeta = enrollmentMeta.get(primaryEnrollmentId)
    const primaryPlaidMeta = plaidItemMeta.get(plaidItemIds[0] ?? '')
    // Distinct institutions in first-seen order; a multi-bank SimpleFIN
    // connection reads "Ally Bank · Robinhood".
    const institutionNames = [
      ...new Set(
        sorted
          .map((a) => a.institution_name)
          .filter((name): name is string => Boolean(name)),
      ),
    ]

    groups.push({
      groupKey,
      institutionName:
        institutionNames.length > 0
          ? institutionNames.join(' · ')
          : (primaryMeta?.institutionName ??
            primaryPlaidMeta?.institutionName ??
            null),
      accounts: sorted,
      totalBalance: sorted.reduce((sum, a) => sum + signedBalance(a), 0),
      lastSyncedAt: latestSyncedAt(sorted),
      provider: entry.provider,
      primaryEnrollmentId,
      tellerConnectEnrollmentId: primaryMeta?.enrollmentId ?? null,
      enrollmentIds,
      simplefinConnectionIds,
      plaidItemIds,
      plaidReconnectRequired:
        primaryPlaidMeta?.status === 'reconnect_required',
      spansInstitutions: institutionNames.length > 1,
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
      plaidItemIds: [],
      plaidReconnectRequired: false,
      spansInstitutions: false,
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
      plaidItemIds: [],
      plaidReconnectRequired: false,
      spansInstitutions: false,
      isManual: false,
    })
  }

  groups.sort(compareInstitutionGroups)

  return groups
}
