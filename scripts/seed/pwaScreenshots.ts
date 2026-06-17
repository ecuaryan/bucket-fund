/**
 * Demo data for the `pwa-screenshots` seed scenario and Chrome Richer Install UI
 * manifest screenshots. Keep bucket names, amounts, and PNG paths in sync —
 * refresh assets with `npm run pwa:screenshots` after UI changes.
 */

export const PWA_SCREENSHOT_SCENARIO_ID = 'pwa-screenshots' as const

/** Header name on Buckets — photogenic, not “Seed Admin”. */
export const PWA_SCREENSHOT_ADMIN_DISPLAY_NAME = 'Jordan'

export const PWA_SCREENSHOT_MANUAL_SOURCE = {
  label: 'Checking',
  amount: 8420,
} as const

/** Emoji-first bucket labels for install screenshots and local demos. */
export const PWA_SCREENSHOT_BUCKETS = [
  { name: '🛒 Groceries', amount: 450 },
  { name: '🏠 Rent', amount: 1800 },
  { name: '⚡ Utilities', amount: 180 },
  { name: '🎉 Fun', amount: 120 },
  { name: '✈️ Travel', amount: 350 },
  { name: '🎁 Gifts', amount: 75 },
  { name: '🚗 Transportation', amount: 200 },
] as const

/** Matches `sendMoney` in the pwa-screenshots seed — affects Float before rebalance capture. */
export const PWA_SCREENSHOT_SEND_AMOUNT = 40

/** Playwright device viewport — sizes must match manifest `sizes` and PNG pixels. */
export const PWA_SCREENSHOT_VIEWPORT = { width: 412, height: 915 } as const

const screenshotSize = `${PWA_SCREENSHOT_VIEWPORT.width}x${PWA_SCREENSHOT_VIEWPORT.height}`

/** Files under `public/screenshots/` referenced by the web app manifest. */
export const PWA_MANIFEST_SCREENSHOTS = [
  {
    src: '/screenshots/buckets.png',
    sizes: screenshotSize,
    type: 'image/png',
    form_factor: 'narrow',
  },
  {
    src: '/screenshots/buckets-rebalance.png',
    sizes: screenshotSize,
    type: 'image/png',
    form_factor: 'narrow',
  },
  {
    src: '/screenshots/send.png',
    sizes: screenshotSize,
    type: 'image/png',
    form_factor: 'narrow',
  },
  {
    src: '/screenshots/history.png',
    sizes: screenshotSize,
    type: 'image/png',
    form_factor: 'narrow',
  },
] as const
