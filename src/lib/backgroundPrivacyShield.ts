import {
  clearAppHiddenAt,
  clearSessionGateActive,
  isAppBackgroundExpired,
  isSessionGateActive,
  PRIVACY_SHIELD_ATTR,
  recordAppHiddenAt,
  setSessionGateActive,
} from '@/lib/backgroundSignOut'
import { hasSessionAuthToken } from '@/lib/authPersistence'

export const SESSION_GATE_OVERLAY_ID = 'session-gate-overlay'

export function showSessionGateOverlay(): void {
  document.documentElement.setAttribute(PRIVACY_SHIELD_ATTR, '1')
  const el = document.getElementById(SESSION_GATE_OVERLAY_ID)
  if (el) el.hidden = false
}

export function clearSessionGateOverlay(): void {
  document.documentElement.removeAttribute(PRIVACY_SHIELD_ATTR)
  const el = document.getElementById(SESSION_GATE_OVERLAY_ID)
  if (el) el.hidden = true
}

export function isSessionGateOverlayVisible(): boolean {
  return document.documentElement.hasAttribute(PRIVACY_SHIELD_ATTR)
}

/** Clears hidden-at, gate flag, and DOM overlay (not auth tokens or home cache). */
export function clearBackgroundPrivacyFlags(): void {
  clearAppHiddenAt()
  clearSessionGateActive()
  clearSessionGateOverlay()
}

function onDocumentHidden(): void {
  if (!hasSessionAuthToken()) return
  recordAppHiddenAt()
  setSessionGateActive()
  showSessionGateOverlay()
}

function shouldKeepGateWithoutAuthToken(): boolean {
  return isAppBackgroundExpired() || isSessionGateActive()
}

function onDocumentVisible(): void {
  if (!hasSessionAuthToken()) {
    if (shouldKeepGateWithoutAuthToken()) {
      showSessionGateOverlay()
      return
    }
    clearBackgroundPrivacyFlags()
    return
  }
  if (isAppBackgroundExpired()) {
    showSessionGateOverlay()
    return
  }
  clearBackgroundPrivacyFlags()
}

function onPageShow(event: PageTransitionEvent): void {
  if (!hasSessionAuthToken()) {
    if (shouldKeepGateWithoutAuthToken()) {
      showSessionGateOverlay()
    }
    return
  }
  if (event.persisted || isAppBackgroundExpired() || isSessionGateActive()) {
    showSessionGateOverlay()
  }
}

/** Register before React mounts — covers hide/return and BFCache without waiting on hooks. */
export function registerBackgroundPrivacyShield(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      onDocumentHidden()
    } else {
      onDocumentVisible()
    }
  })

  window.addEventListener('pageshow', onPageShow)

  if (document.visibilityState === 'hidden' && hasSessionAuthToken()) {
    onDocumentHidden()
  }
}
