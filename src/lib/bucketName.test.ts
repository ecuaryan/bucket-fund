import { describe, expect, it } from 'vitest'
import { BUCKET_NAME_MAX_LENGTH, validateBucketName } from '@/lib/bucketName'

describe('validateBucketName', () => {
  it('accepts a normal label', () => {
    expect(validateBucketName('Groceries')).toBeNull()
  })

  it('rejects empty names', () => {
    expect(validateBucketName('   ')).toBe('Name cannot be empty.')
  })

  it('rejects names over the max length', () => {
    const long = 'a'.repeat(BUCKET_NAME_MAX_LENGTH + 1)
    expect(validateBucketName(long)).toBe(
      `Keep the name to ${BUCKET_NAME_MAX_LENGTH} characters or fewer.`,
    )
  })
})
