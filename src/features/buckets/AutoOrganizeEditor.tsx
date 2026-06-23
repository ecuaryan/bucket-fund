import { useEffect, useMemo, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { FieldLabel } from '@/components/ui/FieldLabel'
import { ClearableInput } from '@/components/ui/ClearableInput'
import { ScrollFade } from '@/components/ui/ScrollFade'
import {
  AUTO_ORGANIZE_BUCKETS_HINT,
  AUTO_ORGANIZE_DISCARD_BODY,
  AUTO_ORGANIZE_DISCARD_CANCEL,
  AUTO_ORGANIZE_DISCARD_CONFIRM,
  AUTO_ORGANIZE_DISCARD_TITLE,
  AUTO_ORGANIZE_EDIT_LABEL,
  AUTO_ORGANIZE_ESTIMATED_TOTAL_LABEL,
  AUTO_ORGANIZE_FREQUENCY_LABEL,
  AUTO_ORGANIZE_FREQUENCY_OPTIONS,
  AUTO_ORGANIZE_INTERVAL_START_HINT,
  AUTO_ORGANIZE_INTERVAL_START_LABEL,
  AUTO_ORGANIZE_INTERVAL_STARTED_LABEL,
  AUTO_ORGANIZE_INTERVAL_STARTED_HINT,
  AUTO_ORGANIZE_MANUAL_EDITOR_HINT,
  AUTO_ORGANIZE_NAME_HINT,
  AUTO_ORGANIZE_NEXT_RUN_LABEL,
  AUTO_ORGANIZE_NO_BUCKETS_ERROR,
  AUTO_ORGANIZE_NOTHING_TO_MOVE_NOW_LABEL,
  AUTO_ORGANIZE_ONCE_MONTHLY_DAY_LABEL,
  AUTO_ORGANIZE_ONCE_MONTHLY_LAST_DAY_HINT,
  AUTO_ORGANIZE_TWICE_MONTHLY_ON_LABEL,
  AUTO_ORGANIZE_SAVE_LABEL,
  AUTO_ORGANIZE_SAVED_TOAST,
  AUTO_ORGANIZE_SAVE_REQUIRES_AMOUNT_HINT,
  AUTO_ORGANIZE_SAVEOFF_BUCKETS_HINT,
  AUTO_ORGANIZE_SAVEOFF_DESTINATION_HINT,
  AUTO_ORGANIZE_SAVEOFF_DESTINATION_LABEL,
  AUTO_ORGANIZE_SAVEOFF_DEST_FLOAT_LABEL,
  AUTO_ORGANIZE_SAVEOFF_EXPLAINER_HINT,
  AUTO_ORGANIZE_SAVEOFF_KEEP_LABEL,
  AUTO_ORGANIZE_SAVEOFF_KEEP_ZERO_ROW_HINT,
  AUTO_ORGANIZE_START_DATE_TODAY_ERROR,
  AUTO_ORGANIZE_START_DATE_PAST_ERROR,
  AUTO_ORGANIZE_START_DATE_TOO_FAR_ERROR,
  AUTO_ORGANIZE_TIMEZONE_HINT,
  AUTO_ORGANIZE_TIMEZONE_HINT_MANUAL,
  AUTO_ORGANIZE_TIMEZONE_LABEL,
  AUTO_ORGANIZE_TOPUP_DIFFERENCE_HINT,
  AUTO_ORGANIZE_TOPUP_FILL_TO_LABEL,
  AUTO_ORGANIZE_TOTAL_PER_RUN_LABEL,
  autoOrganizeBucketsSectionLabel,
  autoOrganizeKindLabel,
  autoOrganizeKindSubtitle,
  autoOrganizeNamePlaceholder,
  type AutoOrganizeKind,
  type AutoOrganizeFrequencySelection,
} from '@/lib/brand'
import {
  sweepThenFillNotesByBucket,
  computeTotalPerRun,
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
  isManualFrequencySelection,
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
  'id' | 'name' | 'allocated_amount'
>

type Props = {
  open: boolean
  kind: AutoOrganizeKind
  initial: AutoOrganizeWithDetails | null
  buckets: Bucket[]
  /** For sweep-then-fill overlap notes when editing. */
  allAutoOrganizes?: AutoOrganizeWithDetails[]
  memberId: string
  /** Household IANA timezone when known (from loaded auto-organize rows). */
  householdTimezone?: string | null
  onClose: () => void
  onSaved: () => void | Promise<void>
}

type BucketDraft = { bucketId: string; amountStr: string }

type EditorSnapshot = {
  kind: AutoOrganizeKind
  name: string
  familyTimezone: string
  cadence: AutoOrganizeCadence
  monthlyPreset: MonthlyPresetId
  monthlyOnceDay: number
  bucketDrafts: BucketDraft[]
  destinationBucketId: string | null
}

const fieldInputClassName =
  'w-full rounded-lg border-0 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 ring-1 ring-inset ring-zinc-700 placeholder:text-zinc-500 focus:outline focus:outline-2 focus:outline-emerald-400'

const amountInputClassName =
  'w-full min-w-[8.5rem] rounded-lg border-0 bg-zinc-950 py-2 pl-7 pr-3 text-sm tabular-nums text-zinc-300 ring-1 ring-inset ring-zinc-700 placeholder:text-zinc-500 focus:outline focus:outline-2 focus:outline-emerald-400'

const bucketRowGridClassName =
  'grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-3'

const scheduleRowGridClassName =
  'grid grid-cols-1 gap-3 sm:grid-cols-2'

function defaultCadenceForKind(
  kind: AutoOrganizeKind,
  timeZone: string,
): AutoOrganizeCadence {
  switch (kind) {
    case 'top_up':
      return {
        autoOrganizeType: 'monthly',
        startDate: null,
        intervalCount: null,
        intervalUnit: null,
        daysOfMonth: [1],
      }
    case 'save_off':
      return {
        autoOrganizeType: 'monthly',
        startDate: null,
        intervalCount: null,
        intervalUnit: null,
        daysOfMonth: [0],
      }
    default:
      return {
        autoOrganizeType: 'interval',
        startDate: tomorrowIsoInTimeZone(timeZone),
        intervalCount: 2,
        intervalUnit: 'week',
        daysOfMonth: null,
      }
  }
}

function cadenceFromInitial(
  initial: AutoOrganizeWithDetails | null,
  kind: AutoOrganizeKind,
  timeZone: string,
): AutoOrganizeCadence {
  if (!initial) {
    return defaultCadenceForKind(kind, timeZone)
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
  kind: AutoOrganizeKind,
  name: string,
  familyTimezone: string,
  cadence: AutoOrganizeCadence,
  monthlyPreset: MonthlyPresetId,
  monthlyOnceDay: number,
  bucketDrafts: BucketDraft[],
  destinationBucketId: string | null,
): EditorSnapshot {
  return {
    kind,
    name,
    familyTimezone,
    cadence,
    monthlyPreset,
    monthlyOnceDay,
    bucketDrafts,
    destinationBucketId,
  }
}

export default function AutoOrganizeEditor({
  open,
  kind,
  initial,
  buckets,
  allAutoOrganizes = [],
  memberId,
  householdTimezone = null,
  onClose,
  onSaved,
}: Props) {
  const { formatMoney } = useHideAmounts()
  const browserTimezone = resolveFamilyTimezone(null)
  const [familyTimezone, setFamilyTimezone] = useState(browserTimezone)
  const todayIso = localDateIsoInTimeZone(familyTimezone)
  const tomorrowIso = tomorrowIsoInTimeZone(familyTimezone)
  const timezoneOptions = useMemo(
    () => familyTimezoneSelectOptions(familyTimezone),
    [familyTimezone],
  )
  const [baselineSnapshot, setBaselineSnapshot] = useState('')
  const [name, setName] = useState('')
  const [cadence, setCadence] = useState<AutoOrganizeCadence>(() =>
    defaultCadenceForKind(kind, browserTimezone),
  )
  const [monthlyPreset, setMonthlyPreset] =
    useState<MonthlyPresetId>('first-and-fifteenth')
  const [monthlyOnceDay, setMonthlyOnceDay] = useState(1)
  const [bucketDrafts, setBucketDrafts] = useState<BucketDraft[]>(() =>
    bucketDraftsFromBuckets(buckets, undefined),
  )
  const [destinationBucketId, setDestinationBucketId] = useState<string | null>(
    null,
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
      const hasHouseholdSchedule =
        allAutoOrganizes.length > 0 || initial != null
      const nextTimezone = resolveFamilyTimezone(stored, {
        treatUtcAsUnset: !hasHouseholdSchedule,
      })
      if (cancelled) return

      const effectiveKindForInit: AutoOrganizeKind =
        (initial?.auto_organize_kind as AutoOrganizeKind | undefined) ?? kind
      const nextCadence = normalizeMonthlyCadence(
        cadenceFromInitial(initial, effectiveKindForInit, nextTimezone),
      )
      const schedule = monthlyScheduleFromDays(nextCadence.daysOfMonth)
      const nextPreset =
        nextCadence.autoOrganizeType === 'monthly' &&
        nextCadence.daysOfMonth?.length === 2
          ? twiceMonthlyPresetFromDays(nextCadence.daysOfMonth)
          : schedule.preset
      const nextName = initial?.name ?? ''
      const nextBuckets = bucketDraftsFromBuckets(buckets, initial?.lines)
      const nextDest =
        initial?.destination_bucket_id ??
        (kind === 'save_off' ? null : null)

      setFamilyTimezone(nextTimezone)
      setName(nextName)
      setCadence(nextCadence)
      setMonthlyPreset(nextPreset)
      setMonthlyOnceDay(schedule.onceDay)
      setBucketDrafts(nextBuckets)
      setDestinationBucketId(nextDest)
      setError(null)
      setBaselineSnapshot(
        snapshotFromState(
          buildSnapshot(
            kind,
            nextName,
            nextTimezone,
            nextCadence,
            nextPreset,
            schedule.onceDay,
            nextBuckets,
            nextDest,
          ),
        ),
      )
    })()

    return () => {
      cancelled = true
    }
  }, [open, initial, buckets, householdTimezone, kind, allAutoOrganizes.length])

  const effectiveKind: AutoOrganizeKind =
    (initial?.auto_organize_kind as AutoOrganizeKind | undefined) ?? kind

  const sourceBuckets = useMemo(() => {
    if (effectiveKind !== 'save_off') return buckets
    if (!destinationBucketId) return buckets
    return buckets.filter((b) => b.id !== destinationBucketId)
  }, [buckets, destinationBucketId, effectiveKind])

  const parsedBuckets = useMemo(() => {
    const drafts =
      effectiveKind === 'save_off'
        ? bucketDrafts.filter(
            (row) =>
              !destinationBucketId || row.bucketId !== destinationBucketId,
          )
        : bucketDrafts

    return drafts
      .map((row) => ({
        bucketId: row.bucketId,
        amount: parseFloat(row.amountStr),
        amountStr: row.amountStr,
      }))
      .filter((row) => {
        if (!row.bucketId) return false
        if (effectiveKind === 'save_off') {
          return row.amountStr.trim() !== '' && Number.isFinite(row.amount) && row.amount >= 0
        }
        return Number.isFinite(row.amount) && row.amount > 0
      })
  }, [bucketDrafts, destinationBucketId, effectiveKind])

  const linesForTotal = useMemo(
    () =>
      parsedBuckets.map((row) => {
        const bucket = buckets.find((b) => b.id === row.bucketId)
        return {
          bucket_id: row.bucketId,
          amount: row.amount,
          bucket_allocated_amount: bucket
            ? Number(bucket.allocated_amount)
            : 0,
        }
      }),
    [parsedBuckets, buckets],
  )

  const { total: totalPerRun, isEstimate: totalIsEstimate } = useMemo(
    () => computeTotalPerRun(effectiveKind, linesForTotal),
    [effectiveKind, linesForTotal],
  )

  const frequencySelection = frequencySelectionFromCadence(
    cadence,
    monthlyPreset,
  )
  const isManual = isManualFrequencySelection(frequencySelection)

  const sweepThenFillNotes = useMemo(() => {
    const bucketIds = new Set(parsedBuckets.map((r) => r.bucketId))
    return sweepThenFillNotesByBucket(
      allAutoOrganizes,
      bucketIds,
      effectiveKind,
      isManual,
      initial?.id ?? null,
    )
  }, [
    parsedBuckets,
    allAutoOrganizes,
    effectiveKind,
    isManual,
    initial?.id,
  ])

  const title = initial
    ? AUTO_ORGANIZE_EDIT_LABEL
    : autoOrganizeKindLabel(effectiveKind)
  const totalLabel = totalIsEstimate
    ? AUTO_ORGANIZE_ESTIMATED_TOTAL_LABEL
    : AUTO_ORGANIZE_TOTAL_PER_RUN_LABEL
  const bucketsSectionLabel = autoOrganizeBucketsSectionLabel(effectiveKind)
  const bucketsHint =
    effectiveKind === 'save_off'
      ? AUTO_ORGANIZE_SAVEOFF_BUCKETS_HINT
      : AUTO_ORGANIZE_BUCKETS_HINT
  const amountColumnLabel =
    effectiveKind === 'top_up'
      ? AUTO_ORGANIZE_TOPUP_FILL_TO_LABEL
      : effectiveKind === 'save_off'
        ? AUTO_ORGANIZE_SAVEOFF_KEEP_LABEL
        : null
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
    if (isManual) return null

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
    isManual,
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
        effectiveKind,
        name,
        familyTimezone,
        cadence,
        monthlyPreset,
        monthlyOnceDay,
        bucketDrafts,
        destinationBucketId,
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
      kind: effectiveKind,
      name: name.trim() || null,
      paused: initial?.paused ?? false,
      cadence: cadenceToSave,
      lines: parsedBuckets.map(({ bucketId, amount }) => ({ bucketId, amount })),
      destinationBucketId:
        effectiveKind === 'save_off' ? destinationBucketId : null,
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
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-zinc-300">{title}</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {autoOrganizeKindSubtitle(effectiveKind, isManual)}
            </p>
          </div>
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
              placeholder={autoOrganizeNamePlaceholder(effectiveKind)}
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
              {isManual
                ? AUTO_ORGANIZE_TIMEZONE_HINT_MANUAL
                : AUTO_ORGANIZE_TIMEZONE_HINT}
            </p>
          </label>

          {isManual ? (
            <div>
              <label className="block min-w-0">
                <FieldLabel>{AUTO_ORGANIZE_FREQUENCY_LABEL}</FieldLabel>
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
              <p className="mt-1 text-xs text-zinc-500">
                {AUTO_ORGANIZE_MANUAL_EDITOR_HINT}
              </p>
            </div>
          ) : isIntervalFrequencySelection(frequencySelection) ? (
            <div>
              <div className={scheduleRowGridClassName}>
                <label className="block min-w-0">
                  <FieldLabel>{AUTO_ORGANIZE_FREQUENCY_LABEL}</FieldLabel>
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
                  <FieldLabel>{AUTO_ORGANIZE_FREQUENCY_LABEL}</FieldLabel>
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
                <FieldLabel>{AUTO_ORGANIZE_FREQUENCY_LABEL}</FieldLabel>
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
            <FieldLabel>{bucketsSectionLabel}</FieldLabel>
            <p className="mt-1 text-xs text-zinc-500">{bucketsHint}</p>
            {effectiveKind === 'top_up' ? (
              <p className="mt-1 text-xs text-zinc-500">
                {AUTO_ORGANIZE_TOPUP_DIFFERENCE_HINT}
              </p>
            ) : null}
            {effectiveKind === 'save_off' ? (
              <p className="mt-1 text-xs text-zinc-500">
                {AUTO_ORGANIZE_SAVEOFF_EXPLAINER_HINT}
              </p>
            ) : null}
            <div className="mt-2 space-y-2">
              {sourceBuckets.map((bucket) => {
                const amountStr =
                  bucketDrafts.find((row) => row.bucketId === bucket.id)
                    ?.amountStr ?? ''
                const sweepThenFillNote = sweepThenFillNotes.get(bucket.id)
                const saveOffKeepAmount = parseFloat(amountStr)
                const showSaveOffSweepAllHint =
                  effectiveKind === 'save_off' &&
                  amountStr.trim() !== '' &&
                  Number.isFinite(saveOffKeepAmount) &&
                  saveOffKeepAmount === 0
                return (
                  <div key={bucket.id}>
                    <div className={bucketRowGridClassName}>
                      <span className="truncate text-sm text-zinc-300">
                        {bucket.name}
                      </span>
                      <div className="min-w-0">
                        {amountColumnLabel ? (
                          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                            {amountColumnLabel}
                          </span>
                        ) : null}
                        <ClearableInput
                          wrapperClassName="min-w-0"
                          inputMode="decimal"
                          value={amountStr}
                          onValueChange={(value) =>
                            setAmountForBucket(bucket.id, value)
                          }
                          onFocus={(e) => scrollFocusedIntoView(e.currentTarget)}
                          placeholder={
                            effectiveKind === 'save_off' ? '' : '0.00'
                          }
                          leading={
                            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-500">
                              $
                            </span>
                          }
                          inputClassName={amountInputClassName}
                        />
                      </div>
                    </div>
                    {showSaveOffSweepAllHint ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        {AUTO_ORGANIZE_SAVEOFF_KEEP_ZERO_ROW_HINT}
                      </p>
                    ) : null}
                    {sweepThenFillNote ? (
                      <p className="mt-1 text-xs text-amber-200/80">
                        {sweepThenFillNote}
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>

          {effectiveKind === 'save_off' ? (
            <label className="block">
              <FieldLabel>{AUTO_ORGANIZE_SAVEOFF_DESTINATION_LABEL}</FieldLabel>
              <select
                value={destinationBucketId ?? ''}
                onChange={(e) =>
                  setDestinationBucketId(e.target.value || null)
                }
                className={fieldInputClassName}
              >
                <option value="">{AUTO_ORGANIZE_SAVEOFF_DEST_FLOAT_LABEL}</option>
                {buckets.map((bucket) => (
                  <option key={bucket.id} value={bucket.id}>
                    {bucket.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-500">
                {AUTO_ORGANIZE_SAVEOFF_DESTINATION_HINT}
              </p>
            </label>
          ) : null}
          </div>
        </ScrollFade>

        <div className="shrink-0 space-y-2 border-t border-zinc-800 px-1 pt-3">
          <div className="rounded-xl bg-zinc-950 px-3 py-2 ring-1 ring-inset ring-zinc-700">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                {totalLabel}
              </p>
              <p className="text-xl font-semibold tabular-nums text-zinc-100">
                {totalIsEstimate && totalPerRun === 0 ? (
                  <span className="text-sm font-normal text-zinc-500">
                    {AUTO_ORGANIZE_NOTHING_TO_MOVE_NOW_LABEL}
                  </span>
                ) : (
                  <>
                    {totalIsEstimate ? '~' : ''}
                    {formatMoney(totalPerRun)}
                  </>
                )}
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
