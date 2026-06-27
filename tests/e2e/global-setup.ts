import { execSync } from 'node:child_process'
import { requireDbEnv } from '../db/env'

/**
 * Wait until edge functions are served at /functions/v1 (served by the local
 * edge-runtime once `supabase start` is up). The first request boots the
 * function and fetches its npm deps, so we pay that cold-start cost here in
 * setup rather than inside a test. Any HTTP response means it is ready.
 */
async function warmUpFunctions(): Promise<void> {
  const { url, anonKey } = requireDbEnv()
  const probe = `${url}/functions/v1/webauthn-login-options`
  const deadline = Date.now() + 180_000
  let lastErr: unknown
  while (Date.now() < deadline) {
    try {
      const res = await fetch(probe, {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: anonKey },
        body: '{}',
        signal: AbortSignal.timeout(10_000),
      })
      if (res.status > 0) {
        console.log(`[e2e] Edge functions ready (probe ${res.status}).`)
        return
      }
    } catch (err) {
      lastErr = err
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(
    `[e2e] Edge functions never became ready (need edge-runtime running). Last error: ${String(lastErr)}`,
  )
}

export default async function globalSetup() {
  if (!process.env.CI) {
    try {
      execSync('npx supabase status', { stdio: 'pipe' })
    } catch {
      console.log('\n[e2e] Starting local Supabase…')
      execSync('npx supabase start', { stdio: 'inherit' })
    }
  }

  if (process.env.CI && process.env.SKIP_DB_RESET === '1') {
    console.log('[e2e] Skipping db reset — CI already ran supabase start with migrations')
  } else {
    console.log('[e2e] Resetting database…')
    execSync('npx supabase db reset --no-seed', { stdio: 'inherit' })
  }

  await warmUpFunctions()
}
