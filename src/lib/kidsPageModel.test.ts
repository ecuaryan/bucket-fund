import { describe, expect, it } from 'vitest'
import { buildKidsPageModel } from '@/lib/kidsPageModel'

describe('buildKidsPageModel', () => {
  it('splits virtual and linked kids', () => {
    const { virtualKids, linkedKids } = buildKidsPageModel({
      children: [
        { id: 'v1', name: 'Jake' },
        { id: 'l1', name: 'Kaycee' },
      ],
      childBalances: [
        { memberId: 'v1', name: 'Jake', amount: 42, availableFloat: 25 },
        { memberId: 'l1', name: 'Kaycee', amount: 130.7, availableFloat: 0 },
      ],
      linkedChildIds: new Set(['l1']),
      accounts: [
        {
          id: 'acc1',
          owner_member_id: 'l1',
          account_name: 'Kaycee ....4143',
          institution_name: 'Ally',
          current_balance: 130.7,
        } as never,
      ],
    })

    expect(virtualKids).toEqual([
      { memberId: 'v1', name: 'Jake', amount: 42, availableFloat: 25 },
    ])
    expect(linkedKids).toHaveLength(1)
    expect(linkedKids[0]?.name).toBe('Kaycee')
    expect(linkedKids[0]?.accounts[0]?.label).toBe('Kaycee ....4143')
    expect(linkedKids[0]?.giveNet).toBe(0)
  })

  it('carries a linked kid’s virtual credit (net gives) for the Take flow', () => {
    const { linkedKids } = buildKidsPageModel({
      children: [{ id: 'l1', name: 'Kaycee' }],
      childBalances: [
        // Gives accumulated while unlinked, then a bank account came back:
        // amount double-counts until the adult takes the giveNet back.
        { memberId: 'l1', name: 'Kaycee', amount: 160.7, giveNet: 30 },
      ],
      linkedChildIds: new Set(['l1']),
      accounts: [],
    })

    expect(linkedKids[0]?.giveNet).toBe(30)
  })
})
