import { registerSW } from 'virtual:pwa-register'

/**
 * Register the service worker and apply updates **only when the app is in the
 * background** — never with a foreground reload that could interrupt sign-in or
 * lose in-progress work (which caused the "log in twice" on a mid-login deploy).
 *
 * Flow: a new version installs and waits (sw.ts does not skipWaiting). We hold
 * it until the next time the tab is hidden, then activate it (which reloads the
 * tab while it's backgrounded). If the user never backgrounds it, the waiting
 * worker activates on the next launch anyway. Signed-in users keep their session
 * across the reload (tokens live in sessionStorage).
 */
/** Ask the browser to look for a new service worker when the app is reopened. */
export function registerUpdateChecks(
  registration: ServiceWorkerRegistration | undefined,
): void {
  if (!registration) return
  const check = () => void registration.update().catch(() => {})
  window.addEventListener('focus', check)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
}

export function setupPwaUpdates(): void {
  let pendingUpdate = false

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // A new version is downloaded and waiting — apply it when safe.
      pendingUpdate = true
      applyIfHidden()
    },
    onRegisteredSW(_swUrl, registration) {
      registerUpdateChecks(registration)
    },
  })

  function applyIfHidden() {
    if (pendingUpdate && document.visibilityState === 'hidden') {
      pendingUpdate = false
      // updateSW(true) posts SKIP_WAITING to the waiting worker and reloads once
      // it takes control — here, while the tab is backgrounded.
      void updateSW(true)
    }
  }

  document.addEventListener('visibilitychange', applyIfHidden)
}
