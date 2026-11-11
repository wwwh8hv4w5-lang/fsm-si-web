/* Laura F.S.M · F.S.M AI — interface FSM SI (backend GitHub Issues) */
(function () {
'use strict';
/* build 50 : appli non installée → écran d'installation (/installer.js) et rien d'autre ne tourne */
if (window.FSM_BLOQUEE) return;
var $ = function (i) { return document.getElementById(i); };
var mem = {
  lire: function (k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
  ecrire: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  oter: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
};
var S = {
  depot: mem.lire('si_depot'), jeton: mem.lire('si_jeton'),
  conv: (function () { var u = /[?&]conv=(\d+)/.exec(location.search || ''); if (u) mem.ecrire('si_conv', u[1]); var c = mem.lire('si_conv'); if (c && c.charAt(0) === 'L') return c; return Number(c) || 0; })(),
  voix: mem.lire('si_voix') === '1', note: mem.lire('si_note') === '1',
  hap: mem.lire('si_hap') !== '0', tzauto: mem.lire('si_tzauto') !== '0',
  notif: mem.lire('si_notif') === '1',
  moi: '', moiNom: '', branche: 'main',
  els: {}, attente: false, pret: false, minuteur: 0, blobs: {},
  convs: [], convsVues: 0, envoi: false, ecran: 'login',
  runEtat: '', lastBotCle: '', pending: [], viaProxy: false
};
var PROXY = (typeof location !== 'undefined' && location.hostname === 'laura.fsmsibot.app')
  ? location.origin
  : 'https://fsm-si-proxy.fsmdev66.workers.dev';
var BUILD = '20261111-54';
window.SI_BUILD = BUILD;
window.SI_conv = function () { return S.conv; };
/* build 49 : passerelle pour taches.js (bandeau des tâches de fond) */
window.SI_ouvrirConv = function (n) { if (n && S.pret) choisir(Number(n)); };
window.SI_rafraichir = function () { return rafraichir(); };
window.SI_pret = function () { return S.ecran === 'home' || S.ecran === 'chat'; };
window.SI_alerte = function (m) { alerte(m); };
window.SI_notifActive = function (v) { S.notif = !!v; mem.ecrire('si_notif', v ? '1' : '0'); try { majCompteUI(); } catch (e) {} };
/* Ligne d’état (build 52) : libellés via i18n, 16 langues, français en secours. */
var ETAT_TXT = {
  fr: { etatTravaille: 'Travaille dessus', etatPese: 'Pèse le pour et le contre', etatEcrit: 'En train d’écrire…' },
  en: { etatTravaille: 'Working on it', etatPese: 'Weighing the options', etatEcrit: 'Writing…' },
  es: { etatTravaille: 'Trabajando en ello', etatPese: 'Sopesando los pros y los contras', etatEcrit: 'Escribiendo…' },
  de: { etatTravaille: 'Arbeitet daran', etatPese: 'Wägt Für und Wider ab', etatEcrit: 'Schreibt…' },
  it: { etatTravaille: 'Ci sta lavorando', etatPese: 'Valuta il pro e il contro', etatEcrit: 'Sta scrivendo…' },
  pt: { etatTravaille: 'Trabalhando nisso', etatPese: 'Pesa prós e contras', etatEcrit: 'Escrevendo…' },
  nl: { etatTravaille: 'Werkt eraan', etatPese: 'Weegt de voors en tegens', etatEcrit: 'Aan het schrijven…' },
  pl: { etatTravaille: 'Pracuje nad tym', etatPese: 'Rozważa za i przeciw', etatEcrit: 'Pisze…' },
  sv: { etatTravaille: 'Jobbar på det', etatPese: 'Väger för- och nackdelar', etatEcrit: 'Skriver…' },
  tr: { etatTravaille: 'Üzerinde çalışıyor', etatPese: 'Artıları ve eksileri tartıyor', etatEcrit: 'Yazıyor…' },
  ru: { etatTravaille: 'Работает над этим', etatPese: 'Взвешивает плюсы и минусы', etatEcrit: 'Пишет…' },
  uk: { etatTravaille: 'Працює над цим', etatPese: 'Зважує плюси і мінуси', etatEcrit: 'Пише…' },
  ar: { etatTravaille: 'يعمل على ذلك', etatPese: 'يوازن بين الإيجابيات والسلبيات', etatEcrit: 'يكتب…' },
  ja: { etatTravaille: '作業中', etatPese: '検討しています', etatEcrit: '入力中…' },
  zh: { etatTravaille: '正在处理', etatPese: '权衡利弊', etatEcrit: '正在输入…' },
  ko: { etatTravaille: '작업 중', etatPese: '장단점을 따지는 중', etatEcrit: '작성 중…' }
};
function langueUI() {
  try {
    if (window.SI_LANG && ETAT_TXT[window.SI_LANG]) return window.SI_LANG;
    var m = /(?:^|;\s*)fsmsi_lang=([a-z]{2})(?:;|$)/.exec(document.cookie || '');
    if (m && ETAT_TXT[m[1]]) return m[1];
    var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language];
    for (var i = 0; i < list.length; i++) {
      var b = String(list[i] || '').split('-')[0].toLowerCase();
      if (ETAT_TXT[b]) return b;
    }
  } catch (e) {}
  return 'fr';
}
function t(cle) {
  if (typeof window.SI_T === 'function') { var x = window.SI_T(cle); if (x && x !== cle) return x; }
  var code = langueUI();
  if (window.I18N) return (I18N[code] && I18N[code][cle]) || (I18N.fr && I18N.fr[cle]) || (ETAT_TXT.fr && ETAT_TXT.fr[cle]) || cle;
  return (ETAT_TXT[code] && ETAT_TXT[code][cle]) || ETAT_TXT.fr[cle] || cle;
}
function libelleEtat(phase) {
  if (phase === 'pese') return t('etatPese');
  if (phase === 'ecrit') return t('etatEcrit');
  return t('etatTravaille');
}
function mouvementReduit() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
}
function animerFil(duree) {
  var fil = $('fil');
  if (!fil) return;
  var from = fil.scrollTop;
  var dest = function () { return Math.max(0, fil.scrollHeight - fil.clientHeight); };
  if (mouvementReduit() || !duree) { fil.scrollTop = dest(); majScrollBtn(); return; }
  if (S._filAnim) cancelAnimationFrame(S._filAnim);
  var t0 = performance.now();
  var ease = function (x) { return 1 - Math.pow(1 - x, 3); };
  function tick(now) {
    var p = Math.min(1, (now - t0) / duree);
    fil.scrollTop = from + (dest() - from) * ease(p);
    if (p < 1) S._filAnim = requestAnimationFrame(tick);
    else { S._filAnim = 0; majScrollBtn(); }
  }
  S._filAnim = requestAnimationFrame(tick);
}
/* ---------- Reprise à la relance (build 20261111-34) ----------
   Boîte d’envoi locale (si_boite), brouillon par conversation (si_brouillon:<n>), position du fil (si_fil:<n>),
   écran ouvert (si_ecran) et réponse rapide en cours (si_rapide). Tout reste dans ce navigateur. */
var Reprise = {
  lire: function (k, d) { try { var v = JSON.parse(mem.lire(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } },
  ecrire: function (k, v) { mem.ecrire(k, JSON.stringify(v)); },
  boite: function () { return Reprise.lire('si_boite', []).filter(function (x) { return x && x.uid && x.corps && Date.now() - (x.t || 0) < 7 * 86400e3; }); },
  garder: function (x) { var l = Reprise.boite().filter(function (y) { return y.uid !== x.uid; }); l.push(x); Reprise.ecrire('si_boite', l); },
  oter: function (uid) { Reprise.ecrire('si_boite', Reprise.boite().filter(function (y) { return y.uid !== uid; })); },
  uid: function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
  /* messages tout juste postés : la liste GitHub peut les rendre avec du retard (cache/répliques) ; on les garde 3 min */
  recent: function (conv, c) {
    if (!conv || !c || !c.id) return;
    var l = Reprise.lire('si_recents', []).filter(function (x) { return Date.now() - x.t < 180000 && x.c.id !== c.id; });
    l.push({ conv: conv, t: Date.now(), c: { id: c.id, body: c.body, created_at: c.created_at, user: c.user ? { login: c.user.login, type: c.user.type } : null } });
    Reprise.ecrire('si_recents', l.slice(-20));
  },
  fusion: function (conv, liste) {
    var ids = {}; liste.forEach(function (c) { ids[c.id] = 1; });
    var l = Reprise.lire('si_recents', []).filter(function (x) { return Date.now() - x.t < 180000; });
    var manque = l.filter(function (x) { return x.conv === conv && !ids[x.c.id]; }).map(function (x) { return x.c; });
    Reprise.ecrire('si_recents', l.filter(function (x) { return !ids[x.c.id]; }));
    if (!manque.length) return liste;
    return liste.concat(manque).sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)) || (a.id - b.id); });
  }
};
var NOM = 'Laura F.S.M · F.S.M AI';
var NOM_COURT = 'Laura F.S.M';
var MAX_FILE = 25 * 1024 * 1024;
var ORDRES = [['/cout', 'Dépenses'], ['/memoire', 'Mémoire'], ['/projets', 'Projets'], ['/taches', 'Tâches planifiées'], ['/bots', 'Équipe'], ['/competences', 'Compétences'], ['/refaire', 'Refaire la dernière demande'], ['/aide', 'Aide'], ['/stop', 'Arrêter']];

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function alerte(m) { var a = $('alerte'); if (!a) return; a.textContent = m || ''; a.hidden = !m; if (m) setTimeout(function () { if (a.textContent === m) a.hidden = true; }, 9000); }
function encP(p) { return String(p).split('/').map(encodeURIComponent).join('/'); }
function hap() { if (S.hap && navigator.vibrate) navigator.vibrate(10); }
function estLocal(c) { c = c == null ? S.conv : c; return typeof c === 'string' && c.charAt(0) === 'L'; }
window.ouvrirBotLocal = function (id) { choisir(id, { morph: false }); };
window.majFilLocal = function (items) {
  S.items = items || [];
  S.attente = false;
  S.pret = true;
  etatLigne('');
  majFil(S.items);
};

function api(chemin, o) {
  o = o || {};
  var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var lim = o.delai || ((o.method && o.method !== 'GET') ? 60000 : 20000);
  var tm = ctl ? setTimeout(function () { try { ctl.abort(); } catch (e) {} }, lim) : 0;
  var via = S.viaProxy;
  var url = via ? (PROXY + '/gh' + chemin) : ('https://api.github.com' + chemin);
  var h = { Accept: o.accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (S.jeton && S.jeton !== 'cookie') h.Authorization = 'Bearer ' + S.jeton;
  if (o.json) h['Content-Type'] = 'application/json';
  return fetch(url, {
    method: o.method || 'GET',
    signal: ctl ? ctl.signal : undefined,
    cache: 'no-store',
    credentials: via ? 'include' : 'omit',
    headers: h,
    body: o.json ? JSON.stringify(o.json) : (o.body || undefined)
  }).then(function (r) {
    clearTimeout(tm);
    if (r.status === 401) throw Object.assign(new Error(via ? 'Session expirée. Reconnecte-toi avec le FSM HUB.' : 'Jeton refusé par GitHub : vérifie-le dans Réglages.'), { status: 401 });
    if (!r.ok) {
      var err = new Error(via ? ('Le dépôt a répondu ' + r.status) : ('GitHub a répondu ' + r.status + (r.status === 403 || r.status === 404 ? ' : le jeton a-t-il accès à ce dépôt, avec les bonnes permissions ?' : '')));
      err.status = r.status;
      throw err;
    }
    if (o.brut) return r.arrayBuffer();
    if (o.texte) return r.text();
    return r.status === 204 ? null : r.json();
  }, function (e) {
    clearTimeout(tm);
    if (e && e.name === 'AbortError') throw new Error((via ? 'Le dépôt' : 'GitHub') + ' ne répond pas (délai dépassé). Nouvel essai automatique.');
    throw e;
  });
}
var D = function () { return '/repos/' + S.depot; };

function cheminDepot(u) {
  var m = String(u).replace(/&amp;/g, '&').match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/[^/]+\/([^?#]+)/);
  if (!m || m[1].toLowerCase() !== S.depot.toLowerCase()) return '';
  try { return decodeURIComponent(m[2]); } catch (e) { return ''; }
}
function lien(u, texte) {
  var p = cheminDepot(u);
  if (p) return '<a href="#" class="fichier" data-p="' + esc(p) + '">' + (/\.html?$/i.test(p) ? 'Ouvrir ' : 'Télécharger ') + texte + '</a>';
  return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + texte + '</a>';
}
function enligne(t) {
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (m, txt, u) { return lien(u, txt); });
  t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (m, a, u) { return a + lien(u, u); });
  return t;
}
function retirerPiedRobot(md) {
  var s = String(md == null ? '' : md).replace(/\r\n/g, '\n');
  s = s.replace(/(?:\n[ \t]*)*<sub>[\s\S]*?<\/sub>[ \t]*$/i, function (m) {
    var t = m.replace(/<[^>]+>/g, '');
    return /(FSM SI\s*v\s*[\d.]+|appels\s*·|robot\s*·)/i.test(t) ? '' : m;
  });
  var lignes = s.split('\n');
  while (lignes.length) {
    var last = lignes[lignes.length - 1].replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/^\s+|\s+$/g, '');
    if (!last && /<img\s/i.test(lignes[lignes.length - 1])) break; /* une image de Laura en fin de message n’est pas un pied */
    if (!last) { lignes.pop(); continue; }
    if (/(FSM SI\s*v\s*[\d.]+|appels\s*·)/i.test(last)) { lignes.pop(); continue; }
    break;
  }
  return lignes.join('\n').replace(/\s+$/g, '');
}
function rendre(md) {
  var codes = [], imgs = [];
  md = retirerPiedRobot(md);
  md = String(md || '').replace(/\u0001/g, '').replace(/<!--[\s\S]*?-->/g, '');
  md = md.replace(/<details>[\s\S]*?<\/details>/gi, '');
  md = md.replace(/!\[[^\]]*\]\((https:\/\/github\.com\/[^)\s]+\.(?:png|jpe?g|gif|webp))\)/gi, function (m, u) { var p = cheminDepot(u); if (!p) return m; imgs.push(p); return '\u0001I' + (imgs.length - 1) + '\u0001'; });
  md = md.replace(/<img\s+src="([^"]+)"[^>]*>/g, function (m, u) {
    var b = window.Ordinateur && Ordinateur.estCapture(u); /* écran de Laura (fsm-si-bureau) */
    if (b) { var al = (m.match(/alt="([^"]*)"/) || [])[1] || ''; imgs.push({ b: b, alt: al }); return '\u0001I' + (imgs.length - 1) + '\u0001'; }
    var p = cheminDepot(u); if (!p) return ''; imgs.push(p); return '\u0001I' + (imgs.length - 1) + '\u0001'; });
  md = md.replace(/```[^\n]*\n([\s\S]*?)```/g, function (m, c) { codes.push(c); return '\n\u0001C' + (codes.length - 1) + '\u0001\n'; });
  var h = esc(md)
    .replace(/&lt;details&gt;[\s\S]*?&lt;\/details&gt;/g, '')
    .replace(/&lt;\/?details[^&]*&gt;/g, '')
    .replace(/&lt;\/?summary[^&]*&gt;/g, '')
    .replace(/&lt;sub&gt;([\s\S]*?)&lt;\/sub&gt;/g, '');
  var out = [], liste = false, table = false;
  function clore() { if (liste) { out.push('</ul>'); liste = false; } if (table) { out.push('</table>'); table = false; } }
  h.split('\n').forEach(function (l) {
    var m;
    if (/^<\/?details/.test(l)) { clore(); out.push(l); return; }
    if (/^\s*\|.*\|\s*$/.test(l)) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(l)) return;
      if (!table) { clore(); out.push('<table>'); table = true; }
      out.push('<tr>' + l.trim().slice(1, -1).split('|').map(function (c) { return '<td>' + enligne(c.trim()) + '</td>'; }).join('') + '</tr>');
      return;
    }
    if ((m = l.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/))) { if (!liste) { clore(); out.push('<ul>'); liste = true; } out.push('<li>' + enligne(m[1]) + '</li>'); return; }
    clore();
    if ((m = l.match(/^#{1,4}\s+(.*)$/))) out.push('<h4>' + enligne(m[1]) + '</h4>');
    else if ((m = l.match(/^&gt;\s?(.*)$/))) out.push('<blockquote>' + enligne(m[1]) + '</blockquote>');
    else if (/^\s*$/.test(l)) out.push('<div class="vide"></div>');
    else out.push('<div>' + enligne(l) + '</div>');
  });
  clore();
  return out.join('')
    .replace(/\u0001I(\d+)\u0001/g, function (m, n) { var x = imgs[n]; if (x && x.b) return '<img class="vue ecran" alt="' + esc(x.alt || 'Écran de Laura') + '" data-b="' + esc(x.b) + '">'; return x ? '<img class="vue" alt="Aperçu" data-p="' + esc(x) + '">' : ''; })
    .replace(/\u0001C(\d+)\u0001/g, function (m, n) { return codes[n] == null ? '' : '<pre>' + esc(codes[n]) + '</pre>'; })
    .replace(/(<div class="vide"><\/div>){2,}/g, '<div class="vide"></div>');
}

var MIME = { html: 'text/html', htm: 'text/html', png: 'image/png', gif: 'image/gif', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', pdf: 'application/pdf', zip: 'application/zip', txt: 'text/plain', md: 'text/plain', json: 'application/json' };
function blobDepot(p) {
  if (S.blobs[p]) return Promise.resolve(S.blobs[p]);
  return api(D() + '/contents/' + encP(p) + '?ref=' + encodeURIComponent(S.branche), { accept: 'application/vnd.github.raw+json', brut: true }).then(function (buf) {
    var ext = (p.split('.').pop() || '').toLowerCase();
    S.blobs[p] = URL.createObjectURL(new Blob([buf], { type: MIME[ext] || 'application/octet-stream' }));
    return S.blobs[p];
  });
}
function brancher(el) {
  if (window.Ordinateur) Array.prototype.forEach.call(el.querySelectorAll('img.vue[data-b]'), function (n) {
    Ordinateur.image(n.getAttribute('data-b'), S.jeton).then(function (u) { n.src = u; }).catch(function (x) { n.alt = x.message; n.classList.add('perdue'); });
  });
  Array.prototype.forEach.call(el.querySelectorAll('img.vue[data-p], video[data-p]'), function (n) {
    blobDepot(n.getAttribute('data-p')).then(function (u) { n.src = u; }).catch(function () { n.alt = 'Aperçu indisponible'; });
  });
}
document.addEventListener('click', function (e) {
  var a = e.target.closest ? e.target.closest('a.fichier') : null;
  if (!a) return;
  e.preventDefault();
  var p = a.getAttribute('data-p'), html = /\.html?$/i.test(p);
  var w = html ? window.open('', '_blank') : null;
  blobDepot(p).then(function (u) {
    if (html) { if (w) w.location = u; else location.href = u; return; }
    var l = document.createElement('a');
    l.href = u; l.download = p.split('/').pop();
    document.body.appendChild(l); l.click(); l.remove();
  }).catch(function (x) { if (w) w.close(); alerte(x.message); });
});

function heure(d) {
  var x = new Date(d), auj = new Date().toDateString() === x.toDateString();
  return (auj ? '' : x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ') + x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function texteBrut(md) {
  return String(md).replace(/<!--[\s\S]*?-->/g, '').replace(/<details>[\s\S]*?<\/details>/g, '').replace(/<sub>[\s\S]*?<\/sub>/g, '').replace(/<[^>]+>/g, '')
    .replace(/```[\s\S]*?```/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/https?:\/\/\S+/g, '').replace(/[*_`#>|]/g, '').replace(/📎 Fichiers[\s\S]*$/, '').trim();
}
function textePourVoix(md) {
  var t = texteBrut(typeof retirerPiedRobot === 'function' ? retirerPiedRobot(md) : md);
  t = t.replace(/\n{2,}/g, '. ').replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();
  return t;
}
function apresPeinture(fn) { requestAnimationFrame(function () { requestAnimationFrame(fn); }); }
function el(nom, cls, texte) { var e = document.createElement(nom); if (cls) e.className = cls; if (texte != null) e.textContent = texte; return e; }

/* ---------- Navigation ---------- */
function themeColor(c) { var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', c); }
function champsFocusables(actifs) {
  var allow = {};
  (actifs || []).forEach(function (n) { if (n) allow[n.id || n] = true; });
  Array.prototype.forEach.call(document.querySelectorAll('input, textarea, select'), function (el) {
    var on = !!(el.id && allow[el.id]);
    el.tabIndex = on ? 0 : -1;
  });
}
function montrerLogin(err) {
  S.ecran = 'login';
  $('login').hidden = false;
  $('home').hidden = true;
  $('chatView').hidden = true;
  if ($('ahubuser')) $('ahubuser').value = '';
  if ($('ahubpass')) $('ahubpass').value = '';
  if ($('ajeton')) $('ajeton').value = '';
  if ($('adepot') && !S.depot) $('adepot').value = 'wwwh8hv4w5-lang/fsm-si';
  $('aerreur').textContent = err || '';
  champsFocusables([$('ahubuser') || $('adepot'), $('ahubpass') || $('ajeton')]);
  themeColor('#141414');
}
function montrerHome(instant) {
  S.ecran = 'home';
  $('login').hidden = true;
  $('home').hidden = false;
  champsFocusables([]);
  if (instant) {
    $('chatView').hidden = true;
    resetCard();
  }
  themeColor('#141414');
  fermerMenu();
  fermerSettings();
  closePush(true);
  if (window.CreateBot) CreateBot.peindreAccueil();
}
function montrerChat(viaMorph) {
  S.ecran = 'chat';
  $('login').hidden = true;
  $('home').hidden = false; /* reste derrière pour le morph */
  $('chatView').hidden = false;
  champsFocusables([$('texte')]);
  themeColor('#141414');
  if (!viaMorph) resetCard();
  setTimeout(function () { var f = $('fil'); if (f) f.scrollTop = f.scrollHeight; }, 40);
}

/* ---------- Conversations ---------- */
function chargerConvs() {
  return api(D() + '/issues?state=all&per_page=60&sort=updated&direction=desc').then(function (l) {
    S.convs = [];
    var nb = 0;
    l.forEach(function (i) {
      if (i.pull_request) return;
      var noms = (i.labels || []).map(function (x) { return x.name; });
      if (noms.indexOf('validation') >= 0) { if (i.state === 'open') nb++; return; }
      S.convs.push(i);
    });
    S.validOuvertes = nb;
    if (S.conv && !S.convs.some(function (c) { return c.number === S.conv; })) {
      /* la conv peut exister hors page ; on ne l’efface pas */
    }
    S.convsVues = Date.now();
  });
}
function choisir(n, opts) {
  opts = opts || {};
  S.conv = n; mem.ecrire('si_conv', String(n));
  S.els = {}; $('fil').textContent = ''; S.pret = false; S.attente = false;
  if (!opts.sansEcran) mem.ecrire('si_ecran', 'chat');
  if (n && !estLocal(n)) { var br = mem.lire('si_brouillon:' + n); if (br && !$('texte').value.trim()) { $('texte').value = br; taille(); } }
  if (window.LauraMode) LauraMode.maj();
  if (window.CreateBot) CreateBot.entete();
  if (!opts.sansEcran) {
    if (opts.morph && !estLocal(n)) ouvrirChatMorph();
    else montrerChat(false);
  }
  if (estLocal(n)) {
    if (window.CreateBot) CreateBot.rafraichir();
    return;
  }
  boucle();
}
function tousCommentaires(n, page, acc) {
  page = page || 1; acc = acc || [];
  return api(D() + '/issues/' + n + '/comments?per_page=100&page=' + page + '&_=' + Date.now()).then(function (l) {
    acc = acc.concat(l);
    return l.length === 100 && page < 6 ? tousCommentaires(n, page + 1, acc) : Reprise.fusion(n, acc);
  });
}

function mediaHtml(corps) {
  /* vidéos du dépôt : lien .mp4/.webm → lecteur */
  return corps.replace(/<a href="#" class="fichier" data-p="([^"]+\.(?:mp4|webm|mov))"[^<]*<\/a>/gi, function (m, p) {
    return '<div class="vid-wrap" data-full="' + esc(p) + '"><video data-p="' + esc(p) + '" playsinline preload="metadata"></video><span class="play"></span></div>';
  });
}

/* ---------- Images jointes, comme Grok : vignette seule (sans bulle), légende dans sa propre bulle ----------
   Le bloc « 📎 Fichiers joints … entree/ » reste dans le message pour le robot ; l’interface ne l’affiche pas. */
var RE_IMG = /\.(png|jpe?g|gif|webp|heic|avif)$/i;
function piecesDe(corps) {
  var s = String(corps || ''), imgs = [], dims = {};
  s.replace(/<!--\s*fsm-pj:\s*(\S+)\s+(\d+)x(\d+)\s*-->/g, function (m, p, w, h) { dims[p] = [+w, +h]; return m; });
  s = s.replace(/\n*📎 \*\*Fichiers joints\*\*[^\n]*\n((?:[ \t]*- \[[^\]]*\]\([^)\s]+\)[ \t]*(?:\n|$))+)/, function (m, liste) {
    var autres = [];
    liste.replace(/- \[([^\]]*)\]\(([^)\s]+)\)/g, function (x, nom, u) {
      var p = cheminDepot(u);
      if (p && RE_IMG.test(p)) imgs.push({ p: p, nom: nom, d: dims[p] }); else autres.push('- [' + nom + '](' + u + ')');
      return x;
    });
    return autres.length ? '\n\n' + autres.join('\n') : '';
  });
  return { reste: s, imgs: imgs };
}
function galerieHtml(imgs, seule) {
  if (!imgs.length) return '';
  var n = Math.min(imgs.length, 4);
  return '<div class="pj-grille' + (imgs.length > 1 ? ' pj-multi' : '') + (seule ? ' bubble pj-seule' : '') + '">' + imgs.map(function (im) {
    var ar = im.d && im.d[0] && im.d[1] ? ' style="aspect-ratio:' + im.d[0] + '/' + im.d[1] + '"' : '';
    return '<img class="vue pj" alt="' + esc(im.nom || 'Image') + '" data-p="' + esc(im.p) + '"' + ar + ' decoding="async">';
  }).join('') + '</div>';
}
/* contenu d’un message (hors note vocale) : images d’abord pour Tom, après le texte pour Laura */
function contenuHtml(corps, moi) {
  var pj = piecesDe(corps), imgs = pj.imgs.slice();
  var h = mediaHtml(rendre(pj.reste)).replace(/<img class="vue" alt="Aperçu" data-p="([^"]+)">/g, function (m, p) {
    imgs.push({ p: p.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'), nom: 'Image' }); return '';
  }).replace(/<div>\s*<\/div>/g, '').replace(/^(<div class="vide"><\/div>)+|(<div class="vide"><\/div>)+$/g, '');
  if (!imgs.length) return '<div class="bubble">' + h + '</div>';
  var txt = h.replace(/<[^>]+>/g, '').trim() ? '<div class="bubble">' + h + '</div>' : '';
  var g = galerieHtml(imgs, !txt);
  return moi ? g + txt : txt + g;
}

function estNoteVocale(corps) {
  return /^\s*(?:🎤\s*)?Note vocale\s*:/i.test(String(corps || ''));
}
function cheminNoteVocale(corps) {
  var m = String(corps || '').match(/Note vocale\s*:\s*(\S+)/i);
  return m ? m[1].trim() : '';
}
function extraireCitationVocale(corps) {
  var s = String(corps || '').replace(/^\uFEFF/, '');
  var m = s.match(/<!--\s*fsm-vocal:\s*([\s\S]*?)-->/);
  if (m) {
    return { texte: m[1].replace(/\s+/g, ' ').trim(), reste: s.replace(m[0], '').replace(/^\s+/, '') };
  }
  m = s.match(/^\s*>\s*«\s*([\s\S]*?)\s*»\s*(?:\n+|$)/);
  if (m) {
    return { texte: m[1].replace(/\s+/g, ' ').trim(), reste: s.slice(m[0].length).replace(/^\s+/, '') };
  }
  return null;
}
function memorerTranscriptionVocale(texte) {
  if (!texte) return;
  S._dernVocal = texte;
}
function transcriptionPourNote(corps) {
  var m = String(corps || '').match(/Note vocale\s*:\s*«\s*([\s\S]*?)\s*»/);
  if (m) return m[1];
  return S._dernVocal || '';
}
function bulleNoteVocale(transcription) {
  var lab = transcription || 'Note vocale';
  var hauteurs = [6, 10, 14, 9, 16, 8, 12, 7, 15, 10, 6];
  var bars = hauteurs.map(function (h) { return '<i style="height:' + h + 'px"></i>'; }).join('');
  return '<div class="bubble vocal"><span class="vocal-wave" aria-hidden="true">' + bars + '</span><span class="vocal-lab">' + esc(lab) + '</span></div>';
}

function majFil(items) {
  var fil = $('fil');
  var bas = fil.scrollHeight - fil.scrollTop - fil.clientHeight < 140;
  var ajout = false, vus = {};
  /* les messages du serveur s’insèrent avant les envois encore en file */
  var ancre = fil.querySelector('.msg.local, .msg.rapide');
  items.forEach(function (it) {
    vus[it.cle] = 1;
    if (it.cache) {
      if (it.direAppel && S.pret && S.modeVocal && !(S._dits = S._dits || {})[it.cle]) { S._dits[it.cle] = 1; vocalSurReponse(it); }
      return;
    }
    var node = S.els[it.cle];
    if (!node) {
      var rapide = (it.genre === 'tx') ? fil.querySelector('.msg.rapide') : null;
      if (rapide && !rapide.dataset.cle) {
        /* la bulle déjà montrée par la voie rapide : on la reprend, sans doublon ni 2e animation */
        node = S.els[it.cle] = rapide;
        rapide.classList.remove('rapide', 'neuf');
        rapide.dataset.cle = it.cle;
        node._neuf = false;
        if (ancre === rapide) ancre = fil.querySelector('.msg.local, .msg.rapide');
      } else {
      node = S.els[it.cle] = document.createElement('article');
      if (S.pret) node._neuf = true;
      if (ancre) fil.insertBefore(node, ancre); else fil.appendChild(node);
      ajout = true;
      }
      if (S.pret && it.genre === 'tx' && !rapide) {
        if (S.modeVocal) vocalSurReponse(it);
        else if (S.voix && it.corps.indexOf('<!-- fsm-laura') < 0) dire(textePourVoix(it.corps));
      }
      if (S.pret && it.genre === 'tx' && it.cle !== S.lastBotCle && S.ecran !== 'chat') {
        bannerBot(it.corps);
      }
      if (it.genre === 'tx') S.lastBotCle = it.cle;
    }
    var sigR = (it.react || []).join('');
    if (node._corps === it.corps) {
      if (node._sigR !== sigR) { node._sigR = sigR; piedMessage(node, it); }
      return;
    }
    node._corps = it.corps;
    node._sigR = sigR;
    var moi = it.genre === 'moi' || it.genre === 'ordre';
    node.className = 'msg ' + (moi ? (it.genre === 'ordre' ? 'ordre' : 'me') : 'bot') + (node._neuf ? ' neuf' : '');
    var corpsVu = it.corps;
    var voc = extraireCitationVocale(corpsVu);
    if (voc) {
      corpsVu = voc.reste;
      memorerTranscriptionVocale(voc.texte);
    }
    var htmlBulle;
    var rsm = !moi && resumeAppelDe(it.corps);
    if (rsm) {
      htmlBulle = carteResumeAppel(rsm.duree, texteLeger(it.corps));
      node.dataset.texte = 'Chat vocal · ' + rsm.duree + '\n' + texteLeger(it.corps);
    } else if (moi && estNoteVocale(it.corps)) {
      var tr = transcriptionPourNote(it.corps);
      htmlBulle = bulleNoteVocale(tr);
      node.dataset.texte = tr || 'Note vocale';
    } else {
      htmlBulle = contenuHtml(corpsVu, moi);
      node.dataset.texte = texteBrut(piecesDe(corpsVu).reste);
    }
    node.innerHTML = htmlBulle + '<time>' + esc(heure(it.date)) + '</time>';
    node.dataset.cle = it.cle;
    node.dataset.qui = moi ? 'me' : 'bot';
    brancher(node);
    if (!moi && window.LauraRapide) LauraRapide.cartes(node, it.corps, { jeton: S.jeton, cle: it.cle, envoyer: envoyer });
    if (!moi && window.Ordinateur) Ordinateur.cartes(node, it.corps, { jeton: S.jeton, cle: it.cle, envoyer: envoyer });
    if (!moi && window.PCTom) PCTom.cartes(node, it.corps, { jeton: S.jeton, cle: it.cle });
    if (!moi && window.GmailCarte) GmailCarte.cartes(node, it.corps);
    piedMessage(node, it);
  });
  Object.keys(S.els).forEach(function (k) {
    if (vus[k] || k.charAt(0) === 'l' || (S.garde && S.garde[k] > Date.now())) return;
    S.els[k].remove(); delete S.els[k];
  });
  if (S._dernVocal) {
    items.forEach(function (it) {
      if (!(it.genre === 'moi' && estNoteVocale(it.corps))) return;
      var n = S.els[it.cle];
      if (!n) return;
      var lab = n.querySelector('.vocal-lab');
      if (lab && lab.textContent === 'Note vocale') {
        lab.textContent = S._dernVocal;
        n.dataset.texte = S._dernVocal;
      }
    });
  }
  majEspacesReact();
  if (ajout && (bas || !S.pret)) {
    if (S.pret) requestAnimationFrame(function () { fil.scrollTo({ top: fil.scrollHeight, behavior: 'smooth' }); });
    else {
      /* premier rendu : les tailles réelles des bulles (content-visibility) n’arrivent qu’après coup ;
         on recolle en bas quelques fois tant que Tom n’a pas touché au fil */
      var pos = Reprise.lire('si_fil:' + S.conv, null);
      var placer = function () {
        var a = pos && !pos.bas && S.els[pos.cle];
        if (a) fil.scrollTop = Math.max(0, a.getBoundingClientRect().top - fil.getBoundingClientRect().top + fil.scrollTop - (pos.off || 0));
        else fil.scrollTop = fil.scrollHeight;
      };
      placer();
      S._colle = Date.now();
      [80, 250, 600, 1200].forEach(function (t) {
        setTimeout(function () { if (S._colle && Date.now() - S._colle < 1600) { placer(); majScrollBtn(); } }, t);
      });
    }
  }
  majScrollBtn();
}

/* place sous une bulle réagie seulement quand un message la suit : l’arrivée d’un tapback ne bouge jamais le fil */
function majEspacesReact() {
  var l = document.querySelectorAll('#fil > .msg.has-react');
  for (var i = 0; i < l.length; i++) {
    var esp = !!l[i].nextElementSibling;
    if (l[i]._esp !== esp) { l[i]._esp = esp; l[i].classList.toggle('react-espace', esp); }
  }
}
/* ---------- Réactions (tapbacks) envoyées par Laura ---------- */
var RE_REAGIR = /<!--\s*fsm-reagir:\s*(\S+)\s+([\s\S]*?)\s*-->/g;
var GH_EMO = { heart: '❤️', '+1': '👍', '-1': '👎', laugh: '😄', hooray: '🎉', confused: '😕' };
function reactionsMarqueurs(corps) {
  var out = [], m;
  RE_REAGIR.lastIndex = 0;
  while ((m = RE_REAGIR.exec(String(corps || '')))) out.push({ id: m[1], emoji: m[2].trim() });
  return out;
}
function reactionsGithub(r) {
  var out = [];
  if (!r) return out;
  Object.keys(GH_EMO).forEach(function (k) { if (r[k] > 0) out.push(GH_EMO[k]); });
  return out;
}
function corpsVisibleVide(corps) {
  var s = retirerPiedRobot(String(corps || '').replace(RE_REAGIR, ''));
  if (/<img\s|\]\(https?:|```/.test(s)) return false;
  return !texteBrut(s).replace(/\s+/g, '');
}
function normEmo(e) { return String(e || '').replace(/\uFE0F/g, ''); }

function lireJSON(k, def) {
  try { var v = JSON.parse(mem.lire(k) || ''); return v || def; } catch (e) { return def; }
}
function ecrireJSON(k, v) { mem.ecrire(k, JSON.stringify(v)); }
function piedMessage(node, it) {
  var cle = it && it.cle || node.dataset.cle;
  var hold = node.querySelector('.react-pills');
  if (hold) hold.remove();
  var rec = lireJSON('si_react', {})[cle];
  var list = rec ? (Array.isArray(rec) ? rec.slice() : [rec]) : [];
  var bot = (it && it.react) || node._react || [];
  if (it && it.react) node._react = it.react;
  bot.forEach(function (em) {
    if (!list.some(function (x) { return normEmo(x) === normEmo(em); })) list.push(em);
  });
  node.classList.toggle('has-react', list.length > 0);
  var bub = node.querySelector('.bubble');
  if (list.length && bub) {
    var p = el('span', 'react-pills');
    p.setAttribute('aria-label', 'Réactions ' + list.join(' '));
    list.slice(0, 3).forEach(function (em) { p.appendChild(el('span', 'react-pill', em)); });
    bub.appendChild(p);
  }
  node.classList.toggle('nonlu', !!lireJSON('si_nonlu', {})[cle]);
}
function fermerReponse() {
  S.reponse = null;
  var b = $('replyBar');
  if (b) b.hidden = true;
  if ($('replyTxt')) $('replyTxt').textContent = '';
}

function bannerBot(corps) {
  var t = texteBrut(corps).slice(0, 140);
  if (!t) return;
  $('bannerName').textContent = NOM;
  $('bannerWhen').textContent = 'maintenant';
  $('bannerText').textContent = t;
  $('banner').hidden = false;
  requestAnimationFrame(function () { $('banner').classList.add('show'); });
  clearTimeout(S.bannerT);
  S.bannerT = setTimeout(function () { $('banner').classList.remove('show'); setTimeout(function () { $('banner').hidden = true; }, 400); }, 5000);
  if (S.notif && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(NOM, { body: t, icon: './icons/laura-192.png' }); } catch (e) {}
  }
}
$('banner').addEventListener('click', function () { $('banner').classList.remove('show'); montrerChat(false); });

function rafraichir() {
  if (estLocal()) return window.CreateBot ? CreateBot.rafraichir() : Promise.resolve();
  if (!S.conv) { S.attente = false; etatLigne(''); return Promise.resolve(); }
  var n = S.conv;
  return Promise.all([api(D() + '/issues/' + n), tousCommentaires(n)]).then(function (r) {
    if (n !== S.conv) return;
    var issue = r[0], items = [];
    var titre = String(issue.title || ''), corps = String(issue.body || '');
    var reacts = {}, ids = {};
    var ajR = function (cle, em) { (reacts[cle] = reacts[cle] || []).push(em); };
    items.push({ cle: 'i' + issue.number, genre: issue.user && issue.user.type === 'Bot' ? 'tx' : 'moi', date: issue.created_at, corps: corps.indexOf(titre) === 0 ? corps : (corps ? '**' + titre + '**\n\n' + corps : titre) });
    reactionsGithub(issue.reactions).forEach(function (em) { ajR('i' + issue.number, em); });
    r[1].forEach(function (c) { ids[String(c.id)] = 1; });
    r[1].forEach(function (c) {
      var b = String(c.body || ''), genre;
      /* Appel vocal : jamais de bulle dans le chat, mais gardé pour la continuité (historique, robot). */
      var ap = appelDe(b);
      if (ap || /<!--\s*fsm-appel-lent/.test(b)) {
        items.push({ cle: 'c' + c.id, genre: 'appel', cache: true, date: c.created_at, corps: b, appel: ap || { tom: '', laura: '', tache: true, lent: true } });
        return;
      }
      if (c.user && c.user.type === 'Bot') genre = b.indexOf('robot-progress') >= 0 ? 'encours' : b.indexOf('robot-commande') >= 0 ? 'note' : 'tx';
      else if (b.indexOf('<!-- fsm-laura') >= 0) genre = 'tx';
      else genre = b.trim().charAt(0) === '/' ? 'ordre' : 'moi';
      if (genre === 'encours') noterProgres(b, c.updated_at || c.created_at);
      if (genre === 'encours' || genre === 'note') {
        /* indicateur dédié plutôt qu’une bulle de statut */
        return;
      }
      var it = { cle: 'c' + c.id, genre: genre, date: c.created_at, corps: b };
      if (genre === 'tx' && b.indexOf('fsm-reagir') >= 0) {
        reactionsMarqueurs(b).forEach(function (x) {
          var id = String(x.id).replace(/^#/, ''), cle;
          if (/^[ic]\d+$/.test(id)) cle = id;
          else if (/^\d+$/.test(id)) cle = ids[id] ? 'c' + id : (Number(id) === issue.number ? 'i' + id : 'c' + id);
          if (cle && x.emoji) ajR(cle, x.emoji);
        });
        if (corpsVisibleVide(b)) it.cache = true;
      }
      if (genre === 'tx' && b.indexOf('fsm-appel-reponse') >= 0) { it.cache = true; it.direAppel = true; }
      reactionsGithub(c.reactions).forEach(function (em) { ajR('c' + c.id, em); });
      items.push(it);
    });
    items.forEach(function (it) {
      var l = reacts[it.cle] || [], vu = {};
      it.react = l.filter(function (em) { var k = normEmo(em); if (vu[k]) return false; vu[k] = 1; return true; });
    });
    var utiles = items.filter(function (i) { return i.genre !== 'ordre' && !(i.genre === 'appel' && !i.appel.tache); });
    var dernier = utiles[utiles.length - 1];
    var attend = (!!dernier && (dernier.genre === 'moi' || dernier.genre === 'appel' || (dernier.genre === 'tx' && dernier.corps.indexOf('<!-- fsm-laura tache') >= 0))) || S.file.length > 0;
    S.items = items;
    S.attente = attend;
    majFil(items);
    if (window.PCTom) { try { PCTom.apresRafraichir(n, titre, items); } catch (e) {} }
    var premier = !S.pret;
    S.pret = true;
    if (premier) reprendreConv(n, r[1], items);
    if (attend) return etatActions();
    etatLigne('');
  });
}
function boucle() {
  clearTimeout(S.minuteur); arreterTic(S.minuteur);
  if (!S.jeton) return;
  /* iOS / appli installée : au lancement, document.hidden peut être vrai.
     choisir() a déjà vidé le fil et affiché le chat : il faut quand même
     charger l'historique. On ne saute que le sondage de fond, une fois l'histoire à l'écran.
     L'appel vocal continue même fenêtre cachée. */
  var histoireDue = !!(S.conv && !estLocal() && !S.pret);
  if (document.hidden && !S.modeVocal && !histoireDue) return;
  /* une seule tournée à la fois : pas d’empilement de requêtes ni de rendus */
  if (S._tourne) { S._rejouer = true; return; }
  S._tourne = true; S._rejouer = false;
  var suite = function () {
    S._tourne = false;
    if (S._rejouer) { S._rejouer = false; boucle(); return; }
    var d = S.attente ? (S.modeVocal ? 1500 : 4000) : 20000;
    S.minuteur = (S.modeVocal && document.hidden) ? minuterieFiable(boucle, d) : setTimeout(boucle, d);
  };
  var p = rafraichir();
  if (Date.now() - S.convsVues > 30000) p = p.then(chargerConvs);
  p.then(function () { suite(); }, function (e) { if (e && e.status === 401) alerte(e.message); else if (!S._errVue || Date.now() - S._errVue > 30000) { S._errVue = Date.now(); alerte(e.message); } suite(); });
}
document.addEventListener('visibilitychange', function () { if (!document.hidden) boucle(); });
['touchstart', 'wheel', 'pointerdown'].forEach(function (ev) { var f = $('fil'); if (f) f.addEventListener(ev, function () { S._colle = 0; }, { passive: true }); });
function noterFil() {
  var f = $('fil');
  if (!f || !S.pret || !S.conv || estLocal() || S.ecran !== 'chat' || $('chatView').hidden) return;
  var bas = f.scrollHeight - f.scrollTop - f.clientHeight < 140, top = f.getBoundingClientRect().top, cle = '', off = 0;
  if (!bas) {
    var l = f.querySelectorAll('article[data-cle]');
    for (var i = 0; i < l.length; i++) {
      var b = l[i].getBoundingClientRect();
      if (b.bottom > top && l[i].dataset.cle.charAt(0) !== 'l') { cle = l[i].dataset.cle; off = b.top - top; break; }
    }
  }
  Reprise.ecrire('si_fil:' + S.conv, { bas: bas || !cle, cle: cle, off: Math.round(off), t: Date.now() });
}
(function () { var f = $('fil'), tm = 0; if (f) f.addEventListener('scroll', function () { clearTimeout(tm); tm = setTimeout(noterFil, 250); }, { passive: true }); })();
function noterBrouillon() {
  if (!S.conv || estLocal()) return;
  var v = $('texte').value;
  if (v.trim()) mem.ecrire('si_brouillon:' + S.conv, v); else mem.oter('si_brouillon:' + S.conv);
}
$('texte').addEventListener('input', noterBrouillon);
window.addEventListener('pagehide', function () { S._quitte = true; noterFil(); noterBrouillon(); });
window.addEventListener('beforeunload', function () { S._quitte = true; });
window.addEventListener('pageshow', function (e) { S._quitte = false; if (e.persisted || !document.hidden) boucle(); });
document.addEventListener('visibilitychange', function () { if (document.hidden) { noterFil(); noterBrouillon(); } });
/* Après le premier rendu d’une conversation : renvoyer ce qui n’est jamais parti, relancer une réponse coupée. */
function reprendreConv(n, commentaires, items) {
  var deja = {};
  (commentaires || []).forEach(function (c) { var m = /<!--\s*fsm-uid:\s*([\w-]+)\s*-->/.exec(String(c.body || '')); if (m) deja[m[1]] = 1; });
  var enFile = {};
  S.file.forEach(function (j) { if (j.uid) enFile[j.uid] = 1; });
  Reprise.boite().forEach(function (x) {
    if (x.conv !== n || enFile[x.uid]) return;
    if (deja[x.uid]) { Reprise.oter(x.uid); return; }   /* parti avant la fermeture : rien à refaire */
    var job = { id: bulleLocale(x.texte), texte: x.corps, conv: n, suitCreation: false, essais: 0, uid: x.uid };
    S.attente = true;
    var envoi = new Promise(function (ok, ko) { job.ok = ok; job.ko = ko; S.file.push(job); pomper(); });
    if (x.texte.charAt(0) !== '/') repondreVite(x.texte, envoi);
    envoi.catch(function () {});
  });
  var r = Reprise.lire('si_rapide', null);
  if (r && r.conv === n) {
    mem.oter('si_rapide');
    var utiles = (items || []).filter(function (i) { return i.genre === 'moi' || i.genre === 'tx'; });
    var dern = utiles[utiles.length - 1];
    /* moins de 25 s : on relance la réponse coupée ; au-delà, le robot (30 s) prend le relais tout seul */
    if (dern && dern.genre === 'moi' && Date.now() - r.t < 25000 && !S._rapideNode) repondreVite(r.texte, Promise.resolve());
  }
}


/* ---------- Statut Actions ---------- */
/* Ligne d’état en direct (comme Grok Bot) : points gris animés + ce que Laura fait, court et en français.
   L’étape réelle du robot (commentaire de progression) d’abord ; sinon des libellés qui évoluent avec le temps. */
function libelleEtape(l) {
  var t = String(l || '').replace(/^[-*\s]+/, '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{2190}-\u{21FF}]/gu, '').trim();
  var low = t.toLowerCase(), outil = (t.split('·')[1] || '').trim().toLowerCase();
  var R = [[/^recherche|web_search|chercher_web|recherche/, 'Fait des recherches'], [/^code|coder|ecrire_fichier|modifier|patch|remplacer/, 'Modifie le code'],
    [/^navigateur|navig|browser/, 'Navigue sur le web'], [/^test|tester/, 'Teste le résultat'], [/^projet/, 'Ouvre le projet'],
    [/^mémoris|memoriser|memoire/, 'Met à jour la mémoire'], [/validation|demander_action/, 'Attend ta validation'], [/besoin de tom/, 'Attend ton aide'],
    [/^veille/, 'Met en place une veille'], [/terminal|commande|shell|bash|executer/, 'Exécute quelques commandes'], [/lire|fichier|lister|chercher/, 'Lit les fichiers'],
    [/bug|erreur|corrig/, 'Enquête sur les bugs'], [/faille|sécur|secur/, 'Ferme les failles'], [/ordinateur|ecran|écran|capture|clic/, 'Travaille sur l’ordinateur'],
    [/note vocale/, 'Écoute ta note'], [/bot créé|deleguer|@/, 'Délègue à un bot'], [/planifi/, 'Planifie la tâche']];
  for (var i = 0; i < R.length; i++) if (R[i][0].test(outil) || R[i][0].test(low)) return R[i][1];
  t = t.split(' : ')[0].split(' — ')[0];
  return t.length > 3 && t.length <= 36 ? t : '';
}
function noterProgres(corps, quand) {
  var lignes = String(corps || '').split('\n').filter(function (x) { return /^\s*-\s+\S/.test(x); });
  var lib = lignes.length ? libelleEtape(lignes[lignes.length - 1]) : '';
  var t = Date.parse(quand || '') || 0;
  if (lib && Date.now() - t < 120000) S._progres = { label: lib, t: Date.now() };
}
function libelleTravail() { return libelleEtat('travail'); }
function etatLigne(txt) {
  txt = String(txt || '');
  if (txt === 'S’en occupe' || txt === 'travail') txt = libelleEtat('travail');
  else if (txt === 'pese') txt = libelleEtat('pese');
  else if (txt === 'ecrit' || txt === 'S’en occupe…') txt = libelleEtat('ecrit');
  if (!txt) { clearInterval(S._travailTic); S._travailTic = 0; S._travailDebut = 0; S._progres = null; S._etatGen = false; }
  etatLigneBrut(txt);
}
function etatLigneBrut(txt) {
  var box = $('typing'), stack = $('typingStack');
  clearTimeout(S._etatT);
  txt = String(txt || '');
  if (!txt) {
    box.hidden = true;
    S.runEtat = '';
    if (stack) {
      stack.textContent = '';
      var em0 = document.createElement('em');
      em0.id = 'typingText';
      em0.className = 'cur';
      stack.appendChild(em0);
    }
    placeScrollDown();
    return;
  }
  box.hidden = false;
  if (S.runEtat === txt) { placeScrollDown(); return; }
  S.runEtat = txt;
  if (!stack) { placeScrollDown(); return; }
  var cur = stack.querySelector('em.cur') || stack.querySelector('em');
  if (!cur) {
    cur = document.createElement('em');
    cur.id = 'typingText';
    cur.className = 'cur';
    stack.appendChild(cur);
  }
  /* échange instantané, sans fondu (relevé Grok Bot) */
  Array.prototype.forEach.call(stack.querySelectorAll('em.out'), function (n) { n.remove(); });
  cur.id = 'typingText';
  cur.className = 'cur';
  cur.textContent = txt;
  placeScrollDown();
}
function etatActions() {
  return api(D() + '/actions/runs?per_page=5').then(function (d) {
    var runs = (d && d.workflow_runs) || [];
    var run = runs.find(function (r) { return r.status === 'queued' || r.status === 'in_progress' || r.status === 'waiting' || r.status === 'pending'; });
    if (!run) {
      if (S.attente) etatLigne('S’en occupe');
      else etatLigne('');
      return;
    }
    if (run.status === 'queued' || run.status === 'waiting' || run.status === 'pending') {
      etatLigne('S’en occupe');
      return;
    }
    /* in_progress : lire jobs/steps si possible */
    return api(D() + '/actions/runs/' + run.id + '/jobs').then(function (j) {
      var jobs = (j && j.jobs) || [];
      var step, job;
      jobs.forEach(function (jb) {
        if (jb.status !== 'in_progress' && jb.status !== 'queued') return;
        job = jb;
        (jb.steps || []).forEach(function (s) {
          if (s.status === 'in_progress') step = s;
        });
      });
      var nom = ((step && step.name) || (job && job.name) || '').trim();
      var low = nom.toLowerCase();
      if (/écrit|ecrit|write|reply|répond|repond|comment|message/i.test(low)) etatLigne('ecrit');
      else etatLigne('travail');
    }).catch(function () { etatLigne('travail'); });
  }).catch(function () {
    if (S.attente) etatLigne('S’en occupe');
  });
}

/* ---------- Envoi ---------- */
/* Le champ de saisie n’est JAMAIS désactivé, recréé ni privé du focus :
   chaque envoi part dans une file (ordre garanti) et s’affiche tout de suite. */
var _tailleRaf = 0;
function taille() {
  if (_tailleRaf) return;
  _tailleRaf = requestAnimationFrame(function () {
    _tailleRaf = 0;
    var t = $('texte');
    var max = ($('composer').classList.contains('full') ? window.innerHeight : window.innerHeight * 0.38);
    var avant = t.style.height;
    t.style.height = 'auto';
    var h = Math.min(t.scrollHeight + 2, max) + 'px';
    t.style.height = h;
    if (avant !== h) placeScrollDown();
  });
  majSendIcon();
}
function majSendIcon() {
  var has = !!($('texte').value.trim() || S.pending.length);
  if (S._hasTxt === has) return;
  S._hasTxt = has;
  var wave = $('sendBtn').querySelector('.ico-wave');
  if (wave) wave.classList.toggle('hidden', has);
  $('sendBtn').querySelector('.ico-send').classList.toggle('hidden', !has);
  $('sendBtn').classList.toggle('has-text', has);
  $('sendBtn').setAttribute('aria-label', has ? 'Envoyer' : 'Mode vocal');
  var ex = $('expandBtn');
  if (ex) ex.classList.toggle('hidden', !has);
}
S.file = []; S.fileSeq = 0;
function bulleLocale(texte) {
  var id = 'l' + (++S.fileSeq);
  var node = document.createElement('article');
  node.className = 'msg me local envoi neuf';
  node.dataset.cle = id; node.dataset.qui = 'me';
  node.dataset.texte = texteBrut(piecesDe(texte).reste);
  node._corps = texte;
  node.innerHTML = (estNoteVocale(texte) ? bulleNoteVocale(transcriptionPourNote(texte)) : contenuHtml(texte, true)) + '<time>' + esc(heure(new Date())) + '</time>';
  var fil = $('fil');
  fil.appendChild(node);
  S.els[id] = node;
  brancher(node);
  majEspacesReact();
  requestAnimationFrame(function () { fil.scrollTop = fil.scrollHeight; majScrollBtn(); });
  return id;
}
function envoyer(texte, opts) {
  texte = String(texte || '').trim();
  if (!texte) return Promise.resolve();
  if (estLocal()) {
    var id = S.conv;
    bulleLocale(texte);
    if (window.CreateBot) CreateBot.ajouterMsg(id, 'moi', texte);
    var b = window.CreateBot && CreateBot.botDe(id);
    var hist = ((b && b.messages) || []).map(function (m) {
      return { role: m.genre === 'moi' ? 'user' : 'assistant', content: String(m.corps || '') };
    }).slice(-16);
    if (window.LauraRapide && S.jeton) {
      var node = null;
      etatLigne('travail');
      return LauraRapide.discuter(S.jeton, { messages: hist, mode: window.LauraMode ? LauraMode.actif() : 'fsmsi' }, function (txt) {
        if (S.conv !== id) return;
        etatLigne('ecrit');
        /* pas de défilement mot à mot : on attend la réponse complète */
      }, function (phase) { if (phase === 'outil') etatLigne('travail'); }).then(function (r) {
        var txt = String((r && r.texte) || '').replace(/\[\[TACHE\]\]/g, '').trim();
        if (txt) node = afficherReponseComplete(txt);
        if (txt && window.CreateBot) CreateBot.ajouterMsg(id, 'tx', txt);
        if (window.CreateBot) return CreateBot.rafraichir();
      }).then(function () { if (node && node.parentNode && node.classList.contains('rapide')) { /* CreateBot.rafraichir reprend la bulle si possible */ } }, function () { if (node && node.parentNode && node.classList.contains('rapide') && !node.dataset.cle) node.remove(); etatLigne(''); });
    }
    return Promise.resolve();
  }
  if (!S.conv && texte.charAt(0) === '/') { alerte('Ouvre d’abord une conversation : les commandes s’envoient dedans.'); return Promise.resolve(); }
  var creationDevant = S.file.some(function (j) { return !j.conv; });
  /* le cerveau (Laura FSM SI) voyage avec le message : le robot prend le même */
  var uid = Reprise.uid();
  var job = { id: bulleLocale(texte), texte: (window.LauraMode ? LauraMode.marquer(texte) : texte) + '\n<!-- fsm-uid: ' + uid + ' -->', conv: S.conv, suitCreation: !S.conv || creationDevant, essais: 0, uid: uid };
  Reprise.garder({ uid: uid, conv: S.conv, texte: texte, corps: job.texte, t: Date.now() });
  S.attente = true;
  if (!S.runEtat) etatLigne('S’en occupe');
  var envoi = new Promise(function (ok, ko) { job.ok = ok; job.ko = ko; S.file.push(job); pomper(); });
  /* Voie rapide en parallèle de l’envoi : Laura répond tout de suite ; sa réponse est postée après le message de Tom. */
  if (texte.charAt(0) !== '/' && !(opts && opts.sansRapide)) repondreVite(texte, envoi, opts && opts.images);
  return envoi;
}
/* Voie rapide : Worker fsm-si-proxy toujours allumé. Laura répond tout de suite, même pendant une tâche.
   Réponse postée avec le marqueur fsm-laura ; « fsm-laura tache » demande au robot GitHub de faire le travail.
   En cas d’échec, rien n’est posté : le robot GitHub répond comme avant. */
function texteLeger(md) {
  return String(md || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<details>[\s\S]*?<\/details>/g, '').replace(/<sub>[\s\S]*?<\/sub>/g, '').trim().slice(0, 6000);
}
function histoireRapide() {
  if (!S.conv) return [];
  var l = [];
  (S.items || []).forEach(function (i) {
    if (i.genre === 'appel') {
      if (i.appel.tom) l.push({ role: 'user', content: '🎤 (au téléphone) ' + i.appel.tom });
      if (i.appel.laura) l.push({ role: 'assistant', content: i.appel.laura });
    } else if (i.genre === 'tx' && resumeAppelDe(i.corps)) {
      l.push({ role: 'assistant', content: '[Résumé de l’appel vocal · ' + resumeAppelDe(i.corps).duree + '] ' + texteLeger(i.corps) });
    } else if ((i.genre === 'moi' || i.genre === 'tx') && (!i.cache || i.direAppel)) {
      l.push({ role: i.genre === 'tx' ? 'assistant' : 'user', content: texteLeger(i.corps) });
    }
  });
  /* tours d’appel gardés à l’instant mais pas encore relus depuis GitHub */
  var vus = {};
  (S.items || []).forEach(function (i) { if (i.genre === 'appel') vus[i.appel.tom + '\u0001' + i.appel.laura] = 1; });
  S._vocalLocaux = (S._vocalLocaux || []).filter(function (t) { return !vus[t.tom + '\u0001' + t.laura]; });
  S._vocalLocaux.forEach(function (t) {
    l.push({ role: 'user', content: '🎤 (au téléphone) ' + t.tom });
    l.push({ role: 'assistant', content: t.laura });
  });
  return l.slice(-16);
}
/* Tour d’appel vocal : commentaire 100 % invisible (commentaire HTML), lu par le robot et par la voie rapide. */
function appelDe(b) {
  var m = String(b || '').match(/<!--\s*fsm-appel\s+(\{[\s\S]*?\})\s*-->/);
  if (!m) return null;
  try { var o = JSON.parse(m[1]); return { tom: String(o.tom || ''), laura: String(o.laura || ''), tache: !!o.tache }; } catch (e) { return null; }
}
function corpsAppel(o, mode) {
  var j = JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/--/g, '-\\u002d');
  return '<!-- fsm-appel ' + j + ' -->' + (o.tache ? '' : '\n<!-- fsm-laura vocal -->') + (mode ? '\n<!-- fsm-mode: ' + mode + ' -->' : '');
}
/* Résumé d’appel (comme Grok Bot) : carte « Chat vocal · 01:42 » postée au raccrochage, dans le même fil
   (même stockage que les autres messages), et relue comme contexte par Laura ensuite. */
function resumeAppelDe(b) {
  var m = String(b || '').match(/<!--\s*fsm-resume-appel\s+(\{[\s\S]*?\})\s*-->/);
  if (!m) return null;
  try { var o = JSON.parse(m[1]); return { duree: String(o.duree || '00:00').replace(/[^\d:]/g, '') }; } catch (e) { return null; }
}
function carteResumeAppel(duree, texte) {
  return '<div class="bubble resume-appel"><div class="ra-tete"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v5a4 4 0 0 0 4 4zm7-4a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21a1 1 0 1 0 2 0v-3.08A7 7 0 0 0 19 11z"/></svg>' +
    '<span>Chat vocal · ' + esc(duree) + '</span></div>' + (texte ? '<div class="ra-texte">' + rendre(texte) + '</div>' : '<div class="ra-texte ra-attente">Résumé en cours…</div>') + '</div>';
}
function dureeMMSS(ms) { var s0 = Math.max(0, Math.round(ms / 1000)); var h = Math.floor(s0 / 3600), m = Math.floor(s0 / 60) % 60, s = s0 % 60; return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); }
function resumerAppel() {
  var tours = (S._appelTours || []).filter(function (t) { return t.tom || t.laura; });
  var enCours = S._vocalEnCours;
  if (enCours && enCours.tom && !tours.some(function (t) { return t.tom === enCours.tom; })) tours.push({ tom: enCours.tom, laura: enCours.laura || '' });
  var conv = S.conv, duree = dureeMMSS(Date.now() - (S._vocalDebut || Date.now()));
  var sauves = S._appelSauves || [];
  S._appelTours = []; S._appelSauves = [];
  if (!conv || !tours.length) return;
  var qui = S.moiNom || S.moi || 'Tom';
  var transcription = tours.map(function (t) { return (t.tom ? qui + ' : ' + t.tom : '') + (t.laura ? '\nLaura : ' + t.laura : ''); }).join('\n').slice(-12000);
  /* carte provisoire tout de suite, remplacée par le vrai message dès qu’il est enregistré */
  var prov = document.createElement('article');
  prov.className = 'msg bot local resume-prov neuf';
  prov.innerHTML = carteResumeAppel(duree, '');
  if ($('fil')) { $('fil').appendChild(prov); $('fil').scrollTop = $('fil').scrollHeight; }
  var consigne = 'Voici la transcription d’un appel vocal entre ' + qui + ' et toi, qui vient de se terminer (durée ' + duree + ').\n' +
    'Écris le résumé de cet appel pour le fil de discussion : 2 à 4 phrases courtes, en français, à la 2e personne pour ' + qui + ' (« Tu m’as demandé… »), ' +
    'qui disent de quoi on a parlé, ce qui a été décidé et ce qui reste à faire. Pas de titre, pas de liste, pas de salutation, aucun outil, aucune tâche.\n\n' + transcription;
  var secours = function () {
    var dern = tours[tours.length - 1];
    return 'Appel de ' + duree + ' (' + tours.length + ' échange' + (tours.length > 1 ? 's' : '') + '). Dernier sujet : « ' + String(dern.tom || dern.laura).slice(0, 160) + ' ».';
  };
  var gen = window.LauraRapide && S.jeton
    ? LauraRapide.discuter(S.jeton, { messages: [{ role: 'user', content: consigne }], vocal: false, mode: 'fsmsi' }, function () {}).then(function (r) {
        var t = String((r && r.texte) || '').replace(/\[\[TACHE\]\]/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();
        return t || secours();
      }, secours)
    : Promise.resolve(secours());
  Promise.all([gen, Promise.all(sauves)]).then(function (r) {
    var corps = r[0].slice(0, 1500) + '\n\n<!-- fsm-resume-appel ' + JSON.stringify({ duree: duree, tours: tours.length, fin: new Date().toISOString() }) + ' -->\n<!-- fsm-laura resume-appel -->';
    return api(D() + '/issues/' + conv + '/comments', { method: 'POST', json: { body: corps } });
  }).then(function () { return conv === S.conv ? rafraichir() : null; }).then(function () { prov.remove(); }, function () { prov.remove(); alerte('Résumé de l’appel non enregistré.'); });
}
function afficherReponseComplete(txt) {
  etatLigne('');
  var node = document.createElement('article');
  node.className = 'msg bot rapide neuf';
  node.innerHTML = '<div class="bubble">' + rendre(String(txt || '').replace(/\[\[TACHE\]\]/g, '')) + '</div>';
  if (window.GmailCarte) GmailCarte.cartes(node, String(txt || ''));
  $('fil').appendChild(node);
  S._rapideNode = node;
  animerFil(mouvementReduit() ? 0 : 250);
  return node;
}
function repondreVite(texte, envoiTom, images) {
  if (!window.LauraRapide || !S.jeton) return;
  var conv0 = S.conv;
  var hist = histoireRapide();
  var moiTxt = images && images.length ? (texteLeger(piecesDe(texte).reste) || (images.length > 1 ? 'Regarde ces images.' : 'Regarde cette image.')) : texteLeger(texte);
  if (!hist.length || hist[hist.length - 1].content !== moiTxt) hist.push({ role: 'user', content: moiTxt });
  var encours = S.runEtat && !S._etatGen && S.runEtat !== 'S’en occupe' ? S.runEtat : (S._tacheEnCours || '');
  var node = null;
  /* Lecture à voix haute (réglage « voix ») : la première phrase part pendant que le texte s’écrit encore. */
  var lect = S.voix && !S.modeVocal && LauraRapide.voix ? LauraRapide.voix.lecteur(S.jeton) : null;
  var marque = Reprise.uid();
  if (conv0) Reprise.ecrire('si_rapide', { id: marque, conv: conv0, texte: texte, t: Date.now() });
  var nettoyer = function () {
    /* ne retirer que si la bulle n'a pas déjà été reprise par majFil (sinon on efface la réponse officielle) */
    if (node && node.parentNode && node.classList.contains('rapide') && !node.dataset.cle) node.remove();
    if (S._rapideNode === node) S._rapideNode = null;
    /* page qui se ferme ou se recharge : on garde la marque, la relance reprendra la réponse */
    if (!S._quitte && (Reprise.lire('si_rapide', {}) || {}).id === marque) mem.oter('si_rapide');
  };
  var modeLaura = window.LauraMode ? LauraMode.actif() : 'fsmsi';
  etatLigne('travail');
  if (S._etatPeseT) clearTimeout(S._etatPeseT);
  S._etatPeseT = setTimeout(function () { if (!node && S.runEtat && !S.modeVocal) etatLigne('pese'); }, 1800);
  LauraRapide.discuter(S.jeton, { messages: hist, vocal: !!S.modeVocal, encours: encours, mode: modeLaura, conv: typeof conv0 === 'number' && conv0 > 0 ? conv0 : undefined, images: images && images.length ? images : undefined }, function (txt) {
    if (conv0 && S.conv !== conv0) return;
    if (lect) lect.pousser(txt.replace(/\[\[TACHE\]\]/g, ''));
    if (S._etatPeseT) { clearTimeout(S._etatPeseT); S._etatPeseT = 0; }
    if (!S.modeVocal) etatLigne('ecrit');
    /* pas de bulle mot à mot : le texte s'accumule, la bulle n'apparaît que complète */
  }, function (phase) {
    if (conv0 && S.conv !== conv0) return;
    if (phase === 'outil') { if (S._etatPeseT) { clearTimeout(S._etatPeseT); S._etatPeseT = 0; } etatLigne('travail'); }
  }).then(function (r) {
    window.SI_RAPIDE = r.fin; /* mesure : premier mot, modèle, replis */
    if (lect) lect.finir();
    var corps = r.texte.replace(/\[\[TACHE\]\]/g, '').trim() + '\n\n<!-- fsm-laura' + (r.fin.tache ? ' tache' : '') + ' -->' +
      '\n<!-- fsm-par: ' + (r.fin.mode === 'grok' || (!r.fin.mode && modeLaura === 'grok') ? 'grok' : 'fsmsi') + ' ' + String(r.fin.modele || '').replace(/[^\w./:-]/g, '') + ' -->';
    if (r.fin.tache) S._tacheEnCours = moiTxt.slice(0, 200);
    if (!S.modeVocal && r.texte && r.texte.replace(/\[\[TACHE\]\]/g, '').trim()) {
      node = afficherReponseComplete(r.texte.replace(/\[\[TACHE\]\]/g, '').trim());
    } else {
      etatLigne('');
    }
    return envoiTom.then(function () {
      var conv = conv0 || S.conv;
      if (!conv) throw new Error('sans conversation');
      return api(D() + '/issues/' + conv + '/comments', { method: 'POST', json: { body: corps } }).then(function (c) { Reprise.recent(conv, c); return c; });
    }).then(function () { return rafraichir(); });
  }).then(nettoyer, function () { nettoyer(); if (lect) lect.finir(); if (S.attente) etatLigne('travail'); });
}
/* Crochets pour le PC de Tom (pc.js) : suite de Laura après une action validée, à l'écrit ou en appel. */
window.FSMChat = {
  jeton: function () { return S.jeton; }, conv: function () { return S.conv; }, depot: function () { return S.depot; },
  enAppel: function () { return !!S.modeVocal; }, texteLeger: texteLeger, envoyer: envoyer,
  api: function (chemin, o) { return api(chemin, o); },
  /* texte caché (résultat) : Laura continue tout de suite ; sa réponse est postée comme d'habitude */
  continuer: function (texteCache, images) { repondreVite(texteCache, Promise.resolve(), images); },
  continuerVocal: function (texteCache) { if (!S.modeVocal) return false; vocalDirect(null, '', texteCache); return true; },
  posterDans: function (conv, corps) { return api(D() + '/issues/' + conv + '/comments', { method: 'POST', json: { body: corps } }); }
};
function pomper() {
  if (S.envoi || !S.file.length) return;
  var job = S.file[0];
  S.envoi = true;
  var conv = job.conv || (job.suitCreation ? S.conv : 0);
  var p = conv
    ? api(D() + '/issues/' + conv + '/comments', { method: 'POST', json: { body: job.texte } })
    : api(D() + '/issues', { method: 'POST', json: { title: job.texte.split('\n')[0].slice(0, 70), body: job.texte } }).then(function (i) {
      S.conv = i.number; mem.ecrire('si_conv', String(i.number));
      chargerConvs().catch(function () {});
      return { issue: i };
    });
  p.then(function (res) {
    S.file.shift(); S.envoi = false;
    if (job.uid) Reprise.oter(job.uid);
    if (conv && res && res.id) Reprise.recent(conv, res);
    var node = S.els[job.id];
    if (node) {
      delete S.els[job.id];
      var cle = res && res.id ? 'c' + res.id : (res && res.issue ? 'i' + res.issue.number : '');
      node.classList.remove('local', 'envoi', 'echec');
      if (cle && !S.els[cle]) {
        S.els[cle] = node; node.dataset.cle = cle; if (res.body != null) node._corps = res.body;
        (S.garde = S.garde || {})[cle] = Date.now() + 30000;
      }
      else if (cle) node.remove();
    }
    S.attente = true;
    if (job.ok) job.ok();
    boucle();
    pomper();
  }, function (e) {
    S.envoi = false;
    job.essais++;
    var node = S.els[job.id];
    if (e && e.status !== 401 && e.status !== 403 && e.status !== 404 && job.essais < 4) {
      setTimeout(pomper, 1200 * job.essais);
      return;
    }
    S.file.shift();
    if (node) {
      node.classList.remove('envoi');
      node.classList.add('echec');
      node.title = 'Non envoyé : touche pour réessayer';
      node.onclick = function () {
        node.onclick = null; node.classList.remove('echec'); node.classList.add('envoi');
        job.essais = 0; S.file.push(job); pomper();
      };
    }
    alerte(e.message);
    if (job.ko) job.ko(e);
    pomper();
  });
}
function envoyerSaisie() {
  var t = $('texte'), v = t.value;
  var pieces = S.pending.slice();
  var msgBase = v;
  if (S.reponse && S.reponse.texte) {
    var q = String(S.reponse.texte).replace(/\s+/g, ' ').trim().slice(0, 280);
    if (q) msgBase = '« ' + q + ' »\n\n' + msgBase;
    fermerReponse();
  }
  /* vider tout de suite, sans toucher au focus ni au DOM du composer */
  t.value = '';
  if (S.conv) mem.oter('si_brouillon:' + S.conv);
  try { t.setSelectionRange(0, 0); } catch (e) {}
  t.scrollTop = 0;
  S._dernEnvoi = Date.now();
  S.pending = [];
  $('attachments').textContent = '';
  $('attachments').classList.add('hidden');
  taille();
  if ($('composer').classList.contains('full')) setFullCompose(false);
  if (pieces.length) {
    var vision = imagesVision(pieces);
    return Promise.all([uploaderPieces(pieces), vision]).then(function (r) {
      pieces.forEach(function (p) { if (p.url && !p.garde) URL.revokeObjectURL(p.url); });
      return envoyer((msgBase.trim() + r[0]).trim(), { images: r[1] });
    }).catch(function (e) { alerte(e.message); if (!t.value) { t.value = v; taille(); } });
  }
  return envoyer(msgBase).then(function () {}, function () {});
}
/* le bouton ne vole jamais le focus du champ (le clavier reste ouvert) */
$('sendBtn').addEventListener('mousedown', function (e) { e.preventDefault(); });
$('micBtn').addEventListener('mousedown', function (e) { e.preventDefault(); });
$('sendBtn').addEventListener('click', function () {
  if ($('texte').value.trim() || S.pending.length) envoyerSaisie();
  else if (Date.now() - (S._dernEnvoi || 0) > 700) ouvrirModeVocal();
});
$('micBtn').addEventListener('click', function () { dicterOuEnregistrer(); });
$('texte').addEventListener('input', taille);
$('texte').addEventListener('keydown', function (e) {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); if ($('texte').value.trim() || S.pending.length) envoyerSaisie(); }
});

/* ---------- Fichiers ---------- */
S.pending = [];
function viderPieces() {
  S.pending.forEach(function (p) { if (p.url) URL.revokeObjectURL(p.url); });
  S.pending = [];
  $('attachments').textContent = '';
  $('attachments').classList.add('hidden');
  majSendIcon();
}
function fmtDur(s) {
  s = Math.round(s || 0);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function ajouterFichier(file) {
  if (file.size > MAX_FILE) { alerte(file.name + ' dépasse 25 Mo : trop gros pour l’envoi par le navigateur.'); return; }
  var it = { file: file, url: URL.createObjectURL(file), type: file.type || '' };
  S.pending.push(it);
  var box = el('div', 'att');
  var isVid = /^video\//.test(it.type) || /\.(mp4|webm|mov)$/i.test(file.name);
  var isImg = /^image\//.test(it.type);
  if (isVid) {
    var v = document.createElement('video');
    v.src = it.url; v.muted = true; v.playsInline = true; v.preload = 'metadata';
    box.appendChild(v);
    box.appendChild(el('span', 'play', ''));
    var dur = el('span', 'dur', '0:00');
    box.appendChild(dur);
    v.addEventListener('loadedmetadata', function () { dur.textContent = fmtDur(v.duration); it.dur = v.duration; });
  } else if (isImg) {
    var img = document.createElement('img'); img.onload = function () { it.w = img.naturalWidth; it.h = img.naturalHeight; }; img.src = it.url; img.alt = file.name; box.appendChild(img);
  } else {
    var lab = el('div', 'apercu-nom', file.name);
    lab.style.padding = '20px 12px';
    box.appendChild(lab);
  }
  var rm = el('button', 'rm', '×'); rm.type = 'button'; rm.setAttribute('aria-label', 'Retirer');
  rm.onclick = function () {
    var i = S.pending.indexOf(it);
    if (i >= 0) { if (it.url) URL.revokeObjectURL(it.url); S.pending.splice(i, 1); }
    box.remove();
    if (!S.pending.length) $('attachments').classList.add('hidden');
    majSendIcon();
  };
  box.appendChild(rm);
  $('attachments').appendChild(box);
  $('attachments').classList.remove('hidden');
  majSendIcon();
}
/* Vision : chaque image jointe part aussi à la voie rapide (réduite à 1568 px, JPEG) pour que Laura la voie tout de suite */
function imagesVision(liste) {
  var imgs = liste.filter(function (it) { return it.url && /^image\/(png|jpe?g|webp|gif|heic|heif|avif)/i.test(it.file.type || '') || RE_IMG.test(it.file.name || ''); }).slice(0, 4);
  return Promise.all(imgs.map(function (it) {
    return new Promise(function (ok) {
      var im = new Image();
      im.onload = function () {
        try {
          var k = Math.min(1, 1568 / Math.max(im.naturalWidth, im.naturalHeight));
          var w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
          ok(c.toDataURL('image/jpeg', 0.85));
        } catch (e) { ok(''); }
      };
      im.onerror = function () { ok(''); };
      im.src = it.url;
    });
  })).then(function (l) { return l.filter(Boolean); });
}
function safeName(n) { return String(n).replace(/[^\w.\-]+/g, '_').slice(0, 80); }
function uploaderPieces(liste) {
  liste = liste || S.pending;
  var folder = S.conv ? String(S.conv) : 'nouveau';
  var ts = new Date().toISOString().replace(/[:.]/g, '-');
  var lignes = [], dimsPj = [];
  var seq = Promise.resolve();
  liste.forEach(function (it, idx) {
    seq = seq.then(function () {
      return new Promise(function (ok, ko) {
        var r = new FileReader();
        r.onload = function () { ok(String(r.result).split(',')[1] || ''); };
        r.onerror = function () { ko(new Error('Lecture impossible : ' + it.file.name)); };
        r.readAsDataURL(it.file);
      }).then(function (b64) {
        var path = 'entree/' + folder + '/' + ts + '-' + (idx + 1) + '-' + safeName(it.file.name);
        return api(D() + '/contents/' + encP(path), { method: 'PUT', json: { message: 'pièce jointe', content: b64, branch: S.branche } }).then(function () {
          var url = 'https://github.com/' + S.depot + '/blob/' + S.branche + '/' + path;
          lignes.push('- [' + it.file.name + '](' + url + ')');
          /* la vignette du fil réutilise l’image locale : rien à retélécharger */
          if (it.url && RE_IMG.test(path)) { S.blobs[path] = it.url; it.garde = true; if (it.w && it.h) dimsPj.push('<!-- fsm-pj: ' + path + ' ' + it.w + 'x' + it.h + ' -->'); }
        });
      });
    });
  });
  return seq.then(function () {
    return '\n\n📎 **Fichiers joints** (déposés dans le dépôt, à lire dans `entree/`) :\n' + lignes.join('\n') + (dimsPj.length ? '\n' + dimsPj.join('\n') : '');
  });
}
$('attachBtn').onclick = function () { $('fileInput').click(); };
$('fileInput').addEventListener('change', function () {
  Array.prototype.forEach.call(this.files || [], ajouterFichier);
  this.value = '';
});
document.addEventListener('paste', function (e) {
  if (S.ecran !== 'chat') return;
  var items = e.clipboardData && e.clipboardData.files;
  if (!items || !items.length) return;
  Array.prototype.forEach.call(items, ajouterFichier);
});
document.addEventListener('dragover', function (e) { if (S.ecran === 'chat') e.preventDefault(); });
document.addEventListener('drop', function (e) {
  if (S.ecran !== 'chat') return;
  e.preventDefault();
  Array.prototype.forEach.call(e.dataTransfer.files || [], ajouterFichier);
});

/* ---------- Visionneuse ---------- */
function ouvrirMedia(src, video) {
  var box = $('lightbox'), img = box.querySelector('img'), vid = box.querySelector('video');
  clearTimeout(box._t);
  box.classList.remove('open', 'drag', 'retour');
  box.style.transform = ''; box.style.opacity = '';
  box.hidden = false;
  apresPeinture(function () { box.classList.add('open'); });
  if (video) { img.removeAttribute('src'); img.style.display = 'none'; vid.style.display = 'block'; vid.src = src; vid.play().catch(function () {}); }
  else { vid.pause(); vid.removeAttribute('src'); vid.style.display = 'none'; img.style.display = 'block'; img.src = src; }
  box._y = 0;
}
$('lightbox').querySelector('.close').onclick = function () { fermerMedia(); };
function fermerMedia() {
  var box = $('lightbox');
  var vid = box.querySelector('video');
  vid.pause();
  box.classList.remove('drag');
  box.classList.add('retour');
  box.classList.remove('open');
  box.style.opacity = '0';
  clearTimeout(box._t);
  box._t = setTimeout(function () {
    vid.removeAttribute('src');
    box.querySelector('img').removeAttribute('src');
    box.hidden = true;
    box.classList.remove('retour');
    box.style.transform = ''; box.style.opacity = '';
  }, 300);
}
(function () {
  var box = $('lightbox'), y0 = 0, dy = 0, on = false;
  box.addEventListener('touchstart', function (e) { if (e.touches.length !== 1) return; on = true; y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
  var raf = 0;
  box.addEventListener('touchmove', function (e) {
    if (!on) return;
    dy = e.touches[0].clientY - y0;
    box.classList.add('drag');
    if (!raf) raf = requestAnimationFrame(function () {
      raf = 0;
      var d = Math.max(0, dy);
      box.style.transform = 'translate3d(0,' + d + 'px,0)';
      box.style.opacity = String(Math.max(0.35, 1 - d / 600));
    });
  }, { passive: true });
  box.addEventListener('touchend', function () {
    if (!on) return; on = false;
    box.classList.remove('drag');
    if (dy > 80) fermerMedia();
    else { box.classList.add('retour'); box.style.transform = ''; box.style.opacity = ''; setTimeout(function () { box.classList.remove('retour'); }, 320); }
  });
})();
$('fil').addEventListener('click', function (e) {
  var v = e.target.closest('.vid-wrap');
  if (v) {
    var vid = v.querySelector('video');
    if (vid && vid.src) ouvrirMedia(vid.src, true);
    return;
  }
  var im = e.target.closest('img.vue');
  if (im && im.src) ouvrirMedia(im.src, false);
});


/* ---------- Voix ---------- */
var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null, enr = null, recFlux = null, swipeCancel = 0;
function dicter() {
  if (!SR) { enregistrer(); return; }
  var acquis = $('texte').value ? $('texte').value.replace(/\s*$/, ' ') : '';
  rec = new SR();
  rec.lang = 'fr-FR'; rec.interimResults = true; rec.continuous = true;
  rec.onresult = function (e) {
    var prov = '';
    for (var i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) acquis += e.results[i][0].transcript; else prov += e.results[i][0].transcript; }
    $('texte').value = acquis + prov; taille();
  };
  rec.onerror = function (e) {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { S.note = true; mem.ecrire('si_note', '1'); alerte('Dictée refusée par le navigateur : le micro enregistre maintenant des notes vocales.'); enregistrer(); }
  };
  rec.onend = function () { rec = null; };
  rec.start();
}
function afficherVoix(on) {
  $('composeRow').hidden = on;
  $('voiceBar').hidden = !on;
  $('voiceHint').hidden = !on;
}
function onde(stream) {
  try {
    var ac = new (window.AudioContext || window.webkitAudioContext)();
    var src = ac.createMediaStreamSource(stream);
    var an = ac.createAnalyser(); an.fftSize = 64;
    src.connect(an);
    var data = new Uint8Array(an.frequencyBinCount);
    var cv = $('wave'), ctx = cv.getContext('2d');
    S._wave = true;
    (function loop() {
      if (!S._wave) { ac.close && ac.close(); return; }
      an.getByteTimeDomainData(data);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = '#C24E00'; ctx.lineWidth = 2; ctx.beginPath();
      var sl = cv.width / data.length;
      for (var i = 0; i < data.length; i++) {
        var y = (data[i] / 255) * cv.height;
        if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(i * sl, y);
      }
      ctx.stroke();
      requestAnimationFrame(loop);
    })();
  } catch (e) {}
}
function enregistrer() {
  if (!navigator.mediaDevices || !window.MediaRecorder) { alerte('Ce navigateur ne sait pas enregistrer le micro. Utilise la dictée du clavier.'); return; }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function (flux) {
    recFlux = flux;
    var morceaux = [];
    enr = new MediaRecorder(flux);
    enr.ondataavailable = function (e) { if (e.data && e.data.size) morceaux.push(e.data); };
    enr.onstop = function () {
      S._wave = false;
      flux.getTracks().forEach(function (t) { t.stop(); });
      afficherVoix(false);
      if (S._annulerVoix) { S._annulerVoix = false; enr = null; return; }
      var type = enr.mimeType || 'audio/mp4'; enr = null;
      if (window.LauraRapide && S.jeton) {
        var blobQ = new Blob(morceaux, { type: type });
        etatLigne('Écoute ta note');
        LauraRapide.transcrire(S.jeton, blobQ).then(function (t) {
          t = String(t || '').trim();
          if (!t) { etatLigne(''); alerte('Je n’ai rien entendu, tu peux répéter ?'); return; }
          return envoyer('🎤 Note vocale : « ' + t.replace(/[«»]/g, '"') + ' »');
        }).catch(function () { envoyerNoteLente(morceaux, type); });
        return;
      }
      envoyerNoteLente(morceaux, type);
    };
    enr.start();
    afficherVoix(true);
    onde(flux);
  }).catch(function () { alerte('Micro refusé : autorise-le dans les réglages du navigateur.'); });
}
function envoyerNoteLente(morceaux, type) {
  var ext = /webm/.test(type) ? 'webm' : /ogg/.test(type) ? 'ogg' : 'm4a';
  var lecteur = new FileReader();
  lecteur.onload = function () {
    var chemin = 'entree/vocal/' + new Date().toISOString().replace(/[:.]/g, '-') + '.' + ext;
    api(D() + '/contents/' + encP(chemin), { method: 'PUT', json: { message: 'note vocale', content: String(lecteur.result).split(',')[1], branch: S.branche } })
      .then(function () { return envoyer('🎤 Note vocale : ' + chemin); }).catch(function (e) { alerte(e.message); });
  };
  lecteur.readAsDataURL(new Blob(morceaux, { type: type }));
}
function dicterOuEnregistrer() {
  if (rec) { rec.stop(); return; }
  if (enr) { enr.stop(); return; }
  /* Micro de qualité (transcription /stt) par défaut ; la dictée du navigateur ne sert que sans enregistreur. */
  if (navigator.mediaDevices && window.MediaRecorder) enregistrer(); else if (SR) dicter(); else enregistrer();
}
$('voiceStop').onclick = function () { S._annulerVoix = true; if (enr) enr.stop(); };
$('voiceSend').onclick = function () { if (enr) enr.stop(); };
(function () {
  var x0 = 0, on = false;
  $('voiceBar').addEventListener('touchstart', function (e) { if (!e.touches[0]) return; on = true; x0 = e.touches[0].clientX; }, { passive: true });
  $('voiceBar').addEventListener('touchmove', function (e) {
    if (!on) return;
    var dx = e.touches[0].clientX - x0;
    if (dx < -70) { on = false; S._annulerVoix = true; if (enr) enr.stop(); }
  }, { passive: true });
  $('voiceBar').addEventListener('touchend', function () { on = false; });
})();
function tauxVoix() {
  var n = prefsVoix().vitesse * 1.02;
  return isFinite(n) ? Math.max(0.7, Math.min(1.5, n)) : 1.02;
}
function dire(t) {
  if (!t) return;
  if (window.LauraRapide && S.jeton) { LauraRapide.voix.parler(S.jeton, t); return; }
  if (!window.speechSynthesis) return;
  var u = new SpeechSynthesisUtterance(t.slice(0, 1500));
  u.lang = 'fr-FR';
  u.rate = tauxVoix();
  var v = choisirVoixFeminine();
  if (v) u.voice = v;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}

/* ---------- Mode vocal (pastille flottante, en direct) ---------- */
S.modeVocal = false;
S.vocalMuet = false;
S.vocalEtat = 'idle';
S._vocalRec = null;
S._vocalFlux = null;
S._vocalAn = null;
S._vocalAc = null;
S._vocalNiveau = 0;
S._vocalCible = 0;
S._vocalAnim = 0;
S._vocalDernier = '';
S._vocalCoupe = false;
S._vocalKeep = 0;
S._vocalRelance = 0;
S._vocalFinal = '';
S._vocalSilence = 0;
S._vocalSpeakAt = 0;
S._vocalHaut = 0;

function choisirVoixFeminine() {
  if (!window.speechSynthesis) return null;
  var list = speechSynthesis.getVoices() || [];
  if (!list.length) return null;
  var saved = mem.lire('si_voixnom');
  var i, eviter = /thomas|daniel|paul|nicolas|fred|jean|google français$/i;
  var preferer = /amélie|amelie|audrey|marie|virginie|denise|hortense|julie|claire|florence|flo\b|samantha|anna|héloïse|heloise/i;
  if (saved) {
    for (i = 0; i < list.length; i++) if (list[i].name === saved) return list[i];
  }
  var fr = [];
  for (i = 0; i < list.length; i++) if (/^fr/i.test(list[i].lang)) fr.push(list[i]);
  var pool = fr.length ? fr : list;
  var best = null;
  for (i = 0; i < pool.length; i++) if (preferer.test(pool[i].name) && !eviter.test(pool[i].name)) return pool[i];
  for (i = 0; i < pool.length; i++) if (!eviter.test(pool[i].name) && /^fr/i.test(pool[i].lang)) { best = pool[i]; break; }
  return best || pool[0] || null;
}
if (window.speechSynthesis) {
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener('voiceschanged', function () { choisirVoixFeminine(); remplirVoixPrefs(); });
}

function vocalEtatUI(etat, caption) {
  S.vocalEtat = etat;
  /* comme Grok Bot : pendant que Laura parle, la roue devient « pause » (toucher = l’interrompre) */
  var g = $('voiceGear');
  if (g) {
    var pause = etat === 'speak';
    if (g._pause !== pause) {
      g._pause = pause;
      if (!g._icoRoue) g._icoRoue = g.innerHTML;
      g.innerHTML = pause ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="3.6" height="14" rx="1.2"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2"/></svg>' : g._icoRoue;
      g.setAttribute('aria-label', pause ? 'Interrompre Laura' : 'Réglages de la voix');
    }
  }
  var scr = $('voiceScreen');
  if (!scr) return;
  scr.classList.remove('listen', 'speak', 'wait', 'muted');
  if (S.vocalMuet) scr.classList.add('muted');
  if (etat) scr.classList.add(etat);
  var st = $('voiceState');
  var labels = {
    listen: S.vocalMuet ? 'Micro coupé' : 'Écoute…',
    wait: 'S’en occupe…',
    speak: 'Laura parle…',
    idle: 'Touchez pour parler'
  };
  if (st) st.textContent = labels[etat] || '';
  if (caption != null && $('voiceCaption')) $('voiceCaption').textContent = caption;
}

/* Vague de la barre d’appel : suit le VRAI niveau audio (micro de Tom, ou voix de Laura jouée).
   Silence = rangée de petits points (comme la barre de Grok Bot) ; pas d’animation fixe, pas de bruit de fond. */
var VAGUE_SEUIL = 0.035;
function vocalBarres(niveau) {
  var cv = $('voiceWave');
  if (!cv) return;
  var rect = cv.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  var w = Math.max(2, Math.round((rect.width || 200) * dpr));
  var h = Math.max(2, Math.round((rect.height || 44) * dpr));
  if (cv.width !== w) cv.width = w;
  if (cv.height !== h) cv.height = h;
  var ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  var gap = 2 * dpr;
  var bar = Math.max(3.2 * dpr, 4 * dpr);
  var n = Math.max(10, Math.floor((w + gap) / (bar + gap)));
  var tps = performance.now() / 1000;
  var niveauN = Math.max(0, Math.min(1, niveau || 0));
  if (niveauN < VAGUE_SEUIL) niveauN = 0;
  /* forme : spectre du micro quand Tom parle (au-dessus du plancher de bruit), sinon une ondulation douce */
  var freq = null;
  if (niveauN > 0 && S.vocalEtat !== 'speak' && S._vocalAn && S._vocalFreq) {
    try { S._vocalAn.getByteFrequencyData(S._vocalFreq); freq = S._vocalFreq; } catch (e) { freq = null; }
  }
  var dot = Math.max(3 * dpr, bar);
  for (var i = 0; i < n; i++) {
    var pos = i / Math.max(1, n - 1);
    var forme = 0.6 + 0.4 * Math.sin(tps * 9 + i * 0.6);
    if (freq && freq.length) {
      var idx = Math.min(freq.length - 1, Math.floor((0.04 + pos * 0.5) * freq.length));
      forme = Math.max(0.25, Math.min(1, (freq[idx] - 90) / 120));
    }
    var hon = niveauN * forme;
    var fin = Math.max(2, 2 * dpr);   /* silence : trait fin et immobile */
    var bh = niveauN ? Math.max(dot, dot + hon * (h - dot - 2 * dpr)) : fin;
    var bw = niveauN ? dot : bar + gap * 0.5;
    var x = i * (bar + gap) + (bar - bw) / 2;
    var y = (h - bh) / 2;
    ctx.fillStyle = '#FF2D8A';
    ctx.globalAlpha = niveauN ? 1 : 0.55;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, Math.min(bw, bh) / 2);
    else ctx.rect(x, y, bw, bh);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* niveau du micro (0..1), lu directement sur l’analyseur : indépendant de l’animation */
function niveauMic() {
  var an = S._vocalAnV || S._vocalAn, data = S._vocalAnV ? S._vocalDataV : S._vocalData;
  if (!an || !data) return S._vocalNiveauMic || 0;
  try {
    an.getByteTimeDomainData(data);
    var sum = 0;
    for (var i = 0; i < data.length; i++) { var v = (data[i] - 128) / 128; sum += v * v; }
    return Math.min(1, Math.sqrt(sum / data.length) * 4.2);
  } catch (e) { return 0; }
}
function vocalAnimer(on) {
  cancelAnimationFrame(S._vocalAnim);
  if (!on) { S._vocalNiveau = 0; vocalBarres(0); return; }
  function frame() {
    if (!S.modeVocal) return;
    /* niveau réel : voix de Laura jouée, ou micro de Tom moins le plancher de bruit (rien quand le micro est coupé) */
    var cible = (S.vocalEtat === 'speak' && !(window.LauraRapide && S.jeton)) ? S._vocalCible : 0;   /* voix du navigateur : pas de niveau lisible */
    if (S.vocalEtat === 'speak' && window.LauraRapide && LauraRapide.voix.niveau) cible = Math.max(cible, LauraRapide.voix.niveau());
    if (S._vocalAn && S._vocalData && !S.vocalMuet) {
      try {
        S._vocalAn.getByteTimeDomainData(S._vocalData);
        var sum = 0, data = S._vocalData;
        for (var i = 0; i < data.length; i++) {
          var v = (data[i] - 128) / 128;
          sum += v * v;
        }
        S._vocalNiveauMic = Math.min(1, Math.sqrt(sum / data.length) * 4.2);
        /* pendant que Laura parle, l’écho résiduel du haut-parleur n’anime pas la vague */
        var plancherMic = S.vocalEtat === 'speak' ? 0.22 : 0.08;
        cible = Math.max(cible, Math.max(0, (S._vocalNiveauMic - plancherMic) / (1 - plancherMic)));
      } catch (e) {}
    }
    S._vocalNiveau += (cible - S._vocalNiveau) * (cible > S._vocalNiveau ? 0.45 : 0.2);
    vocalBarres(S._vocalNiveau);
    if (S.vocalEtat === 'speak' && !S.vocalMuet && !S._vocalMr && S._vocalSpeakAt && (performance.now() - S._vocalSpeakAt > 550)) {
      if ((S._vocalNiveauMic || 0) > 0.42) {
        S._vocalHaut += 1;
        if (S._vocalHaut > 10) { S._vocalHaut = 0; vocalInterrompre(); }
      } else S._vocalHaut = 0;
    } else S._vocalHaut = 0;
    S._vocalCible *= 0.88;
    S._vocalAnim = requestAnimationFrame(frame);
  }
  S._vocalAnim = requestAnimationFrame(frame);
}

function vocalCouperMicro() {
  if (S._vocalSrc) { try { S._vocalSrc.disconnect(); } catch (e) {} S._vocalSrc = null; }
  if (S._vocalAc && S._vocalAc.close && !S._vocalAcPartage) try { S._vocalAc.close(); } catch (e) {}
  S._vocalAc = null; S._vocalAn = null; S._vocalData = null; S._vocalFreq = null; S._vocalAnV = null; S._vocalDataV = null;
  if (S._vocalFlux) {
    S._vocalFlux.getTracks().forEach(function (t) { t.stop(); });
    S._vocalFlux = null;
  }
}

/* ---------- Appel vocal en arrière-plan (build 20261111-48) ----------
   L’appel continue quand la fenêtre perd le focus, est cachée ou réduite : rien ne coupe le micro sur blur/hidden.
   - Minuteries fiables : un petit Worker cadence la détection de parole (100 ms) et l’attente des réponses,
     car le navigateur ralentit setTimeout/setInterval des onglets cachés (1 s, puis 1 min après 5 min sur Chrome).
   - Écran gardé allumé (Screen Wake Lock) pendant l’appel : un iPhone qui se verrouille coupe le micro.
   - Retour au premier plan (visible, pageshow, resume) : contextes audio relancés, micro rouvert s’il a été coupé
     par le système, sans rechargement ni perte de la conversation ; petite note à l’écran si c’est arrivé. */
var _ticW = null, _ticN = 0, _ticFn = {};
function _ticWorker() {
  if (_ticW !== null) return _ticW;
  try {
    var src = 'var t={};onmessage=function(e){var d=e.data;if(d.c==="i")t[d.id]=setInterval(function(){postMessage(d.id)},d.ms);' +
      'else if(d.c==="t")t[d.id]=setTimeout(function(){delete t[d.id];postMessage(d.id)},d.ms);else{clearInterval(t[d.id]);clearTimeout(t[d.id]);delete t[d.id];}}';
    _ticW = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    _ticW.onmessage = function (e) { var f = _ticFn[e.data]; if (f) { if (f.une) delete _ticFn[e.data]; try { f.fn(); } catch (x) {} } };
  } catch (e) { _ticW = false; }
  return _ticW;
}
function ticFiable(fn, ms) {
  var w = _ticWorker();
  if (!w) return setInterval(fn, ms);
  var id = 'w' + (++_ticN); _ticFn[id] = { fn: fn }; w.postMessage({ c: 'i', id: id, ms: ms }); return id;
}
function minuterieFiable(fn, ms) {
  var w = _ticWorker();
  if (!w) return setTimeout(fn, ms);
  var id = 'w' + (++_ticN); _ticFn[id] = { fn: fn, une: true }; w.postMessage({ c: 't', id: id, ms: ms }); return id;
}
function arreterTic(id) {
  if (typeof id === 'string' && id.charAt(0) === 'w') { delete _ticFn[id]; if (_ticW) _ticW.postMessage({ c: 'x', id: id }); return; }
  clearInterval(id); clearTimeout(id);
}
/* Le système (iPhone en arrière-plan, autre appli qui prend le micro…) peut couper ou rendre muette la piste du micro. */
function surveillerPiste(flux) {
  try {
    flux.getAudioTracks().forEach(function (t) {
      t.addEventListener('ended', function () { if (S._vocalFlux === flux) ArrierePlan.coupeOS('ended'); });
      t.addEventListener('mute', function () { if (S._vocalFlux === flux) ArrierePlan.coupeOS('mute'); });
      t.addEventListener('unmute', function () { if (S._vocalFlux === flux && !document.hidden) ArrierePlan.reprise('unmute'); });
    });
  } catch (e) {}
}
var ArrierePlan = (function () {
  var verrou = null, journal = [];
  function note(x) { journal.push({ t: Date.now(), e: x, cache: document.hidden }); if (journal.length > 40) journal.shift(); window.SI_ARRIERE_PLAN = journal; }
  function garderEcran() {
    if (!S.modeVocal || document.hidden || verrou || !navigator.wakeLock || !navigator.wakeLock.request) return;
    navigator.wakeLock.request('screen').then(function (v) {
      verrou = v; note('wakelock');
      v.addEventListener('release', function () { if (verrou === v) verrou = null; });
    }, function () {});
  }
  function sessionMedia(on) {
    var ms = navigator.mediaSession; if (!ms) return;
    try {
      if (on) {
        if (window.MediaMetadata) ms.metadata = new MediaMetadata({ title: 'Appel avec Laura', artist: 'FSM SI', artwork: [{ src: './icons/laura-512.png', sizes: '512x512', type: 'image/png' }] });
        ms.playbackState = 'playing';
        try { ms.setActionHandler('hangup', function () { fermerModeVocal(); }); } catch (e) {}
        try { ms.setActionHandler('togglemicrophone', function () { basculerMuetVocal(); }); } catch (e) {}
      } else {
        ms.playbackState = 'none'; ms.metadata = null;
        try { ms.setActionHandler('hangup', null); } catch (e) {}
        try { ms.setActionHandler('togglemicrophone', null); } catch (e) {}
      }
    } catch (e) {}
  }
  function micVivant() {
    return !!(S._vocalFlux && S._vocalFlux.getAudioTracks().some(function (t) { return t.readyState === 'live' && !t.muted; }));
  }
  function relancerAudio() {
    try { if (window.LauraRapide && LauraRapide.voix.contexte) LauraRapide.voix.contexte(); } catch (e) {}
    try { if (S._vocalAc && S._vocalAc.state !== 'running' && S._vocalAc.state !== 'closed') S._vocalAc.resume(); } catch (e) {}
    try { if (S._voixCtx && S._voixCtx.state === 'suspended') S._voixCtx.resume(); } catch (e) {}
  }
  /* Retour au premier plan (build 52). Avant : resume() seul (sans effet sur un contexte iOS « interrupted »), et chaque
     évènement (visible, pageshow, resume, unmute) relançait sa propre ouverture du micro en parallèle (pistes orphelines).
     Maintenant : une seule reprise à la fois ; le contexte audio partagé est vraiment réveillé (ou recréé) ; s'il ne repart pas,
     la voix en file est arrêtée (sinon « Laura parle… » pour toujours) et un toucher suffit pour reprendre. */
  var enReprise = false, rejouer = '';
  function reprise(pourquoi) {
    if (!S.modeVocal) return;
    note('reprise:' + pourquoi);
    garderEcran();
    if (enReprise) { rejouer = pourquoi; return; }
    enReprise = true;
    var LR = window.LauraRapide && LauraRapide.voix;
    var gen0 = LR ? LR.mesures().generation : 0;
    try { if (S._vocalAc && !S._vocalAcPartage && S._vocalAc.state !== 'running' && S._vocalAc.state !== 'closed') S._vocalAc.resume(); } catch (e) {}
    try { if (S._voixCtx && S._voixCtx.state === 'suspended') S._voixCtx.resume(); } catch (e) {}
    var reveil = LR && LR.reveiller ? LR.reveiller() : Promise.resolve(true);
    reveil.then(function (ok) {
      if (!S.modeVocal) { enReprise = false; return; }
      if (!ok && LR) {
        /* contexte toujours bloqué : on le ferme, un neuf est créé (iOS peut exiger un toucher pour le démarrer) */
        note('contexte bloqué : recréé');
        try { LR.mesures().ctx.close(); } catch (e) {}
        return LR.reveiller();
      }
      return ok;
    }).then(function (ok) {
      enReprise = false;
      if (!S.modeVocal) return;
      var neuf = LR && LR.mesures().generation !== gen0;
      if (!ok || neuf) {
        /* les morceaux de voix programmés sur l'ancien contexte ne finiront jamais : on garde ce que Laura a dit */
        if (S.vocalEtat === 'speak' || S._vocalAppel) {
          sauverTourVocal(S._vocalEnCours, S.vocalEtat === 'speak');
          S._vocalTour = (S._vocalTour || 0) + 1; S._vocalAppel = false;
          LR.stop();
          vocalEtatUI('listen', '');
        }
        if (neuf) { S._micCoupeOS = true; }   /* le micro était branché sur l'ancien contexte : on le rebranche */
      }
      if (!ok) {
        S._repriseTap = true;
        vocalStopMediaRec(true); vocalCouperMicro();
        vocalEtatUI('idle', 'Touche l’écran pour reprendre l’appel.');
        return;
      }
      repriseMicro();
      if (rejouer) { var r = rejouer; rejouer = ''; if (r === 'unmute' || r === 'coupe-visible') reprise(r); }
    });
  }
  function repriseMicro() {
    if (S.vocalMuet) return;
    var coupe = S._micCoupeOS || (S._vocalFlux && !micVivant());
    if (coupe) {
      S._micCoupeOS = false;
      /* micro rouvert sans toucher à la conversation ni au tour en cours */
      vocalStopMediaRec(true); vocalCouperMicro();
      alerte('Le système avait coupé le micro (appli en arrière-plan ou écran verrouillé). Il est rallumé.');
    }
    var r = S._vocalMr;
    if (r && r.state === 'paused') try { r.resume(); } catch (e) {}
    if (S.vocalEtat === 'speak' || S.vocalEtat === 'wait') {
      if (!S._vocalMr) vocalEcouterMedia(true, true);   /* barge-in possible pendant que Laura parle */
    } else if (!S._vocalMr && !S._vocalRec) { vocalEtatUI('listen', ''); vocalEcouter(); }
    if (S.attente) { clearTimeout(S.minuteur); boucle(); }
  }
  function cache() {
    note('cache');
    /* rien n’est coupé : on vérifie seulement que la détection de parole continue malgré le ralentissement */
    relancerAudio();
  }
  function coupeOS(quoi) {
    if (!S.modeVocal || S.vocalMuet) return;
    note('coupe:' + quoi);
    S._micCoupeOS = true;
    if (!document.hidden) {
      if ($('voiceState')) $('voiceState').textContent = 'Micro coupé par le système…';
      setTimeout(function () { if (S._micCoupeOS && !document.hidden) reprise('coupe-visible'); }, quoi === 'mute' ? 1500 : 200);
    }
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted) reprise('pageshow'); });
  document.addEventListener('resume', function () { reprise('resume'); });
  document.addEventListener('freeze', function () { note('freeze'); });
  window.addEventListener('focus', function () { if (S.modeVocal) { relancerAudio(); garderEcran(); } });
  /* blur : volontairement AUCUNE action, l’appel continue sans le focus */
  return {
    demarrer: function () { note('demarrer'); garderEcran(); sessionMedia(true); _ticWorker(); },
    arreter: function () { note('arreter'); if (verrou) { try { verrou.release(); } catch (e) {} verrou = null; } sessionMedia(false); S._micCoupeOS = false; },
    reprise: reprise, cache: cache, coupeOS: coupeOS, micVivant: micVivant
  };
})();


function estIOS() {
  return /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function estPwaIos() {
  return estIOS() && !!(navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches));
}
function dicteeNavigateurOk() {
  /* Whisper (OpenRouter) is the default on every device. Browser STT is only a fallback. */
  if (!S._sttRepliNavigateur) return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition) && !S.note;
}
function debloquerAudio() {
  if (window.LauraRapide) LauraRapide.voix.debloquer();
  try {
    if (window.speechSynthesis) {
      var u = new SpeechSynthesisUtterance('\u200B');
      u.lang = 'fr-FR';
      u.volume = 0.01;
      u.rate = 1;
      u.pitch = 1;
      speechSynthesis.speak(u);
      S._voixDebloquee = true;
    }
  } catch (e) {}
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      if (!S._voixCtx) S._voixCtx = new AC();
      if (S._voixCtx.state === 'suspended' && S._voixCtx.resume) S._voixCtx.resume();
      var ctx = S._voixCtx;
      var buf = ctx.createBuffer(1, 1, ctx.sampleRate || 44100);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    }
  } catch (e) {}
}
function typeEnregistrement() {
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
  var types = ['audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
  for (var i = 0; i < types.length; i++) if (MediaRecorder.isTypeSupported(types[i])) return types[i];
  return '';
}
function vocalStopMediaRec(annuler) {
  clearInterval(S._vocalSilInt);
  var rec = S._vocalMr;
  if (!rec) return;
  arreterTic(rec._int);
  rec._annule = !!annuler;
  S._vocalMr = null;
  try { rec.stop(); } catch (e) {}
}
/* Appel vocal instantané : audio → /voix (transcription, Laura, voix phrase par phrase), sans passer par GitHub.
   L’échange est ensuite posté dans la conversation (note vocale de Tom + réponse fsm-laura). */
function vocalEnvoyerAudio(blob, type) {
  if (window.LauraRapide && S.jeton && !S._voixLente) return vocalDirect(blob, type);
  return vocalEnvoyerAudioLent(blob, type);
}
function modeVoix() { return window.LauraMode ? LauraMode.actif() : ''; }
/* Le tour est gardé dans la conversation (invisible) ; si un envoi écrit est en cours, on attend son tour pour garder l’ordre. */
function garderTourVocal(corps, essai) {
  var n = S.conv;
  if (!n) return Promise.resolve();
  return api(D() + '/issues/' + n + '/comments', { method: 'POST', json: { body: corps } }).then(function (c) {
    if (c && c.id) S._vocalDernier = 'c' + c.id;
    return rafraichir();
  }, function (e) {
    if ((essai || 0) < 2) return new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () { return garderTourVocal(corps, (essai || 0) + 1); });
  });
}
/* Ce que Laura a vraiment eu le temps de dire (proportion du son joué), pour un tour coupé par Tom. */
function texteDejaDit(texte) {
  try {
    var V = LauraRapide.voix.mesures(), c = V.ctx;
    if (!c || V.debutCtx == null || !V.fin || V.fin <= V.debutCtx) return texte;
    var f = Math.max(0, Math.min(1, (c.currentTime - V.debutCtx) / (V.fin - V.debutCtx)));
    var n = Math.round(texte.length * f), coupe = texte.slice(0, n);
    var esp = coupe.lastIndexOf(' ');
    return (esp > 0 && n < texte.length ? coupe.slice(0, esp) : coupe).trim();
  } catch (e) { return texte; }
}
function sauverTourVocal(tt, coupe) {
  if (!tt || tt.sauve || !tt.tom) return Promise.resolve();
  tt.sauve = true;
  var laura = coupe ? (texteDejaDit(tt.laura) + ' … [coupée par Tom]').trim() : tt.laura;
  if (!laura) return Promise.resolve();
  (S._vocalLocaux = S._vocalLocaux || []).push({ tom: tt.tom, laura: laura });
  (S._appelTours = S._appelTours || []).push({ tom: tt.tom, laura: laura });
  var pr = garderTourVocal(corpsAppel({ tom: tt.tom, laura: laura, tache: tt.tache }, modeVoix()));
  S._appelSauves = (S._appelSauves || []).concat([pr.catch(function () {})]);
  return pr;
}
function vocalDirect(blob, type, texteSeul, source) {
  var finParole = S._vocalFinParole || performance.now();
  vocalEtatUI('wait', '');
  S._vocalAppel = true;
  var entendu = '', parlait = false;
  var tt = S._vocalEnCours = { tom: '', laura: '', tache: false, final: false, sauve: false, audioFini: false };
  var mesure = { fin_parole: Math.round(finParole), debut_envoi: Math.round(performance.now()), stt: source === 'flux' ? 'flux' : (texteSeul ? 'texte' : 'lot') };
  mesure.fin_parole_vers_envoi_ms = mesure.debut_envoi - mesure.fin_parole;
  if (source === 'flux') S._fluxDernier = texteSeul;
  var tour = S._vocalTour = (S._vocalTour || 0) + 1;
  var hist = histoireRapide();
  var encours = S.runEtat && !S._etatGen && S.runEtat !== 'S’en occupe' ? S.runEtat : (S._tacheEnCours || '');
  var relancer = function () {
    if (!S.modeVocal) return;
    vocalEtatUI('listen', '');
    if (S._vocalMr && S._vocalMr._propre) return;   /* l’écoute (enregistrement neuf) tourne déjà */
    if (!S.vocalMuet) vocalEcouter();
  };
  var pv = prefsVoix();
  var meta = { messages: hist, encours: encours, voix: pv.voix, vitesse: pv.vitesse, langue: pv.langue };
  if (modeVoix()) meta.mode = modeVoix();
  if (texteSeul) meta.texte = texteSeul;   /* résultat d'une action PC validée pendant l'appel, ou texte de la transcription en continu : pas d'audio */
  if (source === 'flux') meta.stt = 'flux';
  LauraRapide.voix.appel(S.jeton, texteSeul ? null : blob, meta, {
    entendu: function (t) { entendu = t; tt.tom = String(t || '').trim(); if (t && $('voiceCaption')) $('voiceCaption').textContent = t; },
    capture: vocalCaptureEcran,
    texte: function (txt) { tt.laura = String(txt || '').replace(/\[\[TACHE\]\]/g, '').trim(); if (parlait && $('voiceCaption')) $('voiceCaption').textContent = txt.replace(/\[\[TACHE\]\]/g, ''); },
    parle: function () {
      if (parlait || !S._vocalAppel || tour !== S._vocalTour) return;
      parlait = true;
      S._vocalSpeakAt = performance.now();
      S._vocalCible = 0.3;
      vocalEtatUI('speak', '');
      vocalStopMediaRec(true);   /* la phrase de Tom est partie : enregistrement neuf pour l’écoute pendant que Laura parle */
      vocalEcouterMedia(true, true);
      var m = LauraRapide.voix.mesures();
      mesure.premier_son = Math.round(m.premierSon || performance.now());
      mesure.fin_parole_vers_son_ms = mesure.premier_son - mesure.fin_parole;
      window.SI_VOIX = mesure;
    },
    surFinAudio: function () {
      if (!S._vocalAppel || tour !== S._vocalTour) return;
      tt.audioFini = true; if (tt.final) sauverTourVocal(tt, false);
      S._vocalAppel = false; relancer();
    }
  }).then(function (r) {
    if (tour !== S._vocalTour) return;   /* Tom a repris la parole : ce tour est remplacé */
    if (!parlait) vocalStopMediaRec(true); /* pas de son joué : on ne renvoie jamais l’ancienne phrase */
    Object.assign(mesure, { serveur: r.fin, client: r.mesures, entendu: entendu, reessai: !!(blob && blob._reessai) });
    (window.SI_VOIX_LOG = window.SI_VOIX_LOG || []).push(mesure);
    if (!entendu.trim() || (r.fin && r.fin.vide) || !r.texte.trim()) { S._vocalAppel = false; relancer(); return; }
    var tache = !!(r.fin && r.fin.tache);
    if (tache) S._tacheEnCours = entendu.slice(0, 200);
    tt.tom = entendu.trim(); tt.laura = r.texte.replace(/\[\[TACHE\]\]/g, '').trim(); tt.tache = tache; tt.final = true;
    /* Le tour est gardé quand Laura a fini de parler (ou quand Tom la coupe : on garde alors ce qu’elle a eu le temps de dire).
       Une tâche part tout de suite, pour que le robot commence sans attendre. */
    if (tache || tt.audioFini || !parlait) return sauverTourVocal(tt, false);
    setTimeout(function () { sauverTourVocal(tt, false); }, 90000);
  }).catch(function (e) {
    if (!S.modeVocal || tour !== S._vocalTour) return;
    S._vocalAppel = false;
    if (e && e.name === 'AbortError') return;
    if (e && e.etape === 'stt') { vocalEtatUI('listen', e.message); if (!S.vocalMuet) vocalEcouter(); return; }
    /* Coupure réseau passagère : un nouvel essai, puis l’ancien chemin.
       build 52 : si Laura avait déjà commencé à parler (flux coupé au passage en arrière-plan), on ne rejoue pas tout le tour
       depuis le début : on garde ce qu'elle a dit et on se remet à écouter. */
    if (parlait) { sauverTourVocal(tt.tom ? tt : Object.assign(tt, { tom: entendu }), true); relancer(); return; }
    if (!blob) { S._vocalAppel = false; relancer(); return; }
    if (!blob._reessai) { blob._reessai = true; setTimeout(function () { if (S.modeVocal) vocalDirect(blob, type); }, 600); return; }
    /* Voie rapide indisponible : on repasse par l’ancien chemin (note vocale + robot). */
    vocalEnvoyerAudioLent(blob, type);
  });
}
/* Capture d'écran de Laura pendant un appel (évènement ordi_capture de /voix) : postée dans le fil comme message de Laura
   (marqueur fsm-laura : le robot l'ignore, elle n'est jamais lue à voix haute), visible tout de suite et après rechargement. */
function vocalCaptureEcran(c) {
  var url = String((c && c.url) || '');
  if (!/^(https:\/\/|\/)[^\s"'<>]+$/.test(url)) return;
  var page = c.panneau && /^(https:\/\/|\/)[^\s"'<>()]+$/.test(String(c.panneau)) ? String(c.panneau) : '';
  var corps = '<img src="' + url + '" alt="Écran de Laura' + (c.titre ? ' : ' + esc(String(c.titre)).replace(/"/g, '') : '') + '">' +
    (page ? '\n\n[Voir mon écran en direct](' + page + ')' : '') + '\n\n<!-- fsm-laura capture -->' + (modeVoix() ? '\n<!-- fsm-mode: ' + modeVoix() + ' -->' : '');
  (window.SI_VOIX_CAPTURES = window.SI_VOIX_CAPTURES || []).push(url);
  garderTourVocal(corps);
}
/* Transcription en continu (stt-flux.js) : texte intermédiaire affiché, texte final → Laura tout de suite. */
function vocalFluxRappels() {
  return {
    ferme: function () { return !S.modeVocal || S.vocalMuet || S.vocalEtat === 'speak'; },
    bargeIn: function () { var v = !!S._fluxBargeIn; S._fluxBargeIn = false; return v; },
    partiel: function (t) { if (S.modeVocal && S.vocalEtat === 'listen' && t && $('voiceCaption')) $('voiceCaption').textContent = t; },
    final: vocalFluxFinal
  };
}
function vocalFluxFinal(texte, info) {
  if (!S.modeVocal || S.vocalMuet || S.vocalEtat === 'speak') return;   /* pendant que Laura parle : la coupure locale décide */
  var rec = S._vocalMr;
  if (!rec || !rec._fluxFin) return;
  texte = String(texte || '').trim();
  /* fin de tour venue de xAI seule : seulement si le micro a vraiment entendu Tom (jamais l'écho de Laura) */
  if (!(info && info.force) && performance.now() - (S._vocalFinParole || 0) > 2500) return;
  /* build 52 : pendant « S’en occupe », un texte final de xAI seul (fin de parole à 0,7 s côté xAI, bruit, souffle)
     annulait la réponse en route et renvoyait la phrase rallongée : Laura recommençait ou répondait deux fois.
     La reprise de phrase n'est décidée que par la détection locale (niveau réel du micro, voir « reprise » dans l'écoute). */
  if (S.vocalEtat === 'wait') return;
  var complet = texte && S._fluxReprise ? S._fluxReprise + ' ' + texte : texte;
  if (rec._fluxFin(complet, info) && texte) {
    S._fluxReprise = '';
    (window.SI_VOIX_FLUX = window.SI_VOIX_FLUX || []).push({ t: Date.now(), finalize_ms: info && info.finalize_ms, force: !!(info && info.force), n: complet.length });
  }
}
function vocalEnvoyerAudioLent(blob, type) {
  type = type || blob.type || 'audio/mp4';
  var ext = /webm/.test(type) ? 'webm' : /ogg/.test(type) ? 'ogg' : 'm4a';
  var chemin = 'entree/vocal/' + new Date().toISOString().replace(/[:.]/g, '-') + '.' + ext;
  vocalEtatUI('wait', '');
  var lecteur = new FileReader();
  lecteur.onload = function () {
    var b64 = String(lecteur.result || '').split(',')[1];
    if (!b64) {
      vocalEtatUI('listen', '');
      if (!S.vocalMuet) vocalEcouter();
      return;
    }
    api(D() + '/contents/' + encP(chemin), { method: 'PUT', json: { message: 'note vocale', content: b64, branch: S.branche } })
      .then(function () { return garderTourVocal('<!-- fsm-appel-lent 🎤 Note vocale : ' + chemin + ' -->' + (modeVoix() ? '\n<!-- fsm-mode: ' + modeVoix() + ' -->' : '')); })
      .then(function () {
        if (S.modeVocal && S.attente) { clearTimeout(S.minuteur); boucle(); }
      }, function (e) {
        if (!S.modeVocal) return;
        vocalEtatUI('listen', '');
        if (!S.vocalMuet) vocalEcouter();
      });
  };
  lecteur.readAsDataURL(blob);
}
/* Écoute (micro de qualité) : le micro reste ouvert pendant tout l’appel (pas de nouvelle demande d’accès à chaque tour),
   et l’écoute continue pendant que Laura parle : si Tom parle par-dessus, sa voix coupe Laura (barge-in)
   sans perdre ses premiers mots. Fin de parole : ≈ 0,6 s de silence ; un bruit bref est ignoré. */
function vocalEcouterMedia(pendantParole, propre) {
  if (!S.modeVocal || S.vocalMuet) return;
  if (!pendantParole && (S.vocalEtat === 'speak' || S.vocalEtat === 'wait')) return;
  if (S._vocalMr) return; /* déjà à l’écoute */
  if (S._vocalGum) return; /* ouverture du micro déjà en cours (build 52 : avant, deux reprises = deux micros ouverts) */
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    S._sttRepliNavigateur = true;
    if ((window.SpeechRecognition || window.webkitSpeechRecognition) && !S.note) vocalEcouter();
    return;
  }
  var vivant = S._vocalFlux && S._vocalFlux.getAudioTracks().some(function (t) { return t.readyState === 'live' && t.enabled; });
  /* appli en arrière-plan : iOS refuse le micro (et n'en rend pas d'autre) ; on le rouvrira au retour (reprise) */
  if (!vivant && document.hidden) { S._micCoupeOS = true; return; }
  var obtenir = vivant ? Promise.resolve(S._vocalFlux)
    : navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  if (!vivant) S._vocalGum = true;
  obtenir.then(function (flux) {
    S._vocalGum = false; S._gumEchecs = 0; S._repriseTap = false;
    if (!S.modeVocal || S.vocalMuet) { if (flux !== S._vocalFlux) flux.getTracks().forEach(function (tr) { tr.stop(); }); return; }
    if (S._vocalMr) { if (flux !== S._vocalFlux) flux.getTracks().forEach(function (tr) { tr.stop(); }); return; }
    if (flux !== S._vocalFlux) {
      vocalCouperMicro();
      S._vocalFlux = flux;
      surveillerPiste(flux);
      try {
        /* un seul contexte audio pour la voix de Laura et l’analyse du micro (iPhone : deux contextes se disputent la session) */
        var partage = window.LauraRapide && LauraRapide.voix.contexte ? LauraRapide.voix.contexte() : null;
        var ac = partage || new (window.AudioContext || window.webkitAudioContext)();
        S._vocalAcPartage = !!partage;
        if (ac.state === 'suspended' && ac.resume) ac.resume();
        var src = ac.createMediaStreamSource(flux);
        S._vocalSrc = src;
        /* transcription en continu : capture brute branchée sur le même micro, session WebSocket ouverte pour tout l'appel */
        if (window.SttFlux && S.jeton) { SttFlux.brancher(ac, src); SttFlux.ouvrir(S.jeton, (prefsVoix().langue || 'fr-FR').slice(0, 2), vocalFluxRappels()); }
        var an = ac.createAnalyser();
        an.fftSize = 256;
        an.smoothingTimeConstant = 0.55;
        src.connect(an);
        /* analyseur dédié à la détection de parole : fenêtre ≈ 43 ms (un instantané de 5 ms tombe parfois entre deux syllabes) */
        var anV = ac.createAnalyser(); anV.fftSize = 2048; anV.smoothingTimeConstant = 0; src.connect(anV);
        S._vocalAnV = anV; S._vocalDataV = new Uint8Array(anV.fftSize);
        S._vocalAc = ac; S._vocalAn = an;
        S._vocalData = new Uint8Array(an.fftSize);
        S._vocalFreq = new Uint8Array(an.frequencyBinCount);
      } catch (e) {}
    } else if (S._vocalAc && S._vocalAc.state === 'suspended' && S._vocalAc.resume) S._vocalAc.resume();
    var mime = typeEnregistrement();
    var morceaux = [];
    var rec;
    try { rec = mime ? new MediaRecorder(flux, { mimeType: mime }) : new MediaRecorder(flux); }
    catch (err) { rec = new MediaRecorder(flux); }
    S._vocalMr = rec;
    rec._propre = !!propre;
    rec.ondataavailable = function (e) { if (e.data && e.data.size) morceaux.push(e.data); };
    rec.onstop = function () {
      if (S._vocalMr === rec) S._vocalMr = null;
      arreterTic(rec._int);
      var typ = rec.mimeType || mime || 'audio/mp4';
      if (rec._annule) return;
      if (!morceaux.length || rec._bruit) {
        if (S.modeVocal && !S.vocalMuet && S.vocalEtat !== 'wait') setTimeout(function () { vocalEcouterMedia(S.vocalEtat === 'speak'); }, 60);
        return;
      }
      vocalEnvoyerAudio(new Blob(morceaux, { type: typ }), typ);
    };
    try { rec.start(250); } catch (err) { S._vocalMr = null; return; }
    if (!pendantParole) vocalEtatUI('listen', '');
    var parle = false, silencieux = 0, fort = 0, debut = Date.now(), debutParole = 0, haut = 0, fond = [], voixPendant = 0, etaitLaura = false, reprise = 0, envoi = false;
    /* Fin de parole : on envoie ce qui a été dit SANS arrêter l’enregistrement. Si Tom reprend la parole avant que
       Laura réponde (simple pause), la réponse en route est annulée et la phrase entière repart d’un bloc. */
    var attenteFlux = 0;
    /* texte = transcription en continu (le bloc audio part avec, en secours) ; sans texte : ancien chemin (transcription d'un bloc) */
    var envoyerBloc = function (texte) {
      envoi = true; rec._propre = false;
      if (attenteFlux) { clearTimeout(attenteFlux); attenteFlux = 0; }
      if (!texte) S._fluxReprise = '';   /* l'enregistrement entier repart : il contient déjà le début de la phrase */
      try { rec.requestData(); } catch (e) {}
      setTimeout(function () {
        envoi = false;
        if (S._vocalMr !== rec || !S.modeVocal) return;
        var typ = rec.mimeType || mime || 'audio/mp4';
        parle = false; silencieux = 0; fort = 0;
        var blob = new Blob(morceaux.slice(), { type: typ });
        if (texte && window.LauraRapide && S.jeton && !S._voixLente) vocalDirect(blob, typ, texte, 'flux');
        else vocalEnvoyerAudio(blob, typ);
      }, texte ? 0 : 40);
    };
    /* Fin de parole (0,5 s de silence) : avec la transcription en continu, « finalize » → texte final ≈ 0,1 s après, et Laura
       démarre aussitôt. Pas de texte en 0,9 s (flux coupé, rien compris) : ancien chemin avec l'enregistrement. */
    var envoyerTour = function () {
      if (window.SttFlux && SttFlux.sain() && SttFlux.finir()) {
        if (attenteFlux) return;
        parle = false; silencieux = 0; fort = 0;
        attenteFlux = setTimeout(function () {
          attenteFlux = 0;
          if (S._vocalMr !== rec || !S.modeVocal || envoi || S.vocalEtat !== 'listen') return;
          SttFlux.echec('pas de texte final en 0,9 s');
          envoyerBloc('');
        }, 900);
        return;
      }
      envoyerBloc('');
    };
    rec._fluxFin = function (texte, info) {
      if (S._vocalMr !== rec || envoi) return false;
      if (!texte) { if (attenteFlux && info && info.force) { SttFlux.echec('texte final vide'); envoyerBloc(''); } return false; }
      envoyerBloc(texte);
      return true;
    };
    rec._int = ticFiable(function () {
      if (!S.modeVocal || S._vocalMr !== rec) { arreterTic(rec._int); return; }
      var niv = niveauMic();
      var laura = S.vocalEtat === 'speak';
      /* Laura vient de finir sans avoir été coupée, mais Tom parlait déjà : on garde ce qu’il a dit. */
      if (etaitLaura && !laura && voixPendant >= 3 && !parle) { parle = true; fort = 3; silencieux = 0; debutParole = Date.now(); S._vocalFinParole = performance.now(); }
      if (!laura && etaitLaura) voixPendant = 0;
      etaitLaura = laura;
      /* Pendant que Laura parle : seuil plus haut (l’écho résiduel ne coupe pas Laura), et 0,3 s de voix franche. */
      if (laura) {
        /* seuil adaptatif : au-dessus de l’écho résiduel mesuré pendant que Laura parle */
        fond.push(niv); if (fond.length > 30) fond.shift();
        var tri = fond.slice().sort(function (a, b) { return a - b; });
        var plancher = tri[Math.floor(tri.length / 2)] || 0;
        var seuil = Math.max(0.2, Math.min(0.6, plancher * 1.8 + 0.06));
        if (niv > seuil && fond.length >= 4) { haut++; } else haut = Math.max(0, haut - 1);
        if (niv > 0.18) voixPendant++;
        if (haut >= 3) {
          haut = 0; parle = true; fort = 3; silencieux = 0; debutParole = Date.now(); S._vocalFinParole = performance.now();
          (window.SI_VOIX_COUPURES = window.SI_VOIX_COUPURES || []).push(Date.now());
          fond = [];
          S._vocalAppel = false; S._vocalCoupe = true;
          S._fluxBargeIn = true;   /* transcription en continu : les 400 ms de voix qui ont coupé Laura sont envoyées */
          sauverTourVocal(S._vocalEnCours, true);
          if (window.LauraRapide) LauraRapide.voix.stop();
          vocalEtatUI('listen', '');
        }
        return;
      }
      if (envoi) return;
      if (S.vocalEtat === 'wait') {
        if (niv > 0.18) reprise++; else reprise = Math.max(0, reprise - 1);
        if (reprise >= 3) {
          /* Tom continue sa phrase : on annule la réponse en route, on reprend l’écoute du même enregistrement */
          reprise = 0;
          S._vocalTour = (S._vocalTour || 0) + 1;
          S._vocalAppel = false;
          if (window.LauraRapide) LauraRapide.voix.stop();
          S._fluxReprise = S._fluxDernier || '';   /* transcription en continu : la suite sera ajoutée au début déjà transcrit */
          (window.SI_VOIX_REPRISES = window.SI_VOIX_REPRISES || []).push(Date.now());
          parle = true; fort = 3; silencieux = 0; S._vocalFinParole = performance.now();
          vocalEtatUI('listen', '');
        }
        return;
      }
      reprise = 0;
      /* hystérésis : il faut 0,18 pour commencer à parler, mais on reste « en parole » tant que le niveau dépasse 0,10 */
      if (niv > (parle ? 0.10 : 0.18)) { if (!parle) debutParole = Date.now(); parle = true; silencieux = 0; if (niv > 0.18) fort++; S._vocalFinParole = performance.now(); }
      else if (parle) {
        silencieux++;
        /* 0,5 s (0,7 s après une longue phrase) : si Tom reprend, la réponse en route est annulée et la phrase repart entière */
        if (silencieux >= (Date.now() - debutParole > 2500 ? 7 : 5)) {
          if (fort < 3) { parle = false; silencieux = 0; fort = 0; }   /* bruit bref : ignoré */
          else envoyerTour();
        }
      }
      if (parle && Date.now() - debutParole > 30000) { envoyerTour(); }
      /* longue écoute silencieuse : on recommence un enregistrement neuf (mémoire, et début propre) */
      if (!parle && Date.now() - debut > 20000) { rec._annule = true; arreterTic(rec._int); try { rec.stop(); } catch (e2) {} S._vocalMr = null; vocalEcouterMedia(false); }
    }, 100);
  }, function (err) {
    /* build 52 : un échec d'ouverture du micro (fréquent au retour d'arrière-plan sur iPhone : NotReadableError, ou geste exigé)
       ne fait plus basculer TOUT le reste de la session sur la dictée du navigateur (S._sttRepliNavigateur, jamais remis à zéro,
       même au prochain appel). On réessaie, puis un toucher relance le micro. */
    S._vocalGum = false;
    S._gumEchecs = (S._gumEchecs || 0) + 1;
    (window.SI_MICRO_ECHECS = window.SI_MICRO_ECHECS || []).push({ t: Date.now(), nom: err && err.name, cache: document.hidden });
    if (!S.modeVocal || S.vocalMuet) return;
    if (document.hidden) { S._gumEchecs = 0; S._micCoupeOS = true; return; }   /* parti entre-temps : la reprise s'en charge */
    if (S._gumEchecs <= 2) {
      setTimeout(function () { if (S.modeVocal && !S.vocalMuet && !S._vocalMr) vocalEcouterMedia(pendantParole || S.vocalEtat === 'speak', propre); }, 700);
      return;
    }
    S._repriseTap = true;
    var msg = err && err.name === 'NotAllowedError' ? 'Micro refusé : touche pour réessayer.' : 'Micro indisponible : touche pour réessayer.';
    if (S.vocalEtat === 'speak' || S.vocalEtat === 'wait') { if ($('voiceCaption')) $('voiceCaption').textContent = msg; }
    else vocalEtatUI('idle', msg);
  }).catch(function (e) {
    S._vocalGum = false;
    (window.SI_MICRO_ECHECS = window.SI_MICRO_ECHECS || []).push({ t: Date.now(), code: String(e && e.message || e).slice(0, 120) });
    S._repriseTap = true;
    if (S.modeVocal && S.vocalEtat !== 'speak' && S.vocalEtat !== 'wait') vocalEtatUI('idle', 'Micro indisponible : touche pour réessayer.');
  });
}

function vocalOndeMicro() {
  if (S.vocalMuet) return;
  if (S._vocalAn) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (flux) {
    if (!S.modeVocal || S.vocalMuet) {
      flux.getTracks().forEach(function (t) { t.stop(); });
      return;
    }
    vocalCouperMicro();
    S._vocalFlux = flux;
    try {
      var ac = new (window.AudioContext || window.webkitAudioContext)();
      var src = ac.createMediaStreamSource(flux);
      var an = ac.createAnalyser();
      an.fftSize = 256;
      an.smoothingTimeConstant = 0.55;
      src.connect(an);
      S._vocalAc = ac; S._vocalAn = an;
      S._vocalData = new Uint8Array(an.fftSize);
      S._vocalFreq = new Uint8Array(an.frequencyBinCount);
      if (ac.state === 'suspended' && ac.resume) ac.resume();
    } catch (e) {}
  }).catch(function () {});
}

function vocalStopRec() {
  clearTimeout(S._vocalRelance);
  clearTimeout(S._vocalSilence);
  var r = S._vocalRec;
  S._vocalRec = null;
  if (r) {
    try { r.onend = null; r.onerror = null; r.onresult = null; r.stop(); } catch (e) {}
  }
  vocalStopMediaRec(true);
}

function vocalEnvoyerTexte(txt) {
  txt = String(txt || '').replace(/\s+/g, ' ').trim();
  if (!txt || !S.modeVocal) return;
  vocalStopRec();
  S._vocalFinal = '';
  vocalEtatUI('wait', txt);
  S._vocalCible = 0.15;
  envoyer(txt).then(function () {
    if (S.modeVocal && S.attente) { clearTimeout(S.minuteur); boucle(); }
  }, function (e) {
    if (!S.modeVocal) return;
    vocalEtatUI('listen', e && e.message ? e.message : 'Envoi impossible.');
    if (!S.vocalMuet) vocalEcouter();
  });
}

function vocalEcouter() {
  if (!S.modeVocal || S.vocalMuet) return;
  if (S.vocalEtat === 'speak' || S.vocalEtat === 'wait') return;
  vocalStopRec();
  S._vocalCoupe = false;
  vocalEtatUI('listen', '');
  S._vocalCible = 0.2;
  if (!dicteeNavigateurOk()) {
    vocalEcouterMedia();
    return;
  }
  var reco = new SR();
  S._vocalRec = reco;
  reco.lang = 'fr-FR';
  reco.interimResults = true;
  reco.continuous = true;
  reco.maxAlternatives = 1;
  S._vocalFinal = '';
  reco.onresult = function (e) {
    if (!S.modeVocal || S.vocalMuet) return;
    if (S.vocalEtat === 'speak') { vocalInterrompre(); }
    if (S.vocalEtat === 'wait') return;
    var prov = '', fin = S._vocalFinal;
    for (var i = e.resultIndex; i < e.results.length; i++) {
      var t = e.results[i][0].transcript;
      if (e.results[i].isFinal) fin += (fin && !/\s$/.test(fin) ? ' ' : '') + t;
      else prov += t;
    }
    S._vocalFinal = fin;
    var aff = (fin + (prov ? (fin ? ' ' : '') + prov : '')).replace(/\s+/g, ' ').trim();
    if (aff && $('voiceCaption')) $('voiceCaption').textContent = aff;
    S._vocalCible = Math.min(1, 0.4 + aff.length * 0.02);
    clearTimeout(S._vocalSilence);
    if (fin.trim() && !prov.trim()) {
      S._vocalSilence = setTimeout(function () {
        if (S.modeVocal && S.vocalEtat === 'listen') vocalEnvoyerTexte(S._vocalFinal);
      }, 700);
    }
  };
  reco.onerror = function (e) {
    var err = e && e.error;
    if (err === 'no-speech' || err === 'aborted') return;
    if (err === 'not-allowed' || err === 'service-not-allowed') {
      S.note = true;
      vocalEcouterMedia();
      return;
    }
    if (err === 'network') {
      if ($('voiceState')) $('voiceState').textContent = 'Réseau indisponible pour la dictée';
    }
  };
  reco.onend = function () {
    if (S._vocalRec !== reco) return;
    S._vocalRec = null;
    if (!S.modeVocal || S.vocalMuet) return;
    if (S.vocalEtat === 'speak' || S.vocalEtat === 'wait') return;
    var texte = (S._vocalFinal || '').trim();
    if (texte) { vocalEnvoyerTexte(texte); return; }
    S._vocalRelance = setTimeout(function () {
      if (S.modeVocal && S.vocalEtat === 'listen' && !S.vocalMuet) vocalEcouter();
    }, 160);
  };
  try { reco.start(); }
  catch (err) {
    S.note = true;
    vocalEcouterMedia();
  }
}

function decouperVoix(t, max) {
  max = max || 280;
  t = String(t || '');
  if (t.length <= max) return t ? [t] : [];
  var parts = [], rest = t;
  while (rest.length) {
    if (rest.length <= max) { parts.push(rest); break; }
    var morceau = rest.slice(0, max);
    var c = Math.max(morceau.lastIndexOf('. '), morceau.lastIndexOf('? '), morceau.lastIndexOf('! '), morceau.lastIndexOf(', '));
    if (c < max * 0.35) c = morceau.lastIndexOf(' ');
    if (c < 1) c = max;
    else c = c + 1;
    parts.push(rest.slice(0, c).trim());
    rest = rest.slice(c).trim();
  }
  return parts;
}

function vocalParler(texte, fin) {
  texte = String(texte || '').trim();
  if (texte && window.LauraRapide && S.jeton) {
    S._vocalCoupe = false;
    S._vocalSpeakAt = performance.now();
    if ($('voiceCaption')) $('voiceCaption').textContent = texte;
    LauraRapide.voix.parler(S.jeton, texte, function () { if (fin) fin(); });
    return;
  }
  if (!texte || !window.speechSynthesis) { if (fin) fin(); return; }
  speechSynthesis.cancel();
  clearInterval(S._vocalKeep);
  S._vocalCoupe = false;
  S._vocalSpeakAt = performance.now();
  var parts = decouperVoix(texte, 220);
  var i = 0, dit = '';
  var voix = choisirVoixFeminine();
  var rate = tauxVoix();
  if (parts[0] && $('voiceCaption')) $('voiceCaption').textContent = parts[0];
  function suite() {
    if (S._vocalCoupe || !S.modeVocal) { clearInterval(S._vocalKeep); if (fin) fin(); return; }
    if (i >= parts.length) { clearInterval(S._vocalKeep); if (fin) fin(); return; }
    var morceau = parts[i++];
    dit = (dit ? dit + ' ' : '') + morceau;
    if ($('voiceCaption')) $('voiceCaption').textContent = dit;
    var u = new SpeechSynthesisUtterance(morceau);
    u.lang = 'fr-FR';
    u.rate = rate;
    u.pitch = 1.04;
    if (voix) u.voice = voix;
    u.onboundary = function () { S._vocalCible = 0.9; };
    u.onend = suite;
    u.onerror = suite;
    try { speechSynthesis.speak(u); } catch (e) { suite(); }
  }
  S._vocalKeep = setInterval(function () {
    if (!S.modeVocal || S._vocalCoupe) { clearInterval(S._vocalKeep); return; }
    try {
      if (speechSynthesis.speaking && !speechSynthesis.paused) {
        speechSynthesis.pause();
        speechSynthesis.resume();
      }
    } catch (e) {}
  }, 9000);
  suite();
}

function vocalSurReponse(it) {
  if (!S.modeVocal || !it) return;
  if (S._vocalDernier === it.cle) return;
  S._vocalDernier = it.cle;
  if (String(it.corps).indexOf('<!-- fsm-laura') >= 0) return; /* déjà dite en direct */
  var t = textePourVoix(it.corps);
  if (!t) {
    vocalEtatUI('listen', '');
    if (!S.vocalMuet) vocalEcouter();
    return;
  }
  vocalStopRec();
  vocalEtatUI('speak', t);
  S._vocalCible = 0.55;
  vocalParler(t, function () {
    if (!S.modeVocal) return;
    if (S.vocalMuet) { vocalEtatUI('listen', t); return; }
    vocalEtatUI('listen', '');
    vocalEcouter();
  });
}

function vocalInterrompre() {
  if (!S.modeVocal) return;
  if (S._repriseTap) {
    /* un toucher = geste de l'utilisateur : iOS laisse alors démarrer le son et le micro */
    S._repriseTap = false; S._gumEchecs = 0;
    debloquerAudio();
    if (S.vocalEtat === 'idle') vocalEtatUI('listen', '');
    S._micCoupeOS = true;
    ArrierePlan.reprise('toucher');
    return;
  }
  if (S.vocalEtat === 'speak' || S._vocalAppel) {
    S._vocalCoupe = true;
    S._vocalAppel = false;
    if (window.LauraRapide) LauraRapide.voix.stop();
    try { speechSynthesis.cancel(); } catch (e) {}
    vocalEtatUI('listen', '');
    if (!S.vocalMuet) vocalEcouter();
    return;
  }
  if (S.vocalEtat === 'idle' || (S.vocalEtat === 'listen' && !S._vocalRec)) {
    if (!S.vocalMuet) vocalEcouter();
  }
}

/* Réglages de l’appel (voix du fournisseur, vitesse, langue), gardés par utilisateur du FSM HUB.
   Voix : Grok Ara (défaut) et Eve, puis Vivienne et les voix du modèle microsoft/mai-voice-2.1-flash (catalogue OpenRouter, 11/11/2026). */
var VOIX_MAI = {"cs-CZ":["Grant","Harper"],"da-DK":["Grant","Harper"],"de-DE":["Grant","Harper","Klaus","Mia"],"en-AU":["Isla"],"en-GB":["Emily","Harry"],"en-IN":["Dhruv","Priya"],"en-US":["Ethan","Grant","Harper","Iris","Jasper","Olivia","Sage"],"es-ES":["Marta"],"es-MX":["Alejo","Grant","Harper","Valeria"],"fi-FI":["Grant","Harper"],"fr-FR":["Grant","Harper","Marc","Soleil"],"hi-IN":["Arjun","Dhruv","Grant","Harper","Kavya","Priya"],"hu-HU":["Bence","Grant","Harper","Levente","Lilla","Reka"],"id-ID":["Grant","Harper"],"it-IT":["Grant","Harper","Luca","Rosa"],"ko-KR":["Grant","Haena","Harper","Junho"],"nb-NO":["Grant","Harper"],"nl-NL":["Grant","Harper","Sander"],"pl-PL":["Grant","Harper"],"pt-BR":["Caio","Grant","Harper","Luana","Pedro","Rafael"],"pt-PT":["Grant","Harper","Rui"],"ro-RO":["Andrei","Elena","Grant","Harper","Ioana","Radu"],"ru-RU":["Grant","Harper","Lev","Masha"],"sv-SE":["Grant","Harper"],"th-TH":["Grant","Harper","Krit","Nattapong"],"tr-TR":["Aydin","Elif","Grant","Harper"],"vi-VN":["Grant","Harper"],"zh-CN":["Bo","Grant","Harper","Lan","Mei","Wei"]};
/* Voix de Laura : Carina par défaut (sa voix dans Grok Bot, choix de Tom, 11/11/2026), puis Ara, Eve, Vivienne et les voix MAI.
   Carina, Ara et Eve parlent toutes les langues. */
var VOIX_DEFAUT = 'carina';
var VOIX_VIVIENNE = 'fr-FR-Vivienne:DragonHDLatestNeural';
var VOIX_GROK = [['carina', 'Carina'], ['ara', 'Ara'], ['eve', 'Eve']];
var VITESSES = [0.75, 1, 1.25, 1.5];
function cleVoixPrefs() { return 'si_voixpref:' + (S.moi || 'moi'); }
function voixValide(v) { return v === 'carina' || v === 'ara' || v === 'eve' || v === VOIX_VIVIENNE || /^[a-z]{2}-[A-Z]{2}-[A-Za-z]+:MAI-Voice-2\.1-Flash$/.test(String(v)); }
function prefsVoix() {
  var p = {}; try { p = JSON.parse(mem.lire(cleVoixPrefs()) || '{}') || {}; } catch (e) { p = {}; }
  var langue = VOIX_MAI[p.langue] ? p.langue : 'fr-FR';
  /* réglages enregistrés avant Carina (v < 3) : les anciennes voix par défaut (Vivienne, Ara) cèdent la place à Carina */
  if ((p.v || 0) < 3 && (p.voix === VOIX_VIVIENNE || p.voix === 'ara')) p.voix = '';
  var voix = typeof p.voix === 'string' && voixValide(p.voix) && (VOIX_GROK.some(function (g) { return g[0] === p.voix; }) || p.voix === VOIX_VIVIENNE ? true : p.voix.indexOf(langue + '-') === 0) ? p.voix : VOIX_DEFAUT;
  var vitesse = VITESSES.indexOf(+p.vitesse) >= 0 ? +p.vitesse : 1;
  return { voix: voix, vitesse: vitesse, langue: langue };
}
window.SI_PREFS_VOIX = function () { var p = prefsVoix(); return { voix: p.voix, vitesse: p.vitesse, langue: p.langue }; };
function ecrirePrefsVoix(m) { var p = Object.assign(prefsVoix(), m, { v: 3 }); mem.ecrire(cleVoixPrefs(), JSON.stringify(p)); remplirVoixPrefs(); }
function nomVoix(v) { for (var i = 0; i < VOIX_GROK.length; i++) if (VOIX_GROK[i][0] === v) return VOIX_GROK[i][1]; return v === VOIX_VIVIENNE ? 'Vivienne' : String(v).split(':')[0].split('-').slice(2).join('-'); }
function nomLangue(l) {
  /* « Français », et la région seulement quand la langue existe en plusieurs variantes (Anglais (États-Unis)…) */
  var seule = Object.keys(VOIX_MAI).filter(function (k) { return k.split('-')[0] === l.split('-')[0]; }).length === 1;
  try { var n = new Intl.DisplayNames(['fr'], { type: 'language' }).of(seule ? l.split('-')[0] : l); return n.charAt(0).toUpperCase() + n.slice(1); } catch (e) { return l; }
}
function texteVitesse(v) { return String(v) + 'x'; }
function remplirVoixPrefs() {
  var p = prefsVoix();
  var opt = function (sel, val, txt, on) { var o = document.createElement('option'); o.value = val; o.textContent = txt; if (on) o.selected = true; sel.appendChild(o); };
  var sv = $('voiceSel'), sr = $('voiceRate'), sl = $('voiceLang');
  if (sv) { sv.textContent = ''; VOIX_GROK.forEach(function (g) { opt(sv, g[0], g[1], p.voix === g[0]); }); if (p.langue === 'fr-FR') opt(sv, VOIX_VIVIENNE, 'Vivienne', p.voix === VOIX_VIVIENNE); VOIX_MAI[p.langue].forEach(function (n) { var id = p.langue + '-' + n + ':MAI-Voice-2.1-Flash'; opt(sv, id, n, p.voix === id); }); }
  if (sr) { sr.textContent = ''; VITESSES.forEach(function (v) { opt(sr, String(v), texteVitesse(v), v === p.vitesse); }); }
  if (sl) { sl.textContent = ''; Object.keys(VOIX_MAI).map(function (l) { return [l, nomLangue(l)]; }).sort(function (a, b) { return a[1].localeCompare(b[1], 'fr'); }).forEach(function (x) { opt(sl, x[0], x[1], x[0] === p.langue); }); }
  if ($('voiceSelVal')) $('voiceSelVal').textContent = nomVoix(p.voix);
  if ($('voiceRateVal')) $('voiceRateVal').textContent = texteVitesse(p.vitesse);
  if ($('voiceLangVal')) $('voiceLangVal').textContent = nomLangue(p.langue);
}
function dureeAppel() {
  var s0 = S._vocalDebut ? Math.max(0, Math.floor((Date.now() - S._vocalDebut) / 1000)) : 0;
  var h = Math.floor(s0 / 3600), m = Math.floor(s0 / 60) % 60, s = s0 % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}
function synchroBoutonsPrefs() {
  var b = $('vpMute'); if (!b) return;
  b.classList.toggle('muted', !!S.vocalMuet); b.setAttribute('aria-pressed', S.vocalMuet ? 'true' : 'false');
  b.querySelector('.ico-mic-on').classList.toggle('hidden', !!S.vocalMuet);
  b.querySelector('.ico-mic-off').classList.toggle('hidden', !S.vocalMuet);
}
function ouvrirVoixPrefs() {
  remplirVoixPrefs();
  synchroBoutonsPrefs();
  $('voicePrefs').hidden = false;
  if ($('voiceDuree')) $('voiceDuree').textContent = dureeAppel();
  clearInterval(S._vpDuree);
  S._vpDuree = setInterval(function () { if ($('voicePrefs').hidden) { clearInterval(S._vpDuree); return; } $('voiceDuree').textContent = dureeAppel(); }, 1000);
}
function fermerVoixPrefs() {
  clearInterval(S._vpDuree);
  if ($('voicePrefs')) $('voicePrefs').hidden = true;
}

function ouvrirModeVocal() {
  if (!S.jeton) return;
  if ($('composer').classList.contains('full')) setFullCompose(false);
  if (window.LauraRapide && LauraRapide.voix.sessionAppel) LauraRapide.voix.sessionAppel(true);
  debloquerAudio();
  S.modeVocal = true;
  S._sttRepliNavigateur = false; S._gumEchecs = 0; S._repriseTap = false; S._vocalGum = false; S._micCoupeOS = false;
  S._vocalDebut = Date.now();
  S._appelTours = []; S._appelSauves = [];
  S.vocalMuet = false;
  S._vocalCoupe = false;
  S._vocalFinal = '';
  $('voiceMute').classList.remove('muted');
  $('voiceMute').setAttribute('aria-pressed', 'false');
  $('voiceMute').querySelector('.ico-mic-on').classList.remove('hidden');
  $('voiceMute').querySelector('.ico-mic-off').classList.add('hidden');
  $('voiceScreen').hidden = false;
  $('chatView').classList.add('voice-on');
  if ($('texte')) {
    S._phVocal = $('texte').getAttribute('placeholder');
    $('texte').setAttribute('placeholder', 'Demander à Laura F.S.M · F.S.M AI');
  }
  fermerVoixPrefs();
  if ($('voiceDock')) $('voiceDock').style.transform = '';
  themeColor('#141414');
  vocalEtatUI('listen', '');
  vocalAnimer(true);
  vocalEcouter();
  ArrierePlan.demarrer();
  if (S.attente) { clearTimeout(S.minuteur); boucle(); }
}

/* Fenêtre cachée, sans focus ou téléphone verrouillé : l’appel CONTINUE (micro, voix, conversation).
   Seule la fermeture réelle de la page (ou le bouton Raccrocher) termine l’appel. Voir ArrierePlan plus haut. */
document.addEventListener('visibilitychange', function () {
  if (!S.modeVocal) return;
  if (document.hidden) { ArrierePlan.cache(); return; }
  ArrierePlan.reprise('visible');
});
function fermerModeVocal() {
  var enCours = S._vocalEnCours;
  if (enCours && !enCours.sauve && enCours.laura) sauverTourVocal(enCours, !enCours.audioFini && S.vocalEtat === 'speak');
  if (S.modeVocal) resumerAppel();
  S.modeVocal = false;
  S._vocalAppel = false;
  ArrierePlan.arreter();
  if (window.LauraRapide) { LauraRapide.voix.stop(); if (LauraRapide.voix.sessionAppel) LauraRapide.voix.sessionAppel(false); }
  if (window.SttFlux) SttFlux.fermer();
  S._fluxDernier = ''; S._fluxReprise = '';
  S._vocalCoupe = true;
  vocalStopRec();
  vocalCouperMicro();
  vocalAnimer(false);
  clearInterval(S._vocalKeep);
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
  S.vocalEtat = 'idle';
  S.vocalMuet = false;
  fermerVoixPrefs();
  if ($('voiceScreen')) {
    $('voiceScreen').hidden = true;
    $('voiceScreen').classList.remove('listen', 'speak', 'wait', 'muted');
  }
  if ($('chatView')) $('chatView').classList.remove('voice-on');
  if ($('voiceCaption')) $('voiceCaption').textContent = '';
  if ($('voiceDock')) $('voiceDock').style.transform = '';
  if ($('texte') && S._phVocal != null) {
    $('texte').setAttribute('placeholder', S._phVocal);
    S._phVocal = null;
  }
  if (S.ecran === 'chat') themeColor('#141414');
  /* mise à jour de l’appli arrivée pendant l’appel : rechargée seulement maintenant */
  if (S._rechargerApresAppel) { S._rechargerApresAppel = false; setTimeout(function () { location.reload(); }, 300); }
}

function basculerMuetVocal() {
  if (!S.modeVocal) return;
  S.vocalMuet = !S.vocalMuet;
  $('voiceMute').classList.toggle('muted', S.vocalMuet);
  $('voiceMute').setAttribute('aria-pressed', S.vocalMuet ? 'true' : 'false');
  $('voiceMute').querySelector('.ico-mic-on').classList.toggle('hidden', S.vocalMuet);
  $('voiceMute').querySelector('.ico-mic-off').classList.toggle('hidden', !S.vocalMuet);
  if (S.vocalMuet) {
    vocalStopRec();
    vocalCouperMicro();
    if (S.vocalEtat === 'listen') vocalEtatUI('listen', $('voiceCaption').textContent);
    if ($('voiceState') && S.vocalEtat !== 'speak') $('voiceState').textContent = 'Micro coupé';
  } else {
    if (S.vocalEtat !== 'speak' && S.vocalEtat !== 'wait') vocalEcouter();
  }
}

$('voiceHang').addEventListener('click', function (e) { e.stopPropagation(); fermerModeVocal(); });
$('voiceMute').addEventListener('click', function (e) { e.stopPropagation(); basculerMuetVocal(); });
$('voiceGear').addEventListener('click', function (e) { e.stopPropagation(); if (S.vocalEtat === 'speak') { vocalInterrompre(); return; } if ($('voicePrefs').hidden) ouvrirVoixPrefs(); else fermerVoixPrefs(); });
$('voicePrefsOk').addEventListener('click', function (e) { e.stopPropagation(); fermerVoixPrefs(); });
$('voiceDim').addEventListener('click', function () { if (!$('voicePrefs').hidden) fermerVoixPrefs(); else vocalInterrompre(); });
$('voiceSel').addEventListener('change', function () { ecrirePrefsVoix({ voix: $('voiceSel').value }); });
$('voiceRate').addEventListener('change', function () { ecrirePrefsVoix({ vitesse: parseFloat($('voiceRate').value) }); });
$('voiceLang').addEventListener('change', function () { var v = prefsVoix().voix; ecrirePrefsVoix({ langue: $('voiceLang').value, voix: (v === 'carina' || v === 'ara' || v === 'eve') ? v : '' }); });
$('vpMute').addEventListener('click', function (e) { e.stopPropagation(); basculerMuetVocal(); synchroBoutonsPrefs(); });
$('vpGear').addEventListener('click', function (e) { e.stopPropagation(); fermerVoixPrefs(); });
$('vpHang').addEventListener('click', function (e) { e.stopPropagation(); fermerModeVocal(); });
window.addEventListener('keydown', function (e) {
  if (!S.modeVocal) return;
  if (e.key === 'Escape') {
    if ($('voicePrefs') && !$('voicePrefs').hidden) fermerVoixPrefs();
    else fermerModeVocal();
  }
});
(function () {
  var y0 = 0, on = false, dock = $('voiceDock');
  function start(e) {
    if (!S.modeVocal) return;
    var t = e.touches ? e.touches[0] : e;
    if (!t) return;
    if (e.target.closest && e.target.closest('button')) return;
    on = true; y0 = t.clientY;
  }
  function move(e) {
    if (!on) return;
    var t = e.touches ? e.touches[0] : e;
    var dy = t.clientY - y0;
    dock.style.transform = 'translateY(' + dy + 'px)';
  }
  function end(e) {
    if (!on) return; on = false;
    var t = e.changedTouches ? e.changedTouches[0] : e;
    var dy = t ? (t.clientY - y0) : 0;
    if (dy < -70) fermerModeVocal();
    else dock.style.transform = '';
  }
  dock.addEventListener('touchstart', start, { passive: true });
  dock.addEventListener('touchmove', move, { passive: true });
  dock.addEventListener('touchend', end);
})();

window.__voix = {
  ouvrir: ouvrirModeVocal,
  fermer: fermerModeVocal,
  muet: basculerMuetVocal,
  debloquer: debloquerAudio,
  prefs: ouvrirVoixPrefs,
  etat: function () { return S.vocalEtat; },
  caption: function () { return $('voiceCaption') && $('voiceCaption').textContent; },
  texte: textePourVoix,
  simuler: function (kind, txt) {
    if ($('voiceScreen') && $('voiceScreen').hidden) {
      $('voiceScreen').hidden = false;
      if ($('chatView')) $('chatView').classList.add('voice-on');
      S.modeVocal = true;
      vocalAnimer(true);
    }
    S.modeVocal = true;
    if (kind === 'listen') { vocalEtatUI('listen', txt || ''); S._vocalCible = 0.7; }
    else if (kind === 'wait') { vocalEtatUI('wait', txt || ''); S._vocalCible = 0.2; }
    else if (kind === 'speak') { vocalEtatUI('speak', txt || ''); S._vocalCible = 0.95; }
    else if (kind === 'muted') { if (!S.vocalMuet) basculerMuetVocal(); vocalEtatUI('listen', txt || ''); }
    else if (kind === 'final') vocalEnvoyerTexte(txt);
    else if (kind === 'prefs') ouvrirVoixPrefs();
    vocalBarres(S._vocalCible || 0.5);
  }
};

/* ---------- Scroll bas + composer plein écran ---------- */
/* lecture groupée en rAF : aucun aller-retour mise en page / écriture pendant le défilement */
var _scrollRaf = 0;
function majScrollBtn() {
  if (_scrollRaf) return;
  _scrollRaf = requestAnimationFrame(function () {
    _scrollRaf = 0;
    var fil = $('fil'), btn = $('scrollDown');
    var loin = fil.scrollHeight - fil.scrollTop - fil.clientHeight > 120;
    if (btn._loin !== loin) { btn._loin = loin; btn.classList.toggle('show', loin); }
    if (btn.hidden) btn.hidden = false;
  });
}
var _placeRaf = 0;
function placeScrollDown() {
  if (_placeRaf) return;
  _placeRaf = requestAnimationFrame(function () {
    _placeRaf = 0;
    var btn = $('scrollDown'), comp = $('composer');
    var h = comp.offsetHeight;
    if (btn._h !== h) { btn._h = h; btn.style.bottom = (h + 8) + 'px'; }
  });
}
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(placeScrollDown).observe($('composer'));
$('fil').addEventListener('scroll', majScrollBtn, { passive: true });
$('scrollDown').onclick = function () {
  $('fil').scrollTo({ top: $('fil').scrollHeight, behavior: 'smooth' });
};
function setFullCompose(on) {
  var c = $('composer');
  c.classList.toggle('full', on);
  $('expandBtn').querySelector('.ico-expand').classList.toggle('hidden', on);
  $('expandBtn').querySelector('.ico-collapse').classList.toggle('hidden', !on);
  $('expandBtn').setAttribute('aria-label', on ? 'Réduire' : 'Plein écran');
  taille();
}
$('expandBtn').onclick = function () { setFullCompose(!$('composer').classList.contains('full')); };
(function () {
  var y0 = 0, on = false, full = false;
  var c = $('composer');
  c.addEventListener('touchstart', function (e) {
    full = c.classList.contains('full');
    if (!e.touches[0]) return;
    y0 = e.touches[0].clientY; on = true; c._dy = 0;
  }, { passive: true });
  c.addEventListener('touchmove', function (e) {
    if (!on || !e.touches[0]) return;
    var dy = e.touches[0].clientY - y0;
    c._dy = dy;
    /* un balayage vers le haut n'ouvre plus le composeur en plein écran
       (c'était la cause : dy < -40 → setFullCompose(true), #composer.full en inset:0). */
    if (c.classList.contains('full') && dy > 0) {
      var p = Math.min(1, dy / 280);
      c.style.transform = 'translateY(' + dy * 0.6 + 'px) scale(' + (1 - 0.08 * p) + ')';
      c.style.borderRadius = (16 * p) + 'px';
      $('chatView').style.filter = 'brightness(' + (0.5 + 0.5 * (1 - p)) + ')';
    }
  }, { passive: true });
  c.addEventListener('touchend', function () {
    if (!on) return; on = false;
    var dy = c._dy || 0;
    c.style.transform = ''; c.style.borderRadius = '';
    $('chatView').style.filter = '';
    if (c.classList.contains('full') && dy > 90) setFullCompose(false);
  });
})();

/* ---------- Recherche dans le fil ---------- */
var hits = [], hitI = -1;
function ouvrirRecherche() {
  fermerMenu();
  $('composeRow').hidden = true;
  $('chatSearchBar').hidden = false;
  $('findInput').value = '';
  champsFocusables([$('findInput')]);
  $('findInput').focus();
}
function fermerRecherche() {
  $('chatSearchBar').hidden = true;
  $('composeRow').hidden = false;
  champsFocusables([$('texte')]);
  hits = []; hitI = -1;
  Array.prototype.forEach.call($('fil').querySelectorAll('mark.hit'), function (m) {
    var t = document.createTextNode(m.textContent); m.parentNode.replaceChild(t, m);
  });
}
function markHits(q) {
  fermerRecherche();
  $('chatSearchBar').hidden = false;
  $('composeRow').hidden = true;
  hits = []; hitI = -1;
  if (!q) return;
  var re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  Array.prototype.forEach.call($('fil').querySelectorAll('.bubble'), function (b) {
    walk(b);
  });
  function walk(n) {
    if (n.nodeType === 3) {
      var s = n.nodeValue, m, last = 0, frag = document.createDocumentFragment(), ok = false;
      re.lastIndex = 0;
      while ((m = re.exec(s))) {
        ok = true;
        if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
        var mk = document.createElement('mark'); mk.className = 'hit'; mk.textContent = m[0];
        frag.appendChild(mk); hits.push(mk);
        last = m.index + m[0].length;
      }
      if (ok) { if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last))); n.parentNode.replaceChild(frag, n); }
    } else if (n.nodeType === 1 && n.tagName !== 'MARK' && n.tagName !== 'SCRIPT') {
      Array.prototype.slice.call(n.childNodes).forEach(walk);
    }
  }
  if (hits.length) { hitI = 0; allumerHit(); }
}
function allumerHit() {
  hits.forEach(function (h, i) { h.classList.toggle('cur', i === hitI); });
  if (hits[hitI]) hits[hitI].scrollIntoView({ block: 'center', behavior: 'smooth' });
}
$('searchX').onclick = $('searchDone').onclick = fermerRecherche;
$('findInput').addEventListener('input', function () { markHits(this.value.trim()); });
$('searchNext').onclick = function () { if (!hits.length) return; hitI = (hitI + 1) % hits.length; allumerHit(); };
$('searchPrev').onclick = function () { if (!hits.length) return; hitI = (hitI - 1 + hits.length) % hits.length; allumerHit(); };

/* ---------- Menu ⋯ ---------- */
function fermerMenu() {
  $('menuPop').hidden = true;
  $('overlay').hidden = true;
}
function ouvrirMenu() {
  var pop = $('menuPop');
  pop.innerHTML = '';
  function item(lab, ico, fn) {
    var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem');
    b.innerHTML = '<span>' + esc(lab) + '</span>' + ico;
    b.onclick = fn; pop.appendChild(b);
  }
  var user = '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/></svg>';
  var search = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5"/></svg>';
  var share = '<svg viewBox="0 0 24 24"><path d="M12 5v10M8 9l4-4 4 4"/><path d="M5 15v3a1 1 0 001 1h12a1 1 0 001-1v-3"/></svg>';
  item('Voir le profil', user, function () { fermerMenu(); ecranProfil(); });
  item('Rechercher dans la conversation', search, function () { ouvrirRecherche(); });
  item('Partager la conversation', share, function () { fermerMenu(); partagerConv(); });
  if (window.Ordinateur) item('Ordinateur de Laura', '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>', function () { fermerMenu(); Ordinateur.ouvrir({ jeton: S.jeton, envoyer: envoyer }); });
  if (window.PCTom && PCTom.visible()) item('PC de Tom', '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="13" rx="2"/><path d="M7 21h10M12 16v5M6 8l3 2-3 2M11 12h4"/></svg>', function () { fermerMenu(); PCTom.ouvrir(); });
  var btn = $('menuBtn').getBoundingClientRect();
  pop.style.top = (btn.bottom + 6) + 'px';
  pop.style.right = (window.innerWidth - btn.right) + 'px';
  pop.style.left = 'auto';
  pop.hidden = false;
  $('overlay').hidden = false;
}
$('menuBtn').onclick = function (e) { e.stopPropagation(); if ($('menuPop').hidden) ouvrirMenu(); else fermerMenu(); };
/* appui long sur la pastille du nom : même menu */
(function () {
  var w = $('chatWho'), tm = 0;
  if (!w) return;
  var go = function () { tm = 0; hap(); ouvrirMenu(); };
  w.addEventListener('touchstart', function () { clearTimeout(tm); tm = setTimeout(go, 420); }, { passive: true });
  w.addEventListener('touchend', function () { clearTimeout(tm); }, { passive: true });
  w.addEventListener('touchmove', function () { clearTimeout(tm); }, { passive: true });
  w.addEventListener('contextmenu', function (e) { e.preventDefault(); clearTimeout(tm); ouvrirMenu(); });
})();
if (window.LauraMode) LauraMode.maj();
$('overlay').onclick = fermerMenu;
function partagerConv() {
  if (!S.conv) { alerte('Aucune conversation à partager.'); return; }
  var url = 'https://github.com/' + S.depot + '/issues/' + S.conv;
  iosAlerte('Partager la conversation ?', 'Le lien GitHub de cette discussion sera copié.', function () {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { alerte('Lien copié.'); }, function () { alerte(url); });
    } else alerte(url);
  });
}
window.alerte = alerte;
window.iosAlerte = iosAlerte;
function iosAlerte(titre, corps, ok) {
  $('alertTitle').textContent = titre;
  $('alertBody').textContent = corps;
  $('iosAlert').hidden = false;
  $('alertOk').onclick = function () { $('iosAlert').hidden = true; ok && ok(); };
  $('alertCancel').onclick = function () { $('iosAlert').hidden = true; };
}

/* ---------- Morph chat ↔ home (glissement horizontal depuis le bord gauche) ---------- */
function resetCard() {
  var c = $('chatView');
  c._carding = false;
  S._carteR = null;
  c.classList.remove('carding');
  c.style.transform = '';
  c.style.borderRadius = '';
  if ($('home')) {
    $('home').style.transform = '';
    $('home').style.opacity = '';
    $('home').classList.remove('sous-chat', 'nav-anim');
    Array.prototype.forEach.call($('home').querySelectorAll('.home-top, .home-bottom'), function (b) { b.style.opacity = ''; });
  }
  c.classList.remove('nav-anim', 'nav-slide');
  if ($('backBtn')) { $('backBtn').style.transform = ''; $('backBtn').style.opacity = ''; }
  if ($('chatWho')) { $('chatWho').style.transform = ''; $('chatWho').style.opacity = ''; }
  c.style.opacity = '';
  if ($('menuBtn')) $('menuBtn').style.opacity = '';
  if ($('morph')) $('morph').hidden = true;
  if ($('chatAv')) $('chatAv').style.opacity = '';
  if ($('chatName')) $('chatName').style.opacity = '';
  if ($('homeAv')) $('homeAv').style.opacity = '';
  if ($('homeName')) $('homeName').style.opacity = '';
  S._cardP = 0;
}
function lerp(a, b, p) { return a + (b - a) * p; }
var _springId = 0, _springTimer = 0;
var _navTimer = 0, _navId = 0;
function motionOk() {
  return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
function cancelNav() {
  _navId++;
  clearTimeout(_navTimer);
  var c = $('chatView'), h = $('home');
  if (c) c.classList.remove('nav-anim');
  if (h) h.classList.remove('nav-anim');
}
function cancelSpring() {
  _springId++;
  clearTimeout(_springTimer);
  cancelNav();
}
function animerNav(from, to, done) {
  cancelSpring();
  from = Math.max(0, Math.min(1, Number(from) || 0));
  to = Math.max(0, Math.min(1, Number(to) || 0));
  if (!motionOk() || Math.abs(from - to) < 0.001) {
    appliquerCarte(to);
    if (done) done();
    return;
  }
  appliquerCarte(from);
  var c = $('chatView'), h = $('home');
  if (c) c.getBoundingClientRect();
  var id = _navId;
  requestAnimationFrame(function () {
    if (id !== _navId) return;
    if (c) c.classList.add('nav-anim');
    if (h) h.classList.add('nav-anim');
    requestAnimationFrame(function () {
      if (id !== _navId) return;
      appliquerCarte(to);
    });
  });
  _navTimer = setTimeout(function () {
    if (id !== _navId) return;
    if (c) c.classList.remove('nav-anim');
    if (h) h.classList.remove('nav-anim');
    if (done) done();
  }, 360);
}
function spring(from, to, omega, onup, ondone) {
  cancelSpring();
  var id = _springId;
  var t0 = performance.now();
  var finished = false;
  function finish() {
    if (finished || id !== _springId) return;
    finished = true;
    clearTimeout(_springTimer);
    onup(to);
    if (ondone) ondone();
  }
  _springTimer = setTimeout(finish, 1000);
  function frame(now) {
    if (id !== _springId || finished) return;
    var t = (now - t0) / 1000;
    var e = Math.exp(-(omega || 16) * t);
    var k = e * (1 + (omega || 16) * t);
    var v = to + (from - to) * k;
    v = from < to ? Math.min(to, Math.max(from, v)) : Math.min(from, Math.max(to, v));
    onup(v);
    if (k < 0.008 || t > 0.7) { finish(); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
/* Mesures faites une seule fois par geste (chat non transformé), puis transform/opacity uniquement */
function mesurerCarte() {
  var c = $('chatView');
  var tr = c.style.transform;
  c.style.transform = 'none';
  var r = {
    a0: $('chatAv').getBoundingClientRect(), a1: $('homeAv').getBoundingClientRect(),
    n0: $('chatName').getBoundingClientRect(), n1: $('homeName').getBoundingClientRect(),
    w: c.offsetWidth || window.innerWidth || 390
  };
  c.style.transform = tr;
  if (!r.a0.width || !r.a1.width) return null;
  var morph = $('morph'), av = $('morphAv'), nm = $('morphName');
  if (morph && av && nm) {
    /* taille finale (grande) puis réduction : l’image reste nette pendant l’animation */
    av.style.width = r.a1.width + 'px'; av.style.height = r.a1.height + 'px';
    nm.textContent = NOM;
    nm.style.fontSize = '16px'; nm.style.fontWeight = '500';
    nm.style.maxWidth = (r.n0.width || 200) + 'px';
  }
  return r;
}
window.addEventListener('resize', function () { S._carteR = null; });
function appliquerCarte(p) {
  /* Chat 0→100 % (z-index au-dessus, ombre à gauche) ; accueil -30 %→0, opacité 0.8→1.
     À p=0 le chat est ouvert : l’accueil reste calé à -30 % / 0.8 dessous, prêt pour le retour. */
  p = Math.max(0, Math.min(1, Number(p) || 0));
  S._cardP = p;
  var c = $('chatView'), h = $('home');
  if (!c) return p;
  if (c.hidden) c.hidden = false;
  if (h && h.hidden) h.hidden = false;
  var sliding = p > 0.001;
  if (c._carding !== sliding) {
    c._carding = sliding;
    c.classList.toggle('carding', sliding);
    c.classList.toggle('nav-slide', sliding);
  }
  if (h) h.classList.add('sous-chat');
  c.style.transform = 'translate3d(' + (p * 100).toFixed(3) + '%,0,0)';
  if (h) {
    h.style.transform = 'translate3d(' + (-30 * (1 - p)).toFixed(3) + '%,0,0)';
    h.style.opacity = String((0.8 + 0.2 * p).toFixed(3));
  }
  if ($('morph')) $('morph').hidden = true;
  return p;
}
function fermerChatMorph() {
  var start = Math.max(0, Math.min(1, S._cardP || 0));
  animerNav(start, 1, function () {
    resetCard();
    $('chatView').hidden = true;
    if ($('homeAv')) $('homeAv').style.opacity = '';
    if ($('homeName')) $('homeName').style.opacity = '';
    S.ecran = 'home';
    mem.ecrire('si_ecran', 'home');
    themeColor('#141414');
    S._cardP = 0;
  });
}
function ouvrirChatMorph() {
  $('chatView').hidden = false;
  $('home').hidden = false;
  S.ecran = 'chat';
  themeColor('#141414');
  animerNav(1, 0, function () {
    var c = $('chatView'), h = $('home');
    if (c) { c.classList.remove('nav-anim', 'carding', 'nav-slide'); c._carding = false; }
    if (h) h.classList.remove('nav-anim');
    $('chatView').hidden = false;
    setTimeout(function () { var f = $('fil'); if (f) f.scrollTop = f.scrollHeight; }, 30);
  });
}
function revenirCarte() {
  var p = Math.max(0, Math.min(1, S._cardP || 0));
  if (p <= 0) { resetCard(); return; }
  animerNav(p, 0, function () { resetCard(); });
}
$('homeAvatar').addEventListener('click', function () {
  if (!S.jeton) return;
  var n = S.conv || (S.convs[0] && S.convs[0].number) || 0;
  if (n) choisir(n, { morph: true });
  else { montrerChat(true); ouvrirChatMorph(); }
});
$('backBtn').addEventListener('click', function () { if (S.modeVocal) { fermerModeVocal(); return; } fermerChatMorph(); });

(function () {
  var on = false, x0 = 0, y0 = 0, locked = null, lastX = 0, lastT = 0, vx = 0;
  var chat = $('chatView');
  function overlaysBloquent() {
    return S.ecran !== 'chat'
      || !$('push').hidden
      || !$('settingsSheet').hidden
      || !$('iosAlert').hidden
      || ($('lightbox') && !$('lightbox').hidden)
      || ($('createSheet') && !$('createSheet').hidden)
      || ($('reactSheet') && !$('reactSheet').hidden)
      || ($('flagSheet') && !$('flagSheet').hidden)
      || S._lpOuvert
      || $('composer').classList.contains('full');
  }
  function pointerXY(e) {
    if (e.changedTouches && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.clientX != null) return { x: e.clientX, y: e.clientY };
    return null;
  }
  function start(e) {
    if (overlaysBloquent()) return;
    var pt = pointerXY(e);
    if (!pt) return;
    if (pt.x > 28) return;
    cancelSpring();
    on = true;
    locked = null;
    x0 = pt.x; y0 = pt.y;
    lastX = pt.x; lastT = performance.now(); vx = 0;
  }
  function move(e) {
    if (!on) return;
    var pt = pointerXY(e);
    if (!pt) return;
    var dx = pt.x - x0, dy = pt.y - y0;
    if (locked === null && (Math.abs(dx) + Math.abs(dy) > 8)) {
      locked = (Math.abs(dx) > Math.abs(dy) * 1.15 && dx > 0) ? 'x' : 'y';
      if (locked === 'y') {
        on = false;
        if (S._cardP) revenirCarte();
        return;
      }
    }
    if (locked !== 'x') return;
    if (e.cancelable) e.preventDefault();
    var now = performance.now();
    var dt = now - lastT;
    if (dt > 0) vx = (pt.x - lastX) / dt;
    lastX = pt.x; lastT = now;
    var p = Math.max(0, Math.min(1, dx / (chat.offsetWidth || 390)));
    S._carteCible = p;
    if (!S._carteRaf) S._carteRaf = requestAnimationFrame(function () { S._carteRaf = 0; if (on) appliquerCarte(S._carteCible); });
  }
  function settle(e, opts) {
    if (!on) return;
    on = false;
    var lockedDir = locked;
    locked = null;
    var annule = opts && opts.cancel;
    if (annule || lockedDir !== 'x') {
      if (S._cardP) revenirCarte();
      else resetCard();
      vx = 0;
      return;
    }
    var pt = e ? pointerXY(e) : null;
    var dx = pt ? (pt.x - x0) : 0;
    var p = Math.max(0, Math.min(1, S._cardP || 0));
    if (p > 0.4 || vx > 0.5) fermerChatMorph();
    else revenirCarte();
    vx = 0;
  }
  var optsPas = { passive: true };
  var optsBloq = { passive: false };
  chat.addEventListener('touchstart', start, optsPas);
  chat.addEventListener('touchmove', move, optsBloq);
  chat.addEventListener('touchend', settle);
  chat.addEventListener('touchcancel', function (e) { settle(e, { cancel: true }); });
  chat.addEventListener('pointercancel', function (e) { settle(e, { cancel: true }); });
  window.addEventListener('pointercancel', function (e) { settle(e, { cancel: true }); });
  window.addEventListener('blur', function () { if (on) settle(null, { cancel: true }); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && on) settle(null, { cancel: true }); });
  window.addEventListener('pagehide', function () { if (on) settle(null, { cancel: true }); });
  /* expose un accesseur de test */
  function verrouillerDefilement() {
    try {
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
      var app = document.getElementById('app');
      if (app) app.scrollLeft = 0;
    } catch (err) {}
  }
  function corrigerCarteEgarée() {
    verrouillerDefilement();
    if (on) return;
    var p = Math.max(0, Math.min(1, S._cardP || 0));
    if (S.ecran === 'chat' && p > 0 && p < 1) revenirCarte();
    else if (S.ecran === 'chat' && p === 0) resetCard();
  }
  window.addEventListener('pageshow', corrigerCarteEgarée);
  window.addEventListener('resize', verrouillerDefilement);
  window.addEventListener('orientationchange', function () { setTimeout(corrigerCarteEgarée, 50); });
  document.addEventListener('scroll', verrouillerDefilement, { passive: true, capture: true });
  window.__chatGeste = {
    start: start, move: move, settle: settle,
    appliquer: appliquerCarte, reset: resetCard, revenir: revenirCarte,
    enCours: function () { return !!on; },
    p: function () { return S._cardP || 0; },
    ecran: function () { return S.ecran; },
    etat: etatLigne,
    pied: retirerPiedRobot,
    labels: function () {
      return Array.prototype.map.call(document.querySelectorAll('#typingStack em'), function (n) {
        return { text: n.textContent, cls: n.className };
      });
    }
  };
})();

/* ---------- Clavier iOS : le chat épouse la zone visible, le composer suit le clavier ---------- */
(function () {
  var vv = window.visualViewport;
  if (!vv) return;
  var raf = 0, ouvert = false;
  function maj() {
    raf = 0;
    var c = $('chatView');
    /* Repère = hauteur de mise en page (inchangée par le clavier sur iOS). Ne PAS retrancher vv.offsetTop : quand iOS fait
       glisser la page de toute la hauteur du clavier pour montrer le champ, innerHeight − height − offsetTop ≈ 0 et le clavier
       passait pour fermé (en-tête et fil sortis par le haut, écran noir au-dessus du composer). */
    var base = document.documentElement.clientHeight || window.innerHeight;
    var on = (base - vv.height) > 80 && Math.abs((vv.scale || 1) - 1) < 0.01;
    if (on) {
      c.style.height = Math.round(vv.height) + 'px';
      c.style.top = Math.round(vv.offsetTop) + 'px';
      c.style.bottom = 'auto';
    } else if (ouvert) {
      c.style.height = ''; c.style.top = ''; c.style.bottom = '';
    }
    if (on !== ouvert) {
      ouvert = on;
      c.classList.toggle('kb-open', on);
      var fil = $('fil');
      if (on && fil.scrollHeight - fil.scrollTop - fil.clientHeight < 200) requestAnimationFrame(function () { fil.scrollTop = fil.scrollHeight; });
    }
  }
  function planifier() { if (!raf) raf = requestAnimationFrame(maj); }
  vv.addEventListener('resize', planifier, { passive: true });
  vv.addEventListener('scroll', planifier, { passive: true });
})();

/* ---------- Réglages ---------- */
function ouvrirSettings() {
  hap();
  majCompteUI();
  $('settingsBackdrop').hidden = false;
  $('settingsSheet').hidden = false;
  requestAnimationFrame(function () { $('settingsSheet').classList.add('open'); });
}
function fermerSettings() {
  $('settingsSheet').classList.remove('open');
  $('settingsBackdrop').classList.add('hide');
  setTimeout(function () {
    $('settingsSheet').hidden = true;
    $('settingsBackdrop').hidden = true;
    $('settingsBackdrop').classList.remove('hide');
  }, 420);
}
$('btnSettings').onclick = ouvrirSettings;
$('settingsClose').onclick = fermerSettings;
$('settingsBackdrop').onclick = fermerSettings;
(function () {
  var y0 = 0, on = false, sh = $('settingsSheet');
  sh.addEventListener('touchstart', function (e) {
    if (!e.touches[0]) return;
    if ($('settingsBody').scrollTop > 0 && e.target.closest('.sheet-scroll')) return;
    y0 = e.touches[0].clientY; on = true; sh._dy = 0;
  }, { passive: true });
  sh.addEventListener('touchmove', function (e) {
    if (!on) return;
    var dy = e.touches[0].clientY - y0;
    if (dy > 0) { sh._dy = dy; sh.style.transition = 'none'; sh.style.transform = 'translateY(' + dy + 'px)'; }
  }, { passive: true });
  sh.addEventListener('touchend', function () {
    if (!on) return; on = false;
    sh.style.transition = '';
    var dy = sh._dy || 0; sh.style.transform = '';
    if (dy > 110) fermerSettings();
  });
})();

function majCompteUI() {
  $('accName').textContent = S.moiNom || S.moi || '—';
  $('accLogin').textContent = S.moi ? ('@' + S.moi) : '—';
  $('depotVal').textContent = S.depot || '—';
  $('tzVal').textContent = S.tzauto ? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris') : (mem.lire('si_tz') || 'Europe/Paris');
  $('tzToggle').classList.toggle('on', S.tzauto);
  $('tzToggle').setAttribute('aria-checked', S.tzauto ? 'true' : 'false');
  $('notifToggle').classList.toggle('on', S.notif);
  $('notifToggle').setAttribute('aria-checked', S.notif ? 'true' : 'false');
  $('hapVal').textContent = S.hap ? 'Activé' : 'Désactivé';
  $('utilVal').textContent = S.utilAff || '—';
  var gh = 'https://github.com/' + (S.depot || 'wwwh8hv4w5-lang/fsm-si');
  $('rowRepo').href = gh;
  $('rowAide').href = gh + '/blob/' + (S.branche || 'main') + '/LISEZ-MOI.md';
}
$('tzToggle').onclick = function () {
  S.tzauto = !S.tzauto; mem.ecrire('si_tzauto', S.tzauto ? '1' : '0'); hap(); majCompteUI();
};
$('notifToggle').onclick = function () {
  if (!S.notif) {
    if (typeof Notification === 'undefined') { alerte('Les notifications ne sont pas disponibles dans ce navigateur.'); return; }
    Notification.requestPermission().then(function (p) {
      S.notif = p === 'granted'; mem.ecrire('si_notif', S.notif ? '1' : '0'); majCompteUI();
      if (!S.notif) alerte('Notifications refusées par le navigateur.');
      /* build 49 : notifications push des tâches de fond, même appli fermée */
      else if (window.LauraTaches && LauraTaches.pushPossible()) LauraTaches.activerPush(false).then(function () { alerte('Notifications activées : je te préviens quand une tâche est finie, même appli fermée.'); }, function (e) { alerte(String(e && e.message || e)); });
    });
  } else { S.notif = false; mem.ecrire('si_notif', '0'); majCompteUI(); if (window.LauraTaches) LauraTaches.desactiverPush(); }
  hap();
};
$('deco').onclick = function () {
  iosAlerte('Se déconnecter ?', 'Tu devras te reconnecter avec tes identifiants du FSM HUB.', function () {
    mem.oter('si_jeton'); S.jeton = ''; S.viaProxy = false; clearTimeout(S.minuteur);
    fetch(PROXY + '/session/sortie', { method: 'POST', credentials: 'include' }).catch(function () {});
    fermerSettings(); closePush(true); montrerLogin('');
  });
};

var pushFrom = null;
function openPush(title, build, fromEl) {
  pushFrom = fromEl || $('settingsSheet');
  $('pushTitle').textContent = title;
  $('pushBody').textContent = '';
  if ($('pushExtra')) $('pushExtra').textContent = '';
  build($('pushBody'));
  $('push').hidden = false;
  if (pushFrom && pushFrom.classList) pushFrom.classList.add('under-parallax');
  requestAnimationFrame(function () {
    $('push').classList.add('open');
    if (pushFrom && pushFrom.classList) pushFrom.classList.add('back');
  });
}
function closePush(instant) {
  var p = $('push');
  p.classList.remove('open');
  if (pushFrom && pushFrom.classList) pushFrom.classList.remove('back');
  var done = function () {
    p.hidden = true;
    if (pushFrom && pushFrom.classList) pushFrom.classList.remove('under-parallax');
    $('pushBody').textContent = '';
    if (window.Coffre && Coffre.surFermeture) Coffre.surFermeture();
  };
  if (instant) done(); else setTimeout(done, 350);
}
$('pushBack').onclick = function () { if (window.Coffre && Coffre.retour && Coffre.retour()) return; closePush(); };
(function () {
  var on = false, x0 = 0, locked = null, p = $('push');
  p.addEventListener('touchstart', function (e) {
    if (!e.touches[0] || e.touches[0].clientX > 28) return;
    on = true; x0 = e.touches[0].clientX; locked = null;
  }, { passive: true });
  p.addEventListener('touchmove', function (e) {
    if (!on) return;
    var dx = e.touches[0].clientX - x0;
    if (locked === null && Math.abs(dx) > 8) locked = 'x';
    if (locked === 'x' && dx > 0) {
      p.style.transition = 'none';
      p.style.transform = 'translateX(' + dx + 'px)';
      if (pushFrom) pushFrom.style.transform = 'translateX(' + (-30 + 30 * Math.min(1, dx / p.offsetWidth)) + '%)';
    }
  }, { passive: true });
  p.addEventListener('touchend', function (e) {
    if (!on) return; on = false;
    var dx = (e.changedTouches[0] ? e.changedTouches[0].clientX : x0) - x0;
    p.style.transition = ''; p.style.transform = '';
    if (pushFrom) pushFrom.style.transform = '';
    if (dx > 80) closePush();
  });
})();

function ecranCompte(box) {
  var g = el('div', 'group');
  var r = el('div', 'row');
  var av = el('div', 'av sm'); av.innerHTML = '<img src="./icons/tom.png" alt="">';
  r.appendChild(av);
  var t = el('div', 'row-txt'); t.innerHTML = '<div class="t">' + esc(S.moiNom || S.moi || '—') + '</div><div class="s">@' + esc(S.moi || '—') + '</div>';
  r.appendChild(t);
  r.appendChild(el('span', 'val', '✓'));
  g.appendChild(r);
  box.appendChild(g);
  var g2 = el('div', 'group');
  var d = el('button', 'row danger', 'Se déconnecter'); d.type = 'button';
  d.onclick = function () { $('deco').click(); };
  g2.appendChild(d);
  box.appendChild(g2);
  box.appendChild(el('p', 'sheet-foot', 'FSM SI · F.S.M AI. Le jeton reste uniquement dans ce navigateur.'));
}
function ecranUtil(box) {
  var head = el('div', 'util-head');
  head.innerHTML = '<span>Limite d’utilisation</span><span class="tiny"></span>';
  box.appendChild(head);
  var tr = el('div', 'track'); tr.appendChild(el('i', '', ''));
  box.appendChild(tr);
  box.appendChild(el('p', 'util-pct', S.utilAff || '—'));
  box.appendChild(el('p', 'invite', 'Aucun chiffre n’est affiché faute de donnée réelle (dépenses OpenRouter ou minutes Actions). Rien n’est inventé.'));
}
function ecranCoffre(box) {
  if (window.Coffre && typeof Coffre.ouvrir === 'function') Coffre.ouvrir(box);
  else box.appendChild(el('p', 'invite', 'Module du coffre-fort indisponible.'));
}
function ecranApps(box) {
  var badge = el('span', 'badge-pill', '—');
  var head = el('div', 'row'); head.style.border = '0';
  head.appendChild(el('span', 't', 'Connecter des applications'));
  head.appendChild(badge);
  box.appendChild(head);
  var chips = el('div', 'chip-row');
  ['Pour vous', 'Google', 'Notion'].forEach(function (c, i) {
    var b = el('button', 'chip' + (i === 0 ? ' on' : ''), c); b.type = 'button'; chips.appendChild(b);
  });
  box.appendChild(chips);
  var list = el('div', 'group');
  box.appendChild(list);
  list.appendChild(el('p', 'invite', 'Chargement…'));
  api(D() + '/contents/connecteurs.json?ref=' + encodeURIComponent(S.branche), { accept: 'application/vnd.github.raw+json', texte: true }).then(function (t) {
    var j = {}; try { j = JSON.parse(t); } catch (e) {}
    var rows = [];
    function add(nom, desc, on) { rows.push({ nom: nom, desc: desc, on: on }); }
    var apiC = j.api || {}, mcp = j.mcp || {};
    var hasG = !!(apiC.google || apiC.Google || apiC.GOOGLE);
    var hasN = !!(apiC.notion || apiC.Notion || apiC.NOTION);
    add('Google', 'Connecteur déclaré dans le dépôt', hasG);
    add('Notion', 'Connecteur déclaré dans le dépôt', hasN);
    Object.keys(apiC).forEach(function (k) {
      if (!/google|notion/i.test(k)) add(k, 'Connecteur API', true);
    });
    Object.keys(mcp).forEach(function (k) { add(k, 'Connecteur MCP', true); });
    var nOn = rows.filter(function (r) { return r.on; }).length;
    badge.textContent = nOn + ' connecté' + (nOn > 1 ? 's' : '');
    list.textContent = '';
    rows.forEach(function (r) {
      var row = el('div', 'row');
      row.appendChild(el('div', 'icon-sq', r.nom.charAt(0).toUpperCase()));
      var t2 = el('div', 'row-txt'); t2.innerHTML = '<div class="t">' + esc(r.nom) + '</div><div class="s">' + esc(r.desc) + '</div>';
      row.appendChild(t2);
      row.appendChild(el('span', 'pill-btn', r.on ? 'Gérer' : 'Connecter'));
      list.appendChild(row);
    });
    if (!rows.length) list.appendChild(el('p', 'invite', 'Aucun connecteur dans connecteurs.json.'));
  }).catch(function () {
    list.textContent = '';
    list.appendChild(el('p', 'invite', 'connecteurs.json est inaccessible.'));
  });
}
function ecranAuth(box) {
  var h = el('div', 'row'); h.style.border = '0';
  h.appendChild(el('span', 't', 'Autorisations'));
  var add = el('button', 'add-rule', 'Ajouter une règle'); add.type = 'button';
  h.appendChild(add);
  box.appendChild(h);
  box.appendChild(el('p', 'invite', 'Les actions sensibles (envoyer, publier, écrire ailleurs, supprimer) demandent ta validation — issues étiquetées « validation ».'));
  var liste = el('div', '');
  box.appendChild(liste);
  chargerValidationsDans(liste);
  add.onclick = function () {
    var nom = prompt('Nom de la règle locale (rappel, sur cet appareil) :');
    if (!nom) return;
    var rules = [];
    try { rules = JSON.parse(mem.lire('si_regles') || '[]'); } catch (e) {}
    rules.push({ t: nom, d: Date.now() });
    mem.ecrire('si_regles', JSON.stringify(rules));
    renderRegles();
  };
  function renderRegles() {
    var old = box.querySelector('.regles-loc'); if (old) old.remove();
    var wrap = el('div', 'regles-loc');
    var rules = []; try { rules = JSON.parse(mem.lire('si_regles') || '[]'); } catch (e) {}
    rules.forEach(function (r) {
      var c = el('div', 'rule-card');
      c.appendChild(el('div', '', r.t));
      wrap.appendChild(c);
    });
    box.appendChild(wrap);
  }
  renderRegles();
}
function chargerValidationsDans(z) {
  api(D() + '/issues?labels=validation&state=open&per_page=50').then(function (l) {
    z.textContent = '';
    if (!l.length) { z.appendChild(el('p', 'invite', 'Rien à valider. Quand un Bot veut envoyer, publier, écrire ailleurs ou supprimer, sa demande arrive ici.')); return; }
    l.forEach(function (i) {
      var bon = el('article', 'fiche');
      bon.appendChild(el('h3', '', String(i.title).replace(/^⏸️\s*Validation\s*:\s*/, '')));
      var c = el('div', ''); c.innerHTML = rendre(String(i.body || '').replace(/Réponds \*\*valider\*\*[^\n]*/, ''));
      bon.appendChild(c);
      var actes = el('div', 'actes');
      [['Valider', 'valider', 'ok'], ['Refuser', 'refuser', '']].forEach(function (a) {
        var b = el('button', a[2], a[0]); b.type = 'button';
        b.onclick = function () {
          if (a[1] === 'valider' && !confirm('Valider cette action ? Elle sera exécutée.')) return;
          Array.prototype.forEach.call(actes.children, function (x) { x.disabled = true; });
          api(D() + '/issues/' + i.number + '/comments', { method: 'POST', json: { body: a[1] } }).then(function () {
            actes.textContent = a[1] === 'valider' ? 'Validée. Le résultat arrive dans la conversation.' : 'Refusée.';
            S.convsVues = 0;
          }).catch(function (e) { alerte(e.message); });
        };
        actes.appendChild(b);
      });
      bon.appendChild(actes);
      z.appendChild(bon);
    });
  }).catch(function (e) { z.textContent = ''; z.appendChild(el('p', 'invite', e.message)); });
}
function ecranDepot(box) {
  box.appendChild(el('p', 'invite', 'Dépôt GitHub auquel Laura F.S.M est reliée (ordinateur du Bot).'));
  var g = el('div', 'group');
  var r = el('div', 'row'); r.appendChild(el('span', 't', 'Dépôt')); r.appendChild(el('span', 'val', S.depot || '—'));
  g.appendChild(r);
  box.appendChild(g);
}
function ecranDevices(box) {
  box.appendChild(el('p', 'invite', 'Cet appareil uniquement — rien d’autre n’est inventé.'));
  var g = el('div', 'group');
  var r = el('div', 'row');
  var t = el('div', 'row-txt');
  t.innerHTML = '<div class="t">Ce navigateur</div><div class="s">' + esc((navigator.userAgent || '').split(')').slice(0, 1).join(')').slice(0, 80)) + '</div>';
  r.appendChild(t);
  r.appendChild(el('span', 'val', '✓'));
  g.appendChild(r);
  box.appendChild(g);
}
function ecranImport(box) {
  box.appendChild(el('p', 'invite', 'Étape 1 — copie ce prompt, exporte ta mémoire ailleurs, puis colle le résultat ci-dessous. Il sera écrit dans memoire/faits/ du dépôt.'));
  var prompt = 'Résume en français, sous forme de faits courts (un par ligne, préfixe « - »), ce que tu retiens de moi : préférences, projets, décisions, contacts utiles. Pas de secret ni mot de passe.';
  var pre = el('div', 'prompt-box', prompt);
  box.appendChild(pre);
  var copy = el('button', 'copy-btn', 'Copy prompt'); copy.type = 'button';
  copy.onclick = function () {
    if (navigator.clipboard) navigator.clipboard.writeText(prompt).then(function () { copy.textContent = 'Copié'; });
  };
  box.appendChild(copy);
  box.appendChild(el('p', 'invite', 'Étape 2 — colle ici les faits à importer.'));
  var ta = document.createElement('textarea'); ta.id = 'importMem'; ta.placeholder = 'Colle ta mémoire ici…';
  box.appendChild(ta);
  var go = el('button', 'full-btn', 'Importer dans memoire/faits'); go.type = 'button'; go.disabled = true;
  ta.addEventListener('input', function () { go.disabled = !ta.value.trim(); });
  go.onclick = function () {
    var corps = ta.value.trim(); if (!corps) return;
    go.disabled = true;
    var path = 'memoire/faits/import-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.md';
    var contenu = '---\nsource: import\ndate: ' + new Date().toISOString() + '\n---\n\n' + corps + '\n';
    var b64 = btoa(unescape(encodeURIComponent(contenu)));
    api(D() + '/contents/' + encP(path), { method: 'PUT', json: { message: 'import mémoire', content: b64, branch: S.branche } })
      .then(function () { alerte('Mémoire importée dans ' + path + '.'); closePush(); })
      .catch(function (e) { alerte(e.message); go.disabled = false; });
  };
  box.appendChild(go);
}
function ecranApparence(box) {
  var cur = mem.lire('si_appar') || 'système';
  ['Suivre le système', 'Sombre', 'Clair'].forEach(function (lab, i) {
    var v = ['système', 'sombre', 'clair'][i];
    var r = el('button', 'row', ''); r.type = 'button';
    r.appendChild(el('span', 't', lab));
    if (cur === v) r.appendChild(el('span', 'val', '✓'));
    r.onclick = function () { mem.ecrire('si_appar', v); $('appVal').textContent = lab; closePush(); };
    box.appendChild(r);
  });
  box.appendChild(el('p', 'invite', 'L’interface suit le visuel sombre de Laura F.S.M. La préférence est enregistrée sur cet appareil.'));
}
function ecranLangue(box) {
  box.appendChild(el('p', 'invite', 'L’interface est en français, langue de FSM SI. « Système » conserve ce choix.'));
}
function ecranHaptique(box) {
  var r = el('div', 'row toggle-row');
  r.appendChild(el('span', 't', 'Haptique'));
  var tg = el('button', 'toggle' + (S.hap ? ' on' : '')); tg.type = 'button'; tg.setAttribute('role', 'switch');
  tg.onclick = function () { S.hap = !S.hap; mem.ecrire('si_hap', S.hap ? '1' : '0'); tg.classList.toggle('on', S.hap); $('hapVal').textContent = S.hap ? 'Activé' : 'Désactivé'; hap(); };
  r.appendChild(tg);
  box.appendChild(r);
}
function ecranPartage(box) {
  box.appendChild(el('p', 'invite', 'Le jeton et tes messages ne partent que vers l’API GitHub du dépôt FSM SI, depuis ce navigateur. Rien n’est envoyé à un autre service par cette interface.'));
}
function ecranProfil() {
  openPush('', function (box) {
    $('pushTitle').textContent = '';
    var extra = $('pushExtra');
    extra.innerHTML = '';
    var sh = el('button', 'frost-btn'); sh.type = 'button'; sh.setAttribute('aria-label', 'Partager');
    sh.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v10M8 9l4-4 4 4"/><path d="M5 15v3a1 1 0 001 1h12a1 1 0 001-1v-3"/></svg>';
    sh.onclick = function () { partagerConv(); };
    var more = el('button', 'frost-btn'); more.type = 'button'; more.setAttribute('aria-label', 'Options');
    more.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" class="dots-h" fill="currentColor"><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/></svg>';
    more.onclick = function () { closePush(); ouvrirMenu(); };
    extra.appendChild(sh); extra.appendChild(more);
    $('pushBack').className = 'frost-btn';
    $('pushBack').innerHTML = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';

    var hero = el('div', 'prof-hero');
    hero.innerHTML = '<div class="av-wrap"><div class="av xl"><img src="./icons/laura.png" alt=""><span class="dot"></span></div><span class="star-badge">★</span></div><h1>' + esc(NOM) + '</h1>';
    box.appendChild(hero);
    var mod = el('button', 'mod-pill', 'Modifier'); mod.type = 'button';
    box.appendChild(mod);

    var g1 = el('div', 'group');
    var b1 = el('button', 'row'); b1.type = 'button';
    b1.innerHTML = '<span class="row-ico">📁</span><span class="t">Bibliothèque</span><span class="chev">›</span>';
    b1.onclick = function () { ecranBibli(); };
    g1.appendChild(b1);
    var ord = el('button', 'row'); ord.type = 'button';
    ord.innerHTML = '<span class="row-ico">🖥</span><span class="t">Ordinateur</span><span class="val" id="profOrdi">—</span><span class="chev">›</span>';
    ord.onclick = function () { if (window.Ordinateur) Ordinateur.ouvrir({ jeton: S.jeton, envoyer: envoyer }); else ecranDepot(); };
    g1.appendChild(ord);
    box.appendChild(g1);
    /* Écran de Laura en direct (ou le dernier écran s'il dort) ; tap = plein écran */
    if (window.Ordinateur && S.jeton) Ordinateur.vignette(box, S.jeton, ord.querySelector('#profOrdi'));

    box.appendChild(el('div', 'sec-lab', 'Configurer le Bot'));
    var g2 = el('div', 'group');
    var r2 = el('button', 'row'); r2.type = 'button';
    r2.innerHTML = '<span class="row-ico">⏱</span><span class="t">Routines</span><span class="val" id="profRoutines">—</span><span class="chev">›</span>';
    r2.onclick = function () { ecranRoutines(); };
    g2.appendChild(r2);
    box.appendChild(g2);

    var g3 = el('div', 'group');
    var nt = el('div', 'row toggle-row');
    /* build 50 : état réel de l'autorisation (accordée, refusée dans les réglages, pas encore demandée) */
    var pn = typeof Notification === 'undefined' ? 'indispo' : Notification.permission;
    var etatN = pn === 'granted' ? (S.notif ? 'Activées' : 'Autorisées, coupées ici') : pn === 'denied' ? 'Refusées — à changer dans les réglages de l’appareil' : pn === 'indispo' ? 'Indisponibles ici' : 'Pas encore activées';
    nt.innerHTML = '<span class="t">Notifications</span><span class="val" id="notifEtat" style="margin-left:auto;margin-right:10px;color:#9a9a9a;font-size:.82rem;text-align:right">' + esc(etatN) + '</span>';
    var tg = el('button', 'toggle' + (S.notif ? ' on' : '')); tg.type = 'button';
    tg.onclick = function () { $('notifToggle').click(); setTimeout(function () { tg.classList.toggle('on', S.notif); }, 200); };
    nt.appendChild(tg);
    g3.appendChild(nt);
    box.appendChild(g3);
    box.appendChild(el('p', 'sheet-foot', 'FSM SI · F.S.M AI'));
    fichierTexte('taches/planifiees.json').then(function (t) {
      var arr = []; try { arr = JSON.parse(t).filter(function (x) { return x.actif; }); } catch (e) {}
      var n = document.getElementById('profRoutines');
      if (n) n.textContent = arr.length ? (arr.length + ' active' + (arr.length > 1 ? 's' : '')) : '0 active';
    }).catch(function () {});
  }, $('chatView'));
}
function ecranBibli() {
  openPush('Bibliothèque', function (box) {
    box.appendChild(el('p', 'invite', 'Fichiers déposés dans entree/ et sorties/ du dépôt, pour la conversation ouverte.'));
    if (!S.conv) { box.appendChild(el('p', 'invite', 'Ouvre une conversation pour voir ses fichiers.')); return; }
    var z = el('div', ''); box.appendChild(z);
    Promise.all([
      api(D() + '/contents/entree/' + S.conv + '?ref=' + encodeURIComponent(S.branche)).catch(function () { return []; }),
      api(D() + '/contents/sorties/' + S.conv + '?ref=' + encodeURIComponent(S.branche)).catch(function () { return []; })
    ]).then(function (r) {
      function sec(titre, items) {
        z.appendChild(el('h3', '', titre));
        if (!items || !items.length) { z.appendChild(el('p', 'invite', 'Aucun.')); return; }
        items.forEach(function (f) {
          if (f.type !== 'file') return;
          var a = el('button', 'row', f.name); a.type = 'button';
          a.onclick = function () {
            blobDepot(f.path).then(function (u) {
              if (/\.(png|jpg|jpeg|gif|webp)$/i.test(f.name)) ouvrirMedia(u, false);
              else if (/\.(mp4|webm|mov)$/i.test(f.name)) ouvrirMedia(u, true);
              else { var l = document.createElement('a'); l.href = u; l.download = f.name; l.click(); }
            }).catch(function (e) { alerte(e.message); });
          };
          z.appendChild(a);
        });
      }
      sec('Envoyés (entree/)', r[0]);
      sec('Livrés (sorties/)', r[1]);
    });
  }, $('push'));
}
function ecranRoutines() {
  openPush('Routines', function (box) {
    fichierTexte('taches/planifiees.json').then(function (t) {
      var arr = []; try { arr = JSON.parse(t); } catch (e) {}
      var act = arr.filter(function (x) { return x.actif; });
      if (!act.length) { box.appendChild(el('p', 'invite', 'Aucune routine active dans taches/planifiees.json.')); return; }
      act.forEach(function (x) {
        var f = el('div', 'fiche');
        f.appendChild(el('b', '', (x.type === 'veille' ? 'Veille : ' : '') + (x.titre || '')));
        f.appendChild(el('p', '', x.prochaine ? ('Prochaine passe le ' + new Date(x.prochaine).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })) : ''));
        box.appendChild(f);
      });
    }).catch(function () { box.appendChild(el('p', 'invite', 'Fichier taches/planifiees.json inaccessible.')); });
  }, $('push'));
}

$('rowAccount').onclick = function () { openPush('Compte', ecranCompte); };
$('rowUtil').onclick = function () { openPush('Utilisation', ecranUtil); };
$('rowCoffre').onclick = function () { openPush('Coffre-fort', ecranCoffre); };
$('rowApps').onclick = function () { openPush('Connecter des applications', ecranApps); };
$('rowAuth').onclick = function () { openPush('Autorisations', ecranAuth); };
$('rowDepot').onclick = function () { openPush('Ordinateur du Bot', ecranDepot); };
$('rowDevices').onclick = function () { openPush('Gérer vos appareils', ecranDevices); };
$('rowImport').onclick = function () { openPush('Import Memory', ecranImport); };
$('rowApparence').onclick = function () { openPush('Apparence', ecranApparence); };
$('rowLangue').onclick = function () { openPush('Langue', ecranLangue); };
$('rowHaptique').onclick = function () { openPush('Haptique', ecranHaptique); };
$('rowPartage').onclick = function () { openPush('Partage de données', ecranPartage); };
$('rowComments').onclick = function () {
  fermerSettings();
  choisir(0, { morph: false });
  montrerChat(false);
  $('texte').value = '';
  $('texte').placeholder = 'Envoyer des commentaires…';
  $('texte').focus();
};
$('chatWho').onclick = function () { ecranProfil(); };

/* ---------- Grille / recherche / nouveau bot ---------- */
function ficheFront(t) {
  var m = String(t).match(/^---\n([\s\S]*?)\n---/), o = {};
  if (m) m[1].split('\n').forEach(function (l) { var k = l.indexOf(':'); if (k > 0) o[l.slice(0, k).trim()] = l.slice(k + 1).trim(); });
  return o;
}
function fichierTexte(p) { return api(D() + '/contents/' + encP(p) + '?ref=' + encodeURIComponent(S.branche), { accept: 'application/vnd.github.raw+json', texte: true }); }
function fiches(dossier) {
  return api(D() + '/contents/' + dossier + '?ref=' + encodeURIComponent(S.branche)).then(function (l) {
    return Promise.all((l || []).filter(function (f) { return /\.md$/.test(f.name) && !/\.carnet\.md$/.test(f.name); }).map(function (f) {
      return fichierTexte(f.path).then(function (t) { return { nom: f.name.slice(0, -3), meta: ficheFront(t) }; });
    }));
  }).catch(function () { return []; });
}
function ecranGrille() {
  openPush('Conversations', function (box) {
    box.appendChild(el('h3', '', 'Validations'));
    var zv = el('div', ''); box.appendChild(zv);
    chargerValidationsDans(zv);
    box.appendChild(el('h3', '', 'Bots'));
    var zb = el('div', 'fiches'); box.appendChild(zb);
    if (window.CreateBot) {
      CreateBot.lireBots().forEach(function (b) {
        var f = el('div', 'fiche');
        f.innerHTML = (CreateBot.svgPour(b.shape, b.color, 'home-bot-svg') || '');
        f.appendChild(el('b', '', b.name));
        var bt = el('button', 'pill-btn', 'Ouvrir'); bt.type = 'button';
        bt.onclick = function () { closePush(true); choisir(b.id, { morph: false }); };
        f.appendChild(bt);
        zb.appendChild(f);
      });
    }
    fiches('bots').then(function (bots) {
      if (!bots.length && !(window.CreateBot && CreateBot.lireBots().length)) { zb.appendChild(el('p', 'invite', 'Aucun Bot pour l’instant.')); return; }
      bots.forEach(function (b) {
        var f = el('div', 'fiche');
        f.appendChild(el('b', '', '@' + b.nom));
        f.appendChild(el('p', '', b.meta.role || ''));
        var bt = el('button', 'pill-btn', 'Écrire à @' + b.nom); bt.type = 'button';
        bt.onclick = function () { closePush(true); montrerChat(false); $('texte').value = '@' + b.nom + ' '; $('texte').focus(); taille(); };
        f.appendChild(bt);
        zb.appendChild(f);
      });
    });
    box.appendChild(el('h3', '', 'Discussions'));
    if (!S.convs.length) box.appendChild(el('p', 'invite', 'Aucune conversation pour l’instant.'));
    S.convs.forEach(function (c) {
      var it = el('button', 'conv-item'); it.type = 'button';
      it.innerHTML = '<div class="av sm"><img src="./icons/laura.png" alt=""></div><div class="meta"><div class="ttl">' + esc(c.title || ('#' + c.number)) + '</div><div class="sub">#' + c.number + ' · ' + esc(heure(c.updated_at)) + '</div></div>';
      it.onclick = function () { closePush(true); choisir(c.number, { morph: true }); };
      box.appendChild(it);
    });
    var neuve = el('button', 'full-btn', 'Nouvelle conversation'); neuve.type = 'button'; neuve.disabled = false;
    neuve.style.marginTop = '16px';
    neuve.onclick = function () { closePush(true); choisir(0); montrerChat(false); $('texte').focus(); };
    box.appendChild(neuve);
  }, $('home'));
}
$('btnGrid').onclick = function () { chargerConvs().then(ecranGrille, ecranGrille); };
$('btnSearch').onclick = function () {
  openPush('Rechercher', function (box) {
    var bar = el('div', 'float-search');
    var inp = document.createElement('input'); inp.placeholder = 'Rechercher'; inp.autofocus = true;
    bar.appendChild(inp); box.appendChild(bar);
    var res = el('div', ''); box.appendChild(res);
    function go() {
      var q = inp.value.trim().toLowerCase();
      res.textContent = '';
      var n = 0;
      S.convs.forEach(function (c) {
        if (q && String(c.title || '').toLowerCase().indexOf(q) < 0 && String(c.number).indexOf(q) < 0) return;
        n++;
        var it = el('button', 'conv-item'); it.type = 'button';
        it.innerHTML = '<div class="av sm"><img src="./icons/laura.png" alt=""></div><div class="meta"><div class="ttl">' + esc(c.title || ('#' + c.number)) + '</div><div class="sub">#' + c.number + '</div></div>';
        it.onclick = function () { closePush(true); choisir(c.number, { morph: true }); };
        res.appendChild(it);
      });
      if (!n) res.appendChild(el('p', 'invite', q ? 'Aucun résultat.' : 'Tes conversations apparaissent ici.'));
    }
    inp.addEventListener('input', go);
    chargerConvs().then(go, go);
  }, $('home'));
};

/* Créer un Bot : feuille et archive locale — voir create-bot.js (build 20261111-26). */
function ouvrirCreate() { if (window.CreateBot) CreateBot.ouvrir(); }
function fermerCreate() { if (window.CreateBot) CreateBot.fermer(); }

/* ---------- Connexion ---------- */
function demarrer() {
  return Promise.all([api('/user'), api(D())]).then(function (r) {
    S.moi = r[0].login; S.moiNom = r[0].name || r[0].login;
    S.branche = r[1].default_branch || 'main';
    $('aerreur').textContent = '';
    majCompteUI();
    return chargerConvs();
  }).then(function () {
    var ecran = mem.lire('si_ecran');
    montrerHome(true);
    /* relance : on rouvre exactement la conversation qui était ouverte */
    if (ecran === 'chat' && S.conv && !estLocal(S.conv)) { choisir(S.conv, { morph: false }); }
    else boucle();
    /* messages d’une nouvelle conversation jamais partis : déjà créée ? sinon on la crée */
    var corpsIssues = S.convs.map(function (i) { return String(i.body || ''); }).join('\n');
    Reprise.boite().forEach(function (x) {
      if (x.conv) return;
      if (corpsIssues.indexOf('fsm-uid: ' + x.uid) >= 0) { Reprise.oter(x.uid); return; }
      var job = { id: 'r' + x.uid, texte: x.corps, conv: 0, suitCreation: false, essais: 0, uid: x.uid };
      S.file.push(job); pomper();
    });
  });
}
function appliquerSession(e) {
  S.viaProxy = true;
  if (e && e.session) S.jeton = e.session;
  else if (!S.jeton) S.jeton = 'cookie';
  S.depot = S.depot || (e && e.depot) || 'wwwh8hv4w5-lang/fsm-si';
  if (e && e.user) { S.moi = e.user.username || S.moi; S.moiNom = e.user.nom || S.moiNom || S.moi; }
  mem.ecrire('si_depot', S.depot);
}
function relierCompte(e) {
  if (e) e.preventDefault();
  var user = ($('ahubuser') && $('ahubuser').value.trim()) || '';
  var pass = ($('ahubpass') && $('ahubpass').value) || '';
  if (user && pass) {
    $('aerreur').textContent = 'Vérification.';
    return fetch(PROXY + '/session', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass })
    }).then(function (r) { return r.json().then(function (d) { return { r: r, d: d }; }); })
      .then(function (x) {
        if (!x.d || !x.d.ok) { $('aerreur').textContent = (x.d && x.d.erreur) || 'Identifiant ou mot de passe incorrect.'; return; }
        if ($('ahubpass')) $('ahubpass').value = '';
        appliquerSession(x.d);
        return demarrer();
      }, function () { $('aerreur').textContent = 'Connexion indisponible pour le moment.'; });
  }
  /* repli : ancien flux jeton GitHub, seulement si le serveur n’a pas de jeton */
  S.depot = ($('adepot') && $('adepot').value.trim() || '').replace(/^https:\/\/github\.com\//, '').replace(/\/+$/, '');
  S.jeton = ($('ajeton') && $('ajeton').value.trim()) || '';
  if (!/^[\w.-]+\/[\w.-]+$/.test(S.depot) || !S.jeton) { $('aerreur').textContent = 'Renseigne ton identifiant et ton mot de passe du FSM HUB.'; return; }
  $('aerreur').textContent = 'Vérification.';
  demarrer().then(function () { mem.ecrire('si_depot', S.depot); mem.ecrire('si_jeton', S.jeton); }, function (err) { S.jeton = ''; $('aerreur').textContent = err.message; });
}
$('relier').addEventListener('click', relierCompte);
$('loginForm').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') relierCompte(e);
});

if ('serviceWorker' in navigator) {
  var _swRelu = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (_swRelu) return;
    try {
      if (sessionStorage.getItem('si_sw_reloaded') === BUILD) return;
      sessionStorage.setItem('si_sw_reloaded', BUILD);
    } catch (err) {}
    _swRelu = true;
    /* jamais de rechargement en plein appel vocal (il couperait le micro et la conversation) */
    if (S.modeVocal) { S._rechargerApresAppel = true; return; }
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(function (reg) {
    try { reg.update(); } catch (err) {}
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) try { reg.update(); } catch (err) {}
    });
  }).catch(function () {});
}
/* build 49 : notification touchée → ouvrir sa conversation ; abonnement push rafraîchi à l'ouverture */
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.type === 'fsm-ouvrir-conv' && e.data.conv && S.pret) { choisir(Number(e.data.conv)); } if (e.data && e.data.type === 'fsm-ouvrir-conv' && window.LauraTaches) LauraTaches.relire(); });
setTimeout(function () { if (S.notif && window.LauraTaches && LauraTaches.pushPossible() && Notification.permission === 'granted') LauraTaches.activerPush(true).catch(function () {}); }, 4000);
if ($('buildTag')) $('buildTag').textContent = BUILD;
fetch(PROXY + '/session', { cache: 'no-store', credentials: 'include' }).then(function (r) { return r.json(); }).then(function (e) {
  if (e && e.ok) {
    appliquerSession(e);
    return demarrer().catch(function (err) { montrerLogin(err.message); });
  }
  if (S.depot && S.jeton) return demarrer().catch(function (err) { montrerLogin(err.message); });
  montrerLogin('');
}, function () {
  if (S.depot && S.jeton) demarrer().catch(function (err) { montrerLogin(err.message); });
  else montrerLogin('');
});

/* ---------- Appui long sur un message ---------- */
(function () {
  var EMO1 = ['👍', '👎', '❤️', '😂', '🎉', '😮'];
  var EMO2 = ['🔥', '👀', '🙏', '😢', '💯'];
  var EMO_PLUS = ['⭐', '👏', '🤔', '🥳', '🙌', '✨'];
  var cible = null, timer = 0, x0 = 0, y0 = 0, arme = false;

  function remplirRangee(row, list, plus) {
    row.textContent = '';
    list.forEach(function (em) {
      var b = el('button', 'react-emo', em);
      b.type = 'button';
      b.setAttribute('aria-label', 'Réaction ' + em);
      b.onclick = function () { appliquerReaction(em); };
      row.appendChild(b);
    });
    if (plus) {
      var add = el('button', 'react-add', '');
      add.type = 'button';
      add.setAttribute('aria-label', 'Ajouter une réaction');
      add.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>';
      add.onclick = function () {
        if (row.querySelector('[data-extra]')) return;
        EMO_PLUS.forEach(function (em) {
          var b = el('button', 'react-emo', em);
          b.type = 'button';
          b.dataset.extra = '1';
          b.onclick = function () { appliquerReaction(em); };
          row.appendChild(b);
        });
      };
      row.appendChild(add);
    }
  }
  remplirRangee($('reactRow1'), EMO1, false);
  remplirRangee($('reactRow2'), EMO2, true);

  function ouvrirMenu(node) {
    cible = node;
    S._lpOuvert = true;
    hap();
    var sheet = $('reactSheet'), back = $('reactBackdrop');
    if (!sheet) return;
    node.classList.add('appui');
    setTimeout(function () { node.classList.remove('appui'); }, 220);
    if (window.LauraMode) LauraMode.infoBulle(node, sheet);
    back.classList.add('hide');
    back.hidden = false;
    sheet.classList.remove('open', 'drag');
    sheet.style.transform = '';
    sheet.hidden = false;
    apresPeinture(function () {
      back.classList.remove('hide');
      sheet.classList.add('open');
    });
    S._lpIgnoreClicJusqua = Date.now() + 650;
  }
  function fermerMenu() {
    S._lpOuvert = false;
    var sheet = $('reactSheet'), back = $('reactBackdrop');
    if (!sheet) return;
    sheet.classList.remove('open');
    if (back) back.classList.add('hide');
    setTimeout(function () {
      sheet.hidden = true;
      if (back) { back.hidden = true; back.classList.remove('hide'); }
    }, 280);
  }
  function appliquerReaction(em) {
    if (!cible) return;
    var cle = cible.dataset.cle;
    var map = lireJSON('si_react', {});
    var cur = map[cle] ? (Array.isArray(map[cle]) ? map[cle] : [map[cle]]) : [];
    var i = cur.indexOf(em);
    if (i >= 0) cur.splice(i, 1);
    else cur.push(em);
    if (cur.length) map[cle] = cur; else delete map[cle];
    ecrireJSON('si_react', map);
    piedMessage(cible, { cle: cle });
    fermerMenu();
  }

  $('reactBackdrop').addEventListener('click', function (e) {
    if (Date.now() < (S._lpIgnoreClicJusqua || 0)) { e.preventDefault(); e.stopPropagation(); return; }
    fermerMenu();
  });
  $('reactReply').onclick = function () {
    if (!cible) return;
    S.reponse = { cle: cible.dataset.cle, texte: cible.dataset.texte || '', qui: cible.dataset.qui };
    $('replyWho').textContent = cible.dataset.qui === 'me' ? 'Vous' : NOM_COURT;
    $('replyTxt').textContent = (cible.dataset.texte || '').replace(/\s+/g, ' ');
    $('replyBar').hidden = false;
    fermerMenu();
    $('texte').focus();
  };
  $('reactUnread').onclick = function () {
    if (!cible) return;
    var map = lireJSON('si_nonlu', {});
    var cle = cible.dataset.cle;
    if (map[cle]) delete map[cle]; else map[cle] = 1;
    ecrireJSON('si_nonlu', map);
    piedMessage(cible, { cle: cle });
    fermerMenu();
  };
  $('reactCopy').onclick = function () {
    if (!cible) return;
    var v = cible.dataset.texte || '';
    var done = function () { if (window.alerte) alerte('Copié'); fermerMenu(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, done);
    else done();
  };
  $('reactSelect').onclick = function () {
    if (!cible) return;
    var b = cible.querySelector('.bubble');
    if (b) {
      b.classList.add('sel-on');
      cible.classList.add('sel-on');
      var sel = window.getSelection();
      if (sel) {
        var r = document.createRange();
        r.selectNodeContents(b);
        sel.removeAllRanges();
        sel.addRange(r);
      }
    }
    fermerMenu();
  };
  $('reactCopyId').onclick = function () {
    if (!cible) return;
    var v = cible.dataset.cle || '';
    var done = function () { if (window.alerte) alerte('ID copié'); fermerMenu(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, done);
    else done();
  };
  $('reactFlag').onclick = function () {
    fermerMenu();
    ouvrirFlag();
  };
  if ($('replyClear')) $('replyClear').onclick = fermerReponse;

  var RAISONS = ['Spam', 'Contenu offensant', 'Hors-sujet', 'Autre'];
  function ouvrirFlag() {
    var box = $('flagReasons');
    if (!box) return;
    box.textContent = '';
    S._flagRaison = '';
    $('flagAutre').value = '';
    $('flagAutre').closest('.flag-autre').hidden = true;
    RAISONS.forEach(function (r) {
      var b = el('button', 'row', r);
      b.type = 'button';
      b.onclick = function () {
        S._flagRaison = r;
        Array.prototype.forEach.call(box.querySelectorAll('.row'), function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        $('flagAutre').closest('.flag-autre').hidden = r !== 'Autre';
      };
      box.appendChild(b);
    });
    $('flagBackdrop').hidden = false;
    $('flagSheet').hidden = false;
    requestAnimationFrame(function () { $('flagSheet').classList.add('open'); });
  }
  function fermerFlag() {
    $('flagSheet').classList.remove('open');
    setTimeout(function () {
      $('flagSheet').hidden = true;
      $('flagBackdrop').hidden = true;
    }, 280);
  }
  $('flagBackdrop').addEventListener('click', fermerFlag);
  $('flagCancel').onclick = fermerFlag;
  $('flagSend').onclick = function () {
    if (!cible) { fermerFlag(); return; }
    var r = S._flagRaison || '';
    if (r === 'Autre') r = (($('flagAutre') && $('flagAutre').value) || '').trim() || 'Autre';
    if (!r) { if (window.alerte) alerte('Choisissez une raison.'); return; }
    var list = lireJSON('si_signalements', []);
    list.push({ cle: cible.dataset.cle, raison: r, at: Date.now() });
    ecrireJSON('si_signalements', list);
    fermerFlag();
    if (window.alerte) alerte('Merci, c’est signalé');
  };

  function annuler() {
    arme = false;
    clearTimeout(timer);
    timer = 0;
    var a = document.querySelectorAll('#fil .msg.appui');
    for (var i = 0; i < a.length; i++) { clearTimeout(a[i]._appuiT); if (!S._lpOuvert) a[i].classList.remove('appui'); }
  }
  function debut(e) {
    var n = e.target && e.target.closest && e.target.closest('#fil .msg');
    if (!n) return;
    if (e.target.closest('a, button, video, input, textarea')) return;
    var pt = e.touches ? e.touches[0] : e;
    if (!pt) return;
    arme = true;
    x0 = pt.clientX; y0 = pt.clientY;
    clearTimeout(timer);
    clearTimeout(n._appuiT);
    n._appuiT = setTimeout(function () { if (arme) n.classList.add('appui'); }, 120);
    timer = setTimeout(function () {
      if (!arme) return;
      arme = false;
      ouvrirMenu(n);
    }, 450);
  }
  function move(e) {
    if (!arme) return;
    var pt = e.touches ? e.touches[0] : e;
    if (!pt) return;
    if (Math.abs(pt.clientX - x0) > 10 || Math.abs(pt.clientY - y0) > 10) annuler();
  }
  var fil = $('fil');
  fil.addEventListener('touchstart', debut, { passive: true });
  fil.addEventListener('mousedown', debut);
  fil.addEventListener('touchmove', move, { passive: true });
  fil.addEventListener('mousemove', move);
  fil.addEventListener('touchend', function (e) {
    annuler();
    if (S._lpOuvert && e.cancelable) e.preventDefault();
  }, { passive: false });
  fil.addEventListener('touchcancel', annuler);
  fil.addEventListener('mouseup', annuler);
  fil.addEventListener('contextmenu', function (e) {
    if (e.target.closest && e.target.closest('.msg')) e.preventDefault();
  });

  /* glisser le menu vers le bas pour le fermer */
  (function () {
    var sheet = $('reactSheet');
    if (!sheet) return;
    var on = false, y0s = 0;
    sheet.addEventListener('touchstart', function (e) {
      if (!e.touches[0]) return;
      var st = $('reactBody') ? $('reactBody').scrollTop : 0;
      if (st > 0 && e.target.closest('.sheet-scroll')) return;
      on = true; y0s = e.touches[0].clientY;
    }, { passive: true });
    sheet.addEventListener('touchmove', function (e) {
      if (!on) return;
      var dy = e.touches[0].clientY - y0s;
      if (dy > 0) {
        sheet.classList.add('drag');
        var d = dy;
        if (!sheet._raf) sheet._raf = requestAnimationFrame(function () { sheet._raf = 0; sheet.style.transform = 'translate3d(0,' + d + 'px,0)'; });
      }
    }, { passive: true });
    sheet.addEventListener('touchend', function (e) {
      if (!on) return; on = false;
      var dy = (e.changedTouches[0] ? e.changedTouches[0].clientY : y0s) - y0s;
      sheet.classList.remove('drag');
      sheet.style.transform = '';
      if (dy > 80) fermerMenu();
    });
  })();

window.__lp = { ouvrir: function (sel) { var n = document.querySelector(sel || '#fil .msg'); if (n) ouvrirMenu(n); }, fermer: fermerMenu };
})();



/* ---------- Appui long sur Laura (accueil) : aperçu + menu contextuel, comme Grok Bot ---------- */
(function () {
  var box = $('homeCtx'), btn = $('homeAvatar'), home = $('home');
  if (!box || !btn) return;
  var tm = 0, x0 = 0, y0 = 0, ouvert = false, bloqueClic = false;
  var armeFermer = false, doigtOuverture = false, ignoreClicJusqua = 0, suivi = null;
  function dernierTexteBot() {
    var l = document.querySelectorAll('#fil .msg.bot');
    for (var i = l.length - 1; i >= 0; i--) {
      var t = (l[i].dataset.texte || (l[i].querySelector('.bubble') || {}).textContent || '').replace(/\s+/g, ' ').trim();
      if (t) return { t: t, n: l[i] };
    }
    return { t: 'Coucou, je suis là.', n: null };
  }
  function placer() {
    var nb = $('newBtn').getBoundingClientRect();
    box.style.setProperty('--hc-top', Math.round(nb.top + 31) + 'px');
    var m = $('hcMenu'), so = $('hcSous');
    so.style.top = (m.offsetTop + m.offsetHeight + 51 - so.offsetHeight) + 'px';
  }
  function itemSous(x, y) {
    var el = document.elementFromPoint(x, y);
    return (el && el.closest) ? el.closest('#hcMenu .hc-row, #hcSous .hc-row') : null;
  }
  function surligner(el) {
    var rows = box.querySelectorAll('.hc-row');
    for (var i = 0; i < rows.length; i++) {
      if (rows[i] === el) rows[i].classList.add('press');
      else rows[i].classList.remove('press');
    }
  }
  function clicFantome(e) {
    if (Date.now() >= ignoreClicJusqua) return;
    var t = e.target;
    if (t && t.closest && t.closest('#hcMenu .hc-row, #hcSous .hc-row')) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }
  function terminerGesteOuverture(ev) {
    if (!doigtOuverture) return;
    clearTimeout(tm);
    doigtOuverture = false;
    if (!ouvert) return;
    if (ev && ev.cancelable) ev.preventDefault();
    if (ev) { ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation(); }
    var t = (ev && ev.changedTouches && ev.changedTouches[0]) || ev;
    var it = (t && typeof t.clientX === 'number') ? itemSous(t.clientX, t.clientY) : suivi;
    surligner(null);
    suivi = null;
    if (it) it.click();
    ignoreClicJusqua = Date.now() + 650;
    armeFermer = true;
  }
  function ouvrir() {
    if (ouvert || !S.jeton) return;
    ouvert = true; bloqueClic = true; armeFermer = false;
    ignoreClicJusqua = Date.now() + 650;
    hap();
    $('hcBulle').textContent = dernierTexteBot().t;
    box.classList.remove('plus', 'sortie', 'on');
    $('hcPlus').setAttribute('aria-expanded', 'false');
    box.hidden = false;
    placer();
    home.classList.remove('ctx-retour');
    home.classList.add('ctx-on');
    void box.offsetWidth;
    requestAnimationFrame(function () { box.classList.add('on'); });
  }
  function fermer(apres) {
    if (!ouvert) return;
    ouvert = false; bloqueClic = false; armeFermer = false; doigtOuverture = false; suivi = null;
    surligner(null);
    box.classList.add('sortie');
    box.classList.remove('on');
    home.classList.remove('ctx-on');
    home.classList.add('ctx-retour');
    setTimeout(function () {
      box.hidden = true; box.classList.remove('sortie', 'plus');
      home.classList.remove('ctx-retour');
      if (apres) apres();
    }, 260);
  }
  btn.addEventListener('touchstart', function (e) {
    var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; bloqueClic = false;
    doigtOuverture = true;
    clearTimeout(tm); tm = setTimeout(ouvrir, 450);
  }, { passive: true });
  btn.addEventListener('touchmove', function (e) {
    var t = e.touches[0];
    if (!ouvert) {
      if (Math.abs(t.clientX - x0) + Math.abs(t.clientY - y0) > 10) { clearTimeout(tm); doigtOuverture = false; }
      return;
    }
    suivi = itemSous(t.clientX, t.clientY);
    surligner(suivi);
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchmove', function (e) {
    if (!ouvert || !doigtOuverture) return;
    var t = e.touches && e.touches[0];
    if (!t) return;
    suivi = itemSous(t.clientX, t.clientY);
    surligner(suivi);
    if (e.cancelable) e.preventDefault();
  }, { capture: true, passive: false });
  document.addEventListener('touchend', function (e) { terminerGesteOuverture(e); }, { capture: true, passive: false });
  document.addEventListener('pointerup', function (e) { terminerGesteOuverture(e); }, { capture: true });
  document.addEventListener('mouseup', function (e) { terminerGesteOuverture(e); }, { capture: true });
  document.addEventListener('click', clicFantome, true);
  document.addEventListener('touchcancel', function () { clearTimeout(tm); if (doigtOuverture && !ouvert) doigtOuverture = false; }, { capture: true, passive: true });
  btn.addEventListener('touchcancel', function () { clearTimeout(tm); }, { passive: true });
  btn.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    clearTimeout(tm);
    if (!ouvert) ouvrir();
    doigtOuverture = false;
    armeFermer = true;
  });
  btn.addEventListener('click', function (e) { if (bloqueClic || ouvert || Date.now() < ignoreClicJusqua) { e.stopImmediatePropagation(); e.preventDefault(); bloqueClic = false; } }, true);
  box.addEventListener('click', function (e) {
    if (!armeFermer || Date.now() < ignoreClicJusqua) return;
    if (!e.target.closest('.hc-menu, .hc-sous')) fermer();
  });
  box.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  $('hcPlus').onclick = function () { placer(); box.classList.add('plus'); $('hcPlus').setAttribute('aria-expanded', 'true'); };
  $('hcMoins').onclick = function () { box.classList.remove('plus'); $('hcPlus').setAttribute('aria-expanded', 'false'); };
  $('hcUnread').onclick = function () {
    var d = dernierTexteBot();
    fermer(function () {
      if (!d.n || !d.n.dataset.cle) { alerte('Aucun message de Laura à marquer.'); return; }
      var map = lireJSON('si_nonlu', {}); map[d.n.dataset.cle] = 1; ecrireJSON('si_nonlu', map);
      piedMessage(d.n, { cle: d.n.dataset.cle });
      alerte('Dernier message de Laura marqué comme non lu.');
    });
  };
  $('hcPin').onclick = function () { fermer(function () { alerte('Laura reste épinglée : c’est ton seul Bot dans FSM SI.'); }); };
  $('hcReplace').onclick = function () { fermer(function () { alerte('Laura est le Bot principal de FSM SI. Aucun autre Bot à mettre à sa place pour l’instant.'); }); };
  $('hcShare').onclick = function () { fermer(partagerConv); };
  $('hcHide').onclick = function () { fermer(function () { alerte('Laura est ton Bot principal : elle reste affichée.'); }); };
  $('hcCopyId').onclick = function () {
    var v = (S.depot || '') + (S.conv ? '#' + S.conv : '');
    fermer(function () {
      var ok = function () { alerte('ID copié : ' + v); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(ok, function () { alerte(v); }); else alerte(v);
    });
  };
  /* glisser vers le bas pour fermer — seulement après le relâchement qui a ouvert le menu */
  var yd = null;
  box.addEventListener('touchstart', function (e) {
    if (!armeFermer || Date.now() < ignoreClicJusqua || !e.touches[0]) { yd = null; return; }
    yd = e.touches[0].clientY;
  }, { passive: true });
  box.addEventListener('touchend', function (e) {
    if (!armeFermer || Date.now() < ignoreClicJusqua) { yd = null; return; }
    if (yd !== null && e.changedTouches[0] && e.changedTouches[0].clientY - yd > 60) fermer();
    yd = null;
  }, { passive: true });
  window.addEventListener('resize', function () { if (ouvert) placer(); });
  window.__homeCtx = { ouvrir: ouvrir, fermer: fermer };
})();

})();
