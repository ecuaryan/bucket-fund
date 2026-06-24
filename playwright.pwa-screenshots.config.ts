import { defineConfig } from '@playwright/test'
import { localSupabaseViteEnv } from './tests/e2e/load-env'
import { PWA_SCREENSHOT_VIEWPORT } from './scripts/seed/pwaScreenshots'

/** Capture PWA install screenshots — not part of CI. See docs/MAINTENANCE.md § Local database scenarios. */
export default defineConfig({
  testDir: 'tests/pwa-screenshots',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: process.env.PWA_SCREENSHOTS_BASE_URL ?? 'http://127.0.0.1:5173',
    viewport: PWA_SCREENSHOT_VIEWPORT,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  },
  webServer: process.env.PWA_SCREENSHOTS_SKIP_SERVER
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 5173',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: true,
        timeout: 120_000,
        env: localSupabaseViteEnv(),
      },
  projects: [{ name: 'chromium' }],
})
