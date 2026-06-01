import { describe, expect, it } from 'vitest'
import { getAuthStorageBootstrapAction } from '@/lib/authPersistence'

describe('getAuthStorageBootstrapAction', () => {
  it('does nothing when session auth already exists', () => {
    expect(getAuthStorageBootstrapAction('navigate', true, true)).toBe('none')
    expect(getAuthStorageBootstrapAction('reload', true, true)).toBe('none')
  })

  it('does nothing when there is no legacy local auth', () => {
    expect(getAuthStorageBootstrapAction('navigate', false, false)).toBe('none')
    expect(getAuthStorageBootstrapAction('reload', false, false)).toBe('none')
  })

  it('migrates legacy local auth on tab reload', () => {
    expect(getAuthStorageBootstrapAction('reload', true, false)).toBe(
      'migrate-legacy',
    )
  })

  it('clears legacy local auth on cold start (navigate / back_forward)', () => {
    expect(getAuthStorageBootstrapAction('navigate', true, false)).toBe(
      'clear-legacy',
    )
    expect(getAuthStorageBootstrapAction('back_forward', true, false)).toBe(
      'clear-legacy',
    )
  })
})
