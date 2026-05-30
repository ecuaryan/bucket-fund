import type { HomeBalanceBreakdown } from '@/lib/availableBalance'
import type { Database } from '@/types/database'

type Bucket = Database['public']['Tables']['buckets']['Row']
type Account = Database['public']['Tables']['accounts']['Row']

export type HomePageCache = {
  buckets: Bucket[]
  accounts: Account[]
  breakdown: HomeBalanceBreakdown
  balanceUsesFallback: boolean
  householdAdminName: string | null
  savedAt: number
}

const CACHE_PREFIX = 'bucketfund:home:'
const MAX_AGE_MS = 5 * 60 * 1000

function cacheKey(familyId: string, memberId: string): string {
  return `${CACHE_PREFIX}${familyId}:${memberId}`
}

export function readHomeCache(
  familyId: string,
  memberId: string,
): HomePageCache | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(familyId, memberId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as HomePageCache
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(cacheKey(familyId, memberId))
      return null
    }
    if (!Array.isArray(parsed.buckets) || !Array.isArray(parsed.accounts)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeHomeCache(
  familyId: string,
  memberId: string,
  data: Omit<HomePageCache, 'savedAt'>,
): void {
  try {
    const payload: HomePageCache = { ...data, savedAt: Date.now() }
    sessionStorage.setItem(cacheKey(familyId, memberId), JSON.stringify(payload))
  } catch {
    // Quota or private mode — ignore.
  }
}
