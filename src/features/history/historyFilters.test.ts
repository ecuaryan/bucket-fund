import { describe, expect, it } from 'vitest'
import {
  filterFromSearchParams,
  historyFilterSearchKey,
  searchParamsForFilter,
} from './historyFilters'

describe('historyFilters', () => {
  it('parses gives-only filter from URL', () => {
    expect(filterFromSearchParams(new URLSearchParams('type=give'))).toEqual({
      kind: 'give',
    })
  })

  it('prefers gives filter over bucket when both are present', () => {
    expect(
      filterFromSearchParams(new URLSearchParams('type=give&bucket=abc')),
    ).toEqual({ kind: 'give' })
  })

  it('parses bucket filter from URL', () => {
    expect(filterFromSearchParams(new URLSearchParams('bucket=abc'))).toEqual({
      kind: 'bucket',
      bucketId: 'abc',
    })
  })

  it('builds search params for active filter', () => {
    expect(searchParamsForFilter({ kind: 'all' })).toEqual({})
    expect(searchParamsForFilter({ kind: 'give' })).toEqual({ type: 'give' })
    expect(
      searchParamsForFilter({ kind: 'bucket', bucketId: 'abc' }),
    ).toEqual({ bucket: 'abc' })
  })

  it('uses URL string as stable filter key', () => {
    expect(
      historyFilterSearchKey(new URLSearchParams('type=give&bucket=ignored')),
    ).toBe('type=give&bucket=ignored')
  })
})
