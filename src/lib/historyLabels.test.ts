import { describe, expect, it } from 'vitest'
import { bucketEndpointLabel } from '@/lib/historyLabels'

describe('bucketEndpointLabel', () => {
  it('prefers snapshot name over live join', () => {
    expect(
      bucketEndpointLabel({
        bucketId: 'b1',
        snapshotName: 'Old name',
        joinedName: 'New name',
      }),
    ).toBe('Old name')
  })

  it('uses live join when no snapshot', () => {
    expect(
      bucketEndpointLabel({
        bucketId: 'b1',
        snapshotName: null,
        joinedName: 'Groceries',
      }),
    ).toBe('Groceries')
  })

  it('shows Unallocated for null bucket id without snapshot', () => {
    expect(
      bucketEndpointLabel({
        bucketId: null,
        snapshotName: null,
        joinedName: null,
      }),
    ).toBe('Unallocated')
  })

  it('keeps bucket name after delete via snapshot', () => {
    expect(
      bucketEndpointLabel({
        bucketId: null,
        snapshotName: 'Groceries',
        joinedName: null,
      }),
    ).toBe('Groceries')
  })
})
