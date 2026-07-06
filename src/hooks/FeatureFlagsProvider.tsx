import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/lib/auth'
import {
  registryDefaults,
  resolveFeatureFlags,
  type FeatureFlagKey,
  type FeatureFlags,
} from '@/lib/featureFlags'
import { fetchFeatureFlags } from '@/lib/featureFlagsData'
import {
  readFeatureFlagsCache,
  writeFeatureFlagsCache,
} from '@/lib/featureFlagsCache'

const FeatureFlagsContext = createContext<FeatureFlags | null>(null)

/**
 * Feature flags for the signed-in household. Owner-controlled and read-only:
 * the app owner sets rows in Supabase; the client only reads them to decide
 * what to render (see docs/FEATURE_FLAGS.md).
 *
 * Designed to never add latency for anyone:
 *  - Seeds synchronously from the localStorage cache (or registry defaults),
 *    so the first render is instant and never awaits the network.
 *  - Fetches in the background and only then reconciles — nothing gates on it.
 *  - Holds the last resolved value across a null familyId (session
 *    revalidation) or a transient fetch failure, so a gated feature never
 *    flickers off (same stability concern as GiveRecipientsProvider/navTabs).
 *  - No Realtime subscription: flags change rarely and only for the owner's
 *    household, so a load/reload pickup keeps per-session cost at zero.
 */
function useFeatureFlagsState(): FeatureFlags {
  const auth = useAuth()
  const member = auth.status === 'signedIn' ? auth.member : null
  const familyId = member?.family_id ?? null

  const [flags, setFlags] = useState<FeatureFlags>(registryDefaults)

  // Seed from cache the moment a household is known — instant, synchronous,
  // no network. Keeps the last value if familyId is briefly null.
  useEffect(() => {
    if (!familyId) return
    const cached = readFeatureFlagsCache(familyId)
    if (cached) setFlags(cached)
  }, [familyId])

  const loadFlags = useCallback(async () => {
    if (!familyId) return // hold last value during revalidation
    try {
      const resolved = resolveFeatureFlags(await fetchFeatureFlags())
      setFlags(resolved)
      writeFeatureFlagsCache(familyId, resolved)
    } catch (err) {
      // Keep the last good value — never collapse to defaults, which would
      // flicker a gated feature off for the owner's household.
      console.error('Feature-flag refresh failed; keeping last flags', err)
    }
  }, [familyId])

  useEffect(() => {
    void loadFlags()
  }, [loadFlags])

  return flags
}

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const flags = useFeatureFlagsState()
  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFeatureFlags(): FeatureFlags {
  const value = useContext(FeatureFlagsContext)
  if (!value) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider')
  }
  return value
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  return useFeatureFlags()[key]
}

// Re-export for convenience so consumers can import the key type from the hook.
export type { FeatureFlagKey }
