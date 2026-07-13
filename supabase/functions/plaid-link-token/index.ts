// =====================================================================
// plaid-link-token Edge Function
//
// Creates a Plaid Link token for the admin (flag-gated). Two modes:
//
//   * no body / {}            → NEW link. The resulting Link session
//     creates a new Item — one of the team's 10 LIFETIME slots. This is
//     the ONLY code path that can lead to a new Item.
//   * { itemId }              → UPDATE MODE. Repairs the existing Item's
//     bank login (ITEM_LOGIN_REQUIRED etc.); consumes nothing.
//
// The client must always prefer update mode for an institution that
// already has an Item (including a 'detached' one).
// =====================================================================

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { secretKey } from '../_shared/keys.ts'
import { handleCors, jsonResponse } from '../_shared/http.ts'
import { requireCallerAdmin } from '../_shared/callerMember.ts'
import { familyHasPlaidFlag, plaidFlagDeniedResponse } from '../_shared/plaidFlag.ts'
import { createLinkToken, PlaidApiError, PlaidTimeoutError } from '../_shared/plaid.ts'

type LinkTokenRequest = {
  /** plaid_items.id (our uuid) — requests update mode for that Item. */
  itemId?: string
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const auth = await requireCallerAdmin(req, 'connect Plaid')
  if ('errorResponse' in auth) return auth.errorResponse
  const { member } = auth

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, secretKey())

  if (!(await familyHasPlaidFlag(admin, member.family_id))) {
    return plaidFlagDeniedResponse()
  }

  let body: LinkTokenRequest = {}
  try {
    const text = await req.text()
    if (text.trim()) {
      body = JSON.parse(text) as LinkTokenRequest
    }
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  let accessToken: string | undefined
  if (body.itemId) {
    const { data: item, error: itemError } = await admin
      .from('plaid_items')
      .select('id, family_id, access_token')
      .eq('id', body.itemId)
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
    accessToken = item.access_token
  }

  try {
    const linkToken = await createLinkToken({
      clientUserId: member.family_id,
      accessToken,
    })
    return jsonResponse({ ok: true, linkToken, updateMode: Boolean(accessToken) })
  } catch (err) {
    if (err instanceof PlaidTimeoutError) {
      return jsonResponse(
        { error: 'Plaid timed out', code: 'bank_timeout', details: err.message },
        504,
      )
    }
    const details =
      err instanceof PlaidApiError
        ? `${err.errorCode ?? err.status}`
        : err instanceof Error
          ? err.message
          : String(err)
    return jsonResponse(
      { error: 'Failed to create Plaid Link token', details },
      502,
    )
  }
})
