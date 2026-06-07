import { describe, expect, it } from 'vitest'
import { MEMBER_NAME_DUPLICATE } from '@/lib/brand'
import {
  humaniseMemberWriteError,
  normalizeMemberName,
  validateMemberName,
  validateMemberNameForFamily,
} from '@/lib/memberName'

const roster = [
  { id: 'a1', name: 'Alex' },
  { id: 'c1', name: 'Sam' },
]

describe('normalizeMemberName', () => {
  it('trims and lowercases', () => {
    expect(normalizeMemberName('  Sam  ')).toBe('sam')
  })
})

describe('validateMemberNameForFamily', () => {
  it('rejects a duplicate (case-insensitive)', () => {
    expect(validateMemberNameForFamily(roster, ' sam ')).toBe(
      MEMBER_NAME_DUPLICATE,
    )
  })

  it('allows renaming to the same name', () => {
    expect(
      validateMemberNameForFamily(roster, 'Alex', { exceptMemberId: 'a1' }),
    ).toBeNull()
  })

  it('allows a new unique name', () => {
    expect(validateMemberNameForFamily(roster, 'Jordan')).toBeNull()
  })

  it('rejects empty names', () => {
    expect(validateMemberName('   ')).toBe('Name cannot be empty.')
  })
})

describe('humaniseMemberWriteError', () => {
  it('maps unique violations to duplicate copy', () => {
    expect(
      humaniseMemberWriteError({
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      }),
    ).toBe(MEMBER_NAME_DUPLICATE)
  })
})
