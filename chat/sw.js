/* Laura F.S.M · FSM SI — cache de l’enveloppe */
const C = 'laura-fsm-chat-v3';
const SHELL = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest',
  './icons/laura.png', './icons/laura-192.png', './icons/laura-512.png',
  './icons/icon-192.png', './icons/favicon-32.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok && u.pathname.indexOf('/chat/') >= 0) {
        const copy = res.clone();
        caches.open(C).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => r))
  );
});
