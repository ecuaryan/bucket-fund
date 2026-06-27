import { afterEach, describe, expect, it } from 'vitest'
import {
  bindFamily,
  clearBiometricBinding,
  clearBoundFamily,
  getBiometricBinding,
  setBiometricBinding,
} from '@/lib/familyDevice'

afterEach(() => {
  localStorage.clear()
})

describe('biometric binding (per-device passkey pointer)', () => {
  it('returns null when nothing is stored', () => {
    expect(getBiometricBinding()).toBeNull()
  })

  it('round-trips a member + family + credential id', () => {
    setBiometricBinding({ memberId: 'm-1', familyId: 'f-1', credentialId: 'cred-abc' })
    expect(getBiometricBinding()).toEqual({
      memberId: 'm-1',
      familyId: 'f-1',
      credentialId: 'cred-abc',
    })
  })

  it('clears the binding', () => {
    setBiometricBinding({ memberId: 'm-1', familyId: 'f-1', credentialId: 'cred-abc' })
    clearBiometricBinding()
    expect(getBiometricBinding()).toBeNull()
  })

  it('survives unlinking the household join code (independent of it)', () => {
    bindFamily('f-1', 'JOINCODE')
    setBiometricBinding({ memberId: 'm-1', familyId: 'f-1', credentialId: 'cred-abc' })

    clearBoundFamily()

    // The join code is gone, but the passkey binding must remain so an
    // email-signing admin still sees the fingerprint.
    expect(getBiometricBinding()).toEqual({
      memberId: 'm-1',
      familyId: 'f-1',
      credentialId: 'cred-abc',
    })
  })

  it('treats a partial / corrupt binding as absent', () => {
    localStorage.setItem(
      'bucketmymoney_biometric',
      JSON.stringify({ memberId: 'm-1', credentialId: 'cred-abc' }),
    )
    expect(getBiometricBinding()).toBeNull()

    localStorage.setItem('bucketmymoney_biometric', 'not json')
    expect(getBiometricBinding()).toBeNull()
  })
})
