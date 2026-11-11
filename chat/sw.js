/* Laura F.S.M · FSM SI — cache de l’enveloppe */
const C = 'laura-fsm-chat-v53';
const BUILD = '20261111-53';
const Q = '?v=' + BUILD;   /* mêmes adresses que index.html (avant : SHELL restait sur ?v=…-50 pendant que la page chargeait ?v=…-51) */
const SHELL = ['./', './index.html', './style.css' + Q, './app.js' + Q, './stt-flux.js' + Q, './stt-flux-worklet.js' + Q, './coffre.js' + Q, './laura-rapide.js' + Q, './mode.js' + Q, './ordinateur.js' + Q, './bot-shapes.js' + Q, './create-bot.js' + Q, './pc.js' + Q, './gmail.js' + Q, './taches.js' + Q,
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

/* build 52 : seuls les fichiers de l'appli (sous la portée du service worker, /chat/) passent par ici.
   Avant, TOUTE requête GET de la même origine était servie depuis le cache dès la 2e fois — or depuis le build 29 l'API
   est sur la même origine (laura.fsmsibot.app) : /session, la liste des conversations, /issues/N, l'activité du robot
   (/gh/…/actions/runs), /taches… restaient figés jusqu'à la version suivante, et chaque relecture du fil (…&_=heure)
   ajoutait une entrée au cache. L'API ne passe plus jamais par le cache. */
const PORTEE = new URL(self.registration.scope).pathname;
function estEnveloppe(u) {
  const p = u.pathname;
  return p === PORTEE || p === PORTEE + 'index.html' || /\.(js|css|html|webmanifest)$/.test(p);
}

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin || !u.pathname.startsWith(PORTEE)) return;
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
