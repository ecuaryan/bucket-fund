import { registerSW } from 'virtual:pwa-register'

/**
 * Register the service worker and apply updates **only when the app has stayed
 * in the background** — never with a foreground reload that could interrupt
 * sign-in or lose in-progress work (which caused the "log in twice" on a
 * mid-login deploy).
 *
 * Flow: a new version installs and waits (sw.ts does not skipWaiting). We hold
 * it until the tab has been hidden continuously for SUSTAINED_HIDDEN_MS, then
 * activate it (which reloads the tab while it's backgrounded). If the user never
 * backgrounds it long enough, the waiting worker activates on the next launch
 * anyway. Signed-in users keep their session across the reload (tokens live in
 * sessionStorage).
 *
 * The sustained-hidden delay matters: entering a PIN routinely causes a brief
 * hide-then-show — the system keyboard, a biometric/passkey prompt, and the
 * app-switcher all flip visibility to 'hidden' for a moment. Applying on the
 * first 'hidden' event reloaded the app mid-sign-in and forced a second PIN
 * entry. Requiring the app to stay hidden cancels the apply the instant the
 * user returns, so only a real backgrounding triggers the reload.
 */

/** How long the app must stay hidden before a waiting update is applied. */
export const SUSTAINED_HIDDEN_MS = 5_000

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
  let hiddenTimer: ReturnType<typeof setTimeout> | null = null

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // A new version is downloaded and waiting — apply it once safely hidden.
      pendingUpdate = true
      scheduleApplyWhileHidden()
    },
    onRegisteredSW(_swUrl, registration) {
      registerUpdateChecks(registration)
    },
  })

  function applyNow() {
    hiddenTimer = null
    if (pendingUpdate && document.visibilityState === 'hidden') {
      pendingUpdate = false
      // updateSW(true) posts SKIP_WAITING to the waiting worker and reloads once
      // it takes control — here, while the tab is backgrounded.
      void updateSW(true)
    }
  }

  function scheduleApplyWhileHidden() {
    if (hiddenTimer !== null) return
    if (!pendingUpdate || document.visibilityState !== 'hidden') return
    hiddenTimer = setTimeout(applyNow, SUSTAINED_HIDDEN_MS)
  }

  function cancelScheduledApply() {
    if (hiddenTimer === null) return
    clearTimeout(hiddenTimer)
    hiddenTimer = null
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') scheduleApplyWhileHidden()
    else cancelScheduledApply()
  })
}
