import { supabase } from '@/lib/supabase'
import { withAuthLockRetry } from '@/lib/authLockError'
import type { FeatureFlagRow } from '@/lib/featureFlags'

/**
 * Read this household's feature-flag rows. Read-only: flags are set by the app
 * owner directly in Supabase (service role), never by the client — RLS only
 * grants SELECT to authenticated users (see the _082 migration).
 *
 * Wrapped in withAuthLockRetry for the documented mobile auth-lock transient
 * (see authLockError.ts). RLS scopes the result to the caller's family, so no
 * explicit family_id filter is needed.
 */
export async function fetchFeatureFlags(): Promise<FeatureFlagRow[]> {
  return withAuthLockRetry(async () => {
    const { data, error } = await supabase.from('feature_flags').select('*')
    if (error) throw new Error(error.message)
    return (data ?? []) as FeatureFlagRow[]
  })
}
