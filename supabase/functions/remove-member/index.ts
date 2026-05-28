// @ts-nocheck — Deno Edge Function runtime.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { handleCors, jsonResponse } from '../_shared/http.ts'
import { requireAdmin, serviceClient } from '../_shared/supabase.ts'

type Body = { memberId?: string }

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const auth = await requireAdmin(req.headers.get('Authorization'))
  if (!auth.ok) return auth.response

  let body: Body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const memberId = body.memberId?.trim()
  if (!memberId) {
    return jsonResponse({ error: 'memberId is required' }, 400)
  }

  if (memberId === auth.memberId) {
    return jsonResponse({ error: 'You cannot remove yourself' }, 400)
  }

  const admin = serviceClient()
  const { data: target, error: fetchError } = await admin
    .from('family_members')
    .select('id, family_id, role, user_id, name')
    .eq('id', memberId)
    .maybeSingle()

  if (fetchError) {
    console.error('remove-member fetch', fetchError)
    return jsonResponse({ error: 'Lookup failed' }, 500)
  }
  if (!target || target.family_id !== auth.familyId) {
    return jsonResponse({ error: 'Member not found' }, 404)
  }
  if (target.role === 'admin') {
    return jsonResponse({ error: 'Cannot remove an admin' }, 400)
  }
  if (target.role !== 'member' && target.role !== 'child') {
    return jsonResponse({ error: 'Invalid member role' }, 400)
  }

  if (target.user_id) {
    const { error: signOutError } = await admin.auth.admin.signOut(
      target.user_id,
      'global',
    )
    if (signOutError) {
      console.warn('remove-member signOut', signOutError)
    }
  }

  const { error: deleteError } = await admin
    .from('family_members')
    .delete()
    .eq('id', memberId)

  if (deleteError) {
    console.error('remove-member delete', deleteError)
    return jsonResponse({ error: 'Could not remove member' }, 500)
  }

  if (target.user_id) {
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(
      target.user_id,
    )
    if (authDeleteError) {
      console.error('remove-member auth delete', authDeleteError)
      return jsonResponse({ error: 'Could not remove login' }, 500)
    }
  }

  return jsonResponse({ ok: true, name: target.name })
})
