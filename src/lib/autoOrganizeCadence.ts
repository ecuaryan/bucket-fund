import type { AutoOrganizeFrequencySelection } from '@/lib/brand'
import { AUTO_ORGANIZE_FREQUENCY_OPTIONS } from '@/lib/brand'

export type AutoOrganizeType = 'interval' | 'monthly'

export function isIntervalFrequencySelection(
  selection: AutoOrganizeFrequencySelection,
): boolean {
  return !selection.startsWith('monthly-')
}

export function frequencySelectionFromCadence(
  cadence: AutoOrganizeCadence,
  monthlyPreset: MonthlyPresetId,
): AutoOrganizeFrequencySelection {
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

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

function isDueOn(cadence: AutoOrganizeCadence, localDate: Date): boolean {
  const y = localDate.getFullYear()
  const m = localDate.getMonth()
  const d = localDate.getDate()

  if (cadence.autoOrganizeType === 'monthly') {
    const days = cadence.daysOfMonth ?? []
    const last = lastDayOfMonth(y, m)
    if (days.includes(0) && d === last) return true
    return days.includes(d)
  }

  const start = cadence.startDate
  if (!start || !cadence.intervalCount || !cadence.intervalUnit) return false
  const startDate = new Date(`${start}T12:00:00`)
  const target = new Date(Date.UTC(y, m, d, 12))
  if (target < startDate) return false

  if (cadence.intervalUnit === 'week') {
    const diffDays = Math.floor(
      (target.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
    )
    return diffDays % (cadence.intervalCount * 7) === 0
  }

  const monthsDiff =
    (y - startDate.getFullYear()) * 12 + (m - startDate.getMonth())
  if (monthsDiff < 0 || monthsDiff % cadence.intervalCount !== 0) return false
  const anchorDay = Math.min(
    startDate.getDate(),
    lastDayOfMonth(y, m),
  )
  return d === anchorDay
}

/** Next local calendar date this auto-organize would run (for cards). */
export function computeNextRunOn(
  cadence: AutoOrganizeCadence,
  timeZone: string,
  from: Date = new Date(),
): string | null {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  for (let offset = 0; offset < 366; offset += 1) {
    const probe = new Date(from.getTime() + offset * 24 * 60 * 60 * 1000)
    const parts = formatter.formatToParts(probe)
    const y = Number(parts.find((p) => p.type === 'year')?.value)
    const mo = Number(parts.find((p) => p.type === 'month')?.value)
    const da = Number(parts.find((p) => p.type === 'day')?.value)
    const local = new Date(y, mo - 1, da, 12)
    if (isDueOn(cadence, local)) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`
    }
  }
  return null
}

export function formatNextRunLabel(nextRunOn: string | null): string {
  if (!nextRunOn) return 'No upcoming run'
  const [y, m, d] = nextRunOn.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `Next ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
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

function localTodayIso(from: Date = new Date()): string {
  return [
    from.getFullYear(),
    String(from.getMonth() + 1).padStart(2, '0'),
    String(from.getDate()).padStart(2, '0'),
  ].join('-')
}

/** Next run ISO for the editor summary (interval prefers future start date). */
function editorNextRunIso(
  cadence: AutoOrganizeCadence,
  timeZone: string,
): string | null {
  if (cadence.autoOrganizeType === 'interval') {
    if (!cadence.startDate) return null
    if (cadence.startDate >= localTodayIso()) return cadence.startDate
    return computeNextRunOn(cadence, timeZone) ?? cadence.startDate
  }
  return computeNextRunOn(cadence, timeZone)
}

function formatEditorFirstRunSuffix(
  isoDate: string,
  variant: 'short' | 'weekday',
): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (variant === 'short') {
    return `First run ${date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })}`
  }
  return `First run ${date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`
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
): string | null {
  const pattern = formatCadenceSummary(cadence)

  if (cadence.autoOrganizeType === 'monthly') {
    if (!cadence.daysOfMonth?.length) return null
    const next = editorNextRunIso(cadence, timeZone)
    if (!next) return pattern
    return `${pattern} · ${formatEditorFirstRunSuffix(next, 'short')}`
  }

  if (cadence.autoOrganizeType === 'interval') {
    if (!cadence.startDate) return null
    const next = editorNextRunIso(cadence, timeZone)
    if (!next) return pattern
    return `${pattern} · ${formatEditorFirstRunSuffix(next, 'weekday')}`
  }

  return null
}

/** @deprecated use formatEditorSaveScheduleSummary */
export function formatEditorRunSchedulePreview(
  cadence: AutoOrganizeCadence,
  timeZone: string,
): string | null {
  return formatEditorSaveScheduleSummary(cadence, timeZone)
}
