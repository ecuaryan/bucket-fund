/**
 * Standalone PWA minimize shield
 *
 * On Android, Chrome’s swipe-home animation snapshots the live WebView layer tree.
 * That snapshot can flash white around chrome (header logo, blurred surfaces) even
 * when theme-color, #root, maskable icons, and shell CSS are correct.
 *
 * When the installed app backgrounds, paint an immediate full-screen black layer
 * so any frame the compositor grabs after `visibilitychange` is black. This does
 * not replace the session privacy gate — that overlay stays on top for signed-in
 * users and is unchanged.
 *
 * Scope: installed PWA only (`display-mode: standalone`). Browser tabs are unaffected.
 * Limitation: white drawn by the OS outside the WebView may still appear; this only
 * covers in-document surfaces.
 */

/** DOM id for the shield node declared in index.html. */
export const PWA_HIDE_SHIELD_ID = 'pwa-hide-shield'

/** True when the app runs as an installed PWA, not a browser tab. */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // Legacy iOS Safari “Add to Home Screen”.
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function showPwaHideShield(): void {
  document.getElementById(PWA_HIDE_SHIELD_ID)?.removeAttribute('hidden')
}

export function hidePwaHideShield(): void {
  const el = document.getElementById(PWA_HIDE_SHIELD_ID)
  if (el) el.hidden = true
}

export function isPwaHideShieldVisible(): boolean {
  const el = document.getElementById(PWA_HIDE_SHIELD_ID)
  return el != null && !el.hidden
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    showPwaHideShield()
    return
  }
  hidePwaHideShield()
}

let visibilityListener: AbortController | undefined

/** Register before React mounts — same timing as backgroundPrivacyShield. */
export function registerPwaHideShield(): void {
  visibilityListener?.abort()
  visibilityListener = undefined

  if (!isStandalonePwa()) return

  visibilityListener = new AbortController()
  document.addEventListener('visibilitychange', onVisibilityChange, {
    signal: visibilityListener.signal,
  })

  if (document.visibilityState === 'hidden') {
    showPwaHideShield()
  }
}
