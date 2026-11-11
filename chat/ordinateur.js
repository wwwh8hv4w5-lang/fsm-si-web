/* Ordinateur de Laura — vue en direct (noVNC) dans /chat/, comme dans Grok Bot.
   - Profil de Laura : ligne « Ordinateur » (Idle / En cours) + vignette en direct ; tap = plein écran.
   - Plein écran : vue seule par défaut ; « Prendre le contrôle » (clic, double-clic, clic droit, glisser, défiler,
     clavier iPhone, coller), « Rendre la main » ; pincer / double-tap pour zoomer, déplacer ; mode trackpad.
   - Carte « Laura a besoin de toi sur son ordinateur » (connexion, 2FA, captcha, paiement) → contrôle direct, « C’est fait ».
   - Captures montrées par Laura dans le fil (servies par fsm-si-bureau, avec ton jeton).
   Le Worker fsm-si-bureau vérifie le jeton ; la vue seule passe par un port VNC en lecture seule côté serveur. */
(function () {
'use strict';
var BUREAU = (function () { try { return localStorage.getItem('si_bureau') || ''; } catch (e) { return ''; } })() || 'https://fsm-si-bureau.fsmdev66.workers.dev';
var RE_CAPTURE = /^https:\/\/fsm-si-bureau\.fsmdev66\.workers\.dev\/capture\/([0-9a-f]{32})$/;
/* Portail FSM HUB (laura.fsmsibot.app) : plus de jeton dans le navigateur, la session est un cookie HttpOnly.
   L'écran passe alors par le même hôte (/bureau/*, relayé par le proxy) ; le flux VNC reste direct avec un ticket signé. */
var MEME_ORIGINE = /^(laura\.fsmsibot\.app|fsm-si-proxy\.fsmdev66\.workers\.dev)$/.test(location.hostname) && !(function () { try { return localStorage.getItem('si_bureau'); } catch (e) { return ''; } })();
var API = MEME_ORIGINE ? location.origin + '/bureau' : BUREAU;
function entetes(j) { var h = { 'Content-Type': 'application/json' }; j = j || jetonCourant; if (j && j !== 'cookie') h.Authorization = 'Bearer ' + j; return h; }
function versApi(u) { var m = RE_CAPTURE.exec(u) || (u.indexOf(BUREAU + '/capture/') === 0 ? [u, u.slice((BUREAU + '/capture/').length)] : null); return MEME_ORIGINE && m ? API + '/capture/' + m[1] : u; }
var jetonCourant = null, envoyerCourant = null;
var NOVNC = null;
function novnc() {
  if (!NOVNC) NOVNC = Promise.all([import('./novnc/core/rfb.js'), import('./novnc/core/input/keysymdef.js'), import('./novnc/core/input/util.js')])
    .then(function (m) { return { RFB: m[0].default, keysymdef: m[1].default, util: m[2] }; });
  return NOVNC;
}
function $(id) { return document.getElementById(id); }
function e(n, c, t) { var x = document.createElement(n); if (c) x.className = c; if (t != null) x.textContent = t; return x; }
function api(chemin, o) {
  o = o || {};
  return fetch(API + chemin, { method: o.method || (o.body ? 'POST' : 'GET'), credentials: 'same-origin', headers: entetes(o.jeton), body: o.body ? JSON.stringify(o.body) : undefined })
    .then(function (r) { if (o.brut) { if (!r.ok) throw new Error('bureau ' + r.status); return r.blob(); } return r.json().then(function (d) { if (!r.ok) throw new Error(d && d.erreur || 'bureau ' + r.status); return d; }); });
}
function etat(jeton) { if (jeton) jetonCourant = jeton; return api('/etat'); }

/* ---------- Captures dans le fil ---------- */
var blobs = {};
function estCapture(u) { u = String(u || '').replace(/&amp;/g, '&'); return RE_CAPTURE.test(u) || (BUREAU !== 'https://fsm-si-bureau.fsmdev66.workers.dev' && u.indexOf(BUREAU + '/capture/') === 0) ? u : ''; }
function image(u, jeton) {
  if (jeton) jetonCourant = jeton;
  if (!blobs[u]) blobs[u] = fetch(versApi(u), { credentials: 'same-origin', headers: entetes() }).then(function (r) { if (!r.ok) throw new Error(r.status === 404 ? 'Capture expirée' : 'Capture indisponible'); return r.blob(); }).then(function (b) { return URL.createObjectURL(b); });
  blobs[u].catch(function () { delete blobs[u]; });
  return blobs[u];
}

/* ---------- Styles ---------- */
var CSS = [
'#ordi{position:fixed;left:0;top:0;width:100%;height:100%;z-index:9000;background:#000;color:#fff;display:flex;flex-direction:column;font:15px/1.35 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;-webkit-user-select:none;user-select:none;opacity:0;transform:translateY(12px);transition:opacity .22s ease,transform .26s cubic-bezier(.2,.8,.2,1)}',
'#ordi.on{opacity:1;transform:none}',
'#ordi .oh{display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top) + 6px) 10px 6px;min-height:52px;box-sizing:border-box}',
'#ordi .ob{width:40px;height:40px;border-radius:20px;border:0;background:rgba(255,255,255,.12);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);color:#fff;display:flex;align-items:center;justify-content:center;flex:none;padding:0}',
'#ordi .ob svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
'#ordi .ot{flex:1;text-align:center;min-width:0}#ordi .ot b{display:block;font-size:16px;font-weight:600}#ordi .ot small{display:block;color:#8E8E93;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'#ordi .os{position:relative;flex:1;overflow:hidden;touch-action:none;background:#000}',
'#ordi .oz{position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:0 0;will-change:transform}',
'#ordi .ovnc{position:absolute;inset:0}#ordi .ovnc>div{background:transparent !important}',
'#ordi .oc{position:absolute;inset:0;outline:none;touch-action:none;cursor:default}',
'#ordi .oc.main{cursor:none}',
'#ordi .oa{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#8E8E93;pointer-events:none}',
'#ordi .sp{width:28px;height:28px;border-radius:50%;border:3px solid rgba(255,255,255,.18);border-top-color:#fff;animation:osp 0.8s linear infinite}@keyframes osp{to{transform:rotate(360deg)}}',
'#ordi .obas{padding:8px 12px calc(env(safe-area-inset-bottom) + 10px);display:flex;flex-direction:column;align-items:center;gap:8px}',
'#ordi .pill{border:0;border-radius:22px;padding:11px 22px;font-weight:600;font-size:16px;background:#fff;color:#000;min-width:200px}',
'#ordi .pill.main{background:rgba(255,255,255,.14);color:#fff;-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px)}',
'#ordi .pill.fini{background:#F25C05;color:#fff}',
'#ordi .barre{display:flex;align-items:center;gap:8px;width:100%;max-width:640px}',
'#ordi .barre input{flex:1;min-width:0;height:40px;border-radius:20px;border:0;background:#1C1C1E;color:#fff;padding:0 14px;font-size:16px;outline:none;-webkit-appearance:none}',
'#ordi .barre input:disabled{opacity:.45}',
'#ordi .menu{position:absolute;z-index:3;background:rgba(44,44,46,.96);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);border-radius:14px;overflow:hidden;min-width:240px;box-shadow:0 10px 40px rgba(0,0,0,.5)}',
'#ordi .menu button{display:block;width:100%;text-align:left;border:0;background:none;color:#fff;font-size:16px;padding:13px 16px}#ordi .menu button+button{border-top:.5px solid rgba(255,255,255,.12)}',
'#ordi .bulle{position:absolute;z-index:3;right:10px;max-width:300px;background:rgba(44,44,46,.97);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);border-radius:14px;padding:14px 14px 12px;font-size:14px;color:#EBEBF5;box-shadow:0 10px 40px rgba(0,0,0,.5)}',
'#ordi .bulle:before{content:"";position:absolute;top:-7px;right:16px;border:7px solid transparent;border-top:0;border-bottom-color:rgba(44,44,46,.97)}',
'#ordi .bulle h6{margin:0 0 6px;font-size:15px;color:#fff}#ordi .bulle p{margin:0 0 6px}#ordi .bulle label{display:flex;align-items:center;justify-content:space-between;margin-top:8px;color:#fff}',
'#ordi .sw{width:51px;height:31px;border-radius:16px;background:#39393D;position:relative;border:0;flex:none;transition:background .2s}#ordi .sw:after{content:"";position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:50%;background:#fff;transition:transform .2s}#ordi .sw.on{background:#F25C05}#ordi .sw.on:after{transform:translateX(20px)}',
'#ordi .curseur{position:absolute;width:18px;height:18px;margin:-2px 0 0 -2px;pointer-events:none;z-index:2;display:none}',
'#ordi .toast{position:absolute;left:50%;top:12px;transform:translateX(-50%);background:rgba(44,44,46,.95);padding:8px 14px;border-radius:16px;font-size:13px;pointer-events:none;opacity:0;transition:opacity .2s}#ordi .toast.on{opacity:1}',
/* profil : vignette */
'.ordi-vig{position:relative;margin:0 0 14px;border-radius:14px;overflow:hidden;background:#111;aspect-ratio:16/10;cursor:pointer}',
'.ordi-vig img,.ordi-vig .vnc{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}',
'.ordi-vig .vnc>div{background:transparent !important}',
'.ordi-vig .badge{position:absolute;left:8px;top:8px;background:rgba(0,0,0,.6);border-radius:10px;padding:3px 8px;font-size:12px;color:#fff;display:flex;align-items:center;gap:6px}',
'.ordi-vig .badge i{width:7px;height:7px;border-radius:50%;background:#8E8E93;display:inline-block}.ordi-vig .badge.live i{background:#30D158}',
'.ordi-vig .vide{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#8E8E93;font-size:14px}',
/* carte d'aide */
'.si-ordi{margin:8px 0 2px;background:#1C1C1E;border-radius:16px;padding:14px;color:#fff;max-width:340px;font:15px/1.35 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif}',
'.si-ordi h5{margin:0 0 4px;font-size:15px;font-weight:600;display:flex;gap:8px;align-items:center}.si-ordi p{margin:0 0 12px;color:#8E8E93;font-size:13px}',
'.si-ordi .bts{display:flex;gap:8px}.si-ordi button{flex:1;border:0;border-radius:12px;font-weight:600;font-size:15px;padding:11px 8px;background:#2C2C2E;color:#fff}.si-ordi button.p{background:#F25C05}',
'.si-ordi .ok{color:#8E8E93;font-size:14px}'
].join('\n');
function style() { if ($('ordi-css')) return; var s = e('style'); s.id = 'ordi-css'; s.textContent = CSS; document.head.appendChild(s); }
var ICO = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  aide: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 015 .9c0 1.8-2.5 2.2-2.5 3.8"/><path d="M12 17.2h.01"/></svg>',
  presse: '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M9 10h6M9 14h6"/></svg>',
  clavier: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/></svg>',
  baisser: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="11" rx="2"/><path d="M7 8h.01M11 8h.01M15 8h.01M8 12h8M9 19l3 2 3-2"/></svg>'
};

/* ---------- Plein écran ---------- */
var V = null; // état de la vue ouverte
function ouvrir(o) {
  o = o || {};
  if (o.jeton) jetonCourant = o.jeton;
  if (o.envoyer) envoyerCourant = o.envoyer;
  style();
  if (V) fermer(true);
  var root = e('div'); root.id = 'ordi';
  root.innerHTML =
    '<div class="oh"><button class="ob" data-a="fermer" aria-label="Retour">' + ICO.back + '</button>' +
    '<div class="ot"><b>Ordinateur de Laura</b><small class="oetat">Connexion…</small></div>' +
    '<button class="ob" data-a="aide" aria-label="Aide">' + ICO.aide + '</button></div>' +
    '<div class="os"><div class="oz"><div class="ovnc"></div></div>' +
    '<svg class="curseur" viewBox="0 0 18 18"><path d="M2 2l12 5-5 2-2 5z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/></svg>' +
    '<div class="oc" tabindex="0" aria-label="Écran de l’ordinateur"></div>' +
    '<div class="oa"><div class="sp"></div><div class="oam">Connexion…</div></div><div class="toast"></div></div>' +
    '<div class="obas"><button class="pill" data-a="main">Prendre le contrôle</button>' +
    '<div class="barre"><button class="ob" data-a="presse" aria-label="Presse-papiers">' + ICO.presse + '</button>' +
    '<input class="osaisie" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="send" placeholder="Taper sur l’ordinateur" disabled>' +
    '<button class="ob" data-a="clavier" aria-label="Clavier">' + ICO.clavier + '</button></div></div>';
  document.body.appendChild(root);
  V = { root: root, rfb: null, mode: 'vue', voulu: o.main ? 'main' : 'vue', aide: !!o.aide, z: 1, tx: 0, ty: 0, trackpad: lirePref('si_ordi_trackpad'), essais: 0, ferme: false,
        scene: root.querySelector('.os'), zoom: root.querySelector('.oz'), cible: root.querySelector('.ovnc'), capteur: root.querySelector('.oc'),
        attente: root.querySelector('.oa'), etatTxt: root.querySelector('.oetat'), pill: root.querySelector('.pill'), saisie: root.querySelector('.osaisie'),
        curseur: root.querySelector('.curseur'), cx: 640, cy: 400, masque: 0 };
  requestAnimationFrame(function () { root.classList.add('on'); });
  root.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-a]'); if (!b) return;
    var a = b.getAttribute('data-a');
    if (a === 'fermer') fermer();
    else if (a === 'aide') bulleAide(b);
    else if (a === 'main') basculer();
    else if (a === 'presse') menuPresse(b);
    else if (a === 'clavier') clavier();
  });
  gestes(V);
  saisieMobile(V);
  viewport(V, true);
  document.addEventListener('visibilitychange', visibilite);
  history.pushState({ ordi: 1 }, ''); window.addEventListener('popstate', retourNav);
  connecter();
}
function lirePref(k) { try { return localStorage.getItem(k) === '1'; } catch (x) { return false; } }
function ecrirePref(k, v) { try { localStorage.setItem(k, v ? '1' : '0'); } catch (x) {} }
function retourNav() { if (V) fermer(true); }
function visibilite() {
  if (!V) return;
  if (document.hidden) { if (V.rfb) { V.coupeVolontaire = true; try { V.rfb.disconnect(); } catch (x) {} } }
  else if (!V.rfb) connecter();
}
function texteEtat(t, attente) {
  if (!V) return;
  V.etatTxt.textContent = t;
  V.attente.style.display = attente ? 'flex' : 'none';
  if (attente) V.attente.querySelector('.oam').textContent = t;
}
function toast(t) { if (!V) return; var x = V.root.querySelector('.toast'); x.textContent = t; x.classList.add('on'); clearTimeout(x._t); x._t = setTimeout(function () { x.classList.remove('on'); }, 1800); }

function connecter() {
  if (!V || V.ferme) return;
  var v = V, t0 = performance.now();
  texteEtat('Connexion…', true);
  etat().then(function (s) {
    if (v !== V) return;
    if (s.aide) v.aide = true;
    if (s.derniere && !v.fond) { v.fond = true; image(s.derniere.url_capture).then(function (u) { if (V !== v) return; var im = e('img'); im.src = u; im.alt = ''; im.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.55'; v.zoom.insertBefore(im, v.cible); }).catch(function () {}); }
    if (!s.allume) { texteEtat('Réveil de l’ordinateur…', true); return api('/reveiller', { method: 'POST', body: {} }); }
  }).then(function () {
    return api('/ticket', { body: { mode: v.voulu } });
  }).then(function (tk) {
    if (v !== V) return;
    return novnc().then(function (N) {
      if (v !== V) return;
      v.N = N;
      if (v.rfb) { v.coupeVolontaire = true; try { v.rfb.disconnect(); } catch (x) {} }
      v.cible.innerHTML = '';
      var rfb = new N.RFB(v.cible, tk.ws, { shared: true });
      rfb.scaleViewport = true; rfb.resizeSession = false; rfb.background = 'transparent';
      rfb.qualityLevel = 6; rfb.compressionLevel = 2; rfb.focusOnClick = false; rfb.showDotCursor = false;
      rfb.viewOnly = tk.mode !== 'main';
      v.rfb = rfb; v.coupeVolontaire = false;
      rfb.addEventListener('connect', function () {
        if (v !== V) return;
        v.mode = tk.mode; v.essais = 0;
        v.ms = Math.round(performance.now() - t0);
        texteEtat(v.mode === 'main' ? 'Tu as la main' : 'En direct · vue seule', false);
        majPill(); ajusterVue(true);
        v.saisie.disabled = v.mode !== 'main';
        v.capteur.classList.toggle('main', v.mode === 'main' && !estTactile());
        if (v.mode === 'main') { try { v.capteur.focus({ preventScroll: true }); } catch (x) {} }
      });
      rfb.addEventListener('disconnect', function () {
        if (v !== V) return;
        v.rfb = null; v.saisie.disabled = true;
        if (v.coupeVolontaire || v.ferme || document.hidden) return;
        if (++v.essais > 5) { texteEtat('Ordinateur injoignable. Reviens dans un instant.', true); v.attente.querySelector('.sp').style.display = 'none'; return; }
        texteEtat('Reconnexion…', true);
        setTimeout(connecter, Math.min(4000, 600 * v.essais));
      });
      rfb.addEventListener('clipboard', function (ev) { v.pressePapiers = ev.detail.text; });
    });
  }).catch(function (x) {
    if (v !== V) return;
    texteEtat(/budget/.test(x.message) ? 'Ordinateur en pause : budget du mois atteint.' : 'Connexion impossible : ' + x.message, true);
    v.attente.querySelector('.sp').style.display = 'none';
  });
}
function majPill() {
  if (!V) return;
  var p = V.pill;
  p.classList.remove('main', 'fini');
  if (V.mode === 'main') { p.textContent = V.aide ? 'C’est fait · rendre la main' : 'Rendre la main'; p.classList.add(V.aide ? 'fini' : 'main'); }
  else p.textContent = 'Prendre le contrôle';
}
function basculer() {
  if (!V) return;
  if (V.mode === 'main') {
    if (V.aide) finiAide();
    V.voulu = 'vue'; V.aide = false;
  } else V.voulu = 'main';
  if (document.activeElement === V.saisie) V.saisie.blur();
  connecter();
}
function finiAide() {
  api('/aide/fini', { body: {} }).catch(function () {});
  try { localStorage.setItem('si_ordi_aide_fini', String(Date.now())); } catch (x) {}
  Array.prototype.forEach.call(document.querySelectorAll('.si-ordi'), function (c) { marquerCarte(c); });
  if (envoyerCourant) envoyerCourant('C’est fait, je t’ai rendu la main sur ton ordinateur.');
}
function fermer(sansHistorique) {
  if (!V) return;
  var v = V; V = null; v.ferme = true;
  document.removeEventListener('visibilitychange', visibilite);
  window.removeEventListener('popstate', retourNav);
  viewport(v, false);
  if (v.rfb) { v.coupeVolontaire = true; try { v.rfb.disconnect(); } catch (x) {} }
  v.root.classList.remove('on');
  setTimeout(function () { v.root.remove(); }, 260);
  if (!sansHistorique && history.state && history.state.ordi) history.back();
}

/* ---------- Zoom et déplacement de la vue ---------- */
function canvas() { return V && V.cible.querySelector('canvas'); }
function bornes() {
  var w = V.scene.clientWidth, h = V.scene.clientHeight;
  var minx = w - w * V.z, miny = h - h * V.z;
  V.tx = Math.min(0, Math.max(minx, V.tx)); V.ty = Math.min(0, Math.max(miny, V.ty));
}
function appliquer(anim) {
  if (!V) return;
  if (V.z < 1.01) { V.z = 1; V.tx = 0; V.ty = 0; }
  bornes();
  V.zoom.style.transition = anim ? 'transform .22s ease' : 'none';
  V.zoom.style.transform = 'translate(' + V.tx + 'px,' + V.ty + 'px) scale(' + V.z + ')';
  placerCurseur();
}
function zoomA(z, px, py, anim) {
  var r = V.scene.getBoundingClientRect(); px -= r.left; py -= r.top;
  var nz = Math.max(1, Math.min(5, z));
  V.tx = px - (px - V.tx) * nz / V.z; V.ty = py - (py - V.ty) * nz / V.z; V.z = nz;
  appliquer(anim);
}
function ajusterVue(anim) { if (!V) return; V.z = 1; V.tx = 0; V.ty = 0; appliquer(anim); }
// Coordonnées écran → pixels du bureau (1280×800), en tenant compte du zoom et des bandes noires.
function versBureau(cx, cy) {
  var c = canvas(); if (!c) return null;
  var r = c.getBoundingClientRect();
  if (!r.width) return null;
  var x = (cx - r.left) / r.width * c.width, y = (cy - r.top) / r.height * c.height;
  return { x: Math.max(0, Math.min(c.width - 1, Math.round(x))), y: Math.max(0, Math.min(c.height - 1, Math.round(y))), dedans: x >= 0 && y >= 0 && x < c.width && y < c.height };
}
function versEcran(x, y) { var c = canvas(); if (!c) return null; var r = c.getBoundingClientRect(); return { x: r.left + x / c.width * r.width, y: r.top + y / c.height * r.height }; }
function placerCurseur() {
  if (!V) return;
  var on = V.mode === 'main' && V.trackpad && estTactile();
  V.curseur.style.display = on ? 'block' : 'none';
  if (!on) return;
  var p = versEcran(V.cx, V.cy), r = V.scene.getBoundingClientRect();
  if (p) { V.curseur.style.left = (p.x - r.left) + 'px'; V.curseur.style.top = (p.y - r.top) + 'px'; }
}

/* ---------- Souris, clavier, toucher ---------- */
function estTactile() { return (navigator.maxTouchPoints || 0) > 0 && matchMedia('(pointer: coarse)').matches; }
function souris(x, y, masque) {
  if (!V || !V.rfb || V.mode !== 'main' || !V.N) return;
  V.cx = x; V.cy = y; V.masque = masque;
  try { V.N.RFB.messages.pointerEvent(V.rfb._sock, x, y, masque); } catch (er) {}
}
function clic(x, y, bouton, double) {
  var b = bouton === 'droit' ? 4 : 1;
  souris(x, y, 0); souris(x, y, b); souris(x, y, 0);
  if (double) { souris(x, y, b); souris(x, y, 0); }
}
function molette(x, y, bas, n) { var b = bas ? 16 : 8; for (var i = 0; i < n; i++) { souris(x, y, b); souris(x, y, 0); } }
function touche(keysym, down) { if (V && V.rfb && V.mode === 'main') V.rfb.sendKey(keysym, null, down); }
function taper(texte) {
  if (!V || !V.N || V.mode !== 'main') return;
  Array.from(String(texte)).slice(0, 4000).forEach(function (ch) {
    var ks = ch === '\n' ? 0xff0d : ch === '\t' ? 0xff09 : V.N.keysymdef.lookup(ch.codePointAt(0));
    touche(ks, true); touche(ks, false);
  });
}
function gestes(v) {
  var cap = v.capteur, pts = {}, g = null, dernierTap = 0, dernierPos = null, molAcc = 0;
  cap.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
  cap.addEventListener('wheel', function (ev) {
    ev.preventDefault();
    if (ev.ctrlKey || v.mode !== 'main') { if (ev.ctrlKey) zoomA(v.z * Math.exp(-ev.deltaY / 200), ev.clientX, ev.clientY); else if (v.z > 1) { v.tx -= ev.deltaX; v.ty -= ev.deltaY; appliquer(); } return; }
    var p = versBureau(ev.clientX, ev.clientY); if (!p) return;
    molAcc += ev.deltaMode === 1 ? ev.deltaY * 40 : ev.deltaY;
    var n = Math.trunc(molAcc / 60); if (n) { molAcc -= n * 60; molette(p.x, p.y, n > 0, Math.min(10, Math.abs(n))); }
  }, { passive: false });
  // Souris d'ordinateur : correspondance directe.
  cap.addEventListener('pointerdown', function (ev) {
    if (ev.pointerType === 'mouse') {
      ev.preventDefault(); try { cap.focus({ preventScroll: true }); } catch (x) {}
      var p = versBureau(ev.clientX, ev.clientY); if (!p || !p.dedans) return;
      var bit = ev.button === 2 ? 4 : ev.button === 1 ? 2 : 1;
      souris(p.x, p.y, v.masque | bit); cap.setPointerCapture(ev.pointerId); return;
    }
    toucherDebut(ev);
  });
  cap.addEventListener('pointermove', function (ev) {
    if (ev.pointerType === 'mouse') { var p = versBureau(ev.clientX, ev.clientY); if (p && v.mode === 'main') souris(p.x, p.y, v.masque); return; }
    toucherBouge(ev);
  });
  function finPointeur(ev) {
    if (ev.pointerType === 'mouse') { var p = versBureau(ev.clientX, ev.clientY); var bit = ev.button === 2 ? 4 : ev.button === 1 ? 2 : 1; if (p) souris(p.x, p.y, v.masque & ~bit); return; }
    toucherFin(ev);
  }
  cap.addEventListener('pointerup', finPointeur);
  cap.addEventListener('pointercancel', finPointeur);
  // Clavier physique (ordinateur ou iPad avec clavier).
  function clavierPhysique(down) {
    return function (ev) {
      if (v.mode !== 'main' || !v.N) return;
      if (down && (ev.metaKey || ev.ctrlKey) && (ev.key === 'v' || ev.key === 'V')) return; // laisse passer « coller »
      var ks = v.N.util.getKeysym(ev); if (!ks) return;
      ev.preventDefault(); v.rfb.sendKey(ks, v.N.util.getKeycode(ev), down);
    };
  }
  cap.addEventListener('keydown', clavierPhysique(true));
  cap.addEventListener('keyup', clavierPhysique(false));
  cap.addEventListener('paste', function (ev) { if (v.mode !== 'main') return; var t = ev.clipboardData && ev.clipboardData.getData('text/plain'); if (t) { ev.preventDefault(); taper(t); } });

  // Toucher : 1 doigt = clic / glisser (ou déplacer le curseur en mode trackpad), appui long = clic droit,
  // 2 doigts = pincer pour zoomer et déplacer la vue, 2 doigts qui glissent ensemble = défiler, tap à 2 doigts = clic droit.
  function toucherDebut(ev) {
    ev.preventDefault();
    pts[ev.pointerId] = { x: ev.clientX, y: ev.clientY, x0: ev.clientX, y0: ev.clientY, t0: Date.now() };
    try { cap.setPointerCapture(ev.pointerId); } catch (x) {}
    var ids = Object.keys(pts);
    if (ids.length === 1) {
      g = { type: 'un', bouge: false, t0: Date.now(), x0: ev.clientX, y0: ev.clientY, appui: null, tire: false };
      if (v.mode === 'main') g.appui = setTimeout(function () { if (g && !g.bouge && g.type === 'un') { g.long = true; var p = v.trackpad ? { x: v.cx, y: v.cy, dedans: true } : versBureau(g.x0, g.y0); if (p && p.dedans) clic(p.x, p.y, 'droit'); if (navigator.vibrate) navigator.vibrate(10); } }, 550);
    } else if (ids.length === 2) {
      if (g && g.appui) clearTimeout(g.appui);
      if (g && g.tire) { var pp = versBureau(g.lx, g.ly); if (pp) souris(pp.x, pp.y, 0); }
      var a = pts[ids[0]], b = pts[ids[1]];
      g = { type: 'deux', d0: dist(a, b), z0: v.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, tx0: v.tx, ty0: v.ty, t0: Date.now(), bouge: false, defile: false, acc: 0 };
    }
  }
  function toucherBouge(ev) {
    var p0 = pts[ev.pointerId]; if (!p0 || !g) return;
    ev.preventDefault();
    var dx = ev.clientX - p0.x, dy = ev.clientY - p0.y;
    p0.x = ev.clientX; p0.y = ev.clientY;
    var ids = Object.keys(pts);
    if (g.type === 'un') {
      if (!g.bouge && Math.hypot(ev.clientX - g.x0, ev.clientY - g.y0) < 8) return;
      if (!g.bouge) { g.bouge = true; if (g.appui) clearTimeout(g.appui); }
      if (v.mode !== 'main') { if (v.z > 1) { v.tx += dx; v.ty += dy; appliquer(); } return; }
      if (v.trackpad) { var c = canvas(); if (!c) return; var r = c.getBoundingClientRect(); var k = c.width / r.width * 1.4; v.cx = Math.max(0, Math.min(c.width - 1, v.cx + dx * k)); v.cy = Math.max(0, Math.min(c.height - 1, v.cy + dy * k)); souris(Math.round(v.cx), Math.round(v.cy), v.masque); placerCurseur(); return; }
      var p = versBureau(ev.clientX, ev.clientY); if (!p) return;
      if (!g.tire) { var d = versBureau(g.x0, g.y0); if (d) { souris(d.x, d.y, 0); souris(d.x, d.y, 1); } g.tire = true; }
      g.lx = ev.clientX; g.ly = ev.clientY; souris(p.x, p.y, 1);
    } else if (g.type === 'deux' && ids.length >= 2) {
      var a = pts[ids[0]], b = pts[ids[1]];
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, ech = dist(a, b) / g.d0;
      if (!g.bouge && Math.abs(ech - 1) < 0.06 && Math.hypot(mx - g.mx, my - g.my) < 10) return;
      g.bouge = true;
      // Deux doigts qui glissent ensemble sans pincer, vue non zoomée, en contrôle : défilement de la page.
      if (v.mode === 'main' && g.z0 === 1 && (g.defile || (Math.abs(ech - 1) < 0.08 && !g.zoome))) {
        g.defile = true; g.acc += dy;
        var n = Math.trunc(g.acc / 28); if (n) { g.acc -= n * 28; var q = versBureau(mx, my); if (q) molette(q.x, q.y, n < 0, Math.min(6, Math.abs(n))); }
        return;
      }
      g.zoome = true;
      var r2 = v.scene.getBoundingClientRect();
      var nz = Math.max(1, Math.min(5, g.z0 * ech));
      var ox = g.mx - r2.left, oy = g.my - r2.top;
      v.tx = (mx - r2.left) - (ox - g.tx0) * nz / g.z0; v.ty = (my - r2.top) - (oy - g.ty0) * nz / g.z0; v.z = nz;
      appliquer();
    }
  }
  function toucherFin(ev) {
    var p0 = pts[ev.pointerId]; delete pts[ev.pointerId];
    if (!p0 || !g) return;
    ev.preventDefault();
    var reste = Object.keys(pts).length;
    if (g.type === 'un') {
      if (g.appui) clearTimeout(g.appui);
      if (g.tire) { var p = versBureau(g.lx, g.ly); if (p) souris(p.x, p.y, 0); }
      else if (!g.bouge && !g.long && Date.now() - g.t0 < 500) {
        var maintenant = Date.now(), double = dernierPos && maintenant - dernierTap < 320 && Math.hypot(ev.clientX - dernierPos.x, ev.clientY - dernierPos.y) < 30;
        dernierTap = double ? 0 : maintenant; dernierPos = { x: ev.clientX, y: ev.clientY };
        if (v.mode === 'main') {
          var q = v.trackpad ? { x: v.cx, y: v.cy, dedans: true } : versBureau(ev.clientX, ev.clientY);
          if (q && q.dedans) clic(q.x, q.y, 'gauche');
        } else if (double) { if (v.z > 1) ajusterVue(true); else zoomA(2.5, ev.clientX, ev.clientY, true); }
      }
      g = null;
    } else if (g.type === 'deux') {
      if (!g.bouge && Date.now() - g.t0 < 300 && v.mode === 'main') { var c = v.trackpad ? { x: v.cx, y: v.cy, dedans: true } : versBureau(p0.x0, p0.y0); if (c && c.dedans) clic(c.x, c.y, 'droit'); g.bouge = true; }
      if (!reste) g = null;
    }
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) || 1; }
}

/* Clavier de l'iPhone : un champ dans la barre ; chaque lettre part tout de suite vers l'ordinateur. */
function saisieMobile(v) {
  var s = v.saisie;
  s.addEventListener('beforeinput', function (ev) {
    if (v.mode !== 'main') return;
    var t = ev.inputType;
    if (t === 'insertText' || t === 'insertReplacementText' || t === 'insertFromPaste') { var d = ev.data != null ? ev.data : (ev.dataTransfer && ev.dataTransfer.getData('text/plain')) || ''; if (d) taper(d); }
    else if (t === 'insertLineBreak' || t === 'insertParagraph') { touche(0xff0d, true); touche(0xff0d, false); }
    else if (t === 'deleteContentBackward') { touche(0xff08, true); touche(0xff08, false); }
    else if (t === 'deleteContentForward') { touche(0xffff, true); touche(0xffff, false); }
    else return;
    ev.preventDefault();
  });
  s.addEventListener('input', function () { if (s.value) { taper(s.value); s.value = ''; } }); // navigateurs sans beforeinput
  s.addEventListener('keydown', function (ev) {
    if (v.mode !== 'main') return;
    var spec = { Enter: 0xff0d, Tab: 0xff09, Escape: 0xff1b, ArrowLeft: 0xff51, ArrowUp: 0xff52, ArrowRight: 0xff53, ArrowDown: 0xff54 }[ev.key];
    if (spec) { ev.preventDefault(); touche(spec, true); touche(spec, false); }
  });
  s.addEventListener('focus', function () { setTimeout(function () { viewport(v, true); }, 50); });
  s.addEventListener('blur', function () { setTimeout(function () { if (V === v) ajusterVue(true); }, 120); }); // clavier rangé : retour à la vue entière
}
function clavier() {
  if (!V) return;
  if (V.mode !== 'main') { toast('Prends d’abord le contrôle'); return; }
  var s = V.saisie, b = V.root.querySelector('[data-a="clavier"]');
  if (document.activeElement === s) { s.blur(); b.innerHTML = ICO.clavier; }
  else { s.disabled = false; s.focus(); b.innerHTML = ICO.baisser; }
}
// Clavier ouvert : la vue suit visualViewport pour que la barre et la zone touchée restent visibles.
function viewport(v, on) {
  var vv = window.visualViewport;
  if (!vv) return;
  if (!v._vp) v._vp = function () {
    if (V !== v) return;
    v.root.style.height = vv.height + 'px';
    v.root.style.top = vv.offsetTop + 'px';
    if (document.activeElement === v.saisie && v.mode === 'main') {
      // garde le point de travail (dernier clic) au-dessus du clavier
      var p = versEcran(v.cx, v.cy), r = v.scene.getBoundingClientRect();
      if (p && (p.y > r.bottom - 30 || p.y < r.top + 10)) { if (v.z < 1.6) zoomA(1.8, p.x, p.y, false); var q = versEcran(v.cx, v.cy); if (q) { v.ty += (r.top + r.height * 0.45) - q.y; appliquer(true); } }
    }
  };
  if (on) { vv.addEventListener('resize', v._vp); vv.addEventListener('scroll', v._vp); v._vp(); }
  else { vv.removeEventListener('resize', v._vp); vv.removeEventListener('scroll', v._vp); }
}
function menuPresse(btn) {
  if (!V) return;
  var vieux = V.root.querySelector('.menu'); if (vieux) { vieux.remove(); return; }
  var m = e('div', 'menu');
  var b1 = e('button', '', 'Coller depuis le téléphone'), b2 = e('button', '', 'Copier vers le téléphone');
  m.appendChild(b1); m.appendChild(b2);
  var r = btn.getBoundingClientRect(), rr = V.root.getBoundingClientRect();
  m.style.left = (r.left - rr.left) + 'px'; m.style.bottom = (rr.bottom - r.top + 8) + 'px';
  V.root.appendChild(m);
  setTimeout(function () { document.addEventListener('pointerdown', function f(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('pointerdown', f, true); } }, true); }, 0);
  b1.onclick = function () {
    m.remove();
    if (V.mode !== 'main') { toast('Prends d’abord le contrôle'); return; }
    var lire = navigator.clipboard && navigator.clipboard.readText ? navigator.clipboard.readText() : Promise.reject();
    lire.then(function (t) { if (t) { taper(t); toast('Collé'); } else toast('Presse-papiers vide'); }, function () { var t = prompt('Texte à coller sur l’ordinateur'); if (t) taper(t); });
  };
  b2.onclick = function () {
    m.remove();
    var t = V.pressePapiers || '';
    if (!t) { toast('Copie d’abord du texte sur l’ordinateur (Ctrl+C)'); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Copié sur le téléphone'); }, function () { prompt('Texte copié depuis l’ordinateur', t); });
  };
}
function bulleAide(btn) {
  var vieux = V.root.querySelector('.bulle'); if (vieux) { vieux.remove(); return; }
  var b = e('div', 'bulle');
  var r = btn.getBoundingClientRect(), rr = V.root.getBoundingClientRect();
  b.style.top = (r.bottom - rr.top + 10) + 'px';
  b.innerHTML = '<h6>Utiliser l’ordinateur</h6>' +
    '<p>Pincer ou toucher deux fois pour zoomer, glisser pour te déplacer.</p>' +
    '<p>Avec le contrôle : toucher = clic, appui long ou deux doigts = clic droit, deux doigts qui glissent = défiler. Le bouton clavier ouvre le clavier ; le presse-papiers colle ou copie du texte.</p>';
  var l = e('label'); l.appendChild(e('span', '', 'Mode trackpad'));
  var sw = e('button', 'sw' + (V.trackpad ? ' on' : '')); sw.type = 'button'; sw.setAttribute('aria-label', 'Mode trackpad');
  sw.onclick = function () { V.trackpad = !V.trackpad; ecrirePref('si_ordi_trackpad', V.trackpad); sw.classList.toggle('on', V.trackpad); placerCurseur(); };
  l.appendChild(sw); b.appendChild(l);
  b.appendChild(e('p', '', 'Trackpad : ton doigt déplace la flèche comme sur un trackpad, et un toucher clique là où elle est.'));
  V.root.appendChild(b);
  setTimeout(function () { document.addEventListener('pointerdown', function f(ev) { if (!b.contains(ev.target) && !btn.contains(ev.target)) { b.remove(); document.removeEventListener('pointerdown', f, true); } }, true); }, 0);
}

/* ---------- Profil : statut et vignette en direct ---------- */
function vignette(conteneur, jeton, valEl) {
  style(); if (jeton) jetonCourant = jeton;
  var box = e('div', 'ordi-vig'); box.setAttribute('role', 'button'); box.setAttribute('aria-label', 'Ouvrir l’ordinateur de Laura');
  var badge = e('div', 'badge'); badge.innerHTML = '<i></i><span>…</span>';
  box.appendChild(e('div', 'vide', 'Ordinateur de Laura'));
  box.appendChild(badge);
  conteneur.appendChild(box);
  box.onclick = function () { arreter(); ouvrir({ jeton: jetonCourant }); };
  var rfb = null, fini = false;
  function arreter() { fini = true; if (rfb) { try { rfb.disconnect(); } catch (x) {} rfb = null; } }
  var garde = setInterval(function () { if (!box.isConnected) { clearInterval(garde); arreter(); } }, 1000);
  etat().then(function (s) {
    if (fini) return;
    var statut = s.allume ? 'En cours' : 'Idle';
    if (valEl) valEl.textContent = statut;
    badge.querySelector('span').textContent = s.allume ? 'En direct' : 'En veille';
    if (s.derniere) image(s.derniere.url_capture).then(function (u) { if (fini) return; var im = e('img'); im.src = u; im.alt = 'Dernier écran'; box.insertBefore(im, box.querySelector('.vnc') || badge); var v = box.querySelector('.vide'); if (v) v.remove(); }).catch(function () {});
    if (s.allume) {
      badge.classList.add('live');
      return Promise.all([api('/ticket', { body: { mode: 'vue' } }), novnc()]).then(function (r) {
        if (fini) return;
        var d = e('div', 'vnc'); box.insertBefore(d, badge);
        rfb = new r[1].RFB(d, r[0].ws, { shared: true });
        rfb.viewOnly = true; rfb.scaleViewport = true; rfb.background = 'transparent'; rfb.qualityLevel = 6; rfb.compressionLevel = 2;
        rfb.addEventListener('connect', function () { var v = box.querySelector('.vide'); if (v) v.remove(); });
      });
    }
  }).catch(function () { if (valEl) valEl.textContent = '—'; badge.querySelector('span').textContent = 'Hors ligne'; });
  return box;
}

/* ---------- Carte « Laura a besoin de toi sur son ordinateur » ---------- */
function specs(corps) {
  var out = [], re = /<!--\s*fsm-ordinateur:\s*([\s\S]*?)-->/g, m;
  while ((m = re.exec(String(corps || '')))) { try { out.push(JSON.parse(m[1])); } catch (x) {} }
  return out;
}
function marquerCarte(c) {
  if (c._fait) return; c._fait = true;
  try { var f = JSON.parse(localStorage.getItem('si_cartes_faites') || '{}'); f[c._cle] = Date.now(); localStorage.setItem('si_cartes_faites', JSON.stringify(f)); } catch (x) {}
  var b = c.querySelector('.bts'); if (b) b.remove();
  c.appendChild(e('div', 'ok', '✓ C’est fait, Laura reprend'));
}
function cartes(node, corps, o) {
  var l = specs(corps); if (!l.length) return;
  style(); o = o || {}; if (o.jeton) jetonCourant = o.jeton; if (o.envoyer) envoyerCourant = o.envoyer;
  var bulle = node.querySelector('.bubble') || node;
  if (bulle.querySelector('.si-ordi')) return;
  l.forEach(function (s, i) {
    var c = e('div', 'si-ordi'); c._cle = (o.cle || '') + ':ordi:' + i;
    ['click', 'touchstart', 'touchend', 'mousedown', 'contextmenu'].forEach(function (t) { c.addEventListener(t, function (ev) { ev.stopPropagation(); }); });
    c.appendChild(e('h5', '', '🖥 Laura a besoin de toi sur son ordinateur'));
    if (s.message) c.appendChild(e('p', '', s.message));
    var faits = {}; try { faits = JSON.parse(localStorage.getItem('si_cartes_faites') || '{}'); } catch (x) {}
    if (faits[c._cle]) { c.appendChild(e('div', 'ok', '✓ C’est fait')); bulle.appendChild(c); return; }
    var bts = e('div', 'bts');
    var p = e('button', 'p', 'Prendre le contrôle'); p.type = 'button';
    var f = e('button', '', 'C’est fait'); f.type = 'button';
    p.onclick = function () { ouvrir({ jeton: jetonCourant, envoyer: envoyerCourant, main: true, aide: true }); };
    f.onclick = function () { finiAide(); marquerCarte(c); };
    bts.appendChild(p); bts.appendChild(f); c.appendChild(bts);
    bulle.appendChild(c);
  });
}

window.Ordinateur = { BUREAU: BUREAU, ouvrir: ouvrir, fermer: fermer, vignette: vignette, etat: etat, cartes: cartes, specs: specs, estCapture: estCapture, image: image,
  _test: { versBureau: versBureau, etatVue: function () { return V && { mode: V.mode, z: V.z, tx: V.tx, ty: V.ty, trackpad: V.trackpad, cx: V.cx, cy: V.cy, connecte: !!V.rfb, ms: V.ms }; } } };
})();
