import { describe, expect, it } from 'vitest'
import { roleLabel } from '@/lib/memberRoles'

describe('roleLabel', () => {
  it('maps DB roles to user-facing labels', () => {
    expect(roleLabel('admin')).toBe('Admin')
    expect(roleLabel('member')).toBe('Shared')
    expect(roleLabel('child')).toBe('Kid')
  })
})
