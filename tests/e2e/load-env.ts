import { requireDbEnv } from '../db/env'

/** Vite env for `npm run dev` during Playwright runs (local Supabase). */
export function localSupabaseViteEnv(): Record<string, string> {
  const { url, anonKey } = requireDbEnv()
  return {
    VITE_SUPABASE_URL: url,
    VITE_SUPABASE_ANON_KEY: anonKey,
  }
}
