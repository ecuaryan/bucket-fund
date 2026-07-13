// =====================================================================
// plaid-exchange Edge Function
//
// Completes a Plaid Link session (admin only, flag-gated). Two modes:
//
//   * NEW link: { publicToken, institution? } — exchanges the public
//     token for an access token + item_id, upserts plaid_items, pulls
//     balances, and upserts `accounts` rows with source='plaid'. Plaid
//     classifies account types, so there is no manual confirm step
//     (unlike SimpleFIN).
//   * UPDATE-MODE completion: { itemId } — the Link session repaired an
//     existing Item; no exchange happens. Marks it active and re-pulls
//     balances.
//
// Item preservation: if the exchanged item_id already exists for this
// family (including status 'detached'), the row is updated in place —
// re-linking a known bank never creates a duplicate.
// =====================================================================

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { secretKey } from '../_shared/keys.ts'
import { handleCors, jsonResponse } from '../_shared/http.ts'
import { requireCallerAdmin } from '../_shared/callerMember.ts'
import { familyHasPlaidFlag, plaidFlagDeniedResponse } from '../_shared/plaidFlag.ts'
import {
  exchangePublicToken,
  getBalances,
  mapPlaidAccountType,
  pickPlaidBalance,
  PlaidTimeoutError,
  plaidWebhookUrl,
  type PlaidAccount,
} from '../_shared/plaid.ts'

type ExchangeRequest = {
  publicToken?: string
  institution?: { name?: string; institution_id?: string }
  /** plaid_items.id — update-mode completion (no exchange). */
  itemId?: string
}

function accountDisplayName(account: PlaidAccount): string {
  const base = account.name || account.official_name || 'Account'
  return account.mask ? `${base} ····${account.mask}` : base
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

  let body: ExchangeRequest = {}
  try {
    body = (await req.json()) as ExchangeRequest
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  let itemRowId: string
  let accessToken: string

  if (body.itemId) {
    // Update-mode completion: the Item was repaired in Link; no exchange.
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
    if (!item || item.family_id !== member.family_id) {
      return jsonResponse({ error: 'Item not found in your family' }, 404)
    }
    itemRowId = item.id
    accessToken = item.access_token
    const { error: statusError } = await admin
      .from('plaid_items')
      .update({ status: 'active' })
      .eq('id', item.id)
    if (statusError) {
      return jsonResponse(
        { error: 'Failed to update item', details: statusError.message },
        500,
      )
    }
  } else {
    if (!body.publicToken?.trim()) {
      return jsonResponse({ error: 'publicToken is required' }, 400)
    }
    let exchanged
    try {
      exchanged = await exchangePublicToken(body.publicToken)
    } catch (err) {
      if (err instanceof PlaidTimeoutError) {
        return jsonResponse(
          { error: 'Plaid timed out', code: 'bank_timeout', details: err.message },
          504,
        )
      }
      return jsonResponse(
        {
          error: 'Failed to exchange Plaid token',
          details: err instanceof Error ? err.message : String(err),
        },
        502,
      )
    }
    accessToken = exchanged.accessToken

    // Upsert by (family_id, item_id): re-linking a known bank (even a
    // detached one) updates the row in place — never a duplicate Item row.
    const { data: item, error: upsertError } = await admin
      .from('plaid_items')
      .upsert(
        {
          family_id: member.family_id,
          item_id: exchanged.itemId,
          access_token: accessToken,
          institution_name: body.institution?.name ?? null,
          institution_id: body.institution?.institution_id ?? null,
          status: 'active',
          last_synced_at: new Date().toISOString(),
          // New links carry the webhook URL in their link token.
          webhook_configured_at: plaidWebhookUrl() ? new Date().toISOString() : null,
        },
        { onConflict: 'family_id,item_id' },
      )
      .select('id')
      .single()
    if (upsertError || !item) {
      console.error('Failed to upsert plaid_items', upsertError)
      return jsonResponse(
        { error: 'Failed to store item', details: upsertError?.message },
        500,
      )
    }
    itemRowId = item.id
  }

  // Pull balances and land the accounts. Plaid classifies types, so
  // accounts import directly (auto-mapped) with no confirm step.
  let plaidAccounts: PlaidAccount[]
  try {
    plaidAccounts = await getBalances(accessToken)
  } catch (err) {
    if (err instanceof PlaidTimeoutError) {
      return jsonResponse(
        { error: 'Plaid timed out', code: 'bank_timeout', details: err.message },
        504,
      )
    }
    return jsonResponse(
      {
        error: 'Failed to fetch accounts from Plaid',
        details: err instanceof Error ? err.message : String(err),
      },
      502,
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

  for (const plaidAccount of plaidAccounts) {
    let balance: number
    try {
      balance = pickPlaidBalance(plaidAccount.balances)
    } catch (err) {
      return jsonResponse(
        {
          error: 'Plaid returned no usable balance',
          details: `${plaidAccount.account_id}: ${err instanceof Error ? err.message : String(err)}`,
        },
        502,
      )
    }

    const rowData = {
      family_id: member.family_id,
      source: 'plaid',
      plaid_account_id: plaidAccount.account_id,
      plaid_item_id: itemRowId,
      institution_name: body.institution?.name ?? null,
      account_name: accountDisplayName(plaidAccount),
      account_type: mapPlaidAccountType(plaidAccount.type, plaidAccount.subtype),
      current_balance: balance,
      last_synced_at: nowIso,
    }

    const { data: existing } = await admin
      .from('accounts')
      .select('id, owner_member_id, institution_name')
      .eq('family_id', member.family_id)
      .eq('plaid_account_id', plaidAccount.account_id)
      .maybeSingle()

    // Preserve prior kid assignment and institution name on re-link.
    if (existing) {
      rowData.owner_member_id = existing.owner_member_id
      if (!rowData.institution_name) {
        rowData.institution_name = existing.institution_name
      }
    }

    const query = existing
      ? admin.from('accounts').update(rowData).eq('id', existing.id)
      : admin.from('accounts').insert(rowData)
    const { data: saved, error: saveError } = await query
      .select('id, account_name, institution_name, account_type, current_balance')
      .single()
    if (saveError || !saved) {
      console.error('Failed to persist plaid account', saveError)
      return jsonResponse(
        { error: 'Failed to persist accounts', details: saveError?.message },
        500,
      )
    }
    imported.push(saved)
  }

  await admin
    .from('plaid_items')
    .update({ last_synced_at: nowIso })
    .eq('id', itemRowId)

  return jsonResponse({ ok: true, itemId: itemRowId, accounts: imported })
})
