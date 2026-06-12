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
  AUTO_ORGANIZE_NAME_HINT,
  AUTO_ORGANIZE_NO_BUCKETS_ERROR,
  AUTO_ORGANIZE_ONCE_MONTHLY_DAY_LABEL,
  AUTO_ORGANIZE_ONCE_MONTHLY_LAST_DAY_HINT,
  AUTO_ORGANIZE_TWICE_MONTHLY_ON_LABEL,
  AUTO_ORGANIZE_SAVE_LABEL,
  AUTO_ORGANIZE_SCHEDULE_SUMMARY_LABEL,
  AUTO_ORGANIZE_TOTAL_PER_RUN_LABEL,
  type AutoOrganizeFrequencySelection,
} from '@/lib/brand'
import {
  saveAutoOrganize,
  type AutoOrganizeInput,
  type AutoOrganizeWithDetails,
} from '@/lib/autoOrganize'
import { formatErrorMessage } from '@/lib/errorMessage'
import {
  AUTO_ORGANIZE_ONCE_MONTHLY_DAY_OPTIONS,
  AUTO_ORGANIZE_TWICE_MONTHLY_PRESETS,
  applyFrequencySelection,
  daysOfMonthFromSchedule,
  formatEditorSaveScheduleSummary,
  frequencySelectionFromCadence,
  isIntervalFrequencySelection,
  monthlyScheduleFromDays,
  normalizeMonthlyCadence,
  twiceMonthlyPresetFromDays,
  type AutoOrganizeCadence,
  type MonthlyPresetId,
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
  onClose: () => void
  onSaved: () => void | Promise<void>
}

type BucketDraft = { bucketId: string; amountStr: string }

type EditorSnapshot = {
  name: string
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

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function cadenceFromInitial(
  initial: AutoOrganizeWithDetails | null,
): AutoOrganizeCadence {
  if (!initial) {
    return {
      autoOrganizeType: 'monthly',
      startDate: todayIsoDate(),
      intervalCount: 2,
      intervalUnit: 'week',
      daysOfMonth: [1, 15],
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
  cadence: AutoOrganizeCadence,
  monthlyPreset: MonthlyPresetId,
  monthlyOnceDay: number,
  bucketDrafts: BucketDraft[],
): EditorSnapshot {
  return { name, cadence, monthlyPreset, monthlyOnceDay, bucketDrafts }
}

export default function AutoOrganizeEditor({
  open,
  initial,
  buckets,
  memberId,
  onClose,
  onSaved,
}: Props) {
  const { formatMoney } = useHideAmounts()
  const [baselineSnapshot, setBaselineSnapshot] = useState('')
  const [name, setName] = useState('')
  const [cadence, setCadence] = useState<AutoOrganizeCadence>(() =>
    cadenceFromInitial(null),
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
    const nextCadence = normalizeMonthlyCadence(cadenceFromInitial(initial))
    const schedule = monthlyScheduleFromDays(nextCadence.daysOfMonth)
    const nextPreset =
      nextCadence.autoOrganizeType === 'monthly' &&
      nextCadence.daysOfMonth?.length === 2
        ? twiceMonthlyPresetFromDays(nextCadence.daysOfMonth)
        : schedule.preset
    const nextName = initial?.name ?? ''
    const nextBuckets = bucketDraftsFromBuckets(buckets, initial?.lines)

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
          nextCadence,
          nextPreset,
          schedule.onceDay,
          nextBuckets,
        ),
      ),
    )
  }, [open, initial, buckets])

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
  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const saveScheduleSummary = useMemo(() => {
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

    return formatEditorSaveScheduleSummary(previewCadence, localTimeZone)
  }, [
    frequencySelection,
    cadence,
    monthlyPreset,
    monthlyOnceDay,
    localTimeZone,
  ])

  function setFrequencySelection(selection: AutoOrganizeFrequencySelection) {
    const next = applyFrequencySelection(
      selection,
      cadence,
      monthlyPreset,
      todayIsoDate(),
    )
    setCadence(next.cadence)
    setMonthlyPreset(next.monthlyPreset)
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
      setError('Choose a first run date.')
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
    }

    setSubmitting(true)
    setError(null)
    try {
      await saveAutoOrganize(input, memberId)
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

          {isIntervalFrequencySelection(frequencySelection) ? (
            <label className="block">
              <FieldLabel>{AUTO_ORGANIZE_INTERVAL_START_LABEL}</FieldLabel>
              <input
                type="date"
                min={todayIsoDate()}
                value={cadence.startDate ?? ''}
                onChange={(e) =>
                  setCadence((prev) => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
                className={fieldInputClassName}
              />
              {!cadence.startDate ? (
                <p className="mt-1 text-xs text-zinc-500">
                  {AUTO_ORGANIZE_INTERVAL_START_HINT}
                </p>
              ) : null}
            </label>
          ) : frequencySelection === 'monthly-twice' ? (
            <label className="block">
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
          ) : (
            <div className="space-y-1">
              <label className="block">
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
              {monthlyOnceDay === 0 ? (
                <p className="text-xs text-zinc-500">
                  {AUTO_ORGANIZE_ONCE_MONTHLY_LAST_DAY_HINT}
                </p>
              ) : null}
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
            {saveScheduleSummary ? (
              <div className="mt-2 border-t border-zinc-800 pt-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    {AUTO_ORGANIZE_SCHEDULE_SUMMARY_LABEL}
                  </p>
                  <p className="min-w-0 text-right text-xs leading-snug text-zinc-300">
                    {saveScheduleSummary}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

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
