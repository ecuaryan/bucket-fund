import { describe, expect, it } from 'vitest'
import {
  filterGiveRecipients,
  isLinkedChild,
  shouldShowKidsNav,
  shouldShowGiveNav,
} from '@/lib/giveRecipients'

const roster = [
  { id: 'a', name: 'Admin', role: 'admin' },
  { id: 'm', name: 'Spouse', role: 'member' },
  { id: 'c', name: 'Kid', role: 'child' },
  { id: 'c2', name: 'Kid2', role: 'child' },
]

const linked = new Set(['c2'])

describe('isLinkedChild', () => {
  it('true only for linked children', () => {
    expect(isLinkedChild('c2', 'child', linked)).toBe(true)
    expect(isLinkedChild('c', 'child', linked)).toBe(false)
    expect(isLinkedChild('a', 'admin', linked)).toBe(false)
  })
})

describe('filterGiveRecipients', () => {
  it('adult sees only virtual children', () => {
    expect(
      filterGiveRecipients(roster, 'a', 'admin', linked).map((m) => m.id),
    ).toEqual(['c'])
    expect(
      filterGiveRecipients(roster, 'm', 'member', linked).map((m) => m.id),
    ).toEqual(['c'])
  })

  it('virtual child sees adults and virtual siblings, not linked siblings', () => {
    expect(
      filterGiveRecipients(roster, 'c', 'child', linked).map((m) => m.id),
    ).toEqual(['a', 'm'])
  })

  it('linked child caller has no recipients', () => {
    expect(filterGiveRecipients(roster, 'c2', 'child', linked)).toEqual([])
  })

  it('child sees other members when none are linked', () => {
    expect(filterGiveRecipients(roster, 'c', 'child').map((m) => m.id)).toEqual([
      'a',
      'm',
      'c2',
    ])
  })

  it('solo admin has no recipients', () => {
    expect(filterGiveRecipients([roster[0]], 'a', 'admin')).toEqual([])
  })
})

describe('shouldShowKidsNav', () => {
  it('shows for adults with children', () => {
    expect(shouldShowKidsNav('admin', 2)).toBe(true)
    expect(shouldShowKidsNav('member', 1)).toBe(true)
  })

  it('hides for adults without children', () => {
    expect(shouldShowKidsNav('admin', 0)).toBe(false)
  })

  it('hides for children', () => {
    expect(shouldShowKidsNav('child', 2)).toBe(false)
  })
})

describe('shouldShowGiveNav', () => {
  it('hides for adults even with virtual recipients', () => {
    expect(
      shouldShowGiveNav({
        callerRole: 'admin',
        callerIsLinkedChild: false,
        recipientCount: 1,
      }),
    ).toBe(false)
  })

  it('shows for virtual kids with recipients', () => {
    expect(
      shouldShowGiveNav({
        callerRole: 'child',
        callerIsLinkedChild: false,
        recipientCount: 2,
      }),
    ).toBe(true)
  })

  it('shows for linked kids (static explainer page)', () => {
    expect(
      shouldShowGiveNav({
        callerRole: 'child',
        callerIsLinkedChild: true,
        recipientCount: 0,
      }),
    ).toBe(true)
  })

  it('hides for solo admin with no children', () => {
    expect(
      shouldShowGiveNav({
        callerRole: 'admin',
        callerIsLinkedChild: false,
        recipientCount: 0,
      }),
    ).toBe(false)
  })
})
