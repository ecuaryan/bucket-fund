import { describe, expect, it } from 'vitest'
import { classifyMemberFetch } from '@/lib/memberFetch'

type Member = { id: string }

describe('classifyMemberFetch', () => {
  it('returns found when a row is present and there is no error', () => {
    const member: Member = { id: 'm1' }
    expect(classifyMemberFetch(member, null)).toEqual({
      status: 'found',
      member,
    })
  })

  it('returns absent when the query succeeds with no row (genuine orphan)', () => {
    expect(classifyMemberFetch<Member>(null, null)).toEqual({
      status: 'absent',
    })
    expect(classifyMemberFetch<Member>(undefined, null)).toEqual({
      status: 'absent',
    })
  })

  it('returns error when the query failed, even with null data', () => {
    expect(
      classifyMemberFetch<Member>(null, { message: 'JWT expired' }),
    ).toEqual({ status: 'error' })
  })

  it('treats an error as error even if data is somehow present', () => {
    // Defensive: a present error must never be read as a valid membership.
    expect(
      classifyMemberFetch<Member>({ id: 'm1' }, { message: 'network' }),
    ).toEqual({ status: 'error' })
  })
})
