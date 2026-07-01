/** Helpers for detecting how the app is being displayed. */

type IOSNavigator = Navigator & { standalone?: boolean }

/**
 * True when the current page is running as an installed PWA (home-screen app)
 * rather than in a regular browser tab.
 *
 * Note: this only reports the *current* context. There is no reliable way to
 * detect from a browser tab whether the PWA is installed elsewhere on the
 * device — `getInstalledRelatedApps()` is Chromium-only and iOS Safari exposes
 * nothing. So a `false` result means "this is a browser tab", not "not
 * installed anywhere".
 */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as IOSNavigator).standalone === true
  return (
    iosStandalone ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}
