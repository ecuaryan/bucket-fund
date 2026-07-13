// =====================================================================
// simplefin-accounts-confirm Edge Function
//
// Step 2 of connecting SimpleFIN (admin only). After simplefin-claim
// returns the connection's account list, the admin picks which accounts
// to import and marks each cash vs card (SimpleFIN doesn't classify
// types). This function re-reads balances from SimpleFIN (never trusts
// client-sent amounts) and upserts one `accounts` row per selection
// with source = 'simplefin'.
//
// Selecting zero accounts deletes the connection — a claimed Access URL
// with nothing imported is just a stored credential doing nothing.
// =====================================================================

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { secretKey } from '../_shared/keys.ts'
import { handleCors, jsonResponse } from '../_shared/http.ts'
import { requireCallerAdmin } from '../_shared/callerMember.ts'
import {
  fetchAccounts,
  isReconnectError,
  normalizeBalance,
  SimpleFinTimeoutError,
} from '../_shared/simplefin.ts'

type Selection = {
  accountId?: string
  kind?: 'cash' | 'card'
  /** Optional display-name override; defaults to SimpleFIN's name. */
  name?: string
}

type ConfirmRequest = {
  connectionId?: string
  selections?: Selection[]
}

const MAX_NAME_LENGTH = 80

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const auth = await requireCallerAdmin(req, 'connect SimpleFIN')
  if ('errorResponse' in auth) return auth.errorResponse
  const { member } = auth

  let body: ConfirmRequest = {}
  try {
    body = (await req.json()) as ConfirmRequest
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  const connectionId = body.connectionId?.trim()
  if (!connectionId) {
    return jsonResponse({ error: 'connectionId is required' }, 400)
  }
  const selections = (body.selections ?? []).filter(
    (s): s is Required<Pick<Selection, 'accountId' | 'kind'>> & Selection =>
      Boolean(s.accountId) && (s.kind === 'cash' || s.kind === 'card'),
  )

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, secretKey())

  // Same 404 whether the connection is missing or in another family.
  const { data: connection, error: connectionError } = await admin
    .from('simplefin_connections')
    .select('id, family_id, access_url')
    .eq('id', connectionId)
    .maybeSingle()
  if (connectionError) {
    return jsonResponse(
      { error: 'Failed to load connection', details: connectionError.message },
      500,
    )
  }
  if (!connection || connection.family_id !== member.family_id) {
    return jsonResponse({ error: 'Connection not found in your family' }, 404)
  }

  if (selections.length === 0) {
    const { error: deleteError } = await admin
      .from('simplefin_connections')
      .delete()
      .eq('id', connection.id)
    if (deleteError) {
      return jsonResponse(
        { error: 'Failed to discard connection', details: deleteError.message },
        500,
      )
    }
    return jsonResponse({ ok: true, accounts: [], discarded: true })
  }

  // Re-read balances server-side; the client only tells us which
  // accounts to import and how to classify them.
  let accountSet
  try {
    accountSet = await fetchAccounts(connection.access_url, {
      balancesOnly: true,
    })
  } catch (err) {
    if (err instanceof SimpleFinTimeoutError) {
      return jsonResponse(
        { error: 'SimpleFIN timed out', code: 'bank_timeout', details: err.message },
        504,
      )
    }
    if (isReconnectError(err)) {
      return jsonResponse(
        { error: 'SimpleFIN connection needs reconnecting', code: 'bank_link_reconnect' },
        409,
      )
    }
    return jsonResponse(
      {
        error: 'Failed to load accounts from SimpleFIN',
        details: err instanceof Error ? err.message : String(err),
      },
      502,
    )
  }

  const bySimpleFinId = new Map(accountSet.accounts.map((a) => [a.id, a]))
  const unknown = selections.filter((s) => !bySimpleFinId.has(s.accountId))
  if (unknown.length > 0) {
    return jsonResponse(
      {
        error: 'Some selected accounts were not found on this connection',
        details: unknown.map((s) => s.accountId).join(', '),
      },
      400,
    )
  }

  const nowIso = new Date().toISOString()
  const imported: Array<{
    id: string
    account_name: string | null
    institution_name: string | null
    account_type: string | null
    current_balance: number
  }> = []

  for (const selection of selections) {
    const sfAccount = bySimpleFinId.get(selection.accountId)!
    let balance: number
    try {
      balance = normalizeBalance(selection.kind, sfAccount.balance)
    } catch (err) {
      return jsonResponse(
        {
          error: 'SimpleFIN returned a non-numeric balance',
          details: err instanceof Error ? err.message : String(err),
        },
        502,
      )
    }

    const name = (selection.name?.trim() || sfAccount.name || 'Account').slice(
      0,
      MAX_NAME_LENGTH,
    )
    const rowData = {
      family_id: connection.family_id,
      source: 'simplefin',
      simplefin_account_id: sfAccount.id,
      simplefin_connection_id: connection.id,
      institution_name: sfAccount.org?.name ?? sfAccount.org?.domain ?? null,
      account_name: name,
      account_type: selection.kind === 'card' ? 'credit_card' : 'cash',
      current_balance: balance,
      last_synced_at: nowIso,
    }

    // Re-confirming an already-imported account updates it in place
    // (unique index on family_id + simplefin_account_id).
    const { data: existing } = await admin
      .from('accounts')
      .select('id, owner_member_id')
      .eq('family_id', connection.family_id)
      .eq('simplefin_account_id', sfAccount.id)
      .maybeSingle()

    const query = existing
      ? admin.from('accounts').update(rowData).eq('id', existing.id)
      : admin.from('accounts').insert(rowData)
    const { data: saved, error: saveError } = await query
      .select('id, account_name, institution_name, account_type, current_balance')
      .single()
    if (saveError || !saved) {
      console.error('Failed to persist simplefin account', saveError)
      return jsonResponse(
        { error: 'Failed to persist accounts', details: saveError?.message },
        500,
      )
    }
    imported.push(saved)
  }

  return jsonResponse({ ok: true, accounts: imported })
})
