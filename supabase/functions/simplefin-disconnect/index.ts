// =====================================================================
// simplefin-disconnect Edge Function
//
// Removes a SimpleFIN connection and its linked `accounts` rows (admin
// only). SimpleFIN has no server-side revoke API — the credential stays
// valid on the Bridge until the user deletes this app's access on
// beta-bridge.simplefin.org, which the client's confirm Sheet tells them
// to do.
// =====================================================================

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { secretKey } from '../_shared/keys.ts'
import { handleCors, jsonResponse } from '../_shared/http.ts'
import { requireCallerAdmin } from '../_shared/callerMember.ts'

type DisconnectRequest = {
  connectionId?: string
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const auth = await requireCallerAdmin(req, 'unlink SimpleFIN connections')
  if ('errorResponse' in auth) return auth.errorResponse
  const { member } = auth

  let body: DisconnectRequest = {}
  try {
    body = (await req.json()) as DisconnectRequest
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  const connectionId = body.connectionId?.trim()
  if (!connectionId) {
    return jsonResponse({ error: 'connectionId is required' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, secretKey())

  const { data: connection, error: connectionError } = await admin
    .from('simplefin_connections')
    .select('id, family_id')
    .eq('id', connectionId)
    .maybeSingle()
  if (connectionError) {
    return jsonResponse(
      { error: 'Failed to load connection', details: connectionError.message },
      500,
    )
  }
  // Same 404 whether missing or cross-family.
  if (!connection || connection.family_id !== member.family_id) {
    return jsonResponse({ error: 'Connection not found in your family' }, 404)
  }

  const { error: accountsError } = await admin
    .from('accounts')
    .delete()
    .eq('family_id', connection.family_id)
    .eq('simplefin_connection_id', connection.id)
  if (accountsError) {
    return jsonResponse(
      { error: 'Failed to remove accounts', details: accountsError.message },
      500,
    )
  }

  const { error: deleteError } = await admin
    .from('simplefin_connections')
    .delete()
    .eq('id', connection.id)
  if (deleteError) {
    return jsonResponse(
      { error: 'Failed to remove connection', details: deleteError.message },
      500,
    )
  }

  return jsonResponse({ ok: true })
})
