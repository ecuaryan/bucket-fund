export type FamilyTimezoneOption = {
  value: string
  label: string
}

/** Curated IANA zones for household scheduling (auto-organize at 3 AM local). */
export const FAMILY_TIMEZONE_OPTIONS: FamilyTimezoneOption[] = [
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'America/Phoenix', label: 'Arizona' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawaii' },
  { value: 'America/Puerto_Rico', label: 'Puerto Rico' },
  { value: 'America/Toronto', label: 'Toronto' },
  { value: 'America/Winnipeg', label: 'Winnipeg' },
  { value: 'America/Edmonton', label: 'Edmonton' },
  { value: 'America/Vancouver', label: 'Vancouver' },
  { value: 'America/Halifax', label: 'Halifax' },
  { value: 'America/St_Johns', label: 'Newfoundland' },
  { value: 'Europe/London', label: 'London' },
  { value: 'UTC', label: 'UTC' },
]

export function isValidIanaTimezone(timeZone: string): boolean {
  if (!timeZone.trim()) return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone })
    return true
  } catch {
    return false
  }
}

/** Human label for an IANA zone (fallback when not in the curated list). */
export function formatIanaTimezoneLabel(timeZone: string): string {
  const curated = FAMILY_TIMEZONE_OPTIONS.find((option) => option.value === timeZone)
  if (curated) return curated.label
  return timeZone.replace(/_/g, ' ')
}

/** Options for the select, including the stored value when it is not in the list. */
export function familyTimezoneSelectOptions(
  currentValue: string,
): FamilyTimezoneOption[] {
  if (
    !currentValue ||
    FAMILY_TIMEZONE_OPTIONS.some((option) => option.value === currentValue)
  ) {
    return FAMILY_TIMEZONE_OPTIONS
  }
  return [
    { value: currentValue, label: formatIanaTimezoneLabel(currentValue) },
    ...FAMILY_TIMEZONE_OPTIONS,
  ]
}

/** Resolve editor default: stored household TZ, else browser, else Eastern. */
export function resolveFamilyTimezone(stored: string | null | undefined): string {
  if (stored && isValidIanaTimezone(stored)) return stored
  try {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (browser && isValidIanaTimezone(browser)) return browser
  } catch {
    // fall through
  }
  return 'America/New_York'
}
