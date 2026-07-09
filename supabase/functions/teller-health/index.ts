// =====================================================================
// teller-health Edge Function
//
// Lightweight reachability probe for Teller. The client calls this before
// launching Teller Connect (link / reconnect) so it can avoid opening the
// full-screen Connect overlay into a Teller outage — when Teller is down the
// overlay shows a raw 503 with no way back, trapping the user until they kill
// the app.
//
// We probe `teller.io` (the public site the Connect flow lives under) rather
// than the mTLS data API: during a full outage teller.io returns 503, which is
// exactly what the user sees. No client cert or enrollment token is needed.
// Requires a valid session so this isn't an open proxy.
// =====================================================================

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { publishableKey } from '../_shared/keys.ts'

const TELLER_PROBE_URL = 'https://teller.io/'
const PROBE_TIMEOUT_MS = 8000

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401)
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
    return jsonResponse({ error: 'Invalid or expired token' }, 401)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  let reachable = false
  try {
    const res = await fetch(TELLER_PROBE_URL, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'manual',
    })
    // Any HTTP response short of a 5xx means Teller's edge is serving — a 405
    // or 404 still proves reachability. A 5xx (the 503 outage page) does not.
    reachable = res.status < 500
    // We don't need the body; release it so the connection can be reused.
    await res.body?.cancel().catch(() => {})
  } catch {
    // Timeout (abort) or network failure — treat as unreachable.
    reachable = false
  } finally {
    clearTimeout(timer)
  }

  return jsonResponse({ reachable })
})
