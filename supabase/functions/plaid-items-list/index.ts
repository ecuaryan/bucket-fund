// =====================================================================
// plaid-items-list Edge Function (admin only, flag-gated)
//
// Item metadata for the admin's family — id, institution, status,
// last sync, account count. Drives the Admin grouping, the Reconnect
// button (status 'reconnect_required'), and re-link detection (a
// 'detached' Item for an institution means update-mode re-link instead
// of a fresh Item). Never exposes access tokens.
// =====================================================================

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { secretKey } from '../_shared/keys.ts'
import { handleCors, jsonResponse } from '../_shared/http.ts'
import { requireCallerAdmin } from '../_shared/callerMember.ts'
import { familyHasPlaidFlag, plaidFlagDeniedResponse } from '../_shared/plaidFlag.ts'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const auth = await requireCallerAdmin(req, 'view Plaid connections')
  if ('errorResponse' in auth) return auth.errorResponse
  const { member } = auth

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, secretKey())

  if (!(await familyHasPlaidFlag(admin, member.family_id))) {
    return plaidFlagDeniedResponse()
  }

  const { data: items, error: listError } = await admin
    .from('plaid_items')
    .select('id, institution_name, institution_id, status, last_synced_at')
    .eq('family_id', member.family_id)
    .order('created_at', { ascending: true })
  if (listError) {
    return jsonResponse(
      { error: 'Failed to list items', details: listError.message },
      500,
    )
  }

  const { data: accountCounts, error: countError } = await admin
    .from('accounts')
    .select('plaid_item_id')
    .eq('family_id', member.family_id)
    .not('plaid_item_id', 'is', null)
  if (countError) {
    return jsonResponse(
      { error: 'Failed to count accounts', details: countError.message },
      500,
    )
  }

  const countByItem = new Map<string, number>()
  for (const row of accountCounts ?? []) {
    if (!row.plaid_item_id) continue
    countByItem.set(row.plaid_item_id, (countByItem.get(row.plaid_item_id) ?? 0) + 1)
  }

  return jsonResponse({
    ok: true,
    items: (items ?? []).map((item) => ({
      id: item.id,
      institutionName: item.institution_name,
      institutionId: item.institution_id,
      status: item.status,
      lastSyncedAt: item.last_synced_at,
      accountCount: countByItem.get(item.id) ?? 0,
    })),
  })
})
