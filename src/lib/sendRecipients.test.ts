import { describe, expect, it } from 'vitest'
import { filterSendRecipients } from '@/lib/sendRecipients'

const roster = [
  { id: 'a', name: 'Admin', role: 'admin' },
  { id: 'm', name: 'Spouse', role: 'member' },
  { id: 'c', name: 'Kid', role: 'child' },
]

describe('filterSendRecipients', () => {
  it('adult sees only children', () => {
    expect(filterSendRecipients(roster, 'a', 'admin').map((m) => m.id)).toEqual([
      'c',
    ])
    expect(filterSendRecipients(roster, 'm', 'member').map((m) => m.id)).toEqual([
      'c',
    ])
  })

  it('child sees other members', () => {
    expect(filterSendRecipients(roster, 'c', 'child').map((m) => m.id)).toEqual([
      'a',
      'm',
    ])
  })

  it('solo admin has no recipients', () => {
    expect(
      filterSendRecipients([roster[0]], 'a', 'admin'),
    ).toEqual([])
  })
})
