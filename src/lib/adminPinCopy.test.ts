import { describe, expect, it } from 'vitest'
import {
  adminPinSaveSuccess,
  adminPinSheetBody,
  adminPinSheetTitle,
} from '@/lib/brand'

describe('admin PIN copy', () => {
  it('differs for self vs another member', () => {
    expect(adminPinSheetTitle('Alex', true)).toBe('Your PIN')
    expect(adminPinSheetTitle('Alex', false)).toBe('PIN for Alex')

    expect(adminPinSheetBody('Alex', true)).toMatch(/link this device/)
    expect(adminPinSheetBody('Alex', true)).toMatch(/any other devices/i)
    expect(adminPinSheetBody('Alex', true)).toMatch(/this device stays signed in/i)
    expect(adminPinSheetBody('Alex', false)).toMatch(/signs Alex out on every device/)
    expect(adminPinSheetBody('Alex', false)).toMatch(/look signed in/)

    expect(adminPinSaveSuccess('Alex', true)).toMatch(/ready for quick sign-in/)
    expect(adminPinSaveSuccess('Alex', true)).toMatch(/any other devices were signed out/i)
    expect(adminPinSaveSuccess('Alex', false)).toMatch(/signed out everywhere/)
  })
})
