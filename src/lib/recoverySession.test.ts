import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearPasswordRecoveryFlow,
  isPasswordRecoveryFlowActive,
  markPasswordRecoveryFlow,
} from '@/lib/passwordRecoveryFlow'
import { isPasswordRecoverySession } from '@/lib/recoverySession'

describe('isPasswordRecoverySession', () => {
  beforeEach(() => {
    clearPasswordRecoveryFlow()
  })

  afterEach(() => {
    clearPasswordRecoveryFlow()
  })

  it('is false without an explicit PASSWORD_RECOVERY flow', () => {
    expect(isPasswordRecoverySession()).toBe(false)
    expect(isPasswordRecoveryFlowActive()).toBe(false)
  })

  it('is true only during an explicit password recovery flow', () => {
    markPasswordRecoveryFlow()
    expect(isPasswordRecoverySession()).toBe(true)
    expect(isPasswordRecoveryFlowActive()).toBe(true)
  })
})
