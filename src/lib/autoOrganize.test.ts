import { describe, expect, it } from 'vitest'
import {
  autoOrganizeDisplayName,
  disambiguateAutoOrganizeLabels,
} from '@/lib/autoOrganize'

describe('autoOrganizeDisplayName', () => {
  it('uses cadence summary when name is blank', () => {
    expect(
      autoOrganizeDisplayName({
        name: null,
        auto_organize_type: 'interval',
        start_date: '2026-06-01',
        interval_count: 2,
        interval_unit: 'week',
        days_of_month: null,
      }),
    ).toBe('Every 2 weeks')
  })

  it('prefers a trimmed custom name', () => {
    expect(
      autoOrganizeDisplayName({
        name: '  Payday  ',
        auto_organize_type: 'monthly',
        start_date: null,
        interval_count: null,
        interval_unit: null,
        days_of_month: [1],
      }),
    ).toBe('Payday')
  })
})

describe('disambiguateAutoOrganizeLabels', () => {
  it('appends indices when labels repeat', () => {
    expect(
      disambiguateAutoOrganizeLabels([
        { id: 'a', name: 'Every 2 weeks' },
        { id: 'b', name: 'Every 2 weeks' },
      ]),
    ).toEqual([
      { id: 'a', name: 'Every 2 weeks (1)' },
      { id: 'b', name: 'Every 2 weeks (2)' },
    ])
  })
})
