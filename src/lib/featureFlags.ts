/**
 * Feature flags: owner-controlled, per-household, read-only in the client.
 *
 * This module is the SOURCE OF TRUTH for which flags exist and their default
 * (off) state. The `feature_flags` DB table only stores per-household overrides
 * that the app owner sets directly in Supabase (see docs/FEATURE_FLAGS.md); an
 * absent row means "use the default here". Adding a flag = adding a registry
 * entry below — no migration needed per flag.
 *
 * Keep this module pure (no Supabase import) so the provider, any consumer, and
 * the unit test can all import it cheaply. Reads happen via
 * `useFeatureFlag(key)` from FeatureFlagsProvider.
 */
import type { Database } from '@/types/database'

export type FeatureFlagRow = Database['public']['Tables']['feature_flags']['Row']

type FeatureFlagDefinition = {
  /** Stable DB key. Never reuse or repurpose an old key. */
  key: string
  /** Short human label (operator-facing; not user copy). */
  label: string
  /** What the flag gates, for future maintainers. */
  description: string
  /** Value used when no DB row exists for a household. */
  defaultEnabled: boolean
}

/**
 * Known flags. The keys here are the only ones the app honours — a DB row with
 * an unknown key is ignored (see {@link resolveFeatureFlags}).
 */
export const FEATURE_FLAG_REGISTRY = {
  bitcoin: {
    key: 'bitcoin',
    label: 'Bitcoin',
    description:
      'Gates the Bitcoin area (holdings view for kids and any future Bitcoin screens/nav). Off for every household unless the owner enables it in Supabase.',
    defaultEnabled: false,
  },
  plaid: {
    key: 'plaid',
    label: 'Plaid',
    description:
      'Gates the Plaid bank connector (docs/BANK_PROVIDERS.md). The team has 10 LIFETIME production Items, so only the owner\u2019s household gets this; the Plaid Edge Functions re-check the flag server-side.',
    defaultEnabled: false,
  },
} as const satisfies Record<string, FeatureFlagDefinition>

export type FeatureFlagKey = keyof typeof FEATURE_FLAG_REGISTRY

export type FeatureFlags = Record<FeatureFlagKey, boolean>

const FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAG_REGISTRY) as FeatureFlagKey[]

function isFeatureFlagKey(key: string): key is FeatureFlagKey {
  return Object.prototype.hasOwnProperty.call(FEATURE_FLAG_REGISTRY, key)
}

/** The all-defaults map (every registry flag at its `defaultEnabled`). */
export function registryDefaults(): FeatureFlags {
  const defaults = {} as FeatureFlags
  for (const key of FEATURE_FLAG_KEYS) {
    defaults[key] = FEATURE_FLAG_REGISTRY[key].defaultEnabled
  }
  return defaults
}

/**
 * Merge DB rows over registry defaults. Rows whose key isn't in the registry
 * (stale/renamed) are ignored so a leftover row can never crash the app.
 */
export function resolveFeatureFlags(
  rows: readonly Pick<FeatureFlagRow, 'key' | 'enabled'>[],
): FeatureFlags {
  const flags = registryDefaults()
  for (const row of rows) {
    if (isFeatureFlagKey(row.key)) {
      flags[row.key] = row.enabled
    }
  }
  return flags
}
