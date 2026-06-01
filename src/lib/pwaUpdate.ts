/**
 * Ask the browser to check for a new service worker when the user returns.
 * Works with vite-plugin-pwa `registerType: 'autoUpdate'`, which reloads the
 * tab once the new worker is ready — users should not need pull-to-refresh.
 */
export function registerPwaUpdateChecks(
  registration: ServiceWorkerRegistration | undefined,
): void {
  if (!registration) return

  const check = () => {
    void registration.update().catch(() => {})
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
  window.addEventListener('focus', check)
}
