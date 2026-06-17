import { describe, expect, it } from 'vitest'
import {
  ADMIN_ROLE_CONTEXT_ADMIN,
  ADMIN_ROLE_CONTEXT_KID,
  ADMIN_ROLE_CONTEXT_SHARED,
  adminRoleAddHint,
  adminRoleContext,
} from './brand'

describe('adminRoleContext', () => {
  it('returns role-specific copy for each household role', () => {
    expect(adminRoleContext('admin')).toBe(ADMIN_ROLE_CONTEXT_ADMIN)
    expect(adminRoleContext('member')).toBe(ADMIN_ROLE_CONTEXT_SHARED)
    expect(adminRoleContext('child')).toBe(ADMIN_ROLE_CONTEXT_KID)
  })
})

describe('adminRoleAddHint', () => {
  it('matches the selected role context', () => {
    expect(adminRoleAddHint('admin')).toBe(ADMIN_ROLE_CONTEXT_ADMIN)
    expect(adminRoleAddHint('member')).toBe(ADMIN_ROLE_CONTEXT_SHARED)
    expect(adminRoleAddHint('child')).toBe(ADMIN_ROLE_CONTEXT_KID)
  })
})
