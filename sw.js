// Service worker minimal : met en cache l'interface (jamais les appels à l'API GitHub).
const CACHE = 'fsm-si-web-v1';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'vendor/marked.js', 'vendor/purify.min.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin || e.request.method !== 'GET') return;
  // Réseau d'abord (mises à jour immédiates), cache si hors ligne.
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => { for (const c of cs) { c.focus(); c.postMessage({ open: e.notification.data && e.notification.data.issue }); return; } return self.clients.openWindow(url); }));
});
