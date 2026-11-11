/* Laura F.S.M · FSM SI — cache de l’enveloppe */
const C = 'laura-fsm-chat-v11';
const BUILD = '20261111-11';
const SHELL = ['./', './index.html', './style.css?v=20261111-11', './app.js?v=20261111-11', './coffre.js?v=20261111-11',
  './manifest.webmanifest',
  './icons/laura.png', './icons/laura-192.png', './icons/laura-512.png',
  './icons/icon-192.png', './icons/tom.png', './icons/favicon-32.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(C).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== C).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function estEnveloppe(u) {
  const p = u.pathname.replace(/\/+$/, '') || '/';
  return /\/chat$/.test(p) || /\/chat\/index\.html$/.test(p) ||
    /\/chat\/app\.js$/.test(p) || /\/chat\/style\.css$/.test(p) || /\/chat\/coffre\.js$/.test(p);
}

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  if (estEnveloppe(u)) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then((res) => {
        if (res && res.ok) {
          const copie = res.clone();
          caches.open(C).then((c) => c.put(e.request, copie));
        }
        return res;
      }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      if (res && res.ok) {
        const copie = res.clone();
        caches.open(C).then((c) => c.put(e.request, copie));
      }
      return res;
    }).catch(() => r))
  );
});
