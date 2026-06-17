import { describe, expect, it } from 'vitest'
import {
  pinPickerItemClass,
  pinPickerListClass,
  pinPickerRowPartnerIndex,
  pinPickerStatusLine,
  pinPickerTileClass,
  rosterHasPendingPin,
  sortJoinMembers,
} from '@/features/auth/familyLoginMembers'
import type { JoinMember } from '@/lib/memberAuth'

function member(
  overrides: Partial<JoinMember> & Pick<JoinMember, 'id' | 'name' | 'hasPin'>,
): JoinMember {
  return {
    role: 'child',
    avatarUrl: null,
    pinLocked: false,
    ...overrides,
  }
}

describe('sortJoinMembers', () => {
  it('preserves household creation order from the server', () => {
    const members = [
      member({ id: '1', name: 'Zoe', hasPin: false }),
      member({ id: '2', name: 'Amy', hasPin: true }),
      member({ id: '3', name: 'Ben', hasPin: false }),
    ]
    expect(sortJoinMembers(members)).toEqual(members)
  })
})

describe('rosterHasPendingPin', () => {
  it('is true when any member lacks a PIN', () => {
    expect(
      rosterHasPendingPin([
        member({ id: '1', name: 'Amy', hasPin: true }),
        member({ id: '2', name: 'Zoe', hasPin: false }),
      ]),
    ).toBe(true)
  })

  it('is false when every member has a PIN', () => {
    expect(
      rosterHasPendingPin([member({ id: '1', name: 'Amy', hasPin: true })]),
    ).toBe(false)
  })
})

describe('pinPicker layout', () => {
  it('centers a single member at half width', () => {
    expect(pinPickerListClass()).toContain('grid-cols-2')
    expect(pinPickerItemClass(1, 0)).toContain('col-span-2')
    expect(pinPickerTileClass(1, 0)).toContain('w-[calc(50%')
    expect(pinPickerTileClass(1, 0)).not.toContain('h-full')
  })

  it('centers the last tile when the count is odd', () => {
    expect(pinPickerItemClass(3, 2)).toContain('col-span-2')
    expect(pinPickerTileClass(3, 2)).toContain('w-[calc(50%')
    expect(pinPickerTileClass(3, 2)).not.toContain('h-full')
  })

  it('stretches paired tiles in a two-column row', () => {
    expect(pinPickerTileClass(2, 0)).toContain('h-full')
    expect(pinPickerTileClass(2, 1)).toContain('h-full')
    expect(pinPickerTileClass(2, 0)).not.toContain('justify-center')
  })
})

describe('pinPickerStatusLine', () => {
  const pendingLabel = 'PIN not set yet'

  it('reserves status height for a ready tile beside a pending tile', () => {
    const members = [
      member({ id: '1', name: 'Seed Admin', hasPin: true }),
      member({ id: '2', name: 'Bryson', hasPin: false }),
    ]
    expect(pinPickerStatusLine(members[0]!, members, 0, pendingLabel)).toEqual({
      text: pendingLabel,
      visible: false,
      tone: 'reserve',
    })
    expect(pinPickerStatusLine(members[1]!, members, 1, pendingLabel)).toEqual({
      text: pendingLabel,
      visible: true,
      tone: 'pending',
    })
  })

  it('skips reserve on ready tiles when pending member is on another row', () => {
    const members = [
      member({ id: '1', name: 'Jamie', hasPin: true }),
      member({ id: '2', name: 'Seed Admin', hasPin: true }),
      member({ id: '3', name: 'Bryson', hasPin: false }),
    ]
    expect(pinPickerStatusLine(members[0]!, members, 0, pendingLabel)).toBeNull()
    expect(pinPickerStatusLine(members[1]!, members, 1, pendingLabel)).toBeNull()
    expect(pinPickerRowPartnerIndex(3, 0)).toBe(1)
    expect(pinPickerRowPartnerIndex(3, 2)).toBeNull()
  })
})
