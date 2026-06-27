import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import {
  clearBiometricBinding,
  getBiometricBinding,
  setBiometricBinding,
} from '@/lib/familyDevice'
import {
  isPasskeyCancellation,
  isPlatformAuthenticatorAvailable,
  passkeySetupErrorMessage,
  registerPasskey,
} from '@/lib/passkey'
import { supabase } from '@/lib/supabase'

/**
 * Enroll / remove a biometric passkey for the current member on THIS device.
 * Only rendered when the device exposes a platform authenticator. The binding
 * is per-device: enabling here lets this member open the app with Face ID /
 * Touch ID and skip the PIN. Other members on this device still use their PIN.
 */
export default function BiometricSettingsCard() {
  const auth = useAuth()
  const member = auth.status === 'signedIn' ? auth.member : null

  const [available, setAvailable] = useState<boolean | null>(null)
  const [enrolledCredentialId, setEnrolledCredentialId] = useState<string | null>(
    () => getBiometricBinding()?.credentialId ?? null,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void isPlatformAuthenticatorAvailable().then((ok) => {
      if (active) setAvailable(ok)
    })
    return () => {
      active = false
    }
  }, [])

  if (!member || available !== true) return null

  const binding = getBiometricBinding()
  const enrolledHere = binding?.memberId === member.id

  async function enable() {
    setBusy(true)
    setError(null)
    try {
      const credentialId = await registerPasskey()
      setBiometricBinding({
        memberId: member!.id,
        familyId: member!.family_id,
        credentialId,
      })
      setEnrolledCredentialId(credentialId)
    } catch (err) {
      // Silent on cancel; friendly setup message otherwise (not the raw W3C text).
      if (!isPasskeyCancellation(err)) {
        setError(passkeySetupErrorMessage(err))
      }
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    setError(null)
    try {
      if (enrolledCredentialId) {
        await supabase
          .from('member_passkeys')
          .delete()
          .eq('credential_id', enrolledCredentialId)
      }
      clearBiometricBinding()
      setEnrolledCredentialId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not turn off biometric unlock.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-300">Biometric unlock</h2>
      <p className="mt-1 text-xs text-zinc-500">
        {enrolledHere
          ? 'Face ID / Touch ID is on for this device. Open the app and unlock without typing your PIN or password.'
          : 'Use Face ID / Touch ID to open the app on this device without typing your PIN or password. Only turn this on for your own device.'}
      </p>
      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void (enrolledHere ? disable() : enable())}
        className={
          enrolledHere
            ? 'mt-3 w-full rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-60'
            : 'mt-3 w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-60'
        }
      >
        {busy
          ? 'Working…'
          : enrolledHere
            ? 'Turn off on this device'
            : 'Enable on this device'}
      </button>
    </section>
  )
}
