import { BUCKETS_NAME_DUPLICATE } from '@/lib/brand'

/** Short labels — leave room for amounts like $999,999.99 and row actions. */
export const BUCKET_NAME_MAX_LENGTH = 40

export function normalizeBucketName(name: string): string {
  return name.trim().toLowerCase()
}

export function validateBucketName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Name cannot be empty.'
  if (trimmed.length > BUCKET_NAME_MAX_LENGTH) {
    return `Keep the name to ${BUCKET_NAME_MAX_LENGTH} characters or fewer.`
  }
  return null
}

/** Reject duplicate labels in the same bucket list (shared pool or one kid). */
export function validateBucketNameForList(
  existingNames: readonly string[],
  candidate: string,
  options?: { exceptName?: string },
): string | null {
  const invalid = validateBucketName(candidate)
  if (invalid) return invalid

  const key = normalizeBucketName(candidate)
  const exceptKey = options?.exceptName
    ? normalizeBucketName(options.exceptName)
    : null

  for (const existing of existingNames) {
    const existingKey = normalizeBucketName(existing)
    if (exceptKey !== null && existingKey === exceptKey) continue
    if (existingKey === key) return BUCKETS_NAME_DUPLICATE
  }

  return null
}

export function humaniseBucketWriteError(error: {
  message: string
  code?: string
}): string {
  if (error.code === '23505') return BUCKETS_NAME_DUPLICATE
  return error.message
}
