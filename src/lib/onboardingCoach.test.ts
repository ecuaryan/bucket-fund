import { describe, expect, it } from 'vitest'
import {
  getOnboardingCoachState,
  shouldShowOnboardingCoach,
} from '@/lib/onboardingCoach'

describe('getOnboardingCoachState', () => {
  it('starts at add source', () => {
    expect(
      getOnboardingCoachState({
        hasMoneySources: false,
        bucketCount: 0,
        hasAllocations: false,
      }),
    ).toEqual({ step: 'addSource', completedSteps: [] })
  })

  it('advances to create bucket after a money source', () => {
    expect(
      getOnboardingCoachState({
        hasMoneySources: true,
        bucketCount: 0,
        hasAllocations: false,
      }),
    ).toEqual({ step: 'createBucket', completedSteps: ['addSource'] })
  })

  it('advances to set aside after buckets exist', () => {
    expect(
      getOnboardingCoachState({
        hasMoneySources: true,
        bucketCount: 2,
        hasAllocations: false,
      }),
    ).toEqual({
      step: 'setAside',
      completedSteps: ['addSource', 'createBucket'],
    })
  })

  it('completes after first allocation', () => {
    expect(
      getOnboardingCoachState({
        hasMoneySources: true,
        bucketCount: 2,
        hasAllocations: true,
      }),
    ).toEqual({
      step: 'complete',
      completedSteps: ['addSource', 'createBucket', 'setAside'],
    })
  })
})

describe('shouldShowOnboardingCoach', () => {
  it('shows for adults who have not dismissed', () => {
    expect(
      shouldShowOnboardingCoach(
        true,
        false,
        getOnboardingCoachState({
          hasMoneySources: false,
          bucketCount: 0,
          hasAllocations: false,
        }),
      ),
    ).toBe(true)
  })

  it('hides when dismissed or complete', () => {
    expect(
      shouldShowOnboardingCoach(
        true,
        true,
        getOnboardingCoachState({
          hasMoneySources: false,
          bucketCount: 0,
          hasAllocations: false,
        }),
      ),
    ).toBe(false)
    expect(
      shouldShowOnboardingCoach(
        true,
        false,
        getOnboardingCoachState({
          hasMoneySources: true,
          bucketCount: 1,
          hasAllocations: true,
        }),
      ),
    ).toBe(false)
  })

  it('hides for kids', () => {
    expect(
      shouldShowOnboardingCoach(
        false,
        false,
        getOnboardingCoachState({
          hasMoneySources: false,
          bucketCount: 0,
          hasAllocations: false,
        }),
      ),
    ).toBe(false)
  })
})
