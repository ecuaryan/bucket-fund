import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from '@/lib/relativeTime'

const NOW = Date.parse('2026-06-01T12:00:00Z')

describe('formatRelativeTime', () => {
  it('returns null for missing or invalid input', () => {
    expect(formatRelativeTime(null, NOW)).toBeNull()
    expect(formatRelativeTime(undefined, NOW)).toBeNull()
    expect(formatRelativeTime('not-a-date', NOW)).toBeNull()
  })

  it('shows "just now" for very recent and small future skew', () => {
    expect(formatRelativeTime('2026-06-01T11:59:30Z', NOW)).toBe('just now')
    expect(formatRelativeTime('2026-06-01T12:00:10Z', NOW)).toBe('just now')
  })

  it('shows minutes within the hour', () => {
    expect(formatRelativeTime('2026-06-01T11:55:00Z', NOW)).toBe('5m ago')
    expect(formatRelativeTime('2026-06-01T11:01:00Z', NOW)).toBe('59m ago')
  })

  it('shows hours within the day', () => {
    expect(formatRelativeTime('2026-06-01T09:00:00Z', NOW)).toBe('3h ago')
  })

  it('shows days within the week', () => {
    expect(formatRelativeTime('2026-05-30T12:00:00Z', NOW)).toBe('2d ago')
  })

  it('falls back to a date string beyond a week', () => {
    const label = formatRelativeTime('2026-05-01T12:00:00Z', NOW)
    expect(label).not.toBeNull()
    expect(label).not.toMatch(/ago|just now/)
  })
})
