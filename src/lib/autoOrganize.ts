import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import {
  computeNextRunOn,
  formatCadenceSummary,
  formatNextRunLabel,
  type AutoOrganizeCadence,
} from '@/lib/autoOrganizeCadence'

type AutoOrganizeRow = Database['public']['Tables']['auto_organizes']['Row']
type AutoOrganizeLineRow = Database['public']['Tables']['auto_organize_lines']['Row']
type AutoOrganizeRunRow = Database['public']['Tables']['auto_organize_runs']['Row']

export type AutoOrganizeLineInput = {
  bucketId: string
  amount: number
}

export type AutoOrganizeInput = {
  id?: string
  name: string | null
  paused: boolean
  cadence: AutoOrganizeCadence
  lines: AutoOrganizeLineInput[]
}

export type AutoOrganizeWithDetails = AutoOrganizeRow & {
  lines: (AutoOrganizeLineRow & { bucket_name: string | null })[]
  lastRun: Pick<
    AutoOrganizeRunRow,
    'id' | 'status' | 'run_on' | 'trigger' | 'created_at'
  > | null
  /** Any run (manual or scheduled) on the family's local calendar today. */
  hasRunToday: boolean
  totalPerRun: number
  cadenceSummary: string
  nextRunLabel: string
  familyTimezone: string
}

/** Local calendar date `YYYY-MM-DD` in the given IANA timezone. */
export function localTodayIso(
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

export function autoOrganizeHasRunOnDate(
  runs: ReadonlyArray<Pick<AutoOrganizeRunRow, 'run_on'>>,
  runOn: string,
): boolean {
  return runs.some((run) => run.run_on === runOn)
}

export function activeAutoOrganizeLines(
  lines: AutoOrganizeWithDetails['lines'],
): AutoOrganizeWithDetails['lines'] {
  return lines.filter((line) => Number(line.amount) > 0)
}

/** Match Buckets tab order (family-pool buckets only). */
export function orderAutoOrganizeLinesByBuckets<
  T extends { bucket_id: string; amount: string | number },
>(
  lines: readonly T[],
  buckets: ReadonlyArray<{ id: string; owner_member_id: string | null }>,
): T[] {
  const order = new Map(
    buckets
      .filter((bucket) => bucket.owner_member_id === null)
      .map((bucket, index) => [bucket.id, index]),
  )
  return [...lines]
    .filter((line) => Number(line.amount) > 0)
    .sort(
      (a, b) =>
        (order.get(a.bucket_id) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.bucket_id) ?? Number.MAX_SAFE_INTEGER),
    )
}

/** Prefer live bucket names from the Buckets tab over stale fetch joins. */
export function resolveAutoOrganizeLineBucketName(
  line: { bucket_id: string; bucket_name: string | null },
  bucketNamesById: ReadonlyMap<string, string>,
): string {
  return bucketNamesById.get(line.bucket_id) ?? line.bucket_name?.trim() ?? 'Bucket'
}

export async function fetchFamilyTimezone(): Promise<string> {
  const { data, error } = await supabase
    .from('families')
    .select('timezone')
    .single()
  if (error) throw error
  return data.timezone
}

export async function updateFamilyTimezone(timezone: string): Promise<void> {
  const { data: family, error: readError } = await supabase
    .from('families')
    .select('id')
    .single()
  if (readError) throw readError
  const { error } = await supabase
    .from('families')
    .update({ timezone })
    .eq('id', family.id)
  if (error) throw error
}

export async function fetchAutoOrganizes(): Promise<AutoOrganizeWithDetails[]> {
  const [{ data: rows, error }, { data: family, error: familyError }] =
    await Promise.all([
      supabase
        .from('auto_organizes')
        .select(
          `*,
          auto_organize_lines (
            *,
            buckets ( name )
          ),
          auto_organize_runs ( id, status, run_on, trigger, created_at )`,
        )
        .order('created_at', { ascending: true }),
      supabase.from('families').select('timezone').single(),
    ])
  if (error) throw error
  if (familyError) throw familyError

  const timeZone = family.timezone

  return (rows ?? []).map((row) => {
    const {
      auto_organize_lines: nestedLines,
      auto_organize_runs: nestedRuns,
      ...base
    } = row
    const lines = (nestedLines ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((line) => ({
        ...line,
        bucket_name:
          (line as { buckets?: { name: string } | null }).buckets?.name ?? null,
      }))
    const runs = (nestedRuns ?? [])
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    const cadence: AutoOrganizeCadence = {
      autoOrganizeType: row.auto_organize_type as AutoOrganizeCadence['autoOrganizeType'],
      startDate: row.start_date,
      intervalCount: row.interval_count,
      intervalUnit: row.interval_unit as AutoOrganizeCadence['intervalUnit'],
      daysOfMonth: row.days_of_month,
    }
    const nextRunOn = computeNextRunOn(cadence, timeZone)
    const todayIso = localTodayIso(timeZone)
    return {
      ...base,
      lines,
      lastRun: runs[0] ?? null,
      hasRunToday: autoOrganizeHasRunOnDate(runs, todayIso),
      totalPerRun: lines.reduce((sum, line) => sum + Number(line.amount), 0),
      cadenceSummary: formatCadenceSummary(cadence),
      nextRunLabel: formatNextRunLabel(nextRunOn),
      familyTimezone: timeZone,
    }
  })
}

export async function saveAutoOrganize(
  input: AutoOrganizeInput,
  createdByMemberId: string,
): Promise<string> {
  const payload = {
    name: input.name?.trim() || null,
    paused: input.paused,
    auto_organize_type: input.cadence.autoOrganizeType,
    start_date:
      input.cadence.autoOrganizeType === 'interval'
        ? input.cadence.startDate
        : null,
    interval_count:
      input.cadence.autoOrganizeType === 'interval'
        ? input.cadence.intervalCount
        : null,
    interval_unit:
      input.cadence.autoOrganizeType === 'interval'
        ? input.cadence.intervalUnit
        : null,
    days_of_month:
      input.cadence.autoOrganizeType === 'monthly'
        ? input.cadence.daysOfMonth
        : null,
    updated_at: new Date().toISOString(),
  }

  let autoOrganizeId = input.id

  if (autoOrganizeId) {
    const { error } = await supabase
      .from('auto_organizes')
      .update(payload)
      .eq('id', autoOrganizeId)
    if (error) throw error
    const { error: deleteLinesError } = await supabase
      .from('auto_organize_lines')
      .delete()
      .eq('auto_organize_id', autoOrganizeId)
    if (deleteLinesError) throw deleteLinesError
  } else {
    const { data: family, error: familyReadError } = await supabase
      .from('families')
      .select('id')
      .single()
    if (familyReadError) throw familyReadError
    const { data, error } = await supabase
      .from('auto_organizes')
      .insert({
        ...payload,
        family_id: family.id,
        created_by_member_id: createdByMemberId,
      })
      .select('id')
      .single()
    if (error) throw error
    autoOrganizeId = data.id
  }

  const { error: linesError } = await supabase.from('auto_organize_lines').insert(
    input.lines.map((line, index) => ({
      auto_organize_id: autoOrganizeId!,
      bucket_id: line.bucketId,
      amount: line.amount,
      sort_order: index,
    })),
  )
  if (linesError) throw linesError

  await updateFamilyTimezone(defaultBrowserTimezone())
  return autoOrganizeId!
}

export async function setAutoOrganizePaused(
  id: string,
  paused: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('auto_organizes')
    .update({ paused, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteAutoOrganize(id: string): Promise<void> {
  const { error } = await supabase.from('auto_organizes').delete().eq('id', id)
  if (error) throw error
}

export async function runAutoOrganizeNow(
  autoOrganizeId: string,
  memberId: string,
): Promise<void> {
  const { error } = await supabase.rpc('run_auto_organize', {
    p_auto_organize_id: autoOrganizeId,
    p_trigger: 'manual',
    p_triggered_by_member_id: memberId,
  })
  if (error) throw error
}

export function defaultBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
