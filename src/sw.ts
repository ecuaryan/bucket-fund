/// <reference lib="webworker" />
/**
 * Service worker entry point. Built by `vite-plugin-pwa` in `injectManifest`
 * mode: workbox injects the precache manifest at the `self.__WB_MANIFEST`
 * placeholder during the build, and the rest of this file ships as-is.
 *
 * Strategy:
 *   - Precache the built assets so the shell loads offline.
 *   - For navigation requests that miss the cache, fall back to /offline.html.
 *   - For Supabase API calls, prefer the network with a short timeout and
 *     fall back to cache when offline.
 *   - For static assets (fonts, images, scripts, styles), serve from cache
 *     first.
 *
 * Keep this file small and avoid importing app code — it runs in the
 * Service Worker global scope, not in a window.
 */
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Navigation fallback: when a navigation request can't be satisfied from
// the network or the precache, show the offline page.
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'navigations',
      networkTimeoutSeconds: 3,
      plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
    }),
    {
      denylist: [/^\/api/, /^\/auth/],
    },
  ),
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

// Static assets: cache-first.
registerRoute(
  ({ request }) =>
    ['image', 'font', 'style', 'script'].includes(request.destination),
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
