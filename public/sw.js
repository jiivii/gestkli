/**
 * Sinestesya Service Worker
 * Estrategia:
 *  - Cache-first  → recursos estáticos propios (JS/CSS/imágenes del build de Vite)
 *  - Network-only → Supabase, CDN de módulos, Tailwind y Google Fonts
 *  - Network-first con fallback al shell → navegación HTML
 *
 * IMPORTANTE: la autenticación y las llamadas CRUD a Supabase nunca se cachean.
 * Los datos clínicos no se guardan en caché del service worker.
 */

const CACHE_NAME = 'sinestesya-v2.1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
];

const NETWORK_ONLY_HOSTNAMES = [
  'supabase.co',
  'supabase.in',
  'esm.sh',
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'accounts.google.com',
];

function isNetworkOnly(url) {
  return NETWORK_ONLY_HOSTNAMES.some(host => url.hostname.includes(host));
}

function isSameOriginStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  const path = url.pathname;
  return (
    path.startsWith('/assets/') ||
    path.endsWith('.js') ||
    path.endsWith('.css') ||
    path.endsWith('.png') ||
    path.endsWith('.jpg') ||
    path.endsWith('.jpeg') ||
    path.endsWith('.svg') ||
    path.endsWith('.ico') ||
    path.endsWith('.webp') ||
    path.endsWith('.woff') ||
    path.endsWith('.woff2')
  );
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (isNetworkOnly(url)) return;
  if (event.request.method !== 'GET') return;

  if (isSameOriginStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => new Response('Recurso no disponible sin conexión.', { status: 503 }));
      })
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
