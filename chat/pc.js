/* PC de Tom (FSM001-PCPRO) dans FSM SI — comme les cartes d'accord de Grok Bot.
   - Carte d'accord dans le fil pour chaque action proposée par Laura : la commande EXACTE, « Refuser » / « Autoriser ».
     L'accord est signé par la clé de CET appareil (WebCrypto P-256, non extractible, gardée dans IndexedDB) :
     le serveur fsm-si-pc refuse toute exécution sans cette signature, même avec le jeton GitHub.
   - Résultat montré dans la carte (sortie, image), puis Laura continue (à l'écrit, ou à voix haute pendant un appel).
   - Panneau « PC de Tom » : relier (code à 6 chiffres à taper sur le PC), état en ligne, journal, « Couper l'accès ».
   - Mode local : le chat envoie au PC la copie des conversations et de la mémoire ; il remet les messages écrits hors ligne.
   Visible seulement si le PC est relié, ou avec ?pc=1 (drapeau éteint par défaut). */
(function () {
'use strict';
var PC = (function () { try { return localStorage.getItem('si_pc_url') || ''; } catch (e) { return ''; } })() || 'https://fsm-si-pc.fsmdev66.workers.dev';
try { if (/[?&]pc=1\b/.test(location.search)) localStorage.setItem('si_pc', '1'); } catch (e) {}
function lsl(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
function lse(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function el(n, c, t) { var x = document.createElement(n); if (c) x.className = c; if (t != null) x.textContent = t; return x; }
function jeton() { return window.FSMChat ? FSMChat.jeton() : lsl('si_jeton'); }
function api(chemin, o) {
  o = o || {};
  return fetch(PC + chemin, { method: o.method || (o.json ? 'POST' : 'GET'), headers: Object.assign({ Authorization: 'Bearer ' + jeton() }, o.json ? { 'Content-Type': 'application/json' } : {}), body: o.json ? JSON.stringify(o.json) : o.body })
    .then(function (r) { if (o.brut) { if (!r.ok) throw new Error('PC ' + r.status); return r.blob(); } return r.json().catch(function () { return {}; }).then(function (d) { d._statut = r.status; if (!r.ok && !o.tolerer) { var e = new Error(d.erreur || ('PC ' + r.status)); e.statut = r.status; e.donnees = d; throw e; } return d; }); });
}

/* ---------- Clé d'accord de cet appareil (non extractible) ---------- */
var CLE = null;
function idb() { return new Promise(function (ok, ko) { var r = indexedDB.open('fsm-si-pc', 1); r.onupgradeneeded = function () { r.result.createObjectStore('cles'); }; r.onsuccess = function () { ok(r.result); }; r.onerror = function () { ko(r.error); }; }); }
function idbGet(db, k) { return new Promise(function (ok, ko) { var q = db.transaction('cles').objectStore('cles').get(k); q.onsuccess = function () { ok(q.result); }; q.onerror = function () { ko(q.error); }; }); }
function idbPut(db, k, v) { return new Promise(function (ok, ko) { var t = db.transaction('cles', 'readwrite'); t.objectStore('cles').put(v, k); t.oncomplete = function () { ok(); }; t.onerror = function () { ko(t.error); }; }); }
function canonique(o) {
  if (Array.isArray(o)) return '[' + o.map(canonique).join(',') + ']';
  if (o && typeof o === 'object') return '{' + Object.keys(o).sort().map(function (k) { return JSON.stringify(k) + ':' + canonique(o[k]); }).join(',') + '}';
  return JSON.stringify(o === undefined ? null : o);
}
function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
function sha(s) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(hex); }
function b64u(buf) { var s = ''; new Uint8Array(buf).forEach(function (b) { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function cle() {
  if (CLE) return CLE;
  CLE = idb().then(function (db) {
    return idbGet(db, 'approbation').then(function (k) {
      if (k) return k;
      return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']).then(function (p) {
        return crypto.subtle.exportKey('jwk', p.publicKey).then(function (jwk) { var v = { privee: p.privateKey, jwk: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y } }; return idbPut(db, 'approbation', v).then(function () { return v; }); });
      });
    });
  }).then(function (k) { return sha(canonique({ crv: k.jwk.crv, kty: k.jwk.kty, x: k.jwk.x, y: k.jwk.y })).then(function (h) { k.id = h.slice(0, 24); return k; }); });
  CLE.catch(function () { CLE = null; });
  return CLE;
}
function signer(msg) { return cle().then(function (k) { return crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k.privee, new TextEncoder().encode(msg)).then(function (s) { return { id: k.id, sig: b64u(s) }; }); }); }
function nomAppareil() { var u = navigator.userAgent; return /iPhone/.test(u) ? 'iPhone de Tom' : /iPad/.test(u) ? 'iPad de Tom' : /Windows/.test(u) ? 'PC de Tom (FSM SI)' : /Mac/.test(u) ? 'Mac de Tom' : 'Appareil de Tom'; }

/* ---------- Styles (cartes d'accord Grok Bot : #1f1f1f, bord #303030, rayon 20) ---------- */
var CSS = [
'.pc-carte{box-sizing:border-box;width:100%;background:#1f1f1f;border:1px solid #303030;border-radius:20px;padding:14px 15px 15px;margin:8px 0 2px;color:#fff;font:15px/1.38 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;-webkit-user-select:text;user-select:text}',
'.pc-tete{display:flex;align-items:center;gap:9px;color:#a1a1a8;font-size:13px;margin:0 0 10px}.pc-tete i{width:20px;height:20px;border-radius:5px;background:#343436;display:grid;place-items:center;font-style:normal}.pc-tete svg{width:13px;height:13px;stroke:#a1a1a8;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}',
'.pc-carte h5{margin:0 0 8px;font-size:17px;line-height:22px;font-weight:700}',
'.pc-cmd{margin:0 0 8px;background:#141414;border:1px solid #303030;border-radius:12px;padding:10px 12px;font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word;max-height:260px;overflow:auto;color:#e5e5ea}',
'.pc-det{color:#8e8e93;font-size:13px;margin:0 0 12px}',
'.pc-pied{display:flex;justify-content:flex-end;gap:8px;align-items:center}',
'.pc-btn{border:0;border-radius:999px;background:#fff;color:#000;font:inherit;font-size:14px;padding:0 15px;height:34px;cursor:pointer;-webkit-tap-highlight-color:transparent}.pc-btn.gris{background:#343436;color:#fff}.pc-btn.rouge{background:#ff453a;color:#fff}.pc-btn:disabled{background:#343436;color:#858586}',
'.pc-etat{display:flex;align-items:center;gap:7px;color:#a1a1a8;font-size:13px}.pc-etat.ok{color:#4cd964}.pc-etat.ko{color:#ff453a}',
'.pc-sortie{margin:10px 0 0}.pc-sortie summary{color:#a1a1a8;font-size:13px;cursor:pointer}.pc-sortie pre{margin:8px 0 0;background:#141414;border:1px solid #303030;border-radius:12px;padding:10px 12px;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word;max-height:320px;overflow:auto}',
'.pc-img{display:block;max-width:100%;border-radius:12px;margin:10px 0 0;border:1px solid #303030}',
'.pc-err{color:#ff453a;font-size:13px;margin:8px 0 0}',
'#pc-vocal{position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom) + 120px);z-index:9500;max-width:520px;margin:0 auto;box-shadow:0 18px 50px rgba(0,0,0,.6)}',
'#pcp{position:fixed;inset:0;z-index:9000;background:#141414;color:#fff;display:flex;flex-direction:column;font:15px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif}',
'#pcp .h{display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top) + 8px) 12px 8px}#pcp .h b{flex:1;text-align:center;font-size:17px}#pcp .x{width:40px;height:40px;border-radius:20px;border:0;background:#2e2e31;color:#fff;font-size:20px}',
'#pcp .c{flex:1;overflow:auto;padding:4px 16px calc(env(safe-area-inset-bottom) + 24px)}#pcp .code{font:700 40px/1.1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:4px;text-align:center;margin:14px 0}',
'#pcp ol{color:#c7c7cc;padding-left:20px}#pcp li{margin:6px 0}#pcp .j{border-top:1px solid #262626;padding:8px 0;font-size:13px;color:#a1a1a8}#pcp .j b{color:#fff;font-weight:500}'
].join('');
function style() { if (document.getElementById('pc-css')) return; var s = el('style'); s.id = 'pc-css'; s.textContent = CSS; document.head.appendChild(s); }
var ICO = '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M6 8l3 2-3 2M11 12h5"/></svg>';

/* ---------- Cartes d'accord ---------- */
var RE = /<!--\s*fsm-pc-demande\s+(\{[\s\S]*?\})\s*-->/g;
function demandes(corps) { var l = [], m; RE.lastIndex = 0; while ((m = RE.exec(String(corps || '')))) { try { var x = JSON.parse(m[1]); if (x && x.d && x.s) l.push(x); } catch (e) {} } return l; }
var etats = {}; /* id → promesse d'état serveur */
function etatDemande(id, frais) { if (frais || !etats[id]) etats[id] = api('/pc/demande/' + id, { tolerer: true }).catch(function () { return { etat: 'inconnu' }; }); return etats[id]; }
function cartes(node, corps) {
  var l = demandes(corps);
  if (!l.length) return;
  style();
  var bulle = node.querySelector('.bubble') || node;
  l.forEach(function (x) {
    if (bulle.querySelector('[data-pc="' + x.d.id + '"]')) return;
    bulle.appendChild(carte(x, false));
  });
}
function carte(x, vocal) {
  var d = x.d, c = el('div', 'pc-carte'); c.dataset.pc = d.id;
  ['click', 'touchstart', 'touchend', 'mousedown', 'contextmenu'].forEach(function (t) { c.addEventListener(t, function (ev) { ev.stopPropagation(); }); });
  var tete = el('div', 'pc-tete'); tete.innerHTML = '<i>' + ICO + '</i>'; tete.appendChild(el('span', '', 'PC de Tom · Laura demande ton accord')); c.appendChild(tete);
  c.appendChild(el('h5', '', (d.affiche && d.affiche.titre || d.outil) + ' ?'));
  c.appendChild(el('pre', 'pc-cmd', d.affiche && d.affiche.commande || ''));
  if (d.affiche && d.affiche.details) c.appendChild(el('div', 'pc-det', d.affiche.details));
  var pied = el('div', 'pc-pied'); c.appendChild(pied);
  var zone = el('div'); c.appendChild(zone);
  function montrerEtat(e) {
    pied.innerHTML = ''; zone.innerHTML = '';
    var et = e && e.etat;
    if (!et || et === 'attente' || et === 'hors_ligne' || et === 'inconnu') {
      if (d.exp < Date.now()) { pied.appendChild(ligneEtat('Expirée (15 min) : redemande à Laura', '')); return; }
      var r = el('button', 'pc-btn gris', 'Refuser'), a = el('button', 'pc-btn', 'Autoriser');
      r.type = a.type = 'button';
      r.onclick = function () { r.disabled = a.disabled = true; api('/pc/refuser', { json: { d: d, s: x.s } }).then(function (e2) { etats[d.id] = Promise.resolve(e2); montrerEtat(e2); suite(d, e2, vocal); }, function (er) { r.disabled = a.disabled = false; zone.appendChild(el('div', 'pc-err', er.message)); }); };
      a.onclick = function () { r.disabled = a.disabled = true; a.textContent = 'En cours…'; autoriser(x).then(function (e2) { etats[d.id] = Promise.resolve(e2); montrerEtat(e2); suite(d, e2, vocal); }, function (er) { r.disabled = a.disabled = false; a.textContent = 'Autoriser'; zone.appendChild(el('div', 'pc-err', er.message)); }); };
      pied.appendChild(r); pied.appendChild(a);
      if (et === 'hors_ligne') zone.appendChild(el('div', 'pc-err', 'Le PC était hors ligne : ouvre « FSM SI · PC » sur le PC, puis autorise de nouveau.'));
      return;
    }
    if (et === 'refusee') { pied.appendChild(ligneEtat('Refusé', 'ko')); return; }
    if (et === 'en_cours') { pied.appendChild(ligneEtat('En cours sur le PC…', '')); setTimeout(function () { etatDemande(d.id, true).then(montrerEtat); }, 3000); return; }
    var res = e.resultat || {};
    pied.appendChild(ligneEtat((et === 'faite' ? 'Autorisé · fait' : 'Autorisé · échec') + (e.ms ? ' en ' + (e.ms / 1000).toFixed(1).replace('.', ',') + ' s' : '') + (e.par ? ' · ' + e.par : ''), et === 'faite' ? 'ok' : 'ko'));
    if (res.erreur) zone.appendChild(el('div', 'pc-err', res.erreur));
    if (res.sortie) { var det = el('details', 'pc-sortie'); det.appendChild(el('summary', '', 'Sortie' + (res.tronque ? ' (tronquée)' : ''))); det.appendChild(el('pre', '', res.sortie)); zone.appendChild(det); }
    if (res.depot && /^image\//.test(res.type || '')) { var im = el('img', 'pc-img'); im.alt = 'Capture du PC'; zone.appendChild(im); depotBlob(res.depot).then(function (b) { im.src = URL.createObjectURL(b); }, function () { im.alt = 'Image expirée'; }); }
  }
  etatDemande(d.id).then(montrerEtat);
  return c;
}
function ligneEtat(t, cl) { var s = el('div', 'pc-etat ' + cl); s.textContent = (cl === 'ok' ? '✓ ' : cl === 'ko' ? '✕ ' : '') + t; return s; }
var blobs = {};
function depotBlob(id) { if (!blobs[id]) { blobs[id] = api('/pc/depot/' + id, { brut: true }); blobs[id].catch(function () { delete blobs[id]; }); } return blobs[id]; }
function empreinte(d) { return sha(canonique(d)); }
function autoriser(x) {
  return empreinte(x.d).then(function (h) { return signer('fsm-si-pc:approuver:' + h); }).then(function (s) {
    return api('/pc/approuver', { json: { d: x.d, s: x.s, cle_id: s.id, signature: s.sig }, tolerer: true }).then(function (r) {
      if (r._statut === 403 && /appareil/.test(r.erreur || '')) throw new Error('Cet appareil n’est pas celui qui a relié le PC : autorise depuis cet appareil-là, ou relie le PC de nouveau depuis celui-ci.');
      if (r._statut === 409 && r.etat === 'hors_ligne') return r;
      if (r._statut >= 400 && !r.etat) throw new Error(r.erreur || ('PC ' + r._statut));
      return r;
    });
  });
}
/* Laura continue avec le résultat (texte caché : jamais une bulle de Tom). */
var suivies = {};
function suite(d, e, vocal) {
  if (suivies[d.id] || !window.FSMChat) return;
  suivies[d.id] = 1;
  var titre = d.affiche && d.affiche.titre || d.outil;
  var t;
  if (e.etat === 'refusee') t = '[Résultat PC · ' + titre + '] Tom a REFUSÉ cette action. Ne la relance pas sans qu’il le demande.';
  else if (e.etat === 'hors_ligne') return;
  else {
    var r = e.resultat || {};
    t = '[Résultat PC · ' + titre + ' · ' + (e.etat === 'faite' ? 'fait' : 'échec') + (r.code != null ? ' · code ' + r.code : '') + ']\n' + (r.erreur ? 'Erreur : ' + r.erreur + '\n' : '') + String(r.sortie || '').slice(0, 12000) + (r.tronque ? '\n[sortie tronquée]' : '') + (r.depot ? '\n(dépôt ' + r.depot + ')' : '');
  }
  var image = e.resultat && e.resultat.depot && /^image\//.test(e.resultat.type || '') ? e.resultat.depot : null;
  var lancer = function (imgs) {
    if (vocal && FSMChat.enAppel() && FSMChat.continuerVocal(t)) return;
    FSMChat.continuer(t, imgs);
  };
  if (!image) return lancer(undefined);
  depotBlob(image).then(function (b) { return new Promise(function (ok) { var f = new FileReader(); f.onload = function () { ok(f.result); }; f.onerror = function () { ok(null); }; f.readAsDataURL(b); }); })
    .then(function (u) { lancer(u && u.length < 5800000 ? [u] : undefined); }, function () { lancer(undefined); });
}
/* En appel : la carte apparaît au-dessus de la pastille (rien d'autre n'est écrit). */
function demandeVocale(x) {
  if (!x || !x.d) return;
  style();
  var vieux = document.getElementById('pc-vocal'); if (vieux) vieux.remove();
  var c = carte(x, true); c.id = 'pc-vocal';
  document.body.appendChild(c);
  var fermer = function () { var n = document.getElementById('pc-vocal'); if (n === c) setTimeout(function () { c.remove(); }, 2500); };
  var obs = new MutationObserver(function () { if (c.querySelector('.pc-etat')) { obs.disconnect(); fermer(); } });
  obs.observe(c, { childList: true, subtree: true });
}

/* ---------- Panneau « PC de Tom » ---------- */
var ETAT = null;
function visible() { return lsl('si_pc') === '1' || lsl('si_pc_relie') === '1'; }
function rafraichirEtat() { return api('/pc/etat').then(function (e) { ETAT = e; lse('si_pc_relie', e.appareil && !e.appareil.coupe ? '1' : '0'); return e; }); }
function ouvrir() {
  style();
  var p = document.getElementById('pcp'); if (p) p.remove();
  p = el('section'); p.id = 'pcp';
  p.innerHTML = '<div class="h"><button class="x" type="button" aria-label="Fermer">‹</button><b>PC de Tom</b><span style="width:40px"></span></div><div class="c"></div>';
  document.body.appendChild(p);
  p.querySelector('.x').onclick = function () { p.remove(); };
  var c = p.querySelector('.c');
  var dessiner = function () {
    c.innerHTML = '<p class="pc-det">Chargement…</p>';
    Promise.all([rafraichirEtat(), cle(), api('/pc/journal?n=15').catch(function () { return { entrees: [] }; })]).then(function (r) {
      var e = r[0], k = r[1], j = r[2].entrees || [];
      c.innerHTML = '';
      var a = e.appareil, carteE = el('div', 'pc-carte');
      carteE.innerHTML = '<div class="pc-tete"><i>' + ICO + '</i><span>' + (a && !a.coupe ? (a.en_ligne ? 'En ligne' : 'Hors ligne') : 'Aucun PC relié') + '</span></div>';
      carteE.appendChild(el('h5', '', a && !a.coupe ? a.nom : 'Relier ton PC Windows'));
      carteE.appendChild(el('div', 'pc-det', a && !a.coupe ? ('Agent ' + (a.agent_version || a.version || '') + ' · cet appareil ' + (e.approbateurs.some(function (x) { return x.id === k.id; }) ? 'peut autoriser les actions' : 'ne peut PAS autoriser (relie depuis celui-ci pour qu’il le puisse)') + (e.actif ? '' : ' · outils de Laura éteints') + (e.essai ? ' · essai en cours' : '')) : 'Laura pourra proposer des actions sur ton PC ; chacune attendra ton « Autoriser » ici. Rien n’est installé par FSM SI : tu lances toi-même « FSM SI · PC » sur le PC.'));
      var pied = el('div', 'pc-pied'); carteE.appendChild(pied);
      if (a && !a.coupe) {
        var cp = el('button', 'pc-btn rouge', 'Couper l’accès'); cp.type = 'button';
        cp.onclick = function () { cp.disabled = true; api('/pc/couper', { json: {} }).then(dessiner, dessiner); };
        pied.appendChild(cp);
        var act = el('button', 'pc-btn gris', e.actif ? 'Éteindre les outils' : 'Allumer les outils'); act.type = 'button';
        act.onclick = function () { act.disabled = true; api('/pc/config', { json: { actif: !e.actif } }).then(dessiner, dessiner); };
        pied.appendChild(act);
      }
      var rel = el('button', 'pc-btn', a && !a.coupe ? 'Relier de nouveau' : 'Relier ce PC'); rel.type = 'button';
      rel.onclick = function () {
        rel.disabled = true;
        api('/pc/code', { json: { cle_publique: k.jwk, nom: nomAppareil() } }).then(function (r2) {
          c.innerHTML = '';
          var cc = el('div', 'pc-carte'); cc.appendChild(el('h5', '', 'Code pour relier le PC'));
          cc.appendChild(el('div', 'code', r2.code));
          cc.appendChild(el('div', 'pc-det', 'Valable ' + r2.expire_min + ' minutes, une seule fois.'));
          var ol = el('ol'); ['Sur le PC, ouvre « FSM SI · PC » (FSM-SI-PC.exe).', 'Tape ce code dans sa fenêtre, puis Entrée.', 'La fenêtre affiche « PC relié » : c’est prêt. Ferme-la pour couper l’accès à tout moment.'].forEach(function (t) { ol.appendChild(el('li', '', t)); });
          cc.appendChild(ol);
          var ok = el('button', 'pc-btn', 'C’est fait'); ok.type = 'button'; ok.onclick = dessiner;
          var pd = el('div', 'pc-pied'); pd.appendChild(ok); cc.appendChild(pd); c.appendChild(cc);
        }, function (er) { rel.disabled = false; carteE.appendChild(el('div', 'pc-err', er.message)); });
      };
      pied.appendChild(rel);
      c.appendChild(carteE);
      if (j.length) {
        c.appendChild(el('h5', '', 'Journal'));
        j.forEach(function (x) {
          var l = el('div', 'j'); var h = String(x.heure || '').slice(11, 16);
          l.innerHTML = h + ' · <b></b> <span></span>';
          l.querySelector('b').textContent = x.type === 'action' ? (x.outil || '').replace('pc_', '') : x.type;
          l.querySelector('span').textContent = (x.etat ? x.etat + ' · ' : '') + (x.args && (x.args.commande || x.args.chemin || x.args.url) || x.nom || '');
          c.appendChild(l);
        });
      }
    }, function (er) { c.innerHTML = ''; c.appendChild(el('div', 'pc-err', er.message)); });
  };
  dessiner();
}

/* ---------- Mode local : copie vers le PC, messages écrits hors ligne ---------- */
var dernierMiroir = {}, dernierMem = 0, derniereBoite = 0;
function apresRafraichir(n, titre, items) {
  if (lsl('si_pc_relie') !== '1' || !window.FSMChat) return;
  var t = Date.now();
  if (n && (!dernierMiroir[n] || t - dernierMiroir[n] > 60000)) {
    dernierMiroir[n] = t;
    var l = (items || []).filter(function (i) { return i.genre === 'moi' || i.genre === 'tx' || i.genre === 'appel'; }).slice(-300).map(function (i) {
      if (i.genre === 'appel') return { id: i.cle, role: 'user', texte: (i.appel.tom || '') + (i.appel.laura ? '\n— Laura : ' + i.appel.laura : ''), date: i.date, mode: 'vocal', vocal: true };
      var m = /<!--\s*fsm-par:\s*(\w+)/.exec(i.corps || '');
      var outils = []; String(i.corps || '').replace(/"outil":"(pc_\w+)"/g, function (_, o) { outils.push(o); });
      return { id: i.cle, role: i.genre === 'tx' ? 'assistant' : 'user', texte: FSMChat.texteLeger(i.corps), date: i.date, mode: m ? m[1] : (i.genre === 'tx' ? 'robot' : ''), outils: outils.length ? outils : undefined };
    });
    var el2 = {}; el2['conv:' + n] = { n: n, titre: titre, maj: new Date().toISOString(), items: l };
    api('/pc/miroir', { json: { elements: el2 } }).catch(function () { dernierMiroir[n] = 0; });
  }
  if (t - dernierMem > 30 * 60000 && FSMChat.depot()) {
    dernierMem = t;
    FSMChat.api('/repos/' + FSMChat.depot() + '/contents/robot/memoire').then(function (fs) {
      var md = (fs || []).filter(function (f) { return f.type === 'file' && /^0\d-.*\.md$/.test(f.name); });
      return Promise.all(md.map(function (f) { return FSMChat.api('/repos/' + FSMChat.depot() + '/contents/' + f.path, { accept: 'application/vnd.github.raw', texte: true }).then(function (c) { return [f.name, c]; }); }));
    }).then(function (paires) { var e3 = {}; paires.forEach(function (p) { e3['memoire:' + p[0]] = { contenu: p[1] }; }); return api('/pc/miroir', { json: { elements: e3 } }); }).catch(function () { dernierMem = 0; });
  }
  if (t - derniereBoite > 60000) {
    derniereBoite = t;
    api('/pc/boite').then(function (b) {
      var l = b.messages || []; if (!l.length) return;
      var faits = [];
      return l.reduce(function (p, m) {
        return p.then(function () {
          var corps = m.texte + '\n\n<sub>✍️ écrit hors ligne sur le PC (' + String(m.ecrit || '').slice(11, 16) + ')</sub>';
          var envoi = !m.conv || m.conv === FSMChat.conv() ? FSMChat.envoyer(corps) : FSMChat.posterDans(m.conv, corps);
          return Promise.resolve(envoi).then(function () { faits.push(m.id); });
        });
      }, Promise.resolve()).then(function () { if (faits.length) return api('/pc/boite/vu', { json: { ids: faits } }); });
    }).catch(function () {});
  }
}
if (visible()) setTimeout(function () { if (jeton()) rafraichirEtat().catch(function () {}); }, 1500);

window.PCTom = { PC: PC, cartes: cartes, demandeVocale: demandeVocale, ouvrir: ouvrir, visible: visible, apresRafraichir: apresRafraichir, etat: function () { return ETAT; },
  _test: { demandes: demandes, canonique: canonique, carte: carte, cle: cle } };
})();
