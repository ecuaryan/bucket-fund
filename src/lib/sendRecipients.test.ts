import { describe, expect, it } from 'vitest'
import {
  filterSendRecipients,
  isLinkedChild,
  shouldShowSendNav,
} from '@/lib/sendRecipients'

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

describe('filterSendRecipients', () => {
  it('adult sees only virtual children', () => {
    expect(
      filterSendRecipients(roster, 'a', 'admin', linked).map((m) => m.id),
    ).toEqual(['c'])
    expect(
      filterSendRecipients(roster, 'm', 'member', linked).map((m) => m.id),
    ).toEqual(['c'])
  })

  it('virtual child sees adults and virtual siblings, not linked siblings', () => {
    expect(
      filterSendRecipients(roster, 'c', 'child', linked).map((m) => m.id),
    ).toEqual(['a', 'm'])
  })

  it('linked child caller has no recipients', () => {
    expect(filterSendRecipients(roster, 'c2', 'child', linked)).toEqual([])
  })

  it('child sees other members when none are linked', () => {
    expect(filterSendRecipients(roster, 'c', 'child').map((m) => m.id)).toEqual([
      'a',
      'm',
      'c2',
    ])
  })

  it('solo admin has no recipients', () => {
    expect(filterSendRecipients([roster[0]], 'a', 'admin')).toEqual([])
  })
})

describe('shouldShowSendNav', () => {
  it('shows when there are virtual recipients', () => {
    expect(
      shouldShowSendNav({
        callerRole: 'admin',
        callerIsLinkedChild: false,
        recipientCount: 1,
        linkedChildCount: 1,
      }),
    ).toBe(true)
  })

  it('shows for linked kids (static explainer page)', () => {
    expect(
      shouldShowSendNav({
        callerRole: 'child',
        callerIsLinkedChild: true,
        recipientCount: 0,
        linkedChildCount: 1,
      }),
    ).toBe(true)
  })

  it('shows for adults when every kid is linked', () => {
    expect(
      shouldShowSendNav({
        callerRole: 'admin',
        callerIsLinkedChild: false,
        recipientCount: 0,
        linkedChildCount: 1,
      }),
    ).toBe(true)
  })

  it('hides for solo admin with no children', () => {
    expect(
      shouldShowSendNav({
        callerRole: 'admin',
        callerIsLinkedChild: false,
        recipientCount: 0,
        linkedChildCount: 0,
      }),
    ).toBe(false)
  })
})
