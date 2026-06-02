import { describe, expect, it } from 'vitest'
import { canReuseLoadedMember } from '@/lib/authSessionReuse'

describe('canReuseLoadedMember', () => {
  it('reuses when the same user is already loaded with a member', () => {
    expect(canReuseLoadedMember('user-1', true, false, 'user-1')).toBe(true)
  })

  it('does not reuse when there is no previous user (initial load)', () => {
    expect(canReuseLoadedMember(null, false, false, 'user-1')).toBe(false)
    expect(canReuseLoadedMember(undefined, false, false, 'user-1')).toBe(false)
  })

  it('does not reuse when the user changed (PIN switch / different login)', () => {
    expect(canReuseLoadedMember('user-1', true, false, 'user-2')).toBe(false)
  })

  it('does not reuse when no member is loaded yet', () => {
    expect(canReuseLoadedMember('user-1', false, false, 'user-1')).toBe(false)
  })

  it('does not reuse when the previous load errored (let it retry)', () => {
    expect(canReuseLoadedMember('user-1', false, true, 'user-1')).toBe(false)
  })
})
