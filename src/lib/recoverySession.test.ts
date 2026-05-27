import { describe, expect, it } from 'vitest'
import type { Session } from '@supabase/supabase-js'
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
  it('is true when recovery_sent_at is set', () => {
    expect(isPasswordRecoverySession(session('2026-01-01T00:00:00Z'))).toBe(
      true,
    )
  })

  it('is false for a normal session', () => {
    expect(isPasswordRecoverySession(session(undefined))).toBe(false)
  })
})
