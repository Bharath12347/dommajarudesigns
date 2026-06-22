/* ═══════════════════════════════════════════════════════════════
   Bharath Creative Agency — Service Worker
   Strategy:
     • Shell (HTML/CSS/JS)    → Cache First
     • Unsplash images        → Stale-While-Revalidate
     • WhatsApp / external    → Network Only
   ═══════════════════════════════════════════════════════════════ */

const CACHE_NAME    = 'bca-v1';
const SHELL_CACHE   = 'bca-shell-v1';
const IMAGE_CACHE   = 'bca-images-v1';

/* Files to pre-cache on install */
const SHELL_FILES = [
  './bharath-creative-agency.html',
  './manifest.json'
];

/* ── Install: pre-cache shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: clean old caches ── */
self.addEventListener('activate', event => {
  const keep = [SHELL_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => !keep.includes(k)).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: routing strategies ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* Skip non-GET and cross-origin non-image requests */
  if (event.request.method !== 'GET') return;

  /* External APIs / WhatsApp / YouTube — always network */
  if (
    url.hostname === 'wa.me' ||
    url.hostname === 'api.whatsapp.com' ||
    url.hostname === 'youtube.com' ||
    url.hostname === 'www.youtube-nocookie.com' ||
    url.hostname === 'api.anthropic.com'
  ) return;

  /* Unsplash images — Stale-While-Revalidate */
  if (url.hostname === 'images.unsplash.com') {
    event.respondWith(staleWhileRevalidate(event.request, IMAGE_CACHE));
    return;
  }

  /* App shell (local files) — Cache First */
  if (
    url.origin === self.location.origin ||
    url.protocol === 'content:' ||
    url.protocol === 'file:'
  ) {
    event.respondWith(cacheFirst(event.request, SHELL_CACHE));
    return;
  }

  /* Everything else — Network First with cache fallback */
  event.respondWith(networkFirst(event.request, CACHE_NAME));
});

/* ── Strategy: Cache First ── */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('<h2 style="font-family:sans-serif;padding:24px">You are offline.<br>Please reconnect to load Bharath Creative Agency.</h2>',
      { headers: { 'Content-Type': 'text/html' } });
  }
}

/* ── Strategy: Stale While Revalidate ── */
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  /* Fetch fresh in the background regardless */
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || fetchPromise;
}

/* ── Strategy: Network First ── */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

/* ── Background Sync placeholder (for offline form submissions) ── */
self.addEventListener('sync', event => {
  if (event.tag === 'booking-sync') {
    /* Future: retry failed WhatsApp/form submits when back online */
    console.log('[SW] Background sync triggered:', event.tag);
  }
});

/* ── Push Notifications placeholder ── */
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'Bharath Creative Agency', {
    body:    data.body    || 'You have a new message!',
    icon:    './icons/icon-192.png',
    badge:   './icons/icon-72.png',
    vibrate: [200, 100, 200],
    data:    { url: data.url || './' }
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
