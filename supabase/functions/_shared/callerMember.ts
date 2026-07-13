// Caller authentication shared by the SimpleFIN Edge Functions: resolve
// the Authorization header to the caller's family_members row. The
// Teller functions predate this helper and inline the same steps.

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { publishableKey } from './keys.ts'
import { jsonResponse } from './http.ts'

export type CallerMember = {
  id: string
  family_id: string
  role: string
}

/**
 * Authenticate the request's JWT and load the caller's membership.
 * Returns `{ member }` on success or `{ errorResponse }` to return as-is.
 */
export async function requireCallerMember(
  req: Request,
): Promise<{ member: CallerMember } | { errorResponse: Response }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return {
      errorResponse: jsonResponse({ error: 'Missing Authorization header' }, 401),
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const callerClient = createClient(supabaseUrl, publishableKey(), {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()
  if (userError || !user) {
    return {
      errorResponse: jsonResponse({ error: 'Invalid or expired token' }, 401),
    }
  }

  const { data: member } = await callerClient
    .from('family_members')
    .select('id, family_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) {
    return {
      errorResponse: jsonResponse({ error: 'No family membership found' }, 403),
    }
  }

  return { member }
}

/** Admin-gated variant for link/confirm/disconnect actions. */
export async function requireCallerAdmin(
  req: Request,
  action: string,
): Promise<{ member: CallerMember } | { errorResponse: Response }> {
  const result = await requireCallerMember(req)
  if ('errorResponse' in result) return result
  if (result.member.role !== 'admin') {
    return {
      errorResponse: jsonResponse({ error: `Only admins can ${action}` }, 403),
    }
  }
  return result
}
