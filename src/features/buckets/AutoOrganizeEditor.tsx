import { useEffect, useMemo, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { FieldLabel } from '@/components/ui/FieldLabel'
import { ClearableInput } from '@/components/ui/ClearableInput'
import { ScrollFade } from '@/components/ui/ScrollFade'
import {
  AUTO_ORGANIZE_ADD_LABEL,
  AUTO_ORGANIZE_BUCKETS_HINT,
  AUTO_ORGANIZE_BUCKETS_LABEL,
  AUTO_ORGANIZE_DISCARD_BODY,
  AUTO_ORGANIZE_DISCARD_CANCEL,
  AUTO_ORGANIZE_DISCARD_CONFIRM,
  AUTO_ORGANIZE_DISCARD_TITLE,
  AUTO_ORGANIZE_EDIT_LABEL,
  AUTO_ORGANIZE_FREQUENCY_OPTIONS,
  AUTO_ORGANIZE_INTERVAL_START_HINT,
  AUTO_ORGANIZE_INTERVAL_START_LABEL,
  AUTO_ORGANIZE_INTERVAL_STARTED_LABEL,
  AUTO_ORGANIZE_INTERVAL_STARTED_HINT,
  AUTO_ORGANIZE_NAME_HINT,
  AUTO_ORGANIZE_NEXT_RUN_LABEL,
  AUTO_ORGANIZE_NO_BUCKETS_ERROR,
  AUTO_ORGANIZE_ONCE_MONTHLY_DAY_LABEL,
  AUTO_ORGANIZE_ONCE_MONTHLY_LAST_DAY_HINT,
  AUTO_ORGANIZE_TWICE_MONTHLY_ON_LABEL,
  AUTO_ORGANIZE_SAVE_LABEL,
  AUTO_ORGANIZE_SAVED_TOAST,
  AUTO_ORGANIZE_SAVE_REQUIRES_AMOUNT_HINT,
  AUTO_ORGANIZE_START_DATE_TODAY_ERROR,
  AUTO_ORGANIZE_START_DATE_PAST_ERROR,
  AUTO_ORGANIZE_START_DATE_TOO_FAR_ERROR,
  AUTO_ORGANIZE_TIMEZONE_HINT,
  AUTO_ORGANIZE_TIMEZONE_LABEL,
  AUTO_ORGANIZE_TOTAL_PER_RUN_LABEL,
  type AutoOrganizeFrequencySelection,
} from '@/lib/brand'
import {
  fetchFamilyTimezone,
  saveAutoOrganize,
  type AutoOrganizeInput,
  type AutoOrganizeWithDetails,
} from '@/lib/autoOrganize'
import {
  familyTimezoneSelectOptions,
  isValidIanaTimezone,
  resolveFamilyTimezone,
} from '@/lib/familyTimezones'
import { formatErrorMessage } from '@/lib/errorMessage'
import { toast } from '@/lib/toast'
import {
  AUTO_ORGANIZE_ONCE_MONTHLY_DAY_OPTIONS,
  AUTO_ORGANIZE_TWICE_MONTHLY_PRESETS,
  applyFrequencySelection,
  daysOfMonthFromSchedule,
  formatEditorNextRunSummary,
  frequencySelectionFromCadence,
  isIntervalFrequencySelection,
  monthlyScheduleFromDays,
  normalizeMonthlyCadence,
  twiceMonthlyPresetFromDays,
  type AutoOrganizeCadence,
  type MonthlyPresetId,
  formatShortIsoDateLabel,
  localDateIsoInTimeZone,
  tomorrowIsoInTimeZone,
  validateIntervalStartDate,
  maxIntervalStartDateIso,
} from '@/lib/autoOrganizeCadence'
import { useHideAmounts } from '@/lib/HideAmountsProvider'
import { scrollFocusedIntoView } from '@/lib/keyboardViewport'
import type { Database } from '@/types/database'

type Bucket = Pick<
  Database['public']['Tables']['buckets']['Row'],
  'id' | 'name'
>

type Props = {
  open: boolean
  initial: AutoOrganizeWithDetails | null
  buckets: Bucket[]
  memberId: string
  /** Household IANA timezone when known (from loaded auto-organize rows). */
  householdTimezone?: string | null
  onClose: () => void
  onSaved: () => void | Promise<void>
}

type BucketDraft = { bucketId: string; amountStr: string }

type EditorSnapshot = {
  name: string
  familyTimezone: string
  cadence: AutoOrganizeCadence
  monthlyPreset: MonthlyPresetId
  monthlyOnceDay: number
  bucketDrafts: BucketDraft[]
}

const fieldInputClassName =
  'w-full rounded-lg border-0 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 ring-1 ring-inset ring-zinc-700 placeholder:text-zinc-500 focus:outline focus:outline-2 focus:outline-emerald-400'

const amountInputClassName =
  'w-full min-w-[8.5rem] rounded-lg border-0 bg-zinc-950 py-2 pl-7 pr-3 text-sm tabular-nums text-zinc-300 ring-1 ring-inset ring-zinc-700 placeholder:text-zinc-500 focus:outline focus:outline-2 focus:outline-emerald-400'

const bucketRowGridClassName =
  'grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-3'

const scheduleRowGridClassName =
  'grid grid-cols-1 gap-3 sm:grid-cols-2'

function cadenceFromInitial(
  initial: AutoOrganizeWithDetails | null,
  timeZone: string,
): AutoOrganizeCadence {
  if (!initial) {
    return {
      autoOrganizeType: 'interval',
      startDate: tomorrowIsoInTimeZone(timeZone),
      intervalCount: 2,
      intervalUnit: 'week',
      daysOfMonth: null,
    }
  }
  return {
    autoOrganizeType: initial.auto_organize_type as AutoOrganizeCadence['autoOrganizeType'],
    startDate: initial.start_date,
    intervalCount: initial.interval_count,
    intervalUnit: initial.interval_unit as AutoOrganizeCadence['intervalUnit'],
    daysOfMonth: initial.days_of_month,
  }
}

function bucketDraftsFromBuckets(
  buckets: Bucket[],
  lines: AutoOrganizeWithDetails['lines'] | undefined,
): BucketDraft[] {
  const amountByBucketId = new Map(
    (lines ?? []).map((line) => [line.bucket_id, String(Number(line.amount))]),
  )
  return buckets.map((bucket) => ({
    bucketId: bucket.id,
    amountStr: amountByBucketId.get(bucket.id) ?? '',
  }))
}

function sanitizeAmountInput(value: string): string {
  return value.replace(/-/g, '')
}

function snapshotFromState(state: EditorSnapshot): string {
  return JSON.stringify(state)
}

function buildSnapshot(
  name: string,
  familyTimezone: string,
  cadence: AutoOrganizeCadence,
  monthlyPreset: MonthlyPresetId,
  monthlyOnceDay: number,
  bucketDrafts: BucketDraft[],
): EditorSnapshot {
  return { name, familyTimezone, cadence, monthlyPreset, monthlyOnceDay, bucketDrafts }
}

export default function AutoOrganizeEditor({
  open,
  initial,
  buckets,
  memberId,
  householdTimezone = null,
  onClose,
  onSaved,
}: Props) {
  const { formatMoney } = useHideAmounts()
  const [familyTimezone, setFamilyTimezone] = useState('America/New_York')
  const todayIso = localDateIsoInTimeZone(familyTimezone)
  const tomorrowIso = tomorrowIsoInTimeZone(familyTimezone)
  const timezoneOptions = useMemo(
    () => familyTimezoneSelectOptions(familyTimezone),
    [familyTimezone],
  )
  const [baselineSnapshot, setBaselineSnapshot] = useState('')
  const [name, setName] = useState('')
  const [cadence, setCadence] = useState<AutoOrganizeCadence>(() =>
    cadenceFromInitial(null, 'America/New_York'),
  )
  const [monthlyPreset, setMonthlyPreset] =
    useState<MonthlyPresetId>('first-and-fifteenth')
  const [monthlyOnceDay, setMonthlyOnceDay] = useState(1)
  const [bucketDrafts, setBucketDrafts] = useState<BucketDraft[]>(() =>
    bucketDraftsFromBuckets(buckets, undefined),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      setDiscardOpen(false)
      return
    }

    let cancelled = false

    void (async () => {
      const stored =
        initial?.familyTimezone ??
        householdTimezone ??
        (await fetchFamilyTimezone())
      const nextTimezone = resolveFamilyTimezone(stored)
      if (cancelled) return

      const nextCadence = normalizeMonthlyCadence(
        cadenceFromInitial(initial, nextTimezone),
      )
      const schedule = monthlyScheduleFromDays(nextCadence.daysOfMonth)
      const nextPreset =
        nextCadence.autoOrganizeType === 'monthly' &&
        nextCadence.daysOfMonth?.length === 2
          ? twiceMonthlyPresetFromDays(nextCadence.daysOfMonth)
          : schedule.preset
      const nextName = initial?.name ?? ''
      const nextBuckets = bucketDraftsFromBuckets(buckets, initial?.lines)

      setFamilyTimezone(nextTimezone)
      setName(nextName)
      setCadence(nextCadence)
      setMonthlyPreset(nextPreset)
      setMonthlyOnceDay(schedule.onceDay)
      setBucketDrafts(nextBuckets)
      setError(null)
      setBaselineSnapshot(
        snapshotFromState(
          buildSnapshot(
            nextName,
            nextTimezone,
            nextCadence,
            nextPreset,
            schedule.onceDay,
            nextBuckets,
          ),
        ),
      )
    })()

    return () => {
      cancelled = true
    }
  }, [open, initial, buckets, householdTimezone])

  const parsedBuckets = useMemo(
    () =>
      bucketDrafts
        .map((row) => ({
          bucketId: row.bucketId,
          amount: parseFloat(row.amountStr),
        }))
        .filter(
          (row) =>
            row.bucketId && Number.isFinite(row.amount) && row.amount > 0,
        ),
    [bucketDrafts],
  )

  const totalPerRun = parsedBuckets.reduce((sum, row) => sum + row.amount, 0)
  const title = initial ? AUTO_ORGANIZE_EDIT_LABEL : AUTO_ORGANIZE_ADD_LABEL
  const frequencySelection = frequencySelectionFromCadence(
    cadence,
    monthlyPreset,
  )
  const intervalStartMin = tomorrowIso
  const intervalStartMax = maxIntervalStartDateIso(familyTimezone)
  const legacyStartDate = initial?.start_date ?? null
  const intervalStartLocked = Boolean(
    initial &&
      cadence.startDate &&
      cadence.startDate < todayIso,
  )

  function intervalStartDateError(candidate: string): string | null {
    const result = validateIntervalStartDate(candidate, familyTimezone, {
      legacyStartDate,
    })
    if (result.ok) return null
    if (result.ok === false && result.reason === 'today') {
      return AUTO_ORGANIZE_START_DATE_TODAY_ERROR
    }
    if (result.ok === false && result.reason === 'too_far') {
      return AUTO_ORGANIZE_START_DATE_TOO_FAR_ERROR
    }
    return AUTO_ORGANIZE_START_DATE_PAST_ERROR
  }
  const saveNextRunSummary = useMemo(() => {
    if (
      isIntervalFrequencySelection(frequencySelection) &&
      !cadence.startDate
    ) {
      return null
    }

    const previewCadence: AutoOrganizeCadence =
      isIntervalFrequencySelection(frequencySelection)
        ? cadence
        : {
            autoOrganizeType: 'monthly',
            startDate: null,
            intervalCount: null,
            intervalUnit: null,
            daysOfMonth: daysOfMonthFromSchedule(
              frequencySelection === 'monthly-once' ? 'once' : monthlyPreset,
              monthlyOnceDay,
            ),
          }

    return formatEditorNextRunSummary(previewCadence, familyTimezone)
  }, [
    frequencySelection,
    cadence,
    monthlyPreset,
    monthlyOnceDay,
    familyTimezone,
  ])

  function setFrequencySelection(selection: AutoOrganizeFrequencySelection) {
    const next = applyFrequencySelection(
      selection,
      cadence,
      monthlyPreset,
      tomorrowIso,
    )
    setCadence(next.cadence)
    setMonthlyPreset(next.monthlyPreset)
  }

  function setIntervalStartDate(value: string) {
    if (!value) {
      setError(null)
      setCadence((prev) => ({ ...prev, startDate: null }))
      return
    }
    const message = intervalStartDateError(value)
    if (message) {
      setError(message)
      return
    }
    setError(null)
    setCadence((prev) => ({
      ...prev,
      startDate: value,
    }))
  }

  function clearIntervalStartDateErrorIfValid() {
    if (!cadence.startDate || intervalStartDateError(cadence.startDate)) return
    setError((current) =>
      current === AUTO_ORGANIZE_START_DATE_TODAY_ERROR ||
      current === AUTO_ORGANIZE_START_DATE_PAST_ERROR ||
      current === AUTO_ORGANIZE_START_DATE_TOO_FAR_ERROR
        ? null
        : current,
    )
  }

  function setAmountForBucket(bucketId: string, amountStr: string) {
    setBucketDrafts((prev) =>
      prev.map((row) =>
        row.bucketId === bucketId
          ? { ...row, amountStr: sanitizeAmountInput(amountStr) }
          : row,
      ),
    )
  }

  const isDirty =
    snapshotFromState(
      buildSnapshot(
        name,
        familyTimezone,
        cadence,
        monthlyPreset,
        monthlyOnceDay,
        bucketDrafts,
      ),
    ) !== baselineSnapshot

  function requestClose() {
    if (submitting) return
    if (isDirty) {
      setDiscardOpen(true)
      return
    }
    onClose()
  }

  function confirmDiscard() {
    setDiscardOpen(false)
    onClose()
  }

  async function onSubmit() {
    if (parsedBuckets.length === 0) {
      setError(AUTO_ORGANIZE_NO_BUCKETS_ERROR)
      return
    }
    if (cadence.autoOrganizeType === 'interval' && !cadence.startDate) {
      setError('Choose a start date.')
      return
    }
    if (cadence.autoOrganizeType === 'interval' && cadence.startDate) {
      const message = intervalStartDateError(cadence.startDate)
      if (message) {
        setError(message)
        return
      }
    }
    if (!isValidIanaTimezone(familyTimezone)) {
      setError('Choose a valid timezone.')
      return
    }

    const cadenceToSave: AutoOrganizeCadence =
      cadence.autoOrganizeType === 'monthly'
        ? normalizeMonthlyCadence({
            ...cadence,
            daysOfMonth: daysOfMonthFromSchedule(
              monthlyPreset,
              monthlyOnceDay,
            ),
          })
        : cadence

    const input: AutoOrganizeInput = {
      id: initial?.id,
      name: name.trim() || null,
      paused: initial?.paused ?? false,
      cadence: cadenceToSave,
      lines: parsedBuckets,
      familyTimezone,
    }

    setSubmitting(true)
    setError(null)
    try {
      await saveAutoOrganize(input, memberId)
      toast.success(AUTO_ORGANIZE_SAVED_TOAST)
      onClose()
      await Promise.resolve(onSaved())
    } catch (e) {
      setError(formatErrorMessage(e, 'Could not save auto-organize.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={requestClose}
      fillViewport
      aria-label={title}
    >
      <div className="relative flex max-h-full min-h-0 flex-1 flex-col overflow-hidden">
        <header className="mb-4 flex shrink-0 items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-300">{title}</h2>
          <button
            type="button"
            onClick={requestClose}
            disabled={submitting}
            className="rounded p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <ScrollFade scrollClassName="p-1">
          <div className="space-y-4">
            <label className="block">
              <FieldLabel optional>Name</FieldLabel>
            <ClearableInput
              value={name}
              onValueChange={setName}
              placeholder="Payday"
              inputClassName={fieldInputClassName}
            />
            <p className="mt-1 text-xs text-zinc-500">{AUTO_ORGANIZE_NAME_HINT}</p>
          </label>

          <label className="block">
            <FieldLabel>{AUTO_ORGANIZE_TIMEZONE_LABEL}</FieldLabel>
            <select
              value={familyTimezone}
              onChange={(e) => setFamilyTimezone(e.target.value)}
              className={fieldInputClassName}
            >
              {timezoneOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">
              {AUTO_ORGANIZE_TIMEZONE_HINT}
            </p>
          </label>

          {isIntervalFrequencySelection(frequencySelection) ? (
            <div>
              <div className={scheduleRowGridClassName}>
                <label className="block min-w-0">
                  <FieldLabel>Frequency</FieldLabel>
                  <select
                    value={frequencySelection}
                    onChange={(e) =>
                      setFrequencySelection(
                        e.target.value as AutoOrganizeFrequencySelection,
                      )
                    }
                    className={fieldInputClassName}
                  >
                    {AUTO_ORGANIZE_FREQUENCY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="block min-w-0">
                  <FieldLabel>
                    {intervalStartLocked
                      ? AUTO_ORGANIZE_INTERVAL_STARTED_LABEL
                      : AUTO_ORGANIZE_INTERVAL_START_LABEL}
                  </FieldLabel>
                  {intervalStartLocked && cadence.startDate ? (
                    <p
                      className={`${fieldInputClassName} text-zinc-400`}
                      aria-readonly="true"
                    >
                      {formatShortIsoDateLabel(cadence.startDate)}
                    </p>
                  ) : (
                    <input
                      type="date"
                      min={intervalStartMin}
                      max={intervalStartMax}
                      value={cadence.startDate ?? ''}
                      onChange={(e) => setIntervalStartDate(e.target.value)}
                      onBlur={clearIntervalStartDateErrorIfValid}
                      className={fieldInputClassName}
                    />
                  )}
                </div>
              </div>
              {!intervalStartLocked ? (
                <p className="mt-1 text-xs text-zinc-500">
                  {AUTO_ORGANIZE_INTERVAL_START_HINT}
                </p>
              ) : (
                <p className="mt-1 text-xs text-zinc-500">
                  {AUTO_ORGANIZE_INTERVAL_STARTED_HINT}
                </p>
              )}
            </div>
          ) : frequencySelection === 'monthly-once' ? (
            <div>
              <div className={scheduleRowGridClassName}>
                <label className="block min-w-0">
                  <FieldLabel>Frequency</FieldLabel>
                  <select
                    value={frequencySelection}
                    onChange={(e) =>
                      setFrequencySelection(
                        e.target.value as AutoOrganizeFrequencySelection,
                      )
                    }
                    className={fieldInputClassName}
                  >
                    {AUTO_ORGANIZE_FREQUENCY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block min-w-0">
                  <FieldLabel>{AUTO_ORGANIZE_ONCE_MONTHLY_DAY_LABEL}</FieldLabel>
                  <select
                    value={monthlyOnceDay}
                    onChange={(e) =>
                      setMonthlyOnceDay(Number(e.target.value))
                    }
                    className={fieldInputClassName}
                  >
                    {AUTO_ORGANIZE_ONCE_MONTHLY_DAY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {monthlyOnceDay === 0 ? (
                <p className="mt-1 text-xs text-zinc-500">
                  {AUTO_ORGANIZE_ONCE_MONTHLY_LAST_DAY_HINT}
                </p>
              ) : null}
            </div>
          ) : (
            <div className={scheduleRowGridClassName}>
              <label className="block min-w-0">
                <FieldLabel>Frequency</FieldLabel>
                <select
                  value={frequencySelection}
                  onChange={(e) =>
                    setFrequencySelection(
                      e.target.value as AutoOrganizeFrequencySelection,
                    )
                  }
                  className={fieldInputClassName}
                >
                  {AUTO_ORGANIZE_FREQUENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block min-w-0">
                <FieldLabel>{AUTO_ORGANIZE_TWICE_MONTHLY_ON_LABEL}</FieldLabel>
                <select
                  value={monthlyPreset}
                  onChange={(e) =>
                    setMonthlyPreset(e.target.value as MonthlyPresetId)
                  }
                  className={fieldInputClassName}
                >
                  {AUTO_ORGANIZE_TWICE_MONTHLY_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="border-t border-zinc-800 pt-4 pb-4">
            <FieldLabel>{AUTO_ORGANIZE_BUCKETS_LABEL}</FieldLabel>
            <p className="mt-1 text-xs text-zinc-500">
              {AUTO_ORGANIZE_BUCKETS_HINT}
            </p>
            <div className="mt-2 space-y-2">
              {buckets.map((bucket) => {
                const amountStr =
                  bucketDrafts.find((row) => row.bucketId === bucket.id)
                    ?.amountStr ?? ''
                return (
                  <div key={bucket.id} className={bucketRowGridClassName}>
                    <span className="truncate text-sm text-zinc-300">
                      {bucket.name}
                    </span>
                    <ClearableInput
                      wrapperClassName="min-w-0"
                      inputMode="decimal"
                      value={amountStr}
                      onValueChange={(value) =>
                        setAmountForBucket(bucket.id, value)
                      }
                      onFocus={(e) => scrollFocusedIntoView(e.currentTarget)}
                      placeholder="0.00"
                      leading={
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-500">
                          $
                        </span>
                      }
                      inputClassName={amountInputClassName}
                    />
                  </div>
                )
              })}
            </div>
          </div>
          </div>
        </ScrollFade>

        <div className="shrink-0 space-y-2 border-t border-zinc-800 px-1 pt-3">
          <div className="rounded-xl bg-zinc-950 px-3 py-2 ring-1 ring-inset ring-zinc-700">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                {AUTO_ORGANIZE_TOTAL_PER_RUN_LABEL}
              </p>
              <p className="text-xl font-semibold tabular-nums text-zinc-100">
                {formatMoney(totalPerRun)}
              </p>
            </div>
            {saveNextRunSummary ? (
              <div className="mt-2 border-t border-zinc-800 pt-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    {AUTO_ORGANIZE_NEXT_RUN_LABEL}
                  </p>
                  <p className="min-w-0 text-right text-xs leading-snug text-zinc-300">
                    {saveNextRunSummary}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {parsedBuckets.length === 0 ? (
            <p className="text-xs text-zinc-500">
              {AUTO_ORGANIZE_SAVE_REQUIRES_AMOUNT_HINT}
            </p>
          ) : null}

          {error ? (
            <p
              className="break-words rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-inset ring-red-500/30"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={requestClose}
              disabled={submitting}
              className="flex-1 rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || parsedBuckets.length === 0}
              onClick={() => void onSubmit()}
              className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Saving…' : AUTO_ORGANIZE_SAVE_LABEL}
            </button>
          </div>
        </div>
      </div>

      {discardOpen ? (
        <div
          className="absolute inset-0 flex items-end rounded-2xl bg-zinc-950/90 p-5 sm:items-center sm:justify-center"
          role="alertdialog"
          aria-labelledby="auto-organize-discard-title"
          aria-describedby="auto-organize-discard-body"
        >
          <div className="w-full rounded-xl bg-zinc-900 p-4 ring-1 ring-zinc-700">
            <h3
              id="auto-organize-discard-title"
              className="text-base font-semibold text-zinc-100"
            >
              {AUTO_ORGANIZE_DISCARD_TITLE}
            </h3>
            <p
              id="auto-organize-discard-body"
              className="mt-2 text-sm text-zinc-400"
            >
              {AUTO_ORGANIZE_DISCARD_BODY}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDiscardOpen(false)}
                className="flex-1 rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200"
              >
                {AUTO_ORGANIZE_DISCARD_CANCEL}
              </button>
              <button
                type="button"
                onClick={confirmDiscard}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
              >
                {AUTO_ORGANIZE_DISCARD_CONFIRM}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Sheet>
  )
}
