import { execSync } from 'node:child_process'

export default async function globalSetup() {
  if (!process.env.CI) {
    try {
      execSync('npx supabase status', { stdio: 'pipe' })
    } catch {
      console.log(
        '\n[db tests] Starting local Supabase (first run may take a minute)…',
      )
      try {
        execSync('npx supabase start', { stdio: 'inherit' })
      } catch {
        throw new Error(
          'Database tests need Docker + local Supabase. Install Docker Desktop, then run: npm run db:start',
        )
      }
    }
  }

  console.log('[db tests] Resetting database (migrations only, no seed)…')
  execSync('npx supabase db reset --no-seed', { stdio: 'inherit' })
}
