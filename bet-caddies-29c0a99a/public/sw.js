// BetCaddies Service Worker
// Handles push notifications and offline caching

const CACHE_NAME = 'betcaddies-v1'
const OFFLINE_URL = '/offline.html'

// Static assets to pre-cache
const PRECACHE_URLS = [
  '/',
  '/brand/logo.png',
  '/offline.html',
]

// ── Install ──────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Silently fail if some assets are unavailable during install
      })
    })
  )
  self.skipWaiting()
})

// ── Activate ─────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// ── Fetch (Network-first with cache fallback) ───────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip API requests — always go to network
  if (request.url.includes('/api/')) return

  // Skip cross-origin requests
  if (!request.url.startsWith(self.location.origin)) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone and cache successful responses
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone)
          })
        }
        return response
      })
      .catch(() => {
        // Try cache
        return caches.match(request).then((cached) => {
          if (cached) return cached

          // For navigation requests, show offline page
          if (request.mode === 'navigate') {
            return caches.match(OFFLINE_URL)
          }

          return new Response('Offline', { status: 503, statusText: 'Offline' })
        })
      })
  )
})

// ── Push Notifications ──────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'BetCaddies', body: event.data?.text() || 'You have a new notification' }
  }

  const options = {
    body: data.body || '',
    icon: data.icon || '/brand/logo.png',
    badge: data.badge || '/brand/logo.png',
    tag: data.tag || 'betcaddies-notification',
    renotify: true,
    data: {
      url: data.url || '/',
      ...data.data,
    },
    actions: [
      { action: 'open', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'BetCaddies', options)
  )
})

// ── Notification Click ──────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      // Open new window
      return self.clients.openWindow(targetUrl)
    })
  )
})
