/** Short labels — leave room for amounts like $999,999.99 and row actions. */
export const BUCKET_NAME_MAX_LENGTH = 40

export function validateBucketName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Name cannot be empty.'
  if (trimmed.length > BUCKET_NAME_MAX_LENGTH) {
    return `Keep the name to ${BUCKET_NAME_MAX_LENGTH} characters or fewer.`
  }
  return null
}
