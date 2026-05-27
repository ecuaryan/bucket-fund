import { supabase } from '@/lib/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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

async function postFunction<T>(
  name: string,
  body: unknown,
  accessToken?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    apikey: anonKey,
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? `${name} failed: ${res.status}`)
  }
  return data
}

export async function validateJoinCode(code: string): Promise<ValidateJoinResult> {
  return postFunction<ValidateJoinResult>('validate-join-code', {
    code: code.trim(),
  })
}

export async function pinLogin(input: {
  familyId: string
  memberId: string
  pin: string
}): Promise<void> {
  const data = await postFunction<{
    access_token: string
    refresh_token: string
  }>('pin-login', input)

  const { error } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  })
  if (error) throw error
}

export async function createMember(input: {
  name: string
  role: 'member' | 'child'
}): Promise<{ id: string; name: string; role: string }> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Not signed in')

  const data = await postFunction<{ member: { id: string; name: string; role: string } }>(
    'create-member',
    input,
    token,
  )
  return data.member
}

export async function setMemberPin(memberId: string, pin: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Not signed in')

  await postFunction('set-pin', { memberId, pin }, token)
}

export async function clearPinLockout(memberId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Not signed in')

  await postFunction('clear-pin-lockout', { memberId }, token)
}
