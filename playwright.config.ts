import { defineConfig, devices } from '@playwright/test'
import { localSupabaseViteEnv } from './tests/e2e/load-env'

const viteEnv = localSupabaseViteEnv()

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: process.env.CI ? 60_000 : 30_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    // localhost (not 127.0.0.1) so the WebAuthn RP-ID "localhost" matches the
    // page origin — RP-IDs cannot be IP addresses.
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --host localhost --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: viteEnv,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
