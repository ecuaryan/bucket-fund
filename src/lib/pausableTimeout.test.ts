import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pausableTimeout } from '@/lib/pausableTimeout'

describe('pausableTimeout', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('fires after the full duration when left running', () => {
    const onElapsed = vi.fn()
    const t = pausableTimeout(1000, onElapsed)
    t.resume()

    vi.advanceTimersByTime(999)
    expect(onElapsed).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onElapsed).toHaveBeenCalledTimes(1)
  })

  it('does nothing until resumed', () => {
    const onElapsed = vi.fn()
    pausableTimeout(1000, onElapsed)
    vi.advanceTimersByTime(5000)
    expect(onElapsed).not.toHaveBeenCalled()
  })

  it('holds while paused and only fires after the banked remainder', () => {
    const onElapsed = vi.fn()
    const t = pausableTimeout(1000, onElapsed)
    t.resume()

    vi.advanceTimersByTime(600)
    t.pause()
    expect(t.remaining()).toBe(400)

    // Time passes while paused — nothing should fire.
    vi.advanceTimersByTime(10_000)
    expect(onElapsed).not.toHaveBeenCalled()
    expect(t.remaining()).toBe(400)

    t.resume()
    vi.advanceTimersByTime(399)
    expect(onElapsed).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onElapsed).toHaveBeenCalledTimes(1)
  })

  it('reports the live remaining time while running', () => {
    const t = pausableTimeout(1000, vi.fn())
    t.resume()
    vi.advanceTimersByTime(250)
    expect(t.remaining()).toBe(750)
  })

  it('survives repeated pause/resume without drift', () => {
    const onElapsed = vi.fn()
    const t = pausableTimeout(1000, onElapsed)
    t.resume()
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(100)
      t.pause()
      vi.advanceTimersByTime(1000) // idle while paused
      t.resume()
    }
    // 5 × 100ms banked = 500ms elapsed; 500ms left.
    expect(t.remaining()).toBe(500)
    expect(onElapsed).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(onElapsed).toHaveBeenCalledTimes(1)
  })

  it('cancel prevents the callback', () => {
    const onElapsed = vi.fn()
    const t = pausableTimeout(1000, onElapsed)
    t.resume()
    vi.advanceTimersByTime(500)
    t.cancel()
    vi.advanceTimersByTime(5000)
    expect(onElapsed).not.toHaveBeenCalled()
  })
})
