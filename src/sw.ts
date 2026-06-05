/// <reference lib="webworker" />
/**
 * Service worker entry point. Built by `vite-plugin-pwa` in `injectManifest`
 * mode: workbox injects the precache manifest at the `self.__WB_MANIFEST`
 * placeholder during the build, and the rest of this file ships as-is.
 *
 * Strategy:
 *   - Precache the built assets so the shell loads offline.
 *   - SPA navigations always serve the precached index.html (never a stale
 *     per-route NetworkFirst copy that can reference deleted JS chunks).
 *   - Supabase auth is network-only — never cache tokens or session checks.
 *   - Other Supabase calls are network-first with a short timeout for offline.
 *   - Images/fonts only in runtime cache-first (JS/CSS come from precache).
 *
 * Keep this file small and avoid importing app code — it runs in the
 * Service Worker global scope, not in a window.
 */
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA shell: one precached index.html for every in-app route. Avoids stale
// /send or /history navigation cache entries after a deploy changes chunk hashes.
const navigationHandler = createHandlerBoundToURL('/index.html')
registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/api/, /^\/auth/, /^\/offline\.html$/],
  }),
)

// Auth and Edge Functions must never be cached.
registerRoute(
  ({ url }) =>
    url.hostname.endsWith('.supabase.co') &&
    (url.pathname.startsWith('/auth/') ||
      url.pathname.startsWith('/functions/v1/')),
  new NetworkOnly(),
)

// Supabase REST + Realtime: network-first with a short timeout.
registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co'),
  new NetworkFirst({
    cacheName: 'supabase-api',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 5 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)

// Hashed build assets are precached above. Cache only long-lived media here —
// never script/style (stale chunks after deploy) or auth/API responses.
registerRoute(
  ({ request }) => ['image', 'font'].includes(request.destination),
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
