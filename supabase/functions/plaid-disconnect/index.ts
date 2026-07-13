// =====================================================================
// plaid-disconnect Edge Function (admin only)
//
// ITEM-PRESERVING by design: removes the Item's `accounts` rows and
// marks the plaid_items row 'detached' — the access token is KEPT so a
// future re-link of the same bank reuses the existing Item instead of
// consuming one of the team's 10 lifetime slots. /item/remove is never
// called: removing an Item at Plaid does not refund its slot, so there
// is nothing to gain and a working credential to lose.
// =====================================================================

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { secretKey } from '../_shared/keys.ts'
import { handleCors, jsonResponse } from '../_shared/http.ts'
import { requireCallerAdmin } from '../_shared/callerMember.ts'

type DisconnectRequest = {
  itemId?: string
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const auth = await requireCallerAdmin(req, 'unlink Plaid connections')
  if ('errorResponse' in auth) return auth.errorResponse
  const { member } = auth

  let body: DisconnectRequest = {}
  try {
    body = (await req.json()) as DisconnectRequest
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  const itemId = body.itemId?.trim()
  if (!itemId) {
    return jsonResponse({ error: 'itemId is required' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, secretKey())

  const { data: item, error: itemError } = await admin
    .from('plaid_items')
    .select('id, family_id')
    .eq('id', itemId)
    .maybeSingle()
  if (itemError) {
    return jsonResponse(
      { error: 'Failed to load item', details: itemError.message },
      500,
    )
  }
  // Same 404 whether missing or cross-family.
  if (!item || item.family_id !== member.family_id) {
    return jsonResponse({ error: 'Item not found in your family' }, 404)
  }

  const { error: accountsError } = await admin
    .from('accounts')
    .delete()
    .eq('family_id', item.family_id)
    .eq('plaid_item_id', item.id)
  if (accountsError) {
    return jsonResponse(
      { error: 'Failed to remove accounts', details: accountsError.message },
      500,
    )
  }

  const { error: detachError } = await admin
    .from('plaid_items')
    .update({ status: 'detached' })
    .eq('id', item.id)
  if (detachError) {
    return jsonResponse(
      { error: 'Failed to detach item', details: detachError.message },
      500,
    )
  }

  return jsonResponse({ ok: true, detached: true })
})
