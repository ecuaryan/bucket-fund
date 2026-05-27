import { supabaseUrl } from '@/lib/supabase'

/** Must match Supabase JS default storage key for this project URL. */
export const SUPABASE_AUTH_STORAGE_KEY = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`

export function clearLocalAuthSession(): void {
  try {
    localStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY)
    localStorage.removeItem(`${SUPABASE_AUTH_STORAGE_KEY}-user`)
  } catch {
    // private mode / SSR
  }
}
