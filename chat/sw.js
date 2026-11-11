/* Laura F.S.M · FSM SI — cache de l’enveloppe */
const C = 'laura-fsm-chat-v12';
const BUILD = '20261111-12';
const SHELL = ['./', './index.html', './style.css?v=20261111-12', './app.js?v=20261111-12', './coffre.js?v=20261111-12',
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
    /* réseau d’abord, mais jamais plus de 4 s : sur un réseau lent, l’app s’ouvre depuis le cache */
    const reseau = fetch(e.request, { cache: 'no-store' }).then((res) => {
      if (res && res.ok) {
        const copie = res.clone();
        caches.open(C).then((c) => c.put(e.request, copie));
      }
      return res;
    });
    const secours = () => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'));
    e.respondWith(new Promise((ok) => {
      let fini = false;
      const t = setTimeout(() => { secours().then((r) => { if (!fini && r) { fini = true; ok(r); } }); }, 4000);
      reseau.then((res) => { if (!fini) { fini = true; clearTimeout(t); ok(res); } })
        .catch(() => secours().then((r) => { if (!fini) { fini = true; clearTimeout(t); ok(r || Response.error()); } }));
    }));
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
