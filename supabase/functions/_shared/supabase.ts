import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { publishableKey, secretKey } from './keys.ts'

export function serviceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  return createClient(supabaseUrl, secretKey())
}

export function callerClient(authHeader: string): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  return createClient(supabaseUrl, publishableKey(), {
    global: { headers: { Authorization: authHeader } },
  })
}

export async function requireAdmin(
  authHeader: string | null,
): Promise<
  | { ok: true; userId: string; familyId: string; memberId: string }
  | { ok: false; response: Response }
> {
  if (!authHeader) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      ),
    }
  }

  const client = callerClient(authHeader)
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData.user) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    }
  }

  const admin = serviceClient()
  const { data: member, error: memberError } = await admin
    .from('family_members')
    .select('id, family_id, role')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  if (memberError || !member || member.role !== 'admin') {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'Admins only' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    }
  }

  return {
    ok: true,
    userId: userData.user.id,
    familyId: member.family_id,
    memberId: member.id,
  }
}
