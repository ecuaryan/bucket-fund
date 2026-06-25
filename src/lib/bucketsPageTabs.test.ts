import { describe, expect, it } from 'vitest'
import {
  applyBucketsPageTabToSearchParams,
  bucketsPageTabOptions,
  isAutoOrganizeTabAvailabilityPending,
  parseBucketsPageTab,
  resolveBucketsPageTab,
  shouldShowAutoOrganizeTab,
} from '@/lib/bucketsPageTabs'

describe('parseBucketsPageTab', () => {
  it('defaults to buckets', () => {
    expect(parseBucketsPageTab(null)).toBe('buckets')
    expect(parseBucketsPageTab(undefined)).toBe('buckets')
    expect(parseBucketsPageTab('')).toBe('buckets')
    expect(parseBucketsPageTab('other')).toBe('buckets')
  })

  it('parses auto-organize', () => {
    expect(parseBucketsPageTab('auto-organize')).toBe('auto-organize')
  })

  it('parses account', () => {
    expect(parseBucketsPageTab('account')).toBe('account')
  })
})

describe('resolveBucketsPageTab', () => {
  it('falls back to buckets when auto-organize tab is unavailable', () => {
    expect(
      resolveBucketsPageTab('auto-organize', { autoOrganize: false, account: false }),
    ).toBe('buckets')
  })

  it('keeps auto-organize when available', () => {
    expect(
      resolveBucketsPageTab('auto-organize', { autoOrganize: true, account: false }),
    ).toBe('auto-organize')
  })

  it('falls back to buckets when account tab is unavailable', () => {
    expect(
      resolveBucketsPageTab('account', { autoOrganize: false, account: false }),
    ).toBe('buckets')
  })

  it('keeps account when available', () => {
    expect(
      resolveBucketsPageTab('account', { autoOrganize: false, account: true }),
    ).toBe('account')
  })
})

describe('bucketsPageTabOptions', () => {
  it('returns only buckets when no optional tabs are available', () => {
    const opts = bucketsPageTabOptions({ showAutoOrganize: false, showAccount: false })
    expect(opts.map((o) => o.value)).toEqual(['buckets'])
  })

  it('appends optional tabs in order: buckets, auto-organize, account', () => {
    const opts = bucketsPageTabOptions({ showAutoOrganize: true, showAccount: true })
    expect(opts.map((o) => o.value)).toEqual([
      'buckets',
      'auto-organize',
      'account',
    ])
  })

  it('includes only the account tab for a linked child', () => {
    const opts = bucketsPageTabOptions({ showAutoOrganize: false, showAccount: true })
    expect(opts.map((o) => o.value)).toEqual(['buckets', 'account'])
  })
})

describe('shouldShowAutoOrganizeTab', () => {
  it('hides from children', () => {
    expect(shouldShowAutoOrganizeTab(false, true, true)).toBe(false)
  })

  it('shows for admin even before availability resolves', () => {
    expect(shouldShowAutoOrganizeTab(true, true, null)).toBe(true)
  })

  it('shows for shared member only when rules exist', () => {
    expect(shouldShowAutoOrganizeTab(true, false, null)).toBe(false)
    expect(shouldShowAutoOrganizeTab(true, false, false)).toBe(false)
    expect(shouldShowAutoOrganizeTab(true, false, true)).toBe(true)
  })
})

describe('isAutoOrganizeTabAvailabilityPending', () => {
  it('waits only for shared members who can see auto-organize', () => {
    expect(isAutoOrganizeTabAvailabilityPending(true, false, null)).toBe(true)
    expect(isAutoOrganizeTabAvailabilityPending(true, false, true)).toBe(
      false,
    )
    expect(isAutoOrganizeTabAvailabilityPending(true, true, null)).toBe(false)
    expect(isAutoOrganizeTabAvailabilityPending(false, false, null)).toBe(
      false,
    )
  })
})

describe('applyBucketsPageTabToSearchParams', () => {
  it('sets tab without dropping unrelated params', () => {
    const prev = new URLSearchParams('foo=bar')
    const next = applyBucketsPageTabToSearchParams(prev, 'auto-organize')
    expect(next.get('foo')).toBe('bar')
    expect(next.get('tab')).toBe('auto-organize')
  })

  it('removes tab param for buckets default', () => {
    const prev = new URLSearchParams('tab=auto-organize&foo=bar')
    const next = applyBucketsPageTabToSearchParams(prev, 'buckets')
    expect(next.get('tab')).toBeNull()
    expect(next.get('foo')).toBe('bar')
  })

  it('sets the account tab param', () => {
    const prev = new URLSearchParams('foo=bar')
    const next = applyBucketsPageTabToSearchParams(prev, 'account')
    expect(next.get('tab')).toBe('account')
    expect(next.get('foo')).toBe('bar')
  })

  it('does not mutate the input params', () => {
    const prev = new URLSearchParams('tab=auto-organize')
    applyBucketsPageTabToSearchParams(prev, 'buckets')
    expect(prev.get('tab')).toBe('auto-organize')
  })
})
