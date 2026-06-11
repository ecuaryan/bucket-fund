export type OnboardingStep = 'addSource' | 'createBucket' | 'setAside' | 'complete'

export type OnboardingCoachState = {
  step: OnboardingStep
  /** Steps finished before the current one (for checklist UI). */
  completedSteps: readonly OnboardingStep[]
}

type StepInput = {
  hasMoneySources: boolean
  bucketCount: number
  hasAllocations: boolean
}

export function getOnboardingCoachState(input: StepInput): OnboardingCoachState {
  const completedSteps: OnboardingStep[] = []

  if (input.hasMoneySources) {
    completedSteps.push('addSource')
  }
  if (input.bucketCount > 0) {
    completedSteps.push('createBucket')
  }
  if (input.hasAllocations) {
    completedSteps.push('setAside')
    return { step: 'complete', completedSteps }
  }

  if (!input.hasMoneySources) {
    return { step: 'addSource', completedSteps }
  }
  if (input.bucketCount === 0) {
    return { step: 'createBucket', completedSteps }
  }
  return { step: 'setAside', completedSteps }
}

export function shouldShowOnboardingCoach(
  isAdult: boolean,
  dismissed: boolean,
  state: OnboardingCoachState,
): boolean {
  return isAdult && !dismissed && state.step !== 'complete'
}
