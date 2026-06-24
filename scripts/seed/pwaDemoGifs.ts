/**
 * Demo data for README / portfolio GIF capture (`npm run pwa:gifs`).
 * Empty buckets + cash in Float — the Playwright script creates buckets live.
 */

export const PWA_DEMO_GIF_SCENARIO_ID = 'pwa-gifs' as const

export const PWA_DEMO_GIF_ADMIN_DISPLAY_NAME = 'Jordan'

export const PWA_DEMO_GIF_MANUAL_SOURCE = {
  label: 'Checking',
  amount: 5000,
} as const

export const PWA_DEMO_GIF_BUCKETS = ['🛒 Groceries', '🏠 Rent', '🎉 Fun'] as const

/** Two set-asides — enough to show the flow without lengthening the GIF. */
export const PWA_DEMO_GIF_MOVES = [
  { bucket: '🛒 Groceries', amount: 450 },
  { bucket: '🏠 Rent', amount: 1800 },
] as const

/** Bucket dragged up in the README demo GIF. */
export const PWA_DEMO_GIF_DRAG_BUCKET = '🏠 Rent' as const
