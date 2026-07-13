// =====================================================================
// simplefin-claim Edge Function
//
// Step 1 of connecting SimpleFIN (admin only). The admin pastes a
// one-time Setup Token from their SimpleFIN Bridge account; we claim it
// (POST the decoded claim URL → Access URL), store the Access URL in
// `simplefin_connections`, and return the connection's account list for
// the confirm step (simplefin-accounts-confirm). SimpleFIN does not
// classify account types, so nothing lands in `accounts` until the
// admin marks each one cash vs card.
//
// The Access URL never reaches the client — only the connection id and
// account metadata do.
// =====================================================================

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { secretKey } from '../_shared/keys.ts'
import { CORS_HEADERS, handleCors, jsonResponse } from '../_shared/http.ts'
import { requireCallerAdmin } from '../_shared/callerMember.ts'
import {
  claimAccessUrl,
  fetchAccounts,
  SimpleFinApiError,
  SimpleFinSetupTokenError,
  SimpleFinTimeoutError,
} from '../_shared/simplefin.ts'

type ClaimRequest = {
  setupToken?: string
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const auth = await requireCallerAdmin(req, 'connect SimpleFIN')
  if ('errorResponse' in auth) return auth.errorResponse
  const { member } = auth

  let body: ClaimRequest = {}
  try {
    body = (await req.json()) as ClaimRequest
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  if (!body.setupToken?.trim()) {
    return jsonResponse({ error: 'setupToken is required' }, 400)
  }

  let accessUrl: string
  try {
    accessUrl = await claimAccessUrl(body.setupToken)
  } catch (err) {
    if (err instanceof SimpleFinSetupTokenError) {
      return jsonResponse(
        { error: 'Invalid Setup Token', code: 'bad_setup_token', details: err.message },
        400,
      )
    }
    if (err instanceof SimpleFinTimeoutError) {
      return jsonResponse(
        { error: 'SimpleFIN timed out', code: 'bank_timeout', details: err.message },
        504,
      )
    }
    if (err instanceof SimpleFinApiError) {
      // A Setup Token can only be claimed once; a reused/expired token
      // typically 403s here.
      return jsonResponse(
        {
          error: 'SimpleFIN rejected the Setup Token',
          code: 'claim_rejected',
          details: err.message,
        },
        err.status === 403 ? 403 : 502,
      )
    }
    return jsonResponse(
      {
        error: 'Failed to claim Setup Token',
        details: err instanceof Error ? err.message : String(err),
      },
      502,
    )
  }

  // Pull the account list before persisting anything — a connection with
  // no reachable accounts shouldn't be stored.
  let accountSet
  try {
    accountSet = await fetchAccounts(accessUrl, { balancesOnly: true })
  } catch (err) {
    if (err instanceof SimpleFinTimeoutError) {
      return jsonResponse(
        { error: 'SimpleFIN timed out', code: 'bank_timeout', details: err.message },
        504,
      )
    }
    return jsonResponse(
      {
        error: 'Claimed the token but failed to list accounts',
        details: err instanceof Error ? err.message : String(err),
      },
      502,
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, secretKey())

  const { data: connection, error: insertError } = await admin
    .from('simplefin_connections')
    .insert({
      family_id: member.family_id,
      access_url: accessUrl,
      status: 'active',
      last_synced_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (insertError || !connection) {
    console.error('Failed to insert simplefin_connections', insertError)
    return jsonResponse(
      { error: 'Failed to store connection', details: insertError?.message },
      500,
    )
  }

  return jsonResponse({
    ok: true,
    connectionId: connection.id,
    // Non-fatal per-institution problems (e.g. one bank needs attention
    // on the Bridge site) — surfaced so the admin isn't confused by a
    // short list.
    errors: accountSet.errors,
    accounts: accountSet.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      institutionName: a.org?.name ?? a.org?.domain ?? null,
      currency: a.currency,
      balance: Number(a.balance),
      // SimpleFIN reports liabilities negative — suggest 'card' for those;
      // the admin confirms.
      suggestedKind: Number(a.balance) < 0 ? 'card' : 'cash',
    })),
  })
})
