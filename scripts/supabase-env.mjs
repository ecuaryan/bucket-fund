#!/usr/bin/env node
/**
 * Print local Supabase connection vars (for eval or .env.local).
 *
 * Prefer:  source scripts/env-local.sh
 * Or:      eval "$(node scripts/supabase-env.mjs)"
 *
 * Do NOT:  eval "$(npm run env:local)"  — npm adds lines that break eval.
 */
import { execSync } from 'node:child_process'

function parseStatusEnv(stdout) {
  const out = {}
  for (const line of stdout.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    const key = m[1]
    let value = m[2]
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

let raw
try {
  raw = execSync('npx supabase status -o env', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch {
  console.error(
    'Local Supabase is not running. Start it with: npx supabase start',
  )
  process.exit(1)
}

const status = parseStatusEnv(raw)
const apiUrl = status.API_URL ?? status.SUPABASE_URL
const anon = status.ANON_KEY ?? status.SUPABASE_ANON_KEY
const service = status.SERVICE_ROLE_KEY ?? status.SUPABASE_SERVICE_ROLE_KEY

if (!apiUrl || !anon) {
  console.error('Could not read API_URL / ANON_KEY from supabase status')
  process.exit(1)
}

const lines = [
  `export VITE_SUPABASE_URL=${apiUrl}`,
  `export VITE_SUPABASE_PUBLISHABLE_KEY=${anon}`,
  `export VITE_SUPABASE_ANON_KEY=${anon}`,
  `export SUPABASE_URL=${apiUrl}`,
  `export SUPABASE_ANON_KEY=${anon}`,
]
if (service) {
  lines.push(`export SUPABASE_SERVICE_ROLE_KEY=${service}`)
}

process.stdout.write(lines.join('\n'))
