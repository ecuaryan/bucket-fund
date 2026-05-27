import { execSync } from 'node:child_process'

function parseStatusEnv(stdout: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of stdout.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    let value = m[2]
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[m[1]] = value
  }
  return out
}

function loadFromSupabaseStatus(): void {
  const raw = execSync('npx supabase status -o env', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const status = parseStatusEnv(raw)
  process.env.SUPABASE_URL ??= status.API_URL ?? status.SUPABASE_URL
  process.env.SUPABASE_ANON_KEY ??=
    status.ANON_KEY ?? status.SUPABASE_ANON_KEY
  process.env.SUPABASE_SERVICE_ROLE_KEY ??=
    status.SERVICE_ROLE_KEY ?? status.SUPABASE_SERVICE_ROLE_KEY
}

export function requireDbEnv(): {
  url: string
  anonKey: string
  serviceRoleKey: string
} {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    try {
      loadFromSupabaseStatus()
    } catch {
      throw new Error(
        'Database tests need local Supabase. Run: npx supabase start',
      )
    }
  }

  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY',
    )
  }

  return { url, anonKey, serviceRoleKey }
}
