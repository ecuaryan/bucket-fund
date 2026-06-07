import { describe, expect, it } from 'vitest'
import {
  bucketEndpointLabel,
  historyBucketMoveSubtitle,
  historySendSubtitle,
  historyMoveActorLabel,
  sendMemberEndpointLabel,
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

describe('sendMemberEndpointLabel', () => {
  it('prefers snapshot name over live join', () => {
    expect(
      sendMemberEndpointLabel({
        snapshotName: 'Alex',
        joinedName: 'New name',
        isMe: false,
      }),
    ).toBe('Alex')
  })

  it('returns You for the current member', () => {
    expect(
      sendMemberEndpointLabel({
        snapshotName: 'Jamie',
        joinedName: 'Jamie',
        isMe: true,
      }),
    ).toBe('You')
  })

  it('keeps name after member removed via snapshot', () => {
    expect(
      sendMemberEndpointLabel({
        snapshotName: 'Alex',
        joinedName: null,
        isMe: false,
      }),
    ).toBe('Alex')
  })

  it('falls back to Someone without snapshot or join', () => {
    expect(
      sendMemberEndpointLabel({
        snapshotName: null,
        joinedName: null,
        isMe: false,
      }),
    ).toBe('Someone')
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

describe('historySendSubtitle', () => {
  it('includes sender for adults', () => {
    expect(
      historySendSubtitle({
        time: '3:45 PM',
        actorMemberId: 'm1',
        actorName: 'Ryan',
        currentMemberId: 'm2',
        showActor: true,
      }),
    ).toBe('Send · by Ryan · 3:45 PM')
  })

  it('uses "you" when the viewer sent', () => {
    expect(
      historySendSubtitle({
        time: '9:00 AM',
        actorMemberId: 'm1',
        actorName: 'Ryan',
        currentMemberId: 'm1',
        showActor: true,
      }),
    ).toBe('Send · by you · 9:00 AM')
  })
})
