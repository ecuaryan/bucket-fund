import {
  clearSessionGateOverlay,
  showSessionGateOverlay,
} from '@/lib/backgroundPrivacyShield'
import {
  clearAppHiddenAt,
  clearSessionGateActive,
  setSessionGateActive,
} from '@/lib/backgroundSignOut'
import { clearLocalAuthSession } from '@/lib/authStorage'
import { clearAllHomeCaches } from '@/lib/homeCache'

/** Sync cleanup when the 60s background policy expires (tokens + caches; keep gate visible). */
export function runExpiredBackgroundCleanup(): void {
  clearLocalAuthSession()
  clearAllHomeCaches()
  setSessionGateActive()
  showSessionGateOverlay()
}

/** Full reset after sign-out or short visible return. */
export function clearBackgroundPrivacyState(): void {
  clearAppHiddenAt()
  clearSessionGateActive()
  clearSessionGateOverlay()
}
