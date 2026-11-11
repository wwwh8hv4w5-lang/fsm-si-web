/* Laura F.S.M · FSM SI — cache de l’enveloppe */
const C = 'laura-fsm-chat-v50';
const BUILD = '20261111-50';
const SHELL = ['./', './index.html', './style.css?v=20261111-50', './app.js?v=20261111-50', './stt-flux.js?v=20261111-50', './stt-flux-worklet.js?v=20261111-50', './coffre.js?v=20261111-50', './laura-rapide.js?v=20261111-50', './mode.js?v=20261111-50', './ordinateur.js?v=20261111-50', './bot-shapes.js?v=20261111-50', './create-bot.js?v=20261111-50', './pc.js?v=20261111-50', './gmail.js?v=20261111-50', './taches.js?v=20261111-50',
  './manifest.webmanifest',
  './icons/laura.png', './icons/laura-192.png', './icons/laura-512.png',
  './icons/fsm-si-logo.png', './icons/icon-192.png', './icons/icon-180.png', './icons/icon-512.png',
  './icons/icon-512-maskable.png', './icons/favicon.ico',
  './icons/tom.png', './icons/favicon-32.png'];

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
    /\/chat\/app\.js$/.test(p) || /\/chat\/style\.css$/.test(p) || /\/chat\/coffre\.js$/.test(p) || /\/chat\/laura-rapide\.js$/.test(p) || /\/chat\/mode\.js$/.test(p) || /\/chat\/ordinateur\.js$/.test(p) || /\/chat\/bot-shapes\.js$/.test(p) || /\/chat\/create-bot\.js$/.test(p) || /\/chat\/taches\.js$/.test(p);
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

/* ---------- Web Push (build 49) : notification quand une tâche de fond se termine ----------
   Le serveur envoie un push sans contenu ; on relit /taches/notif (session de Tom, même origine) pour le texte. */
self.addEventListener('push', (e) => {
  e.waitUntil(fetch('/taches/notif', { credentials: 'include', cache: 'no-store' }).then((r) => r.json()).then((d) => {
    const l = (d && d.notifs) || [];
    if (!l.length) return self.registration.showNotification('Laura F.S.M', { body: 'Une tâche vient de se terminer.', icon: './icons/laura-192.png', badge: './icons/favicon-32.png', tag: 'fsm-tache' });
    return Promise.all(l.map((n) => self.registration.showNotification(n.titre || 'Laura F.S.M', { body: n.corps || '', icon: './icons/laura-192.png', badge: './icons/favicon-32.png', tag: 'fsm-tache-' + (n.tache || n.quand), data: { conv: n.conv || 0 } })));
  }).catch(() => self.registration.showNotification('Laura F.S.M', { body: 'Une tâche vient de se terminer.', icon: './icons/laura-192.png', tag: 'fsm-tache' })));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const conv = e.notification.data && e.notification.data.conv;
  const cible = new URL('./' + (conv ? '?conv=' + conv : ''), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if (c.url.startsWith(self.registration.scope)) { c.postMessage({ type: 'fsm-ouvrir-conv', conv }); return c.focus(); }
    return self.clients.openWindow(cible);
  }));
});
