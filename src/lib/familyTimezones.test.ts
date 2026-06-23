import { describe, expect, it } from 'vitest'
import {
  familyTimezoneSelectOptions,
  isValidIanaTimezone,
  resolveFamilyTimezone,
} from '@/lib/familyTimezones'

describe('familyTimezones', () => {
  it('validates IANA timezone ids', () => {
    expect(isValidIanaTimezone('America/Chicago')).toBe(true)
    expect(isValidIanaTimezone('Not/A_Zone')).toBe(false)
  })

  it('prepends unknown stored timezone to select options', () => {
    const options = familyTimezoneSelectOptions('America/Detroit')
    expect(options[0]?.value).toBe('America/Detroit')
    expect(options.some((option) => option.value === 'America/New_York')).toBe(
      true,
    )
  })

  it('prefers stored timezone when valid', () => {
    expect(resolveFamilyTimezone('America/Denver')).toBe('America/Denver')
  })

  it('treats schema-default UTC as unset when requested', () => {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone
    expect(
      resolveFamilyTimezone('UTC', { treatUtcAsUnset: true }),
    ).toBe(browser && isValidIanaTimezone(browser) ? browser : 'America/New_York')
  })

  it('keeps UTC when household has already configured schedules', () => {
    expect(resolveFamilyTimezone('UTC', { treatUtcAsUnset: false })).toBe('UTC')
  })
})
