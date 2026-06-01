/** Check for a waiting service worker when the user returns to the app. */
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
