/** Client-safe Supabase API key (publishable preferred; legacy anon fallback). */
export function resolveSupabasePublishableKey(env: {
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
  VITE_SUPABASE_ANON_KEY?: string
}): string {
  const publishable = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (publishable) return publishable

  const legacy = env.VITE_SUPABASE_ANON_KEY?.trim()
  if (legacy) return legacy

  throw new Error(
    'Missing Supabase publishable key. Set VITE_SUPABASE_PUBLISHABLE_KEY (preferred) or VITE_SUPABASE_ANON_KEY in .env.local.',
  )
}
