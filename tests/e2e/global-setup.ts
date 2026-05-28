import { execSync } from 'node:child_process'

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
    return
  }

  console.log('[e2e] Resetting database…')
  execSync('npx supabase db reset --no-seed', { stdio: 'inherit' })
}
