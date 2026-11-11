/* Laura F.S.M — tâches de fond (build 20261111-49 ; carte des notifications : build 50).
   Les tâches tournent sur le serveur (Durable Object « Taches » + robot FSM SI), appli ouverte ou fermée.
   Ici : bandeau « en cours / fini » (relu à l'ouverture et toutes les 15 s tant qu'une tâche tourne),
   et abonnement Web Push (VAPID) pour être prévenu quand une tâche se termine. FSM SI LAURA seulement. */
(function () {
'use strict';
if (window.FSM_BLOQUEE) return;
var LAURA = typeof location !== 'undefined' && location.hostname === 'laura.fsmsibot.app';
var PROXY = LAURA ? location.origin : '';
var etat = { taches: [], ouvert: false, minuteur: 0, vus: {}, pret: false };
function q(chemin, o) {
  o = o || {};
  return fetch(PROXY + chemin, { method: o.method || 'GET', credentials: 'include', cache: 'no-store', headers: o.body ? { 'Content-Type': 'application/json' } : {}, body: o.body ? JSON.stringify(o.body) : undefined })
    .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.erreur || ('HTTP ' + r.status)); return d; }); });
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function heure(t) { try { return new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }); } catch (e) { return ''; } }
var LIB = { en_file: 'En attente', en_cours: 'En cours', fini: 'Fini', echec: 'Interrompue', annule: 'Arrêtée' };
function actives() { return etat.taches.filter(function (t) { return t.etat === 'en_file' || t.etat === 'en_cours'; }); }
function recentes() { return etat.taches.filter(function (t) { return t.fin && Date.now() - t.fin < 6 * 3600e3 && !etat.vus[t.id]; }); }
function bandeau() {
  var b = document.getElementById('tachesBar');
  if (!b) {
    var cv = document.getElementById('chatView'); if (!cv) return null;
    b = document.createElement('div'); b.id = 'tachesBar'; b.hidden = true;
    var top = cv.querySelector('.topbar');
    if (top && top.nextSibling) cv.insertBefore(b, top.nextSibling); else cv.appendChild(b);
  }
  return b;
}
function dessiner() {
  var b = bandeau(); if (!b) return;
  var a = actives(), r = recentes();
  if (!a.length && !r.length) { b.hidden = true; b.innerHTML = ''; return; }
  b.hidden = false;
  var resume = a.length ? '⏳ ' + (a.length > 1 ? a.length + ' tâches en cours' : (a[0].etapes && a[0].etapes.length ? a[0].etapes[a[0].etapes.length - 1] : 'Tâche en cours')) + (a[0].duree ? ' · ' + a[0].duree : '')
    : '✅ ' + (r.length > 1 ? r.length + ' tâches finies' : 'Fini : ' + (r[0].demande || 'ta tâche'));
  var h = '<button type="button" class="tb-tete" aria-expanded="' + (etat.ouvert ? 'true' : 'false') + '">' + esc(resume) + '</button>';
  if (etat.ouvert) {
    h += '<div class="tb-liste">';
    a.concat(r).forEach(function (t) {
      h += '<div class="tb-tache" data-id="' + esc(t.id) + '"><div class="tb-l1"><b>' + esc(LIB[t.etat] || t.etat) + '</b> · ' + esc(heure(t.cree)) + ' · conversation ' + esc(t.conv) + '</div>' +
        '<div class="tb-dem">' + esc(t.demande || t.annonce || '') + '</div>' +
        (t.etapes && t.etapes.length && !t.fin ? '<ul>' + t.etapes.slice(-4).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' : '') +
        (t.resultat ? '<div class="tb-res">' + esc(t.resultat) + '</div>' : '') +
        '<div class="tb-act"><button type="button" data-a="ouvrir">Ouvrir</button>' + (t.fin ? '<button type="button" data-a="vu">OK</button>' : '<button type="button" data-a="stop">Arrêter</button>') + '</div></div>';
    });
    h += '</div>';
  }
  b.innerHTML = h;
  b.querySelector('.tb-tete').onclick = function () { etat.ouvert = !etat.ouvert; dessiner(); };
  Array.prototype.forEach.call(b.querySelectorAll('.tb-tache button'), function (x) {
    x.onclick = function () {
      var id = x.closest('.tb-tache').getAttribute('data-id');
      var t = etat.taches.filter(function (y) { return y.id === id; })[0]; if (!t) return;
      if (x.getAttribute('data-a') === 'ouvrir') { if (window.SI_ouvrirConv) window.SI_ouvrirConv(t.conv); if (t.fin) etat.vus[t.id] = 1; etat.ouvert = false; dessiner(); }
      else if (x.getAttribute('data-a') === 'vu') { etat.vus[t.id] = 1; sauverVus(); dessiner(); }
      else if (x.getAttribute('data-a') === 'stop') { x.disabled = true; q('/taches/annuler', { method: 'POST', body: { id: id } }).then(relire, relire); }
    };
  });
}
function sauverVus() { try { localStorage.setItem('si_taches_vues', JSON.stringify(etat.vus)); } catch (e) {} }
try { etat.vus = JSON.parse(localStorage.getItem('si_taches_vues') || '{}') || {}; } catch (e) {}
function relire() {
  if (!LAURA || document.hidden) return Promise.resolve();
  return q('/taches').then(function (d) {
    var avant = {}; etat.taches.forEach(function (t) { avant[t.id] = t.etat; });
    etat.taches = d.taches || []; etat.pret = true;
    /* une tâche vient de finir dans la conversation ouverte : on recharge le fil */
    var conv = window.SI_conv ? window.SI_conv() : 0;
    if (etat.taches.some(function (t) { return t.fin && avant[t.id] && avant[t.id] !== t.etat && t.conv === conv; }) && window.SI_rafraichir) window.SI_rafraichir();
    dessiner(); planifier();
  }).catch(function () { planifier(); });
}
function planifier() {
  clearTimeout(etat.minuteur);
  if (actives().length && !document.hidden) etat.minuteur = setTimeout(relire, 15000);
}
document.addEventListener('visibilitychange', function () { if (!document.hidden) relire(); });
/* ---------- Web Push ---------- */
function versOctets(b64) {
  var p = '='.repeat((4 - b64.length % 4) % 4), s = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/'));
  var o = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o;
}
function pushPossible() { return LAURA && 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined'; }
function activerPush(silencieux) {
  if (!pushPossible()) return Promise.reject(new Error(LAURA ? 'Ce navigateur ne gère pas les notifications push (sur iPhone : ajoute d’abord l’appli à l’écran d’accueil).' : 'hors FSM SI LAURA'));
  if (Notification.permission !== 'granted') return Promise.reject(new Error('notifications non autorisées'));
  return q('/push/cle').then(function (k) {
    if (!k.cle) throw new Error('notifications pas encore prêtes côté serveur');
    return navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription().then(function (s) {
        return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versOctets(k.cle) });
      });
    });
  }).then(function (sub) {
    return q('/push/abonner', { method: 'POST', body: { abonnement: sub.toJSON() } });
  }).then(function (r) {
    if (!silencieux) return q('/push/essai', { method: 'POST', body: { conv: window.SI_conv ? window.SI_conv() : 0 } }).then(function () { return r; });
    return r;
  });
}
function desactiverPush() {
  if (!pushPossible()) return Promise.resolve();
  return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (s) {
    if (!s) return null;
    var e = s.endpoint;
    return s.unsubscribe().then(function () { return q('/push/desabonner', { method: 'POST', body: { endpoint: e } }); });
  }).catch(function () {});
}
window.LauraTaches = { relire: relire, activerPush: activerPush, desactiverPush: desactiverPush, pushPossible: pushPossible, etat: etat };
if (LAURA) setTimeout(relire, 1200);

/* ---------- Carte « Active les notifications » (build 50) ----------
   Appli installée (ou appli Windows) et autorisation jamais demandée : une carte, et la demande part au toucher
   (iOS exige un geste). Accordée ou refusée : plus jamais de carte (l'état est dans le menu). « Plus tard » : 24 h. */
var TXT = ({
  fr: { t: 'Active les notifications', s: 'Je te préviens quand une tâche est finie, même appli fermée.', a: 'Activer', l: 'Plus tard', ok: 'Notifications activées : une notification d’essai arrive.', non: 'Notifications refusées. Tu peux les autoriser dans les réglages de l’appareil.' },
  en: { t: 'Turn on notifications', s: 'I’ll let you know when a task is done, even with the app closed.', a: 'Turn on', l: 'Later', ok: 'Notifications on: a test notification is on its way.', non: 'Notifications blocked. You can allow them in your device settings.' },
  es: { t: 'Activa las notificaciones', s: 'Te aviso cuando termine una tarea, aunque la app esté cerrada.', a: 'Activar', l: 'Más tarde', ok: 'Notificaciones activadas: llega una de prueba.', non: 'Notificaciones bloqueadas. Puedes permitirlas en los ajustes del dispositivo.' }
})[String(navigator.language || 'fr').slice(0, 2)] || null;
TXT = TXT || { t: 'Turn on notifications', s: 'I’ll let you know when a task is done, even with the app closed.', a: 'Turn on', l: 'Later', ok: 'Notifications on: a test notification is on its way.', non: 'Notifications blocked. You can allow them in your device settings.' };
function carteVisible() {
  if (!LAURA || !window.FSM_INSTALLEE || !pushPossible() || Notification.permission !== 'default') return false;
  var plusTard = Number(localStorage.getItem('si_notif_plus_tard') || 0);
  return Date.now() - plusTard > 86400e3;
}
function montrerCarte() {
  if (document.getElementById('notifCarte') || !carteVisible()) return;
  var c = document.createElement('div'); c.id = 'notifCarte'; c.setAttribute('role', 'dialog');
  c.innerHTML = '<img src="/chat/icons/fsm-si-logo.png" alt=""><div class="nc-t"><b>' + esc(TXT.t) + '</b><span>' + esc(TXT.s) + '</span></div>' +
    '<div class="nc-b"><button type="button" class="nc-oui">' + esc(TXT.a) + '</button><button type="button" class="nc-non">' + esc(TXT.l) + '</button></div>';
  document.body.appendChild(c);
  c.querySelector('.nc-non').onclick = function () { try { localStorage.setItem('si_notif_plus_tard', String(Date.now())); } catch (e) {} c.remove(); };
  c.querySelector('.nc-oui').onclick = function () {
    var vu = false;
    var fini = function (p) {
      if (vu) return; vu = true;
      c.remove();
      if (p === 'granted') {
        if (window.SI_notifActive) window.SI_notifActive(true);
        activerPush(false).then(function () { if (window.SI_alerte) window.SI_alerte(TXT.ok); }, function (e) { if (window.SI_alerte) window.SI_alerte(String(e && e.message || e)); });
      } else { if (window.SI_notifActive) window.SI_notifActive(false); if (p === 'denied' && window.SI_alerte) window.SI_alerte(TXT.non); }
    };
    /* la demande part dans le geste lui-même (iOS) ; ancienne forme à rappel acceptée aussi */
    var r = Notification.requestPermission(fini);
    if (r && r.then) r.then(fini);
  };
}
var essais = 0;
(function attendre() {
  if (!LAURA || !window.FSM_INSTALLEE) return;
  if (window.SI_pret && window.SI_pret()) return montrerCarte();
  if (++essais < 90) setTimeout(attendre, 2000);
})();
window.LauraTaches.carteNotif = montrerCarte;
window.LauraTaches.carteVisible = carteVisible;
})();
