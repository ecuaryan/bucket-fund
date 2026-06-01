import { describe, expect, it } from 'vitest'
import {
  filterFromSearchParams,
  historyFilterSearchKey,
  searchParamsForFilter,
} from './historyFilters'

describe('historyFilters', () => {
  it('parses sends-only filter from URL', () => {
    expect(filterFromSearchParams(new URLSearchParams('type=send'))).toEqual({
      kind: 'send',
    })
  })

  it('prefers sends filter over bucket when both are present', () => {
    expect(
      filterFromSearchParams(new URLSearchParams('type=send&bucket=abc')),
    ).toEqual({ kind: 'send' })
  })

  it('parses bucket filter from URL', () => {
    expect(filterFromSearchParams(new URLSearchParams('bucket=abc'))).toEqual({
      kind: 'bucket',
      bucketId: 'abc',
    })
  })

  it('builds search params for active filter', () => {
    expect(searchParamsForFilter({ kind: 'all' })).toEqual({})
    expect(searchParamsForFilter({ kind: 'send' })).toEqual({ type: 'send' })
    expect(
      searchParamsForFilter({ kind: 'bucket', bucketId: 'abc' }),
    ).toEqual({ bucket: 'abc' })
  })

  it('uses URL string as stable filter key', () => {
    expect(
      historyFilterSearchKey(new URLSearchParams('type=send&bucket=ignored')),
    ).toBe('type=send&bucket=ignored')
  })
})
