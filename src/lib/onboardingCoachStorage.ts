export const ONBOARDING_COACH_STORAGE_PREFIX =
  'bucketmymoney_onboarding_coach_dismissed:'

export function onboardingCoachStorageKey(memberId: string): string {
  return `${ONBOARDING_COACH_STORAGE_PREFIX}${memberId}`
}

export function readOnboardingCoachDismissed(memberId: string): boolean {
  try {
    return localStorage.getItem(onboardingCoachStorageKey(memberId)) === '1'
  } catch {
    return false
  }
}

export function writeOnboardingCoachDismissed(memberId: string): void {
  try {
    localStorage.setItem(onboardingCoachStorageKey(memberId), '1')
  } catch {
    // private mode
  }
}
