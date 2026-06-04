import type { SupportedStorage } from '@supabase/supabase-js'
import {
  SUPABASE_AUTH_STORAGE_KEY,
  clearLegacyLocalAuthSession,
  readLegacyLocalAuthEntries,
  writeAuthEntriesToSessionStorage,
} from '@/lib/authStorage'

/** Supabase auth tokens live in sessionStorage so a killed app does not restore a session. */
export const supabaseAuthStorage: SupportedStorage = {
  getItem(key) {
    try {
      return sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key, value) {
    try {
      sessionStorage.setItem(key, value)
    } catch {
      // private mode / restricted storage
    }
  },
  removeItem(key) {
    try {
      sessionStorage.removeItem(key)
    } catch {
      // private mode / restricted storage
    }
  },
}

export type AuthStorageBootstrapAction = 'none' | 'migrate-legacy' | 'clear-legacy'

/** Decide how to handle auth tokens still in localStorage from before session-scoped storage. */
export function getAuthStorageBootstrapAction(
  navigationType: string | undefined,
  hasLegacyLocalAuth: boolean,
  hasSessionAuth: boolean,
): AuthStorageBootstrapAction {
  if (!hasLegacyLocalAuth || hasSessionAuth) return 'none'
  return navigationType === 'reload' ? 'migrate-legacy' : 'clear-legacy'
}

function readNavigationType(): string | undefined {
  if (typeof performance === 'undefined') return undefined
  const entry = performance.getEntriesByType('navigation')[0]
  if (entry && 'type' in entry) {
    return entry.type as string
  }
  return undefined
}

export function hasSessionAuthToken(): boolean {
  try {
    return sessionStorage.getItem(SUPABASE_AUTH_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

function hasLegacyLocalAuthToken(): boolean {
  try {
    return localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

/**
 * Run once before the Supabase client reads auth state. Migrates legacy
 * localStorage sessions on tab reload; drops them on cold start (kill / reopen).
 */
export function prepareAuthStorageOnStartup(): void {
  const action = getAuthStorageBootstrapAction(
    readNavigationType(),
    hasLegacyLocalAuthToken(),
    hasSessionAuthToken(),
  )

  if (action === 'migrate-legacy') {
    const entries = readLegacyLocalAuthEntries()
    writeAuthEntriesToSessionStorage(entries)
    clearLegacyLocalAuthSession()
    return
  }

  if (action === 'clear-legacy') {
    clearLegacyLocalAuthSession()
  }
}
