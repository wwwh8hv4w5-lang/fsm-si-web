/* Laura F.S.M · F.S.M AI — interface FSM SI (backend GitHub Issues) */
(function () {
'use strict';
var $ = function (i) { return document.getElementById(i); };
var mem = {
  lire: function (k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
  ecrire: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  oter: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
};
var S = {
  depot: mem.lire('si_depot'), jeton: mem.lire('si_jeton'),
  conv: Number(mem.lire('si_conv')) || 0,
  voix: mem.lire('si_voix') === '1', note: mem.lire('si_note') === '1',
  hap: mem.lire('si_hap') !== '0', tzauto: mem.lire('si_tzauto') !== '0',
  notif: mem.lire('si_notif') === '1',
  moi: '', moiNom: '', branche: 'main',
  els: {}, attente: false, pret: false, minuteur: 0, blobs: {},
  convs: [], convsVues: 0, envoi: false, ecran: 'login',
  runEtat: '', lastBotCle: '', pending: []
};
var NOM = 'Laura F.S.M · F.S.M AI';
var NOM_COURT = 'Laura F.S.M';
var MAX_FILE = 25 * 1024 * 1024;
var ORDRES = [['/cout', 'Dépenses'], ['/memoire', 'Mémoire'], ['/projets', 'Projets'], ['/taches', 'Tâches planifiées'], ['/bots', 'Équipe'], ['/competences', 'Compétences'], ['/refaire', 'Refaire la dernière demande'], ['/aide', 'Aide'], ['/stop', 'Arrêter']];

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function alerte(m) { var a = $('alerte'); if (!a) return; a.textContent = m || ''; a.hidden = !m; if (m) setTimeout(function () { if (a.textContent === m) a.hidden = true; }, 9000); }
function encP(p) { return String(p).split('/').map(encodeURIComponent).join('/'); }
function hap() { if (S.hap && navigator.vibrate) navigator.vibrate(10); }

function api(chemin, o) {
  o = o || {};
  return fetch('https://api.github.com' + chemin, {
    method: o.method || 'GET',
    headers: Object.assign({ Authorization: 'Bearer ' + S.jeton, Accept: o.accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, o.json ? { 'Content-Type': 'application/json' } : {}),
    body: o.json ? JSON.stringify(o.json) : (o.body || undefined)
  }).then(function (r) {
    if (r.status === 401) throw Object.assign(new Error('Jeton refusé par GitHub : vérifie-le dans Réglages.'), { status: 401 });
    if (!r.ok) {
      var err = new Error('GitHub a répondu ' + r.status + (r.status === 403 || r.status === 404 ? ' : le jeton a-t-il accès à ce dépôt, avec les bonnes permissions ?' : ''));
      err.status = r.status;
      throw err;
    }
    if (o.brut) return r.arrayBuffer();
    if (o.texte) return r.text();
    return r.status === 204 ? null : r.json();
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
function rendre(md) {
  var codes = [], imgs = [];
  md = String(md || '').replace(/\u0001/g, '').replace(/<!--[\s\S]*?-->/g, '');
  md = md.replace(/<img\s+src="([^"]+)"[^>]*>/g, function (m, u) { var p = cheminDepot(u); if (!p) return ''; imgs.push(p); return '\u0001I' + (imgs.length - 1) + '\u0001'; });
  md = md.replace(/```[^\n]*\n([\s\S]*?)```/g, function (m, c) { codes.push(c); return '\n\u0001C' + (codes.length - 1) + '\u0001\n'; });
  var h = esc(md)
    .replace(/&lt;details&gt;\s*&lt;summary&gt;([\s\S]*?)&lt;\/summary&gt;/g, '\n<details><summary>$1</summary>\n')
    .replace(/&lt;\/details&gt;/g, '\n</details>\n')
    .replace(/&lt;sub&gt;([\s\S]*?)&lt;\/sub&gt;/g, '<span class="petit">$1</span>');
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
    .replace(/\u0001I(\d+)\u0001/g, function (m, n) { return imgs[n] ? '<img class="vue" alt="Aperçu" data-p="' + esc(imgs[n]) + '">' : ''; })
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
function el(nom, cls, texte) { var e = document.createElement(nom); if (cls) e.className = cls; if (texte != null) e.textContent = texte; return e; }

/* ---------- Navigation ---------- */
function themeColor(c) { var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', c); }
function montrerLogin(err) {
  S.ecran = 'login';
  $('login').hidden = false;
  $('home').hidden = true;
  $('chatView').hidden = true;
  $('adepot').value = S.depot || 'wwwh8hv4w5-lang/fsm-si';
  $('ajeton').value = '';
  $('aerreur').textContent = err || '';
  themeColor('#141414');
}
function montrerHome(instant) {
  S.ecran = 'home';
  $('login').hidden = true;
  $('home').hidden = false;
  if (instant) {
    $('chatView').hidden = true;
    resetCard();
  }
  themeColor('#141414');
  fermerMenu();
  fermerSettings();
  closePush(true);
}
function montrerChat(viaMorph) {
  S.ecran = 'chat';
  $('login').hidden = true;
  $('home').hidden = false; /* reste derrière pour le morph */
  $('chatView').hidden = false;
  themeColor('#000000');
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
  if (!opts.sansEcran) {
    if (opts.morph) ouvrirChatMorph();
    else montrerChat(false);
  }
  boucle();
}
function tousCommentaires(n, page, acc) {
  page = page || 1; acc = acc || [];
  return api(D() + '/issues/' + n + '/comments?per_page=100&page=' + page).then(function (l) {
    acc = acc.concat(l);
    return l.length === 100 && page < 6 ? tousCommentaires(n, page + 1, acc) : acc;
  });
}

function mediaHtml(corps) {
  /* vidéos du dépôt : lien .mp4/.webm → lecteur */
  return corps.replace(/<a href="#" class="fichier" data-p="([^"]+\.(?:mp4|webm|mov))"[^<]*<\/a>/gi, function (m, p) {
    return '<div class="vid-wrap" data-full="' + esc(p) + '"><video data-p="' + esc(p) + '" playsinline preload="metadata"></video><span class="play"></span></div>';
  });
}

function majFil(items) {
  var fil = $('fil');
  var bas = fil.scrollHeight - fil.scrollTop - fil.clientHeight < 140;
  var ajout = false, vus = {};
  items.forEach(function (it) {
    vus[it.cle] = 1;
    var node = S.els[it.cle];
    if (!node) {
      node = S.els[it.cle] = document.createElement('article');
      fil.appendChild(node); ajout = true;
      if (S.pret && S.voix && it.genre === 'tx') dire(texteBrut(it.corps));
      if (S.pret && it.genre === 'tx' && it.cle !== S.lastBotCle && S.ecran !== 'chat') {
        bannerBot(it.corps);
      }
      if (it.genre === 'tx') S.lastBotCle = it.cle;
    }
    if (node._corps === it.corps) return;
    node._corps = it.corps;
    var moi = it.genre === 'moi' || it.genre === 'ordre';
    node.className = 'msg ' + (moi ? (it.genre === 'ordre' ? 'ordre' : 'me') : 'bot');
    node.innerHTML = '<div class="bubble">' + mediaHtml(rendre(it.corps)) + '</div><time>' + esc(heure(it.date)) + '</time>';
    brancher(node);
  });
  Object.keys(S.els).forEach(function (k) { if (!vus[k]) { S.els[k].remove(); delete S.els[k]; } });
  if (ajout && (bas || !S.pret)) fil.scrollTop = fil.scrollHeight;
  majScrollBtn();
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
  if (!S.conv) { S.attente = false; etatLigne(''); return Promise.resolve(); }
  var n = S.conv;
  return Promise.all([api(D() + '/issues/' + n), tousCommentaires(n)]).then(function (r) {
    if (n !== S.conv) return;
    var issue = r[0], items = [];
    var titre = String(issue.title || ''), corps = String(issue.body || '');
    items.push({ cle: 'i' + issue.number, genre: issue.user && issue.user.type === 'Bot' ? 'tx' : 'moi', date: issue.created_at, corps: corps.indexOf(titre) === 0 ? corps : (corps ? '**' + titre + '**\n\n' + corps : titre) });
    r[1].forEach(function (c) {
      var b = String(c.body || ''), genre;
      if (c.user && c.user.type === 'Bot') genre = b.indexOf('robot-progress') >= 0 ? 'encours' : b.indexOf('robot-commande') >= 0 ? 'note' : 'tx';
      else genre = b.trim().charAt(0) === '/' ? 'ordre' : 'moi';
      if (genre === 'encours' || genre === 'note') {
        /* indicateur dédié plutôt qu’une bulle de statut */
        return;
      }
      items.push({ cle: 'c' + c.id, genre: genre, date: c.created_at, corps: b });
    });
    var utiles = items.filter(function (i) { return i.genre !== 'ordre'; });
    var dernier = utiles[utiles.length - 1];
    var attend = !!dernier && dernier.genre === 'moi';
    S.attente = attend;
    majFil(items);
    S.pret = true;
    if (attend) return etatActions();
    etatLigne('');
  });
}
function boucle() {
  clearTimeout(S.minuteur);
  if (!S.jeton || document.hidden) return;
  var suite = function () { S.minuteur = setTimeout(boucle, S.attente ? 4000 : 20000); };
  var p = rafraichir();
  if (Date.now() - S.convsVues > 30000) p = p.then(chargerConvs);
  p.then(function () { suite(); }, function (e) { alerte(e.message); suite(); });
}
document.addEventListener('visibilitychange', function () { if (!document.hidden) boucle(); });

/* ---------- Statut Actions ---------- */
function etatLigne(txt) {
  var box = $('typing'), em = $('typingText');
  if (!txt) { box.hidden = true; S.runEtat = ''; placeScrollDown(); return; }
  box.hidden = false;
  if (em.textContent !== txt) {
    em.style.opacity = '0';
    setTimeout(function () { em.textContent = txt; em.style.opacity = '1'; }, 160);
  }
  S.runEtat = txt;
  placeScrollDown();
}
function etatActions() {
  return api(D() + '/actions/runs?per_page=5').then(function (d) {
    var runs = (d && d.workflow_runs) || [];
    var run = runs.find(function (r) { return r.status === 'queued' || r.status === 'in_progress' || r.status === 'waiting' || r.status === 'pending'; });
    if (!run) {
      if (S.attente) etatLigne('En train d’écrire…');
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
      if (/écrit|ecrit|write|reply|répond|repond|comment|message/i.test(low)) etatLigne('En train d’écrire…');
      else if (/assemble|pièce|piece/i.test(low)) etatLigne('Assemble les pièces');
      else if (/pas à pas|pas a pas|step by step|avance/i.test(low)) etatLigne('Avance pas à pas');
      else if (nom && /^[\wÀ-ÿ’' .:-]{3,60}$/.test(nom) && /[àâéèêëîïôùûçÀ-ÿ ]/.test(nom)) etatLigne(nom);
      else etatLigne('Exécute quelques commandes');
    }).catch(function () { etatLigne('Exécute quelques commandes'); });
  }).catch(function () {
    if (S.attente) etatLigne('S’en occupe');
  });
}

/* ---------- Envoi ---------- */
function taille() {
  var t = $('texte');
  t.style.height = 'auto';
  t.style.height = Math.min(t.scrollHeight + 2, ($('composer').classList.contains('full') ? window.innerHeight : window.innerHeight * 0.38)) + 'px';
  majSendIcon();
}
function majSendIcon() {
  var has = !!$('texte').value.trim() || S.pending.length;
  var wave = $('sendBtn').querySelector('.ico-wave');
  if (wave) wave.classList.toggle('hidden', has);
  $('sendBtn').querySelector('.ico-send').classList.toggle('hidden', !has);
  $('sendBtn').setAttribute('aria-label', has ? 'Envoyer' : 'Note vocale');
  var ex = $('expandBtn');
  if (ex) ex.classList.toggle('hidden', !($('texte').value.trim() || S.pending.length));
}
function envoyer(texte) {
  texte = String(texte || '').trim();
  if (!texte) return Promise.resolve();
  if (!S.conv && texte.charAt(0) === '/') { alerte('Ouvre d’abord une conversation : les commandes s’envoient dedans.'); return Promise.resolve(); }
  if (S.envoi) return Promise.resolve();
  S.envoi = true;
  $('sendBtn').disabled = true;
  var p = S.conv
    ? api(D() + '/issues/' + S.conv + '/comments', { method: 'POST', json: { body: texte } })
    : api(D() + '/issues', { method: 'POST', json: { title: texte.split('\n')[0].slice(0, 70), body: texte } }).then(function (i) {
      S.conv = i.number; mem.ecrire('si_conv', String(i.number));
      return chargerConvs();
    });
  return p.then(function () {
    S.envoi = false; $('sendBtn').disabled = false; S.attente = true; etatLigne('S’en occupe'); boucle();
  }, function (e) {
    S.envoi = false; $('sendBtn').disabled = false; alerte(e.message); throw e;
  });
}
function envoyerSaisie() {
  var t = $('texte'), v = t.value;
  var fin = function (msg) {
    if (t.value === v) { t.value = ''; taille(); }
    viderPieces();
    if ($('composer').classList.contains('full')) setFullCompose(false);
    return envoyer(msg);
  };
  if (S.pending.length) {
    return uploaderPieces().then(function (bloc) {
      var msg = (v.trim() + bloc).trim();
      return fin(msg);
    }).catch(function (e) { alerte(e.message); });
  }
  return fin(v).then(function () {}, function () {});
}
$('sendBtn').addEventListener('click', function () {
  if ($('texte').value.trim() || S.pending.length) envoyerSaisie();
  else enregistrer();
});
$('micBtn').addEventListener('click', function () { dicterOuEnregistrer(); });
$('texte').addEventListener('input', taille);
$('texte').addEventListener('keydown', function (e) {
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
    var img = document.createElement('img'); img.src = it.url; img.alt = file.name; box.appendChild(img);
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
function safeName(n) { return String(n).replace(/[^\w.\-]+/g, '_').slice(0, 80); }
function uploaderPieces() {
  var folder = S.conv ? String(S.conv) : 'nouveau';
  var ts = new Date().toISOString().replace(/[:.]/g, '-');
  var lignes = [];
  var seq = Promise.resolve();
  S.pending.forEach(function (it, idx) {
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
        });
      });
    });
  });
  return seq.then(function () {
    return '\n\n📎 **Fichiers joints** (déposés dans le dépôt, à lire dans `entree/`) :\n' + lignes.join('\n');
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
  box.hidden = false;
  if (video) { img.removeAttribute('src'); img.style.display = 'none'; vid.style.display = 'block'; vid.src = src; vid.play().catch(function () {}); }
  else { vid.pause(); vid.removeAttribute('src'); vid.style.display = 'none'; img.style.display = 'block'; img.src = src; }
  box._y = 0;
}
$('lightbox').querySelector('.close').onclick = function () { fermerMedia(); };
function fermerMedia() {
  var box = $('lightbox');
  var vid = box.querySelector('video');
  vid.pause(); vid.removeAttribute('src');
  box.querySelector('img').removeAttribute('src');
  box.hidden = true;
  box.style.transform = '';
}
(function () {
  var box = $('lightbox'), y0 = 0, dy = 0, on = false;
  box.addEventListener('touchstart', function (e) { if (e.touches.length !== 1) return; on = true; y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
  box.addEventListener('touchmove', function (e) {
    if (!on) return;
    dy = e.touches[0].clientY - y0;
    if (dy > 0) box.style.transform = 'translateY(' + dy + 'px)';
  }, { passive: true });
  box.addEventListener('touchend', function () {
    if (!on) return; on = false;
    if (dy > 80) fermerMedia(); else box.style.transform = '';
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
      ctx.strokeStyle = '#F25C05'; ctx.lineWidth = 2; ctx.beginPath();
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
      var ext = /webm/.test(type) ? 'webm' : /ogg/.test(type) ? 'ogg' : 'm4a';
      var lecteur = new FileReader();
      lecteur.onload = function () {
        var chemin = 'entree/vocal/' + new Date().toISOString().replace(/[:.]/g, '-') + '.' + ext;
        api(D() + '/contents/' + encP(chemin), { method: 'PUT', json: { message: 'note vocale', content: String(lecteur.result).split(',')[1], branch: S.branche } })
          .then(function () { return envoyer('🎤 Note vocale : ' + chemin); }).catch(function (e) { alerte(e.message); });
      };
      lecteur.readAsDataURL(new Blob(morceaux, { type: type }));
    };
    enr.start();
    afficherVoix(true);
    onde(flux);
  }).catch(function () { alerte('Micro refusé : autorise-le dans les réglages du navigateur.'); });
}
function dicterOuEnregistrer() {
  if (rec) { rec.stop(); return; }
  if (enr) { enr.stop(); return; }
  if (SR && !S.note) dicter(); else enregistrer();
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
function dire(t) {
  if (!t || !window.speechSynthesis) return;
  var u = new SpeechSynthesisUtterance(t.slice(0, 1500));
  u.lang = 'fr-FR';
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}

/* ---------- Scroll bas + composer plein écran ---------- */
function majScrollBtn() {
  var fil = $('fil'), btn = $('scrollDown');
  var loin = fil.scrollHeight - fil.scrollTop - fil.clientHeight > 120;
  btn.classList.toggle('show', loin);
  btn.hidden = false;
  placeScrollDown();
}
function placeScrollDown() {
  var btn = $('scrollDown'), typ = $('typing'), comp = $('composer');
  var top = comp.getBoundingClientRect().top;
  if (!typ.hidden) top = typ.getBoundingClientRect().top;
  var chat = $('chatView').getBoundingClientRect();
  btn.style.bottom = (chat.bottom - top + 8) + 'px';
}
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
    if (!full && !on) {
      /* swipe up on composer to expand */
    }
    if (!e.touches[0]) return;
    y0 = e.touches[0].clientY; on = true; c._dy = 0;
  }, { passive: true });
  c.addEventListener('touchmove', function (e) {
    if (!on || !e.touches[0]) return;
    var dy = e.touches[0].clientY - y0;
    c._dy = dy;
    if (c.classList.contains('full') && dy > 0) {
      var p = Math.min(1, dy / 280);
      c.style.transform = 'translateY(' + dy * 0.6 + 'px) scale(' + (1 - 0.08 * p) + ')';
      c.style.borderRadius = (16 * p) + 'px';
      $('chatView').style.filter = 'brightness(' + (0.5 + 0.5 * (1 - p)) + ')';
    } else if (!c.classList.contains('full') && dy < -40) {
      setFullCompose(true); on = false;
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
  $('findInput').focus();
}
function fermerRecherche() {
  $('chatSearchBar').hidden = true;
  $('composeRow').hidden = false;
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
  var btn = $('menuBtn').getBoundingClientRect();
  pop.style.top = (btn.bottom + 6) + 'px';
  pop.style.right = (window.innerWidth - btn.right) + 'px';
  pop.style.left = 'auto';
  pop.hidden = false;
  $('overlay').hidden = false;
}
$('menuBtn').onclick = function (e) { e.stopPropagation(); if ($('menuPop').hidden) ouvrirMenu(); else fermerMenu(); };
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
  c.classList.remove('carding');
  c.style.transform = '';
  c.style.borderRadius = '';
  c.style.opacity = '';
  $('backBtn').style.opacity = '';
  $('menuBtn').style.opacity = '';
  $('morph').hidden = true;
  $('chatAv').style.opacity = '';
  $('chatName').style.opacity = '';
  $('homeAv').style.opacity = '';
  $('homeName').style.opacity = '';
}
function lerp(a, b, p) { return a + (b - a) * p; }
function appliquerCarte(p) {
  p = Math.max(0, Math.min(1, p));
  var c = $('chatView');
  c.hidden = false;
  $('home').hidden = false;
  c.classList.toggle('carding', p > 0.02);
  var scale = lerp(1, 0.85, p);
  var x = p * c.offsetWidth * 0.22;
  c.style.transform = 'translateX(' + x + 'px) scale(' + scale + ')';
  c.style.borderRadius = (32 * p) + 'px';
  $('backBtn').style.opacity = String(1 - p);
  $('menuBtn').style.opacity = String(1 - p);
  /* FLIP avatar + nom */
  var a0 = $('chatAv').getBoundingClientRect();
  var a1 = $('homeAv').getBoundingClientRect();
  var n0 = $('chatName').getBoundingClientRect();
  var n1 = $('homeName').getBoundingClientRect();
  var morph = $('morph'), av = $('morphAv'), nm = $('morphName');
  morph.hidden = false;
  $('chatAv').style.opacity = '0';
  $('chatName').style.opacity = '0';
  $('homeAv').style.opacity = '0';
  $('homeName').style.opacity = '0';
  var w = lerp(a0.width, a1.width, p);
  var h = lerp(a0.height, a1.height, p);
  var l = lerp(a0.left, a1.left, p);
  var t = lerp(a0.top, a1.top, p);
  av.style.width = w + 'px';
  av.style.height = h + 'px';
  av.style.left = l + 'px';
  av.style.top = t + 'px';
  nm.textContent = p > 0.55 ? 'Laura F.S.M · F.S.M AI' : NOM;
  nm.style.maxWidth = lerp(n0.width || 200, 168, p) + 'px';
  nm.style.left = lerp(n0.left, n1.left, p) + 'px';
  nm.style.top = lerp(n0.top, n1.top, p) + 'px';
  nm.style.fontSize = lerp(16, 16, p) + 'px';
  nm.style.fontWeight = p > 0.5 ? '500' : '600';
  nm.style.opacity = '1';
}
function spring(from, to, omega, onup, ondone) {
  var t0 = performance.now();
  function frame(now) {
    var t = (now - t0) / 1000;
    var e = Math.exp(-omega * t);
    var k = e * (1 + omega * t);
    var v = to + (from - to) * k;
    onup(v);
    if (k < 0.008 || t > 0.7) { onup(to); ondone && ondone(); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
function fermerChatMorph() {
  var start = S._cardP || 0;
  spring(start, 1, 14, appliquerCarte, function () {
    resetCard();
    $('chatView').hidden = true;
    $('homeAv').style.opacity = '';
    $('homeName').style.opacity = '';
    S.ecran = 'home';
    themeColor('#141414');
    S._cardP = 0;
  });
}
function ouvrirChatMorph() {
  $('chatView').hidden = false;
  $('home').hidden = false;
  S.ecran = 'chat';
  themeColor('#000000');
  appliquerCarte(1);
  spring(1, 0, 16, appliquerCarte, function () {
    resetCard();
    $('chatView').hidden = false;
    setTimeout(function () { var f = $('fil'); f.scrollTop = f.scrollHeight; }, 30);
  });
}
$('homeAvatar').addEventListener('click', function () {
  if (!S.jeton) return;
  var n = S.conv || (S.convs[0] && S.convs[0].number) || 0;
  if (n) choisir(n, { morph: true });
  else { montrerChat(true); ouvrirChatMorph(); }
});
$('backBtn').addEventListener('click', function () { fermerChatMorph(); });

(function () {
  var on = false, x0 = 0, y0 = 0, edge = false, locked = null;
  var chat = $('chatView');
  chat.addEventListener('touchstart', function (e) {
    if (S.ecran !== 'chat' || !$('push').hidden || !$('settingsSheet').hidden || !$('iosAlert').hidden) return;
    if ($('composer').classList.contains('full')) return;
    if (!e.touches[0]) return;
    var x = e.touches[0].clientX, y = e.touches[0].clientY;
    edge = x <= 28;
    if (!edge) return;
    on = true; locked = null; x0 = x; y0 = y; S._cardP = 0;
  }, { passive: true });
  chat.addEventListener('touchmove', function (e) {
    if (!on) return;
    var t = e.touches[0];
    var dx = t.clientX - x0, dy = t.clientY - y0;
    if (locked === null && Math.abs(dx) + Math.abs(dy) > 8) locked = Math.abs(dx) > Math.abs(dy) * 1.1 ? 'x' : 'y';
    if (locked !== 'x') return;
    var p = Math.max(0, Math.min(1, dx / (chat.offsetWidth * 0.55)));
    S._cardP = p;
    appliquerCarte(p);
  }, { passive: true });
  chat.addEventListener('touchend', function (e) {
    if (!on) return; on = false;
    if (locked !== 'x') { if (S._cardP) spring(S._cardP, 0, 16, appliquerCarte, resetCard); return; }
    var dx = (e.changedTouches[0] ? e.changedTouches[0].clientX : x0) - x0;
    var p = S._cardP || 0;
    if (p > 0.28 || dx > 80) fermerChatMorph();
    else spring(p, 0, 16, appliquerCarte, resetCard);
  });
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
    });
  } else { S.notif = false; mem.ecrire('si_notif', '0'); majCompteUI(); }
  hap();
};
$('deco').onclick = function () {
  iosAlerte('Se déconnecter ?', 'Le jeton sera oublié sur cet appareil.', function () {
    mem.oter('si_jeton'); S.jeton = ''; clearTimeout(S.minuteur);
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
  };
  if (instant) done(); else setTimeout(done, 350);
}
$('pushBack').onclick = function () { closePush(); };
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
  var av = el('div', 'av sm'); av.innerHTML = '<img src="./icons/icon-192.png" alt="">';
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
  box.appendChild(el('p', 'invite', 'Noms des secrets du dépôt, jamais leurs valeurs.'));
  var list = el('div', '');
  box.appendChild(list);
  list.appendChild(el('p', 'invite', 'Chargement…'));
  var cherche = el('div', 'float-search');
  cherche.innerHTML = '<span>⌕</span>';
  var inp = document.createElement('input'); inp.placeholder = 'Rechercher dans le coffre-fort';
  cherche.appendChild(inp);
  box.appendChild(cherche);
  function render(noms, filtre) {
    list.textContent = '';
    var f = (filtre || '').toLowerCase();
    var n = noms.filter(function (x) { return !f || x.toLowerCase().indexOf(f) >= 0; });
    if (!n.length) { list.appendChild(el('p', 'invite', noms.length ? 'Aucun résultat.' : 'Aucun secret lisible.')); return; }
    var g = el('div', 'group');
    n.forEach(function (nom) {
      var r = el('div', 'row');
      r.appendChild(el('div', 'icon-sq', '🔑'));
      var t = el('div', 'row-txt'); t.innerHTML = '<div class="t">' + esc(nom) + '</div><div class="s">Secret du dépôt</div>';
      r.appendChild(t);
      r.appendChild(el('span', 'pill-btn', 'Gérer'));
      g.appendChild(r);
    });
    list.appendChild(g);
  }
  var noms = [];
  api(D() + '/actions/secrets').then(function (d) {
    noms = ((d && d.secrets) || []).map(function (s) { return s.name; });
    render(noms, inp.value);
  }).catch(function () {
    return api(D() + '/contents/connecteurs.json?ref=' + encodeURIComponent(S.branche), { accept: 'application/vnd.github.raw+json', texte: true }).then(function (t) {
      var j = {}; try { j = JSON.parse(t); } catch (e) {}
      var keys = [];
      Object.keys(j.api || {}).forEach(function (k) { keys.push(k); });
      Object.keys(j.mcp || {}).forEach(function (k) { keys.push('mcp:' + k); });
      noms = keys;
      if (!noms.length) list.textContent = '', list.appendChild(el('p', 'invite', 'Aucun connecteur déclaré dans connecteurs.json (les secrets du dépôt ne sont pas lisibles avec ce jeton).'));
      else render(noms, inp.value);
    }).catch(function () {
      list.textContent = '';
      list.appendChild(el('p', 'invite', 'Impossible de lister les secrets (droits insuffisants) et connecteurs.json est inaccessible.'));
    });
  });
  inp.addEventListener('input', function () { render(noms, inp.value); });
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
    ord.innerHTML = '<span class="row-ico">🖥</span><span class="t">Ordinateur</span><span class="val">—</span><span class="chev">›</span>';
    ord.onclick = function () { ecranDepot(); };
    g1.appendChild(ord);
    box.appendChild(g1);

    box.appendChild(el('div', 'sec-lab', 'Configurer le Bot'));
    var g2 = el('div', 'group');
    var r2 = el('button', 'row'); r2.type = 'button';
    r2.innerHTML = '<span class="row-ico">⏱</span><span class="t">Routines</span><span class="val" id="profRoutines">—</span><span class="chev">›</span>';
    r2.onclick = function () { ecranRoutines(); };
    g2.appendChild(r2);
    box.appendChild(g2);

    var g3 = el('div', 'group');
    var nt = el('div', 'row toggle-row');
    nt.innerHTML = '<span class="t">Notifications</span>';
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
    var zb = el('div', ''); box.appendChild(zb);
    fiches('bots').then(function (bots) {
      if (!bots.length) { zb.appendChild(el('p', 'invite', 'Aucun Bot dans bots/.')); return; }
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

/* Créer un Bot */
var SHAPES = ['●','■','▲','◆','★','✦','☀','☁','✿','❖','◉','◎','⬡','▮','▶','❤'];
var COLORS = ['#7B61FF','#FF2D55','#FF9F0A','#34C759','#0A84FF','#64D2FF','#FFD60A','#BF5AF2','#AC8E68','#8E8E93','#FF6482','#30DB5B','#00C7BE','#FFFFFF'];
var botSel = { shape: 0, color: '#7B61FF' };
function ouvrirCreate() {
  var sg = $('shapeGrid'), cg = $('colorGrid');
  sg.textContent = ''; cg.textContent = '';
  var radii = [
    '50%', '40% 60% 50% 50% / 45% 45% 55% 55%', '20%', '30% 70% 70% 30% / 30% 30% 70% 70%', '50% 50% 40% 60%',
    '50% 40% 50% 60%', '42% 58% 58% 42%', '50% 50% 30% 70%', '55% 45% 50% 50%', '20% 80% 70% 30% / 40% 40% 60% 60%',
    '40% 40% 20% 20%', '40% 60% 35% 65%', '30%'
  ];
  radii.forEach(function (rad, i) {
    var b = el('button', 'shape-cell' + (i === botSel.shape ? ' on' : '')); b.type = 'button';
    var blob = el('span', 'bloblet'); blob.style.borderRadius = rad; blob.style.background = botSel.color;
    b.appendChild(blob);
    b.onclick = function () { botSel.shape = i; Array.prototype.forEach.call(sg.children, function (x, j) { x.classList.toggle('on', j === i); }); };
    sg.appendChild(b);
  });
  COLORS.forEach(function (c, i) {
    var b = el('button', 'swatch' + (c === botSel.color ? ' on' : '')); b.type = 'button';
    b.style.setProperty('--c', c);
    b.onclick = function () { botSel.color = c; $('botBlob').style.background = c; Array.prototype.forEach.call(document.querySelectorAll('.bloblet'), function (x) { x.style.background = c; }); Array.prototype.forEach.call(cg.children, function (x) { x.classList.remove('on'); }); b.classList.add('on'); };
    cg.appendChild(b);
  });
  $('botBlob').style.background = botSel.color;
  $('botName').value = '';
  $('botCreate').disabled = true;
  $('createBackdrop').hidden = false;
  $('createSheet').hidden = false;
  requestAnimationFrame(function () { $('createSheet').classList.add('open'); });
}
function fermerCreate() {
  $('createSheet').classList.remove('open');
  setTimeout(function () { $('createSheet').hidden = true; $('createBackdrop').hidden = true; }, 420);
}
$('newBtn').onclick = ouvrirCreate;
$('createClose').onclick = fermerCreate;
$('createBackdrop').onclick = fermerCreate;
$('botName').addEventListener('input', function () { $('botCreate').disabled = !this.value.trim(); });
$('botCreate').onclick = function () {
  var nom = $('botName').value.trim(); if (!nom) return;
  var slug = nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'bot';
  var md = '---\nnom: ' + nom + '\nrole: Bot créé depuis Laura F.S.M\nmodele: \noutils: \nforme: ' + SHAPES[botSel.shape] + '\ncouleur: \'' + botSel.color + '\'\n---\n\nPrésentation de @' + slug + '.\n';
  $('botCreate').disabled = true;
  var path = 'bots/' + slug + '.md';
  var body = { message: 'nouveau bot ' + slug, content: btoa(unescape(encodeURIComponent(md))), branch: S.branche };
  api(D() + '/contents/' + encP(path), { method: 'PUT', json: body }).then(function () {
    fermerCreate();
    alerte('Bot @' + slug + ' créé dans le dépôt.');
    montrerChat(false);
    $('texte').value = '@' + slug + ' ';
    $('texte').focus(); taille();
  }).catch(function (e) { alerte(e.message); $('botCreate').disabled = false; });
};

/* ---------- Connexion ---------- */
function demarrer() {
  return Promise.all([api('/user'), api(D())]).then(function (r) {
    S.moi = r[0].login; S.moiNom = r[0].name || r[0].login;
    S.branche = r[1].default_branch || 'main';
    $('aerreur').textContent = '';
    majCompteUI();
    return chargerConvs();
  }).then(function () {
    montrerHome(true);
    if (S.conv) { /* rester à l’accueil : on ouvre au tap */ }
    boucle();
  });
}
$('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();
  S.depot = $('adepot').value.trim().replace(/^https:\/\/github\.com\//, '').replace(/\/+$/, '');
  S.jeton = $('ajeton').value.trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(S.depot) || !S.jeton) { $('aerreur').textContent = 'Indique le dépôt sous la forme propriétaire/nom, et le jeton.'; return; }
  $('aerreur').textContent = 'Vérification.';
  demarrer().then(function () { mem.ecrire('si_depot', S.depot); mem.ecrire('si_jeton', S.jeton); }, function (err) { S.jeton = ''; $('aerreur').textContent = err.message; });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(function () {});
}
if (S.depot && S.jeton) demarrer().catch(function (e) { montrerLogin(e.message); });
else montrerLogin('');
})();
