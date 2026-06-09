import { describe, expect, it } from 'vitest'
import { absentMembershipAction } from '@/lib/absentMembership'
import { PIN_AUTH_EMAIL_SUFFIX } from '@/lib/pinAuthDomain'

describe('absentMembershipAction', () => {
  it('auto sign-out for internal PIN auth emails', () => {
    expect(absentMembershipAction(`kid${PIN_AUTH_EMAIL_SUFFIX}`)).toBe('pinSignOut')
  })

  it('shows orphan notice for human admin email', () => {
    expect(absentMembershipAction('admin@example.com')).toBe('orphanNotice')
  })
})
