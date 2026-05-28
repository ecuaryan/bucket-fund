import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import {
  clearPasswordRecoveryFlow,
  isPasswordRecoveryFlowActive,
  markPasswordRecoveryFlow,
} from '@/lib/passwordRecoveryFlow'
import { isPasswordRecoverySession } from '@/lib/recoverySession'

function session(recoverySentAt: string | undefined): Session {
  return {
    access_token: 'token',
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-id',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'admin@example.com',
      recovery_sent_at: recoverySentAt,
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  } as Session
}

describe('isPasswordRecoverySession', () => {
  beforeEach(() => {
    clearPasswordRecoveryFlow()
  })

  afterEach(() => {
    clearPasswordRecoveryFlow()
  })

  it('is false for a normal session even if recovery_sent_at is set', () => {
    expect(isPasswordRecoverySession(session('2026-01-01T00:00:00Z'))).toBe(
      false,
    )
    expect(isPasswordRecoveryFlowActive()).toBe(false)
  })

  it('is true only during an explicit password recovery flow', () => {
    markPasswordRecoveryFlow()
    expect(isPasswordRecoverySession(session(undefined))).toBe(true)
    expect(isPasswordRecoveryFlowActive()).toBe(true)
  })
})
