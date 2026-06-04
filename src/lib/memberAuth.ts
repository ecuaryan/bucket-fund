import { notifyHouseholdRosterChanged } from '@/lib/householdRosterRefresh'
import { getFreshAccessToken } from '@/lib/sessionToken'
import { supabase, supabaseUrl } from '@/lib/supabase'
import { withTimeout } from '@/lib/timeout'

const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const PIN_LOGIN_TIMEOUT_MS = 25_000

export type JoinMember = {
  id: string
  name: string
  role: string
  avatarUrl: string | null
  hasPin: boolean
  pinLocked: boolean
}

export type ValidateJoinResult = {
  familyId: string
  familyName: string
  members: JoinMember[]
}

function mapPostFunctionNetworkError(err: unknown, name: string): Error {
  if (err instanceof Error) {
    if (err.message.includes('timed out')) return err
    const msg = err.message.toLowerCase()
    if (msg === 'failed to fetch' || msg.includes('network')) {
      return new Error(
        'Could not reach the server. Check your connection. If you were idle a long time, sign out and sign in again, then retry.',
      )
    }
  }
  return err instanceof Error ? err : new Error(`${name} failed`)
}

async function requireAdminAccessToken(): Promise<string> {
  const token = await getFreshAccessToken()
  if (!token) throw new Error('Not signed in')
  return token
}

async function postFunction<T>(
  name: string,
  body: unknown,
  accessToken?: string,
  timeoutMs = PIN_LOGIN_TIMEOUT_MS,
): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    apikey: anonKey,
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  let res: Response
  try {
    res = await withTimeout(
      fetch(`${supabaseUrl}/functions/v1/${name}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      }),
      timeoutMs,
      'Request timed out. Check your connection and try again.',
    )
  } catch (err) {
    throw mapPostFunctionNetworkError(err, name)
  }

  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Session expired. Sign out and sign in again, then retry.')
    }
    const detail = data.error ?? `${name} failed: ${res.status}`
    if (res.status === 503) {
      throw new Error(
        `${detail}. For local dev, run \`npm run functions:serve\` in a second terminal (needs \`supabase/functions/.env\`).`,
      )
    }
    throw new Error(detail)
  }
  return data
}

export async function validateJoinCode(code: string): Promise<ValidateJoinResult> {
  return postFunction<ValidateJoinResult>('validate-join-code', {
    code: code.trim(),
  })
}

export type PinSessionTokens = {
  access_token: string
  refresh_token: string
}

/** Validates PIN via Edge Function; caller applies tokens with `signInWithSession`. */
export async function exchangePinForSession(input: {
  familyId: string
  memberId: string
  pin: string
}): Promise<PinSessionTokens> {
  return postFunction<PinSessionTokens>('pin-login', input)
}

export async function removeMember(memberId: string): Promise<void> {
  const token = await requireAdminAccessToken()
  await postFunction<{ ok: boolean }>('remove-member', { memberId }, token)
  notifyHouseholdRosterChanged()
}

export async function createMember(input: {
  name: string
  role: 'member' | 'child'
}): Promise<{ id: string; name: string; role: string }> {
  const token = await requireAdminAccessToken()
  const data = await postFunction<{ member: { id: string; name: string; role: string } }>(
    'create-member',
    input,
    token,
  )
  notifyHouseholdRosterChanged()
  return data.member
}

/**
 * Revoke refresh tokens for every session except this device.
 * Must run in the browser that just saved the admin's own PIN — GoTrue needs
 * the local refresh token to identify the current session (`scope: 'others'`).
 */
export async function signOutOtherAuthSessions(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'others' })
  if (error) {
    throw new Error(`Could not sign out other devices: ${error.message}`)
  }
}

export async function setMemberPin(
  memberId: string,
  pin: string,
  options?: { signOutOtherDevices?: boolean },
): Promise<void> {
  const token = await requireAdminAccessToken()
  await postFunction('set-pin', { memberId, pin }, token)

  if (options?.signOutOtherDevices) {
    await signOutOtherAuthSessions()
  }
}

export async function clearPinLockout(memberId: string): Promise<void> {
  const token = await requireAdminAccessToken()
  await postFunction('clear-pin-lockout', { memberId }, token)
}
