/* Carte d'envoi Gmail, relevée image par image sur la carte Grok Bot de Tom
   (vidéo tom-1136-draftcard.mp4, 1170×2532, ×3). Rien ne part sans l'appui sur Envoyer. */
(function () {
'use strict';

var PROXY = (window.LauraRapide && LauraRapide.PROXY) ||
  ((typeof location !== 'undefined' && location.hostname === 'laura.fsmsibot.app') ? location.origin : 'https://fsm-si-proxy.fsmdev66.workers.dev');

var CSS = [
'.mail-carte{position:relative;box-sizing:border-box;width:100%;background:#1C1C1E;border-radius:24px;padding:16px;margin:8px 0 10px;color:#fff;font:15px/1.38 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;-webkit-user-select:text;user-select:text}',
'.mail-badge{display:inline-flex;align-items:center;gap:6px;background:#2C2C2E;border-radius:999px;padding:5px 10px 5px 8px;font-size:13px;font-weight:500;line-height:1;color:#fff;margin:0 0 12px}',
'.mail-badge svg{width:14px;height:14px;flex:none}',
'.mail-objet{display:block;width:100%;margin:0 0 12px;padding:0;border:0;background:transparent;color:#fff;font:700 19px/1.25 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;outline:none;resize:none;overflow:hidden}',
'.mail-objet:disabled{opacity:1;-webkit-text-fill-color:#fff}',
'.mail-ligne{display:flex;align-items:baseline;gap:10px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.10)}',
'.mail-ligne.cc{border-bottom:0;padding-bottom:0}',
'.mail-lab{flex:none;width:28px;color:#8E8E93;font-size:14px;line-height:1.3}',
'.mail-val{flex:1;min-width:0;border:0;background:transparent;color:#fff;font:15px/1.35 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;outline:none;padding:0}',
'.mail-val:disabled{opacity:1;-webkit-text-fill-color:#fff}',
'.mail-val::placeholder{color:#636366}',
'.mail-corps{display:block;width:100%;margin:16px 0 0;padding:0;border:0;background:transparent;color:#fff;font:15px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;outline:none;resize:none;overflow:hidden;white-space:pre-wrap}',
'.mail-corps:disabled{opacity:1;-webkit-text-fill-color:#fff}',
'.mail-approb{display:inline-flex;align-items:center;gap:4px;margin:22px 0 0;padding:0;border:0;background:transparent;color:#8E8E93;font:13px/1.2 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent}',
'.mail-approb .chev{display:inline-flex;align-items:center;margin-left:1px;transition:transform .18s ease}',
'.mail-approb.open .chev{transform:rotate(180deg) translateY(-1px)}',
'.mail-pied{display:flex;justify-content:flex-end;align-items:center;gap:16px;margin-top:14px}',
'.mail-abandonner{border:0;background:transparent;color:#8E8E93;font:15px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;padding:8px 0;cursor:pointer;-webkit-tap-highlight-color:transparent}',
'.mail-envoyer{border:0;border-radius:999px;background:#fff;color:#000;font:700 15px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;padding:0 16px;height:34px;cursor:pointer;-webkit-tap-highlight-color:transparent}',
'.mail-envoyer:disabled,.mail-abandonner:disabled{opacity:.45;pointer-events:none}',
'.mail-etat{display:flex;align-items:center;gap:6px;margin:22px 0 0;font-size:13px;color:#8E8E93}',
'.mail-etat.envoye{color:#4CD964}',
'.mail-etat.abandonne{color:#8E8E93}',
'.mail-carte.abandonne{opacity:.72}',
'.mail-err{color:#ff453a;font-size:13px;margin:10px 0 0}',
'.mail-menu-fond{position:fixed;inset:0;z-index:9600;background:transparent}',
'.mail-menu{position:fixed;z-index:9601;width:200px;background:rgba(20,20,22,.88);-webkit-backdrop-filter:saturate(180%) blur(28px);backdrop-filter:saturate(180%) blur(28px);border-radius:14px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.45);padding:2px 0}',
'.mail-menu button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;background:transparent;color:#fff;font:17px/1.2 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;padding:12px 16px 12px 14px;cursor:pointer;-webkit-tap-highlight-color:transparent}',
'.mail-menu button+button{border-top:1px solid rgba(255,255,255,.12)}',
'.mail-menu .coche{flex:none;width:18px;text-align:center;font-size:15px;line-height:1}',
'.mail-menu .lib{flex:1}',
'.mail-bientot{position:fixed;inset:0;z-index:9700;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}',
'.mail-bientot .boite{width:min(280px,calc(100% - 48px));background:rgba(44,44,46,.94);-webkit-backdrop-filter:blur(30px);backdrop-filter:blur(30px);border-radius:16px;padding:22px 18px 16px;text-align:center;color:#fff}',
'.mail-bientot h3{margin:0 0 8px;font-size:17px;font-weight:700}',
'.mail-bientot p{margin:0 0 16px;font-size:14px;color:#EBEBF0;line-height:1.4}',
'.mail-bientot button{border:0;border-radius:22px;background:#0A84FF;color:#fff;font:700 17px/1 -apple-system,system-ui,sans-serif;padding:10px 18px;min-width:120px;cursor:pointer}',
'#gmail-vocal{position:fixed;left:16px;right:16px;bottom:calc(env(safe-area-inset-bottom) + 120px);z-index:9500;max-width:520px;margin:0 auto;box-shadow:0 18px 50px rgba(0,0,0,.6)}'
].join('');

var ICO = '<svg viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.6" y="3.2" width="12.8" height="9.6" rx="1.7"/><path d="M2.2 4.4 8 9.1l5.8-4.7"/></svg>';

function style() {
  if (document.getElementById('gmail-css')) return;
  var s = document.createElement('style'); s.id = 'gmail-css'; s.textContent = CSS; document.head.appendChild(s);
}
function el(tag, cls, texte) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (texte != null) n.textContent = texte;
  return n;
}
function autoHauteur(n) {
  n.style.height = 'auto';
  n.style.height = Math.max(n.scrollHeight, 24) + 'px';
}

var RE = /<!--\s*fsm-gmail-brouillon\s+(\{[\s\S]*?\})\s*-->/g;
function brouillons(corps) {
  var l = [], m; RE.lastIndex = 0;
  while ((m = RE.exec(String(corps || '')))) {
    try { var x = JSON.parse(m[1]); if (x && x.id) l.push(x); } catch (e) {}
  }
  return l;
}
function memoLire(id) {
  try { var m = JSON.parse(localStorage.getItem('si_gmail_cartes') || '{}'); return m[id] || null; } catch (e) { return null; }
}
function memoEcrire(id, patch) {
  var m = {};
  try { m = JSON.parse(localStorage.getItem('si_gmail_cartes') || '{}'); } catch (e) {}
  m[id] = Object.assign({}, m[id] || {}, patch, { maj: Date.now() });
  try { localStorage.setItem('si_gmail_cartes', JSON.stringify(m)); } catch (e) {}
  return m[id];
}

function jeton() { return (window.FSMChat && FSMChat.jeton && FSMChat.jeton()) || ''; }
function api(chemin, o) {
  o = o || {};
  var opt = { method: o.method || (o.json ? 'POST' : 'GET'), credentials: 'include', headers: { Authorization: 'Bearer ' + jeton() }, cache: 'no-store' };
  if (o.json) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(o.json); }
  return fetch(PROXY + chemin, opt).then(function (r) {
    return r.json().then(function (d) {
      if (!r.ok) throw new Error(d.erreur || ('Gmail ' + r.status));
      return d;
    }, function () { throw new Error('Gmail ' + r.status); });
  });
}

function cartes(node, corps) {
  var l = brouillons(corps);
  if (!l.length) return;
  style();
  node.classList && node.classList.add('si-avec-carte');
  var bulle = node.querySelector && node.querySelector('.bubble');
  l.forEach(function (d) {
    if (node.querySelector && node.querySelector('[data-gmail="' + d.id + '"]')) return;
    var c = carte(d, false);
    if (bulle && bulle.parentNode === node) node.insertBefore(c, bulle);
    else node.appendChild(c);
  });
}

function champs(c) {
  return {
    de: c.querySelector('[data-f=de]').value.trim(),
    a: c.querySelector('[data-f=a]').value.trim(),
    cc: c.querySelector('[data-f=cc]').value.trim(),
    objet: c.querySelector('[data-f=objet]').value,
    corps: c.querySelector('[data-f=corps]').value
  };
}

function carte(d, vocal) {
  style();
  var loc = memoLire(d.id) || {};
  var etat = loc.etat || d.etat || 'attente';
  var c = el('div', 'mail-carte' + (etat === 'abandonne' ? ' abandonne' : ''));
  c.dataset.gmail = d.id;
  ['click', 'touchstart', 'touchend', 'mousedown', 'contextmenu'].forEach(function (t) {
    c.addEventListener(t, function (ev) { ev.stopPropagation(); });
  });

  var badge = el('div', 'mail-badge');
  badge.innerHTML = ICO; badge.appendChild(el('span', '', 'E-mail'));
  c.appendChild(badge);

  var objet = el('textarea', 'mail-objet');
  objet.dataset.f = 'objet'; objet.rows = 1; objet.value = loc.objet != null ? loc.objet : (d.objet || '');
  objet.setAttribute('aria-label', 'Objet');
  c.appendChild(objet);

  function ligne(lab, cle, ph) {
    var r = el('div', 'mail-ligne' + (cle === 'cc' ? ' cc' : ''));
    r.appendChild(el('span', 'mail-lab', lab));
    var i = el('input', 'mail-val');
    i.type = 'text'; i.dataset.f = cle; i.placeholder = ph || '';
    i.value = loc[cle] != null ? loc[cle] : (d[cle] || '');
    i.setAttribute('aria-label', lab);
    i.autocapitalize = 'off'; i.autocomplete = 'off'; i.spellcheck = false;
    r.appendChild(i); c.appendChild(r); return i;
  }
  ligne('De', 'de');
  ligne('À', 'a');
  ligne('Cc', 'cc', 'name@example.com');

  var corps = el('textarea', 'mail-corps');
  corps.dataset.f = 'corps'; corps.value = loc.corps != null ? loc.corps : (d.corps || '');
  corps.setAttribute('aria-label', 'Corps');
  c.appendChild(corps);

  var zone = el('div'); c.appendChild(zone);
  var err = el('div', 'mail-err');

  function verrouiller(on) {
    c.querySelectorAll('input,textarea,button').forEach(function (n) { n.disabled = !!on; });
  }
  function ajuster() { autoHauteur(objet); autoHauteur(corps); }
  objet.addEventListener('input', ajuster);
  corps.addEventListener('input', ajuster);

  function montrer(et, info) {
    etat = et;
    zone.innerHTML = '';
    c.classList.toggle('abandonne', et === 'abandonne');
    if (et === 'envoye' || et === 'abandonne') {
      verrouiller(true);
      var s = el('div', 'mail-etat ' + et);
      s.textContent = (et === 'envoye' ? '✓ Envoyé' : 'Abandonné') + (info ? ' · ' + info : '');
      zone.appendChild(s);
      return;
    }
    verrouiller(false);
    var approb = el('button', 'mail-approb');
    approb.type = 'button';
    approb.innerHTML = 'Approbation nécessaire <span class="chev"><svg viewBox="0 0 10 6" width="9" height="6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    approb.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); ouvrirMenu(c, approb); });
    zone.appendChild(approb);
    var pied = el('div', 'mail-pied');
    var ab = el('button', 'mail-abandonner', 'Abandonner'); ab.type = 'button';
    var en = el('button', 'mail-envoyer', 'Envoyer'); en.type = 'button';
    ab.onclick = function () { faire('abandonner', ab, en); };
    en.onclick = function () { faire('envoyer', ab, en); };
    pied.appendChild(ab); pied.appendChild(en);
    zone.appendChild(pied);
  }

  function faire(action, ab, en) {
    ab.disabled = en.disabled = true;
    if (err.parentNode) err.remove();
    var f = champs(c);
    memoEcrire(d.id, f);
    var corpsReq = Object.assign({ id: d.id, fil: d.fil || '' }, f);
    var p = action === 'envoyer'
      ? api('/gmail/envoyer', { json: corpsReq })
      : api('/gmail/abandonner', { json: { id: d.id } });
    p.then(function (r) {
      var et = r.etat || (action === 'envoyer' ? 'envoye' : 'abandonne');
      memoEcrire(d.id, Object.assign({ etat: et }, f));
      montrer(et, et === 'envoye' ? (r.de || f.de) + ' → ' + (r.a || f.a) : '');
      prevenirLaura(d, et, Object.assign({}, f, r), vocal);
    }, function (er) {
      ab.disabled = en.disabled = false;
      err.textContent = er.message || 'Impossible pour le moment.';
      zone.appendChild(err);
    });
  }

  montrer(etat, loc.info || '');
  requestAnimationFrame(ajuster);
  // Si un autre appareil a déjà envoyé ou abandonné, on aligne l'état (sans bloquer l'affichage).
  if (etat === 'attente' && jeton()) {
    api('/gmail/carte/' + encodeURIComponent(d.id)).then(function (s) {
      if (s && (s.etat === 'envoye' || s.etat === 'abandonne')) {
        memoEcrire(d.id, { etat: s.etat, de: s.de, a: s.a, cc: s.cc, objet: s.objet, corps: s.corps });
        if (s.de) c.querySelector('[data-f=de]').value = s.de;
        if (s.a) c.querySelector('[data-f=a]').value = s.a;
        c.querySelector('[data-f=cc]').value = s.cc || '';
        if (s.objet != null) objet.value = s.objet;
        if (s.corps != null) corps.value = s.corps;
        ajuster();
        montrer(s.etat, s.etat === 'envoye' ? (s.de || '') + ' → ' + (s.a || '') : '');
      }
    }).catch(function () {});
  }
  return c;
}

function prevenirLaura(d, etat, f, vocal) {
  if (!window.FSMChat) return;
  var t;
  if (etat === 'abandonne') {
    t = '[E-mail · brouillon abandonné] Tom a abandonné l’envoi (objet : ' + (f.objet || d.objet || '') + ', à : ' + (f.a || d.a || '') + '). Ne le renvoie pas. Confirme-lui brièvement que c’est annulé.';
  } else {
    t = '[E-mail · envoyé] Tom a appuyé sur Envoyer. Le message est parti.\nDe : ' + (f.de || '') + '\nÀ : ' + (f.a || '') + (f.cc ? '\nCc : ' + f.cc : '') + '\nObjet : ' + (f.objet || '') + '\n\n' + (f.corps || '') + '\n\nDis-lui clairement ce qui a été envoyé, sans le renvoyer.';
  }
  if (vocal && FSMChat.enAppel() && FSMChat.continuerVocal(t)) return;
  if (FSMChat.continuer) FSMChat.continuer(t);
}

function ouvrirMenu(carteEl, btn) {
  fermerMenu();
  btn.classList.add('open');
  var fond = el('div', 'mail-menu-fond');
  var menu = el('div', 'mail-menu');
  menu.setAttribute('role', 'menu');
  var items = [
    { id: 'autoriser', t: 'Autoriser le destinataire' },
    { id: 'approb', t: 'Approbation nécessaire', coche: true },
    { id: 'off', t: 'Désactiver les brouillons' }
  ];
  items.forEach(function (it) {
    var b = el('button'); b.type = 'button'; b.setAttribute('role', 'menuitem');
    b.innerHTML = '<span class="coche">' + (it.coche ? '✓' : '') + '</span><span class="lib"></span>';
    b.querySelector('.lib').textContent = it.t;
    b.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      fermerMenu();
      if (it.id !== 'approb') bientot(it.t);
    });
    menu.appendChild(b);
  });
  document.body.appendChild(fond);
  document.body.appendChild(menu);
  var r = btn.getBoundingClientRect();
  var carteR = carteEl.getBoundingClientRect();
  var mw = 200;
  var left = carteR.left + 16;
  if (left + mw > carteR.right - 8) left = Math.max(8, carteR.right - mw - 8);
  menu.style.left = left + 'px';
  /* Au-dessus du libellé, au-dessus du pied, comme sur la carte Grok Bot. */
  requestAnimationFrame(function () {
    var mh = menu.getBoundingClientRect().height;
    var top = r.top - mh - 8;
    if (top < 8) top = Math.min(r.bottom + 8, window.innerHeight - mh - 8);
    menu.style.top = top + 'px';
  });
  var ignore = Date.now() + 350;
  function clicFond(ev) {
    if (Date.now() < ignore) { ev.preventDefault(); ev.stopPropagation(); return; }
    fermerMenu();
  }
  fond.addEventListener('click', clicFond);
  fond.addEventListener('touchend', clicFond);
  ouvrirMenu._fermer = function () {
    btn.classList.remove('open');
    fond.remove(); menu.remove();
    ouvrirMenu._fermer = null;
  };
}
function fermerMenu() { if (ouvrirMenu._fermer) ouvrirMenu._fermer(); }

function bientot(titre) {
  var f = el('div', 'mail-bientot');
  var b = el('div', 'boite');
  b.appendChild(el('h3', '', titre));
  b.appendChild(el('p', '', 'Bientôt disponible.'));
  var ok = el('button', '', 'OK'); ok.type = 'button';
  ok.onclick = function () { f.remove(); };
  b.appendChild(ok);
  f.appendChild(b);
  f.addEventListener('click', function (e) { if (e.target === f) f.remove(); });
  document.body.appendChild(f);
}

function demandeVocale(d) {
  if (!d || !d.id) return;
  style();
  var vieux = document.getElementById('gmail-vocal'); if (vieux) vieux.remove();
  var c = carte(d, true); c.id = 'gmail-vocal';
  document.body.appendChild(c);
  var fermer = function () {
    var n = document.getElementById('gmail-vocal');
    if (n === c) setTimeout(function () { if (n.parentNode) n.remove(); }, 2800);
  };
  var obs = new MutationObserver(function () {
    if (c.querySelector('.mail-etat')) { obs.disconnect(); fermer(); }
  });
  obs.observe(c, { childList: true, subtree: true });
}

window.GmailCarte = {
  cartes: cartes, brouillons: brouillons, demandeVocale: demandeVocale,
  _test: { carte: carte, brouillons: brouillons, style: style, PROXY: PROXY }
};
})();
