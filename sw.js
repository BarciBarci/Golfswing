/* Golf Swing Analysis – service worker
 * Makes the app installable (Add to Home Screen) and usable offline on phones:
 * the first visit caches the app, later starts work without a server or
 * internet connection. New versions are fetched when the device is online.
 */
'use strict';

const CACHE = 'golf-swing-analysis-v1';

// Everything the app needs. Built from the worker's scope (the folder the
// service worker lives in), so it works regardless of the hosting path.
const scopeUrl = self.registration.scope;
const CORE = [scopeUrl, scopeUrl + 'index.html', scopeUrl + 'styles.css', scopeUrl + 'app.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigation (the page itself): network first so updates arrive, fall back
  // to the cached page when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(scopeUrl + 'index.html', clone));
          return resp;
        })
        .catch(() => caches.match(scopeUrl + 'index.html'))
    );
    return;
  }

  // Static assets: cache first (fast, offline), and refresh the cache in the
  // background so updates arrive on the next visit.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((resp) => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then((cache) => cache.put(req, clone));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
