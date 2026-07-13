// Server-side gate for the `plaid` feature flag. The client hides Plaid
// UI behind useFeatureFlag('plaid'), but the Edge Functions re-check via
// the service role: the flag is the only thing between other households
// and the team's 10 lifetime Plaid Items, so it must hold even against a
// hand-crafted request.

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { jsonResponse } from './http.ts'

/** True when the family has the `plaid` flag enabled. */
export async function familyHasPlaidFlag(
  admin: SupabaseClient,
  familyId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('feature_flags')
    .select('enabled')
    .eq('family_id', familyId)
    .eq('key', 'plaid')
    .maybeSingle()
  if (error) {
    console.error('feature_flags lookup failed', error)
    return false
  }
  return data?.enabled === true
}

/** Standard 403 when the flag is off for the caller's family. */
export function plaidFlagDeniedResponse(): Response {
  return jsonResponse(
    { error: 'Plaid is not enabled for your household' },
    403,
  )
}
