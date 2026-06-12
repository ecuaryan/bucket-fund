import { describe, expect, it } from 'vitest'
import {
  AUTO_ORGANIZE_ONCE_MONTHLY_DAY_OPTIONS,
  AUTO_ORGANIZE_ONCE_MONTHLY_MAX_DAY,
  AUTO_ORGANIZE_TWICE_MONTHLY_PRESETS,
  applyFrequencySelection,
  daysOfMonthFromSchedule,
  formatCadenceSummary,
  formatEditorSaveScheduleSummary,
  formatLocalDateLabel,
  formatRunScheduleForDays,
  frequencySelectionFromCadence,
  monthlyScheduleFromDays,
  normalizeMonthlyCadence,
  normalizeOnceMonthlyDay,
  twiceMonthlyPresetFromDays,
} from '@/lib/autoOrganizeCadence'

describe('normalizeOnceMonthlyDay', () => {
  it('keeps 1–28 and last day', () => {
    expect(normalizeOnceMonthlyDay(1)).toBe(1)
    expect(normalizeOnceMonthlyDay(28)).toBe(28)
    expect(normalizeOnceMonthlyDay(0)).toBe(0)
  })

  it('maps 29–31 to last day', () => {
    expect(normalizeOnceMonthlyDay(29)).toBe(0)
    expect(normalizeOnceMonthlyDay(30)).toBe(0)
    expect(normalizeOnceMonthlyDay(31)).toBe(0)
  })
})

describe('AUTO_ORGANIZE_ONCE_MONTHLY_DAY_OPTIONS', () => {
  it('offers 1–28 plus last day only', () => {
    expect(AUTO_ORGANIZE_ONCE_MONTHLY_DAY_OPTIONS).toHaveLength(
      AUTO_ORGANIZE_ONCE_MONTHLY_MAX_DAY + 1,
    )
    expect(AUTO_ORGANIZE_ONCE_MONTHLY_DAY_OPTIONS.at(-1)).toEqual({
      value: 0,
      label: 'Last day of month',
    })
    expect(
      AUTO_ORGANIZE_ONCE_MONTHLY_DAY_OPTIONS.some((option) => option.value > 28),
    ).toBe(false)
  })
})

describe('AUTO_ORGANIZE_TWICE_MONTHLY_PRESETS', () => {
  it('covers typical semi-monthly pay schedules', () => {
    expect(AUTO_ORGANIZE_TWICE_MONTHLY_PRESETS.map((preset) => preset.label)).toEqual([
      '1st & 15th',
      '2nd & 16th',
      '1st & 16th',
      '15th & last day',
      '16th & last day',
    ])
  })
})

describe('monthlyScheduleFromDays', () => {
  it('loads legacy day 31 as once-a-month last day', () => {
    expect(monthlyScheduleFromDays([31])).toEqual({
      preset: 'once',
      onceDay: 0,
    })
  })

  it('loads twice-monthly presets by days', () => {
    expect(monthlyScheduleFromDays([2, 16])).toEqual({
      preset: 'second-and-sixteenth',
      onceDay: 1,
    })
  })
})

describe('twiceMonthlyPresetFromDays', () => {
  it('maps saved days to preset ids', () => {
    expect(twiceMonthlyPresetFromDays([1, 16])).toBe('first-and-sixteenth')
    expect(twiceMonthlyPresetFromDays([16, 0])).toBe('sixteenth-and-last')
  })
})

describe('daysOfMonthFromSchedule', () => {
  it('persists normalized once-a-month days', () => {
    expect(daysOfMonthFromSchedule('once', 31)).toEqual([0])
    expect(daysOfMonthFromSchedule('once', 15)).toEqual([15])
  })

  it('persists twice-monthly preset days', () => {
    expect(daysOfMonthFromSchedule('second-and-sixteenth', 0)).toEqual([2, 16])
  })
})

describe('normalizeMonthlyCadence', () => {
  it('rewrites legacy once-a-month day 31 to last day', () => {
    expect(
      normalizeMonthlyCadence({
        autoOrganizeType: 'monthly',
        startDate: null,
        intervalCount: null,
        intervalUnit: null,
        daysOfMonth: [31],
      }).daysOfMonth,
    ).toEqual([0])
  })

  it('leaves twice-monthly presets unchanged', () => {
    const cadence = {
      autoOrganizeType: 'monthly' as const,
      startDate: null,
      intervalCount: null,
      intervalUnit: null,
      daysOfMonth: [1, 15],
    }
    expect(normalizeMonthlyCadence(cadence)).toEqual(cadence)
  })
})

describe('formatRunScheduleForDays', () => {
  it('describes twice-monthly calendar days', () => {
    expect(formatRunScheduleForDays([1, 15])).toBe(
      'Runs on the 1st and the 15th of each month.',
    )
    expect(formatRunScheduleForDays([15, 0])).toBe(
      'Runs on the 15th and the last day of each month.',
    )
  })
})

describe('formatEditorSaveScheduleSummary', () => {
  it('includes the next run for monthly schedules', () => {
    const summary = formatEditorSaveScheduleSummary(
      {
        autoOrganizeType: 'monthly',
        startDate: null,
        intervalCount: null,
        intervalUnit: null,
        daysOfMonth: [1, 15],
      },
      'UTC',
    )
    expect(summary).toMatch(/^Twice a month · 1st & 15th · First run /)
  })

  it('uses the selected start date for interval schedules', () => {
    expect(
      formatEditorSaveScheduleSummary(
        {
          autoOrganizeType: 'interval',
          startDate: '2026-06-12',
          intervalCount: 2,
          intervalUnit: 'week',
          daysOfMonth: null,
        },
        'UTC',
      ),
    ).toBe('Every 2 weeks · First run Fri, Jun 12, 2026')
  })
})

describe('formatLocalDateLabel', () => {
  it('formats ISO dates in local calendar terms', () => {
    expect(formatLocalDateLabel('2026-06-12')).toBe('Friday, June 12, 2026')
  })
})

describe('formatCadenceSummary', () => {
  it('describes twice-monthly presets by label', () => {
    expect(
      formatCadenceSummary({
        autoOrganizeType: 'monthly',
        startDate: null,
        intervalCount: null,
        intervalUnit: null,
        daysOfMonth: [2, 16],
      }),
    ).toBe('Twice a month · 2nd & 16th')
  })

  it('describes legacy day 31 as last day', () => {
    expect(
      formatCadenceSummary({
        autoOrganizeType: 'monthly',
        startDate: null,
        intervalCount: null,
        intervalUnit: null,
        daysOfMonth: [31],
      }),
    ).toBe('Once a month · last day')
  })
})

describe('frequencySelectionFromCadence', () => {
  it('maps interval and monthly cadences to flat frequency options', () => {
    expect(
      frequencySelectionFromCadence(
        {
          autoOrganizeType: 'interval',
          startDate: '2026-06-11',
          intervalCount: 2,
          intervalUnit: 'week',
          daysOfMonth: null,
        },
        'first-and-fifteenth',
      ),
    ).toBe('2-week')

    expect(
      frequencySelectionFromCadence(
        {
          autoOrganizeType: 'monthly',
          startDate: null,
          intervalCount: null,
          intervalUnit: null,
          daysOfMonth: [15],
        },
        'once',
      ),
    ).toBe('monthly-once')
  })
})

describe('applyFrequencySelection', () => {
  it('sets interval cadence from every 2 weeks', () => {
    const base = {
      autoOrganizeType: 'monthly' as const,
      startDate: null,
      intervalCount: null,
      intervalUnit: null,
      daysOfMonth: [1, 15],
    }

    expect(
      applyFrequencySelection(
        '2-week',
        base,
        'first-and-fifteenth',
        '2026-06-11',
      ),
    ).toEqual({
      cadence: {
        autoOrganizeType: 'interval',
        startDate: '2026-06-11',
        intervalCount: 2,
        intervalUnit: 'week',
        daysOfMonth: [1, 15],
      },
      monthlyPreset: 'first-and-fifteenth',
    })
  })
})
