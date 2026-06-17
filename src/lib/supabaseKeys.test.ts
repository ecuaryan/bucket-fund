import { describe, expect, it } from 'vitest'
import { resolveSupabasePublishableKey } from './supabaseKeys'

describe('resolveSupabasePublishableKey', () => {
  it('prefers VITE_SUPABASE_PUBLISHABLE_KEY over legacy anon', () => {
    expect(
      resolveSupabasePublishableKey({
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
        VITE_SUPABASE_ANON_KEY: 'legacy-anon',
      }),
    ).toBe('sb_publishable_test')
  })

  it('falls back to VITE_SUPABASE_ANON_KEY for local Docker', () => {
    expect(
      resolveSupabasePublishableKey({
        VITE_SUPABASE_ANON_KEY: 'legacy-anon',
      }),
    ).toBe('legacy-anon')
  })

  it('throws when neither key is set', () => {
    expect(() => resolveSupabasePublishableKey({})).toThrow(
      /Missing Supabase publishable key/,
    )
  })
})
