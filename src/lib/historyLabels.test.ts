import { describe, expect, it } from 'vitest'
import {
  bucketEndpointLabel,
  historyBucketMoveSubtitle,
  historyMoveActorLabel,
} from '@/lib/historyLabels'

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

describe('historyMoveActorLabel', () => {
  it('returns you for the current member', () => {
    expect(
      historyMoveActorLabel({
        actorMemberId: 'm1',
        actorName: 'Jamie',
        currentMemberId: 'm1',
        showActor: true,
      }),
    ).toBe('you')
  })

  it('returns the actor name for another adult', () => {
    expect(
      historyMoveActorLabel({
        actorMemberId: 'm2',
        actorName: 'Ryan',
        currentMemberId: 'm1',
        showActor: true,
      }),
    ).toBe('Ryan')
  })

  it('is hidden for child viewers', () => {
    expect(
      historyMoveActorLabel({
        actorMemberId: 'm2',
        actorName: 'Ryan',
        currentMemberId: 'm1',
        showActor: false,
      }),
    ).toBeNull()
  })
})

describe('historyBucketMoveSubtitle', () => {
  it('includes actor for adults', () => {
    expect(
      historyBucketMoveSubtitle({
        time: '3:45 PM',
        actorMemberId: 'm2',
        actorName: 'Jamie',
        currentMemberId: 'm1',
        showActor: true,
      }),
    ).toBe('Bucket move · by Jamie · 3:45 PM')
  })

  it('omits actor when not shown', () => {
    expect(
      historyBucketMoveSubtitle({
        time: '3:45 PM',
        actorMemberId: 'm2',
        actorName: 'Jamie',
        currentMemberId: 'c1',
        showActor: false,
      }),
    ).toBe('Bucket move · 3:45 PM')
  })
})
