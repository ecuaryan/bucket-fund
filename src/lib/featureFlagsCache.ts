import { registryDefaults, type FeatureFlags } from '@/lib/featureFlags'

/**
 * localStorage cache of a household's resolved feature flags, so the provider
 * can render last-known values synchronously on a cold open (0 ms) and
 * revalidate in the background. This is the stale-while-revalidate that keeps
 * feature flags from ever adding latency to the critical path.
 *
 * localStorage (not sessionStorage) so a returning user gets instant flags
 * across tabs/restarts. A short max-age bounds how long a stale value can show
 * before the background fetch reconciles it (which happens within the same load
 * anyway).
 */
const CACHE_PREFIX = 'bucketmymoney:feature-flags:'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

type CachePayload = {
  flags: FeatureFlags
  savedAt: number
}

function cacheKey(familyId: string): string {
  return `${CACHE_PREFIX}${familyId}`
}

export function readFeatureFlagsCache(familyId: string): FeatureFlags | null {
  try {
    const raw = localStorage.getItem(cacheKey(familyId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachePayload
    if (
      typeof parsed?.savedAt !== 'number' ||
      Date.now() - parsed.savedAt > MAX_AGE_MS ||
      typeof parsed.flags !== 'object' ||
      parsed.flags === null
    ) {
      localStorage.removeItem(cacheKey(familyId))
      return null
    }
    // Merge over current defaults so a newly-added registry flag (not in the
    // cached payload) resolves to its default rather than undefined.
    return { ...registryDefaults(), ...parsed.flags }
  } catch {
    return null
  }
}

export function writeFeatureFlagsCache(
  familyId: string,
  flags: FeatureFlags,
): void {
  try {
    const payload: CachePayload = { flags, savedAt: Date.now() }
    localStorage.setItem(cacheKey(familyId), JSON.stringify(payload))
  } catch {
    // Quota or private mode — ignore.
  }
}
