/** Sign out locally after the app has been hidden this long (ms). */
export const BACKGROUND_SIGN_OUT_MS = 60_000

/** @deprecated Use BACKGROUND_SIGN_OUT_MS */
export const ADULT_BACKGROUND_SIGN_OUT_MS = BACKGROUND_SIGN_OUT_MS

export const PRIVACY_SHIELD_ATTR = 'data-privacy-shield'

const HIDDEN_AT_KEY = 'bucketmymoney:app-hidden-at'
const GATE_ACTIVE_KEY = 'bucketmymoney:session-gate-active'

/** True when the app was hidden long enough to require re-auth on return. */
export function shouldSignOutAfterBackground(
  hiddenAtMs: number | null,
  nowMs: number,
  thresholdMs: number = BACKGROUND_SIGN_OUT_MS,
): boolean {
  if (hiddenAtMs === null) return false
  return nowMs - hiddenAtMs >= thresholdMs
}

export function recordAppHiddenAt(atMs: number = Date.now()): void {
  try {
    sessionStorage.setItem(HIDDEN_AT_KEY, String(atMs))
  } catch {
    // private mode
  }
}

export function readAppHiddenAt(): number | null {
  try {
    const raw = sessionStorage.getItem(HIDDEN_AT_KEY)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export function clearAppHiddenAt(): void {
  try {
    sessionStorage.removeItem(HIDDEN_AT_KEY)
  } catch {
    // private mode
  }
}

export function isAppBackgroundExpired(nowMs: number = Date.now()): boolean {
  return shouldSignOutAfterBackground(readAppHiddenAt(), nowMs)
}

export function setSessionGateActive(): void {
  try {
    sessionStorage.setItem(GATE_ACTIVE_KEY, '1')
  } catch {
    // private mode
  }
}

export function clearSessionGateActive(): void {
  try {
    sessionStorage.removeItem(GATE_ACTIVE_KEY)
  } catch {
    // private mode
  }
}

export function isSessionGateActive(): boolean {
  try {
    return sessionStorage.getItem(GATE_ACTIVE_KEY) === '1'
  } catch {
    return false
  }
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
