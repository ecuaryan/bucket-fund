/** Sign out adult sessions after the app has been hidden this long (ms). */
export const ADULT_BACKGROUND_SIGN_OUT_MS = 60_000

export function isAdultMemberRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'member'
}

/** True when the app was hidden long enough to require re-auth on return. */
export function shouldSignOutAfterBackground(
  hiddenAtMs: number | null,
  nowMs: number,
  thresholdMs: number = ADULT_BACKGROUND_SIGN_OUT_MS,
): boolean {
  if (hiddenAtMs === null) return false
  return nowMs - hiddenAtMs >= thresholdMs
}

export type BackgroundSignOutTimer = {
  start(onFire: () => void): void
  cancel(): void
}

/** Injectable timer for tests — mirrors visibilitychange + setTimeout behavior. */
export function createBackgroundSignOutTimer(
  delayMs: number,
  schedule: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>,
  clear: (id: ReturnType<typeof setTimeout>) => void,
): BackgroundSignOutTimer {
  let id: ReturnType<typeof setTimeout> | undefined

  return {
    start(onFire) {
      if (id !== undefined) clear(id)
      id = schedule(onFire, delayMs)
    },
    cancel() {
      if (id === undefined) return
      clear(id)
      id = undefined
    },
  }
}
