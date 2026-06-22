/* ═══════════════════════════════════════════════════════════════
   Bharath Creative Agency — Service Worker v3
   ─────────────────────────────────────────────────────────────
   Strategies:
     Shell (HTML / manifest)   → Cache First  (instant load)
     Google Fonts CSS          → Stale-While-Revalidate
     Google Fonts woff2        → Cache First  (font files rarely change)
     CDN images (jsdelivr)     → Stale-While-Revalidate
     Unsplash images           → Stale-While-Revalidate
     WhatsApp / YouTube        → Network Only (external actions)
     Everything else local     → Network First + cache fallback
   ═══════════════════════════════════════════════════════════════ */

const VER          = 'v3';
const SHELL_CACHE  = `bca-shell-${VER}`;
const IMAGE_CACHE  = `bca-images-${VER}`;
const FONT_CACHE   = `bca-fonts-${VER}`;
const CACHE_NAME   = `bca-misc-${VER}`;

/* Files that MUST be available offline ── critical app shell */
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './sw.js'
];

/* ─────────────────────────────────────────────────────────────
   INSTALL — pre-cache the shell so the app loads instantly
   ───────────────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())   /* take over immediately */
      .catch(err => console.warn('[SW] install cache error:', err))
  );
});

/* ─────────────────────────────────────────────────────────────
   ACTIVATE — delete caches from old versions
   ───────────────────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  const keep = [SHELL_CACHE, IMAGE_CACHE, FONT_CACHE, CACHE_NAME];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !keep.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())  /* control all open tabs now */
  );
});

/* ─────────────────────────────────────────────────────────────
   FETCH — routing table
   ───────────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;  /* skip POST etc. */

  const url = new URL(event.request.url);

  /* ── 1. Always network: external services ── */
  if (
    url.hostname === 'wa.me'                       ||
    url.hostname === 'api.whatsapp.com'            ||
    url.hostname === 'youtube.com'                 ||
    url.hostname === 'www.youtube-nocookie.com'    ||
    url.hostname === 'api.anthropic.com'
  ) return;  /* let browser handle directly */

  /* ── 2. Google Fonts CSS — Stale-While-Revalidate ── */
  if (url.hostname === 'fonts.googleapis.com') {
    event.respondWith(staleWhileRevalidate(event.request, FONT_CACHE));
    return;
  }

  /* ── 3. Google Font woff2 files — Cache First (immutable) ── */
  if (url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(event.request, FONT_CACHE));
    return;
  }

  /* ── 4. CDN images (your portfolio images) — Stale-While-Revalidate ── */
  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(staleWhileRevalidate(event.request, IMAGE_CACHE));
    return;
  }

  /* ── 5. Unsplash images — Stale-While-Revalidate ── */
  if (url.hostname === 'images.unsplash.com') {
    event.respondWith(staleWhileRevalidate(event.request, IMAGE_CACHE));
    return;
  }

  /* ── 6. App shell & local assets — Cache First ── */
  if (
    url.origin === self.location.origin ||
    url.protocol === 'file:'
  ) {
    event.respondWith(cacheFirst(event.request, SHELL_CACHE));
    return;
  }

  /* ── 7. Anything else — Network First ── */
  event.respondWith(networkFirst(event.request, CACHE_NAME));
});

/* ═══════════════════════════════════════════════════════════════
   STRATEGIES
   ═══════════════════════════════════════════════════════════════ */

/* Cache First: return cached version immediately; fetch & update on miss */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    /* Offline fallback for the main shell */
    if (request.destination === 'document') return offlinePage();
    return new Response('', { status: 503 });
  }
}

/* Stale-While-Revalidate: return cache instantly, refresh in background */
async function staleWhileRevalidate(request, cacheName) {
  const cache        = await caches.open(cacheName);
  const cached       = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || await fetchPromise;
}

/* Network First: try network, fall back to cache, then offline page */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.destination === 'document') return offlinePage();
    return new Response('', { status: 503 });
  }
}

/* Minimal offline page shown when shell can't load */
function offlinePage() {
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bharath Creative Agency — Offline</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    min-height:100vh;margin:0;background:#F8FAFC;color:#111827;text-align:center;padding:24px;}
  .logo{font-size:2rem;font-weight:900;background:linear-gradient(135deg,#2563EB,#0EA5E9);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px;}
  .sub{font-size:.75rem;font-weight:700;color:#94A3B8;letter-spacing:3px;text-transform:uppercase;margin-bottom:32px;}
  .icon{width:72px;height:72px;background:#EFF6FF;border-radius:50%;display:flex;
    align-items:center;justify-content:center;margin:0 auto 20px;}
  h2{font-size:1.3rem;font-weight:800;margin-bottom:8px;}
  p{color:#6B7280;font-size:.9rem;max-width:280px;line-height:1.6;}
  button{margin-top:24px;background:#2563EB;color:#fff;border:none;padding:12px 28px;
    border-radius:10px;font-size:.9rem;font-weight:700;cursor:pointer;}
</style></head>
<body>
  <div class="logo">Bharath</div>
  <div class="sub">Creative Agency</div>
  <div class="icon">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2">
      <path d="M1 6l10.5 7.5L22 6"/><rect x="1" y="4" width="21" height="16" rx="2"/>
    </svg>
  </div>
  <h2>You're Offline</h2>
  <p>Please check your connection and try again. Once back online, all features will be available.</p>
  <button onclick="location.reload()">Try Again</button>
</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

/* ═══════════════════════════════════════════════════════════════
   BACKGROUND SYNC — retry offline bookings when back online
   ═══════════════════════════════════════════════════════════════ */
self.addEventListener('sync', event => {
  if (event.tag === 'booking-sync') {
    console.log('[SW] Background sync: retrying pending bookings');
    /* Future: replay queued WhatsApp/form requests */
  }
});

/* ═══════════════════════════════════════════════════════════════
   PUSH NOTIFICATIONS
   ═══════════════════════════════════════════════════════════════ */
self.addEventListener('push', event => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'Bharath Creative Agency', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Bharath Creative Agency', {
      body:    data.body    || 'You have a new message!',
      icon:    './icons/icon-192.png',
      badge:   './icons/icon-72.png',
      vibrate: [200, 100, 200],
      tag:     'bca-notification',
      renotify: true,
      data:    { url: data.url || './' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client)
          return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data.url);
    })
  );
});
