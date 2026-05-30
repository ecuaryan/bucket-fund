import { describe, expect, it } from 'vitest'
import {
  buildAccountIdentityKey,
  buildAccountIdentityKeyFromRow,
  parseLastFour,
} from '../../supabase/functions/_shared/accountIdentity.ts'

describe('tellerAccountIdentity', () => {
  it('parses last four from account_name', () => {
    expect(parseLastFour('Expenses ····2172')).toBe('2172')
    expect(parseLastFour('no digits')).toBeNull()
  })

  it('builds a stable identity key', () => {
    expect(
      buildAccountIdentityKey({
        institutionId: 'ally',
        institutionName: 'Ally',
        accountType: 'checking',
        lastFour: '2172',
      }),
    ).toBe('ally|2172|checking')
  })

  it('matches rows with the same institution, type, and last four', () => {
    const key = buildAccountIdentityKeyFromRow({
      institution_name: 'Ally',
      account_type: 'checking',
      account_name: 'Expenses ····2172',
    })
    expect(key).toBe('ally|2172|checking')
  })
})
