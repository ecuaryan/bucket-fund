const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

/** Must match Supabase JS default storage key for this project URL. */
export const SUPABASE_AUTH_STORAGE_KEY = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`

const USER_SUFFIX = '-user'

export type AuthStorageEntries = {
  token: string | null
  user: string | null
}

export function readLegacyLocalAuthEntries(): AuthStorageEntries {
  try {
    return {
      token: localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY),
      user: localStorage.getItem(`${SUPABASE_AUTH_STORAGE_KEY}${USER_SUFFIX}`),
    }
  } catch {
    return { token: null, user: null }
  }
}

export function writeAuthEntriesToSessionStorage(entries: AuthStorageEntries): void {
  try {
    if (entries.token !== null) {
      sessionStorage.setItem(SUPABASE_AUTH_STORAGE_KEY, entries.token)
    }
    if (entries.user !== null) {
      sessionStorage.setItem(
        `${SUPABASE_AUTH_STORAGE_KEY}${USER_SUFFIX}`,
        entries.user,
      )
    }
  } catch {
    // private mode / SSR
  }
}

export function clearLegacyLocalAuthSession(): void {
  try {
    localStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY)
    localStorage.removeItem(`${SUPABASE_AUTH_STORAGE_KEY}${USER_SUFFIX}`)
  } catch {
    // private mode / SSR
  }
}

/** Clears Supabase auth from session storage and any leftover legacy local keys. */
export function clearLocalAuthSession(): void {
  try {
    sessionStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY)
    sessionStorage.removeItem(`${SUPABASE_AUTH_STORAGE_KEY}${USER_SUFFIX}`)
  } catch {
    // private mode / SSR
  }
  clearLegacyLocalAuthSession()
}
