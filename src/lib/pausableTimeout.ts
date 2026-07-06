/**
 * A setTimeout you can pause and resume. Time only elapses while running, so a
 * paused timer never fires until it is resumed and the banked time runs out.
 *
 * The toast auto-dismiss uses this so hovering, keyboard focus, an in-progress
 * swipe, or an explicit pause all hold the countdown — and the on-screen
 * progress bar can freeze in lockstep.
 *
 * `now` is injectable so tests can drive it with fake timers.
 */
export type PausableTimeout = {
  /** Start, or resume from the banked remaining time. No-op if already running. */
  resume: () => void
  /** Freeze the countdown; the remaining time is preserved. No-op if paused. */
  pause: () => void
  /** Stop for good — the callback will not fire. */
  cancel: () => void
  /** Milliseconds left before the callback fires. */
  remaining: () => number
  isPaused: () => boolean
}

export function pausableTimeout(
  durationMs: number,
  onElapsed: () => void,
  now: () => number = Date.now,
): PausableTimeout {
  let remaining = Math.max(0, durationMs)
  let startedAt = 0
  let handle: ReturnType<typeof setTimeout> | null = null
  let paused = true

  function resume() {
    if (!paused || handle) return
    paused = false
    startedAt = now()
    handle = setTimeout(() => {
      handle = null
      remaining = 0
      paused = true
      onElapsed()
    }, remaining)
  }

  function pause() {
    if (paused) return
    paused = true
    if (handle) {
      clearTimeout(handle)
      handle = null
    }
    remaining = Math.max(0, remaining - (now() - startedAt))
  }

  function cancel() {
    if (handle) {
      clearTimeout(handle)
      handle = null
    }
    paused = true
    remaining = 0
  }

  function remainingMs() {
    if (paused) return remaining
    return Math.max(0, remaining - (now() - startedAt))
  }

  return {
    resume,
    pause,
    cancel,
    remaining: remainingMs,
    isPaused: () => paused,
  }
}
