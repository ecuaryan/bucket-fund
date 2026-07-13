import { describe, expect, it } from 'vitest'
import { mapPlaidAccountType, pickPlaidBalance } from '@/lib/plaidParse'

describe('mapPlaidAccountType', () => {
  it('maps depository subtypes onto the cash vocabulary', () => {
    expect(mapPlaidAccountType('depository', 'checking')).toBe('checking')
    expect(mapPlaidAccountType('depository', 'savings')).toBe('savings')
    expect(mapPlaidAccountType('depository', 'money market')).toBe('money_market')
    expect(mapPlaidAccountType('depository', 'cd')).toBe('certificate_of_deposit')
    expect(mapPlaidAccountType('depository', 'cash management')).toBe(
      'cash_management',
    )
  })

  it('treats unknown depository subtypes as cash (spendable)', () => {
    expect(mapPlaidAccountType('depository', 'hsa')).toBe('cash')
    expect(mapPlaidAccountType('depository', null)).toBe('cash')
  })

  it('maps credit to credit_card', () => {
    expect(mapPlaidAccountType('credit', 'credit card')).toBe('credit_card')
    expect(mapPlaidAccountType('credit', null)).toBe('credit_card')
  })

  it('keeps non-cash types visible but out of the cash pool', () => {
    // Not in is_cash_account_type → balance excluded from the ledger.
    expect(mapPlaidAccountType('loan', 'student')).toBe('student')
    expect(mapPlaidAccountType('investment', 'brokerage')).toBe('brokerage')
    expect(mapPlaidAccountType('loan', null)).toBe('loan')
  })
})

describe('pickPlaidBalance', () => {
  it('prefers current, falls back to available', () => {
    expect(pickPlaidBalance({ current: 120.5, available: 100 })).toBe(120.5)
    expect(pickPlaidBalance({ current: null, available: 100 })).toBe(100)
  })

  it('keeps Plaid card balances as positive-owed (no sign flip)', () => {
    // Unlike SimpleFIN, Plaid already reports credit `current` positive.
    expect(pickPlaidBalance({ current: 378.66, available: null })).toBe(378.66)
  })

  it('throws when Plaid returns no usable balance', () => {
    expect(() => pickPlaidBalance({ current: null, available: null })).toThrow(
      /no usable balance/,
    )
  })
})
