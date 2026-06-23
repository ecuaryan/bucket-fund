import { describe, expect, it } from 'vitest'
import {
  AUTO_ORGANIZE_ONCE_MONTHLY_DAY_OPTIONS,
  AUTO_ORGANIZE_ONCE_MONTHLY_MAX_DAY,
  AUTO_ORGANIZE_TWICE_MONTHLY_PRESETS,
  applyFrequencySelection,
  daysOfMonthFromSchedule,
  formatCadenceSummary,
  formatEditorNextRunSummary,
  formatEditorSaveScheduleSummary,
  formatLastRunLabel,
  formatLocalDateLabel,
  formatShortIsoDateLabel,
  formatNextRunLabelForCadence,
  formatRunScheduleForDays,
  computeNextRunOn,
  frequencySelectionFromCadence,
  isManualFrequencySelection,
  monthlyScheduleFromDays,
  normalizeMonthlyCadence,
  normalizeOnceMonthlyDay,
  twiceMonthlyPresetFromDays,
  validateIntervalStartDate,
  maxIntervalStartDateIso,
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

describe('validateIntervalStartDate', () => {
  const from = new Date('2026-06-11T20:00:00Z')
  const timeZone = 'America/Los_Angeles'

  it('allows tomorrow and later', () => {
    expect(
      validateIntervalStartDate('2026-06-12', timeZone, { from }).ok,
    ).toBe(true)
    expect(
      validateIntervalStartDate('2026-07-01', timeZone, { from }).ok,
    ).toBe(true)
  })

  it('rejects today and past dates', () => {
    expect(validateIntervalStartDate('2026-06-11', timeZone, { from })).toEqual({
      ok: false,
      reason: 'today',
    })
    expect(validateIntervalStartDate('2026-06-01', timeZone, { from })).toEqual({
      ok: false,
      reason: 'past',
    })
  })

  it('allows an unchanged legacy start date when editing', () => {
    expect(
      validateIntervalStartDate('2026-05-01', timeZone, {
        from,
        legacyStartDate: '2026-05-01',
      }).ok,
    ).toBe(true)
    expect(
      validateIntervalStartDate('2026-05-01', timeZone, {
        from,
        legacyStartDate: '2026-06-12',
      }),
    ).toEqual({ ok: false, reason: 'past' })
  })

  it('rejects dates more than two years out', () => {
    const max = maxIntervalStartDateIso(timeZone, from)
    expect(validateIntervalStartDate(max, timeZone, { from }).ok).toBe(true)
    expect(
      validateIntervalStartDate('2028-06-13', timeZone, { from }),
    ).toEqual({ ok: false, reason: 'too_far' })
  })
})

describe('formatLastRunLabel', () => {
  it('formats a completed run date', () => {
    expect(formatLastRunLabel('2026-06-13')).toBe('Last run Jun 13')
  })

  it('returns null when there is no run', () => {
    expect(formatLastRunLabel(null)).toBeNull()
  })
})

describe('formatEditorNextRunSummary', () => {
  it('returns the next due date without repeating cadence', () => {
    const from = new Date('2026-06-11T20:00:00Z')
    expect(
      formatEditorNextRunSummary(
        {
          autoOrganizeType: 'interval',
          startDate: '2026-06-12',
          intervalCount: 2,
          intervalUnit: 'week',
          daysOfMonth: null,
        },
        'America/Los_Angeles',
        from,
      ),
    ).toBe('Jun 12')
  })
})

describe('formatEditorSaveScheduleSummary', () => {
  it('includes cadence and next run for monthly schedules', () => {
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
    expect(summary).toMatch(/^Twice a month · 1st & 15th · Next run /)
  })
})

describe('computeNextRunOn', () => {
  it('returns the start date for a weekly interval (matches editor summary)', () => {
    const cadence = {
      autoOrganizeType: 'interval' as const,
      startDate: '2026-06-12',
      intervalCount: 1,
      intervalUnit: 'week' as const,
      daysOfMonth: null,
    }
    const from = new Date('2026-06-11T20:00:00Z')
    expect(computeNextRunOn(cadence, 'America/Los_Angeles', from)).toBe(
      '2026-06-12',
    )
    expect(formatNextRunLabelForCadence(cadence, computeNextRunOn(cadence, 'America/Los_Angeles', from))).toBe(
      'Next run Jun 12',
    )
  })

  it('returns Runs when you choose for manual cadence', () => {
    expect(
      formatNextRunLabelForCadence(
        {
          autoOrganizeType: 'manual',
          startDate: null,
          intervalCount: null,
          intervalUnit: null,
          daysOfMonth: null,
        },
        null,
      ),
    ).toBe('Runs when you choose')
  })

  it('returns null next run for manual cadence', () => {
    expect(
      computeNextRunOn(
        {
          autoOrganizeType: 'manual',
          startDate: null,
          intervalCount: null,
          intervalUnit: null,
          daysOfMonth: null,
        },
        'America/Los_Angeles',
      ),
    ).toBeNull()
  })
})

describe('formatLocalDateLabel', () => {
  it('formats ISO dates in local calendar terms', () => {
    expect(formatLocalDateLabel('2026-06-12')).toBe('Friday, June 12, 2026')
  })
})

describe('formatShortIsoDateLabel', () => {
  it('formats ISO dates for read-only start display', () => {
    expect(formatShortIsoDateLabel('2026-06-13')).toBe('Jun 13, 2026')
  })
})

describe('formatCadenceSummary', () => {
  it('returns Manual only for manual cadence', () => {
    expect(
      formatCadenceSummary({
        autoOrganizeType: 'manual',
        startDate: null,
        intervalCount: null,
        intervalUnit: null,
        daysOfMonth: null,
      }),
    ).toBe('Manual only')
  })

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
  it('maps manual cadence to manual-only', () => {
    expect(
      frequencySelectionFromCadence(
        {
          autoOrganizeType: 'manual',
          startDate: null,
          intervalCount: null,
          intervalUnit: null,
          daysOfMonth: null,
        },
        'first-and-fifteenth',
      ),
    ).toBe('manual-only')
  })

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
  it('clears schedule fields for manual-only', () => {
    const base = {
      autoOrganizeType: 'interval' as const,
      startDate: '2026-06-11',
      intervalCount: 2,
      intervalUnit: 'week' as const,
      daysOfMonth: null,
    }

    expect(
      applyFrequencySelection(
        'manual-only',
        base,
        'first-and-fifteenth',
        '2026-06-11',
      ),
    ).toEqual({
      cadence: {
        autoOrganizeType: 'manual',
        startDate: null,
        intervalCount: null,
        intervalUnit: null,
        daysOfMonth: null,
      },
      monthlyPreset: 'first-and-fifteenth',
    })
  })

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

describe('isManualFrequencySelection', () => {
  it('identifies manual-only selection', () => {
    expect(isManualFrequencySelection('manual-only')).toBe(true)
    expect(isManualFrequencySelection('2-week')).toBe(false)
    expect(isManualFrequencySelection('monthly-once')).toBe(false)
  })
})
