import { describe, expect, it } from 'vitest'
import {
  applyAdminPageTabToSearchParams,
  parseAdminPageTab,
} from '@/lib/adminPageTabs'

describe('parseAdminPageTab', () => {
  it('defaults to money-sources', () => {
    expect(parseAdminPageTab(null)).toBe('money-sources')
    expect(parseAdminPageTab(undefined)).toBe('money-sources')
    expect(parseAdminPageTab('')).toBe('money-sources')
    expect(parseAdminPageTab('other')).toBe('money-sources')
  })

  it('parses household', () => {
    expect(parseAdminPageTab('household')).toBe('household')
  })

  it('falls back to money-sources for the removed account tab', () => {
    expect(parseAdminPageTab('account')).toBe('money-sources')
  })
})

describe('applyAdminPageTabToSearchParams', () => {
  it('sets tab without dropping unrelated params', () => {
    const prev = new URLSearchParams('foo=bar')
    const next = applyAdminPageTabToSearchParams(prev, 'household')
    expect(next.get('foo')).toBe('bar')
    expect(next.get('tab')).toBe('household')
  })

  it('removes tab param for money-sources default', () => {
    const prev = new URLSearchParams('tab=household&foo=bar')
    const next = applyAdminPageTabToSearchParams(prev, 'money-sources')
    expect(next.get('tab')).toBeNull()
    expect(next.get('foo')).toBe('bar')
  })

  it('does not mutate the input params', () => {
    const prev = new URLSearchParams('tab=account')
    applyAdminPageTabToSearchParams(prev, 'money-sources')
    expect(prev.get('tab')).toBe('account')
  })
})
