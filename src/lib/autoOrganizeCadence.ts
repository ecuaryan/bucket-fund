import type { AutoOrganizeFrequencySelection } from '@/lib/brand'
import {
  AUTO_ORGANIZE_FREQUENCY_OPTIONS,
  AUTO_ORGANIZE_MANUAL_CADENCE_SUMMARY,
  AUTO_ORGANIZE_MANUAL_NEXT_RUN_LABEL,
  AUTO_ORGANIZE_NEXT_RUN_LABEL,
  AUTO_ORGANIZE_NO_UPCOMING_RUN_LABEL,
  AUTO_ORGANIZE_RUN_NOW_LAST_RUN_TODAY_PREFIX,
} from '@/lib/brand'

export type AutoOrganizeType = 'interval' | 'monthly' | 'manual'

export function isManualFrequencySelection(
  selection: AutoOrganizeFrequencySelection,
): boolean {
  return selection === 'manual-only'
}

export function isIntervalFrequencySelection(
  selection: AutoOrganizeFrequencySelection,
): boolean {
  return !selection.startsWith('monthly-') && selection !== 'manual-only'
}

export function frequencySelectionFromCadence(
  cadence: AutoOrganizeCadence,
  monthlyPreset: MonthlyPresetId,
): AutoOrganizeFrequencySelection {
  if (cadence.autoOrganizeType === 'manual') {
    return 'manual-only'
  }

  if (cadence.autoOrganizeType === 'monthly') {
    return monthlyPreset === 'once' ? 'monthly-once' : 'monthly-twice'
  }

  const count = cadence.intervalCount ?? 2
  const unit = cadence.intervalUnit ?? 'week'
  const candidate = `${count}-${unit}` as AutoOrganizeFrequencySelection
  if (
    AUTO_ORGANIZE_FREQUENCY_OPTIONS.some((option) => option.value === candidate)
  ) {
    return candidate
  }

  return '2-week'
}

export function applyFrequencySelection(
  selection: AutoOrganizeFrequencySelection,
  prev: AutoOrganizeCadence,
  monthlyPreset: MonthlyPresetId,
  todayIso: string,
): { cadence: AutoOrganizeCadence; monthlyPreset: MonthlyPresetId } {
  if (selection === 'manual-only') {
    return {
      cadence: {
        ...prev,
        autoOrganizeType: 'manual',
        startDate: null,
        intervalCount: null,
        intervalUnit: null,
        daysOfMonth: null,
      },
      monthlyPreset,
    }
  }

  if (selection === 'monthly-once') {
    return {
      cadence: { ...prev, autoOrganizeType: 'monthly' },
      monthlyPreset: 'once',
    }
  }

  if (selection === 'monthly-twice') {
    return {
      cadence: { ...prev, autoOrganizeType: 'monthly' },
      monthlyPreset:
        monthlyPreset === 'once' ? 'first-and-fifteenth' : monthlyPreset,
    }
  }

  const [count, unit] = selection.split('-')
  return {
    cadence: {
      ...prev,
      autoOrganizeType: 'interval',
      startDate: prev.startDate ?? todayIso,
      intervalCount: Number(count),
      intervalUnit: unit as 'week' | 'month',
    },
    monthlyPreset,
  }
}

export type MonthlyPresetId =
  | 'first-and-fifteenth'
  | 'first-and-sixteenth'
  | 'second-and-sixteenth'
  | 'fifteenth-and-last'
  | 'sixteenth-and-last'
  | 'once'

export const AUTO_ORGANIZE_TWICE_MONTHLY_PRESETS: {
  id: Exclude<MonthlyPresetId, 'once'>
  label: string
  daysOfMonth: number[]
}[] = [
  { id: 'first-and-fifteenth', label: '1st & 15th', daysOfMonth: [1, 15] },
  { id: 'second-and-sixteenth', label: '2nd & 16th', daysOfMonth: [2, 16] },
  { id: 'first-and-sixteenth', label: '1st & 16th', daysOfMonth: [1, 16] },
  { id: 'fifteenth-and-last', label: '15th & last day', daysOfMonth: [15, 0] },
  {
    id: 'sixteenth-and-last',
    label: '16th & last day',
    daysOfMonth: [16, 0],
  },
]

export function twiceMonthlyPresetFromDays(
  days: number[] | null | undefined,
): Exclude<MonthlyPresetId, 'once'> {
  const key = daysKey(days)
  const match = AUTO_ORGANIZE_TWICE_MONTHLY_PRESETS.find(
    (preset) => daysKey(preset.daysOfMonth) === key,
  )
  return match?.id ?? 'first-and-fifteenth'
}

export function formatTwiceMonthlyDayLabels(days: number[]): string {
  return [...days]
    .sort((a, b) => (a === 0 ? 99 : a) - (b === 0 ? 99 : b))
    .map(formatDayOfMonth)
    .join(' & ')
}

/** @deprecated use AUTO_ORGANIZE_TWICE_MONTHLY_PRESETS */
export const AUTO_ORGANIZE_MONTHLY_PRESETS = AUTO_ORGANIZE_TWICE_MONTHLY_PRESETS

export type AutoOrganizeCadence = {
  autoOrganizeType: AutoOrganizeType
  startDate: string | null
  intervalCount: number | null
  intervalUnit: 'week' | 'month' | null
  daysOfMonth: number[] | null
}

/** Once-a-month UI: 1–28 always exist; 29–31 map to last day (0). */
export const AUTO_ORGANIZE_ONCE_MONTHLY_MAX_DAY = 28

export function normalizeOnceMonthlyDay(day: number): number {
  if (day === 0) return 0
  if (day > AUTO_ORGANIZE_ONCE_MONTHLY_MAX_DAY) return 0
  return day
}

const ORDINALS = [
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th',
  '10th',
  '11th',
  '12th',
  '13th',
  '14th',
  '15th',
  '16th',
  '17th',
  '18th',
  '19th',
  '20th',
  '21st',
  '22nd',
  '23rd',
  '24th',
  '25th',
  '26th',
  '27th',
  '28th',
  '29th',
  '30th',
  '31st',
] as const

export function formatDayOfMonth(day: number): string {
  if (day === 0) return 'last day'
  return ORDINALS[day - 1] ?? `${day}th`
}

export const AUTO_ORGANIZE_ONCE_MONTHLY_DAY_OPTIONS: {
  value: number
  label: string
}[] = [
  ...Array.from({ length: AUTO_ORGANIZE_ONCE_MONTHLY_MAX_DAY }, (_, index) => ({
    value: index + 1,
    label: formatDayOfMonth(index + 1),
  })),
  { value: 0, label: 'Last day of month' },
]

function daysKey(days: number[] | null | undefined): string {
  if (!days?.length) return ''
  return [...days]
    .sort((a, b) => (a === 0 ? 99 : a) - (b === 0 ? 99 : b))
    .join(',')
}

export function monthlyScheduleFromDays(days: number[] | null | undefined): {
  preset: MonthlyPresetId
  onceDay: number
} {
  const key = daysKey(days)
  const twice = AUTO_ORGANIZE_TWICE_MONTHLY_PRESETS.find(
    (preset) => daysKey(preset.daysOfMonth) === key,
  )
  if (twice) return { preset: twice.id, onceDay: 1 }
  if (days?.length === 2) {
    return { preset: twiceMonthlyPresetFromDays(days), onceDay: 1 }
  }
  if (days?.length === 1) {
    return { preset: 'once', onceDay: normalizeOnceMonthlyDay(days[0]) }
  }
  return { preset: 'first-and-fifteenth', onceDay: 1 }
}

/** @deprecated use monthlyScheduleFromDays */
export function monthlyPresetFromDays(
  days: number[] | null | undefined,
): MonthlyPresetId {
  return monthlyScheduleFromDays(days).preset
}

export function daysOfMonthFromSchedule(
  preset: MonthlyPresetId,
  onceDay: number,
): number[] {
  if (preset === 'once') return [normalizeOnceMonthlyDay(onceDay)]
  return (
    AUTO_ORGANIZE_TWICE_MONTHLY_PRESETS.find((item) => item.id === preset)
      ?.daysOfMonth ?? [1, 15]
  )
}

/** @deprecated use daysOfMonthFromSchedule */
export function daysOfMonthFromPreset(id: MonthlyPresetId): number[] {
  return daysOfMonthFromSchedule(id, 0)
}

export function normalizeMonthlyCadence(
  cadence: AutoOrganizeCadence,
): AutoOrganizeCadence {
  if (cadence.autoOrganizeType !== 'monthly') return cadence
  const { preset, onceDay } = monthlyScheduleFromDays(cadence.daysOfMonth)
  if (preset !== 'once') return cadence
  return {
    ...cadence,
    daysOfMonth: daysOfMonthFromSchedule('once', onceDay),
  }
}

export function formatCadenceSummary(cadence: AutoOrganizeCadence): string {
  if (cadence.autoOrganizeType === 'manual') {
    return AUTO_ORGANIZE_MANUAL_CADENCE_SUMMARY
  }

  if (cadence.autoOrganizeType === 'monthly') {
    const { preset, onceDay } = monthlyScheduleFromDays(cadence.daysOfMonth)
    if (preset === 'once') {
      return `Once a month · ${formatDayOfMonth(onceDay)}`
    }
    const days = cadence.daysOfMonth ?? []
    const twice = AUTO_ORGANIZE_TWICE_MONTHLY_PRESETS.find(
      (item) => item.id === preset,
    )
    if (twice && daysKey(days) === daysKey(twice.daysOfMonth)) {
      return `Twice a month · ${twice.label}`
    }
    if (days.length === 2) {
      return `Twice a month · ${formatTwiceMonthlyDayLabels(days)}`
    }
    if (twice) return `Twice a month · ${twice.label}`
    if (days.length === 0) return 'Monthly'
    const labels = [...days].sort((a, b) => a - b).map(formatDayOfMonth)
    if (labels.length === 1) return `Once a month · ${labels[0]}`
    return `Twice a month · ${labels.join(' & ')}`
  }

  if (cadence.autoOrganizeType === 'interval') {
    const count = cadence.intervalCount ?? 1
    const unit = cadence.intervalUnit ?? 'week'
    if (unit === 'week' && count === 1) return 'Every week'
    if (unit === 'week' && count === 2) return 'Every 2 weeks'
    if (unit === 'month' && count === 1) return 'Every month'
    return `Every ${count} ${unit}s`
  }

  return 'Auto-organize'
}

/** Local calendar date `YYYY-MM-DD` in the given IANA timezone. */
export function localDateIsoInTimeZone(
  timeZone: string,
  from: Date = new Date(),
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(from)
}

function addCalendarDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d + days))
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, '0'),
    String(shifted.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function daysBetweenIso(startIso: string, targetIso: string): number {
  const [sy, sm, sd] = startIso.split('-').map(Number)
  const [ty, tm, td] = targetIso.split('-').map(Number)
  return Math.floor(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(sy, sm - 1, sd)) / 86_400_000,
  )
}

function lastDayOfMonthForIso(iso: string): number {
  const [y, m] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function tomorrowIsoInTimeZone(
  timeZone: string,
  from: Date = new Date(),
): string {
  return addCalendarDays(localDateIsoInTimeZone(timeZone, from), 1)
}

export type IntervalStartDateValidation =
  | { ok: true }
  | { ok: false; reason: 'today' | 'past' | 'too_far' }

/** Latest first-run date: two years after tomorrow in family local calendar. */
export const INTERVAL_START_MAX_YEARS_AHEAD = 2

export function maxIntervalStartDateIso(
  timeZone: string,
  from: Date = new Date(),
): string {
  const [y, m, d] = tomorrowIsoInTimeZone(timeZone, from).split('-').map(Number)
  const max = new Date(Date.UTC(y + INTERVAL_START_MAX_YEARS_AHEAD, m - 1, d))
  return [
    max.getUTCFullYear(),
    String(max.getUTCMonth() + 1).padStart(2, '0'),
    String(max.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

/** First scheduled run: tomorrow through max horizon in family TZ, or unchanged legacy start when editing. */
export function validateIntervalStartDate(
  candidate: string,
  timeZone: string,
  options?: { from?: Date; legacyStartDate?: string | null },
): IntervalStartDateValidation {
  if (options?.legacyStartDate === candidate) return { ok: true }

  const todayIso = localDateIsoInTimeZone(timeZone, options?.from)
  const tomorrowIso = tomorrowIsoInTimeZone(timeZone, options?.from)
  const maxIso = maxIntervalStartDateIso(timeZone, options?.from)

  if (candidate >= tomorrowIso && candidate <= maxIso) return { ok: true }
  if (candidate === todayIso) return { ok: false, reason: 'today' }
  if (candidate > maxIso) return { ok: false, reason: 'too_far' }
  return { ok: false, reason: 'past' }
}

/** Match SQL `auto_organize_is_due_on` using calendar dates only (no clock TZ drift). */
function isDueOn(cadence: AutoOrganizeCadence, localDateIso: string): boolean {
  if (cadence.autoOrganizeType === 'manual') return false

  const day = Number(localDateIso.split('-')[2])

  if (cadence.autoOrganizeType === 'monthly') {
    const days = cadence.daysOfMonth ?? []
    const last = lastDayOfMonthForIso(localDateIso)
    if (days.includes(0) && day === last) return true
    return days.includes(day)
  }

  const start = cadence.startDate
  if (!start || !cadence.intervalCount || !cadence.intervalUnit) return false
  if (localDateIso < start) return false

  if (cadence.intervalUnit === 'week') {
    return (
      daysBetweenIso(start, localDateIso) % (cadence.intervalCount * 7) === 0
    )
  }

  const [ty, tm] = localDateIso.split('-').map(Number)
  const [sy, sm, sd] = start.split('-').map(Number)
  const monthsDiff = (ty - sy) * 12 + (tm - sm)
  if (monthsDiff < 0 || monthsDiff % cadence.intervalCount !== 0) return false
  const anchorDay = Math.min(sd, lastDayOfMonthForIso(localDateIso))
  return day === anchorDay
}

/** Next local calendar date this auto-organize would run (for cards). */
export function computeNextRunOn(
  cadence: AutoOrganizeCadence,
  timeZone: string,
  from: Date = new Date(),
  options?: { notBefore?: string; skipRunOnDates?: readonly string[] },
): string | null {
  if (cadence.autoOrganizeType === 'manual') return null

  const todayIso = localDateIsoInTimeZone(timeZone, from)
  const startIso = options?.notBefore ?? todayIso
  const skipRunOn = options?.skipRunOnDates?.length
    ? new Set(options.skipRunOnDates)
    : undefined
  for (let offset = 0; offset < 366; offset += 1) {
    const probeIso = addCalendarDays(startIso, offset)
    if (skipRunOn?.has(probeIso)) continue
    if (isDueOn(cadence, probeIso)) return probeIso
  }
  return null
}

export function formatNextRunDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function formatNextRunLabelForCadence(
  cadence: AutoOrganizeCadence,
  nextRunOn: string | null,
): string {
  if (cadence.autoOrganizeType === 'manual') {
    return AUTO_ORGANIZE_MANUAL_NEXT_RUN_LABEL
  }
  if (!nextRunOn) return AUTO_ORGANIZE_NO_UPCOMING_RUN_LABEL
  return `${AUTO_ORGANIZE_NEXT_RUN_LABEL} ${formatNextRunDateLabel(nextRunOn)}`
}

/** @deprecated use formatNextRunLabelForCadence */
export function formatNextRunLabel(nextRunOn: string | null): string {
  if (!nextRunOn) return AUTO_ORGANIZE_NO_UPCOMING_RUN_LABEL
  return `${AUTO_ORGANIZE_NEXT_RUN_LABEL} ${formatNextRunDateLabel(nextRunOn)}`
}

export function formatLastRunLabel(lastRunOn: string | null): string | null {
  if (!lastRunOn) return null
  return `Last run ${formatNextRunDateLabel(lastRunOn)}`
}

export type AutoOrganizeLastRunFields = {
  run_on: string
  created_at: string
}

export function formatRunTimeInTimeZone(
  isoTimestamp: string,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoTimestamp))
}

/** Run-now confirm: last-run context (amber when the last run was today). */
export function autoOrganizeRunNowLastRunContext(
  lastRun: AutoOrganizeLastRunFields,
  timeZone: string,
  from: Date = new Date(),
): { message: string; emphasize: boolean } {
  const todayIso = localDateIsoInTimeZone(timeZone, from)
  const timeLabel = formatRunTimeInTimeZone(lastRun.created_at, timeZone)
  const emphasize = lastRun.run_on === todayIso

  if (emphasize) {
    return {
      message: `${AUTO_ORGANIZE_RUN_NOW_LAST_RUN_TODAY_PREFIX} ${timeLabel}.`,
      emphasize: true,
    }
  }

  return {
    message: `Last run ${formatNextRunDateLabel(lastRun.run_on)} at ${timeLabel}`,
    emphasize: false,
  }
}

function formatRunScheduleDayPhrase(day: number): string {
  if (day === 0) return 'the last day'
  return `the ${formatDayOfMonth(day)}`
}

export function formatRunScheduleForDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => (a === 0 ? 99 : a) - (b === 0 ? 99 : b))
  if (sorted.length === 0) return ''
  if (sorted.length === 1) {
    if (sorted[0] === 0) return 'Runs on the last day of each month.'
    return `Runs on the ${formatDayOfMonth(sorted[0])} of each month.`
  }
  if (sorted.length === 2) {
    const [first, second] = sorted
    return `Runs on ${formatRunScheduleDayPhrase(first)} and ${formatRunScheduleDayPhrase(second)} of each month.`
  }
  const phrases = sorted.map(formatRunScheduleDayPhrase)
  const last = phrases.pop()!
  return `Runs on ${phrases.join(', ')}, and ${last} of each month.`
}

function formatEditorNextRunSuffix(isoDate: string): string {
  return `${AUTO_ORGANIZE_NEXT_RUN_LABEL} ${formatNextRunDateLabel(isoDate)}`
}

/** Next scheduled run date for the editor footer (cadence is already in the form). */
export function formatEditorNextRunSummary(
  cadence: AutoOrganizeCadence,
  timeZone: string,
  from: Date = new Date(),
  options?: { skipRunOnDates?: readonly string[] },
): string | null {
  if (cadence.autoOrganizeType === 'monthly') {
    if (!cadence.daysOfMonth?.length) return null
  } else if (cadence.autoOrganizeType === 'interval') {
    if (!cadence.startDate) return null
  } else if (cadence.autoOrganizeType === 'manual') {
    return null
  } else {
    return null
  }

  const next = computeNextRunOn(cadence, timeZone, from, options)
  if (!next) return null
  return formatNextRunDateLabel(next)
}

export function formatShortIsoDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatLocalDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Footer summary in the auto-organize editor before Save. */
export function formatEditorSaveScheduleSummary(
  cadence: AutoOrganizeCadence,
  timeZone: string,
  from: Date = new Date(),
  options?: { skipRunOnDates?: readonly string[] },
): string | null {
  const pattern = formatCadenceSummary(cadence)

  if (cadence.autoOrganizeType === 'monthly') {
    if (!cadence.daysOfMonth?.length) return null
  } else if (cadence.autoOrganizeType === 'interval') {
    if (!cadence.startDate) return null
  } else if (cadence.autoOrganizeType === 'manual') {
    return null
  } else {
    return null
  }

  const next = computeNextRunOn(cadence, timeZone, from, options)
  if (!next) return pattern
  return `${pattern} · ${formatEditorNextRunSuffix(next)}`
}

/** @deprecated use formatEditorSaveScheduleSummary */
export function formatEditorRunSchedulePreview(
  cadence: AutoOrganizeCadence,
  timeZone: string,
  options?: { skipRunOnDates?: readonly string[] },
): string | null {
  return formatEditorSaveScheduleSummary(cadence, timeZone, new Date(), options)
}
