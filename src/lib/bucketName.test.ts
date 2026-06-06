import { describe, expect, it } from 'vitest'
import { BUCKETS_NAME_DUPLICATE } from '@/lib/brand'
import {
  BUCKET_NAME_MAX_LENGTH,
  humaniseBucketWriteError,
  normalizeBucketName,
  validateBucketName,
  validateBucketNameForList,
} from '@/lib/bucketName'

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

describe('validateBucketNameForList', () => {
  it('rejects a duplicate in the same list (case-insensitive)', () => {
    expect(
      validateBucketNameForList(['Groceries', 'Rent'], ' groceries '),
    ).toBe(BUCKETS_NAME_DUPLICATE)
  })

  it('allows the same name when renaming the bucket that already has it', () => {
    expect(
      validateBucketNameForList(['Groceries', 'Rent'], 'Groceries', {
        exceptName: 'Groceries',
      }),
    ).toBeNull()
  })

  it('allows renaming case only on the same bucket', () => {
    expect(
      validateBucketNameForList(['Groceries', 'Rent'], 'GROCERIES', {
        exceptName: 'Groceries',
      }),
    ).toBeNull()
  })

  it('rejects renaming into another existing name', () => {
    expect(
      validateBucketNameForList(['Groceries', 'Rent'], 'Rent', {
        exceptName: 'Groceries',
      }),
    ).toBe(BUCKETS_NAME_DUPLICATE)
  })
})

describe('normalizeBucketName', () => {
  it('trims and lowercases', () => {
    expect(normalizeBucketName('  Groceries ')).toBe('groceries')
  })
})

describe('humaniseBucketWriteError', () => {
  it('maps unique violations to duplicate copy', () => {
    expect(
      humaniseBucketWriteError({
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      }),
    ).toBe(BUCKETS_NAME_DUPLICATE)
  })
})
