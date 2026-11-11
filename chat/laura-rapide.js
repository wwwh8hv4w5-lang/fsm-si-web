/* Laura F.S.M — voie rapide (Worker fsm-si-proxy toujours allumé) + cases sécurisées du coffre.
   Les valeurs saisies dans une case sécurisée partent directement au coffre chiffré :
   jamais dans le fil, jamais dans GitHub, jamais montrées au modèle. */
(function () {
'use strict';
var PROXY = (typeof location !== 'undefined' && location.hostname === 'laura.fsmsibot.app')
  ? location.origin
  : 'https://fsm-si-proxy.fsmdev66.workers.dev';

function discuter(jeton, corps, surTexte) {
  var t0 = performance.now(), premier = 0;
  var ctl = new AbortController();
  var minuteur = setTimeout(function () { ctl.abort(); }, 12000); /* aucun mot en 12 s : on laisse le robot répondre */
  return fetch(PROXY + '/chat', { credentials: 'include', 
    method: 'POST', signal: ctl.signal,
    headers: { Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' },
    body: JSON.stringify(corps)
  }).then(function (r) {
    if (!r.ok || !r.body) throw new Error('voie rapide ' + r.status);
    var rd = r.body.getReader(), dec = new TextDecoder(), buf = '', txt = '', fin = null;
    function pompe() {
      return rd.read().then(function (x) {
        if (x.done) {
          clearTimeout(minuteur);
          if (!fin || !txt.trim()) throw new Error('voie rapide coupée');
          fin.premier_navigateur_ms = Math.round(premier);
          return { texte: txt, fin: fin };
        }
        buf += dec.decode(x.value, { stream: true });
        var i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          var bloc = buf.slice(0, i); buf = buf.slice(i + 2);
          var l = bloc.replace(/^data:\s*/, '');
          var j; try { j = JSON.parse(l); } catch (e) { continue; }
          if (j.t) {
            if (!premier) { premier = performance.now() - t0; clearTimeout(minuteur); }
            txt += j.t; surTexte(txt);
          }
          if (j.fin) fin = j;
          if (j.erreur && !txt) throw new Error('voie rapide indisponible');
        }
        return pompe();
      });
    }
    return pompe();
  });
}

/* ---------- Cases sécurisées (même look que la case « Secrets » de Grok Bot) ---------- */
/* valeurs relevées au pixel sur la capture Grok Bot de Tom (1170×2532, ×3) */
var CSS = '.si-bloc{width:100%;margin:2px 0 0;align-self:stretch;font:15px/1.38 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;-webkit-touch-callout:default}' +
  '.msg.si-avec-carte{width:100%}' +
  '.si-carte{box-sizing:border-box;width:100%;background:#1f1f1f;border:1px solid #303030;border-radius:20px;padding:14.5px 15px 15px;color:#fff}' +
  '.si-tete{display:flex;align-items:center;gap:9px;color:#fff;font-size:15px;font-weight:400;height:20px;margin:0 0 21px}' +
  '.si-tete .si-ico{width:20px;height:20px;border-radius:5px;background:#343436;color:#a1a1a8;display:grid;place-items:center;flex:none}' +
  '.si-tete svg{width:15px;height:15px}' +
  '.si-carte h5{margin:0 0 3.5px;font-size:17px;line-height:22px;font-weight:700;color:#fff}' +
  '.si-carte p.si-desc{margin:0 0 12px;color:#99999f;font-size:17px;line-height:24px}' +
  '.si-champ{position:relative;margin:0 0 18px}' +
  '.si-champ input{display:block;width:100%;box-sizing:border-box;height:40px;background:#343436;border:0;border-radius:10px;color:#fff;padding:0 44px 0 12px;font-size:17px;outline:none;-webkit-appearance:none;appearance:none;-webkit-user-select:text;user-select:text;font-family:inherit}' +
  '.si-champ input::placeholder{color:#6a6a6f;opacity:1}' +
  '.si-champ input[readonly]{color:#a1a1a8}' +
  '.si-oeil{position:absolute;right:3px;top:50%;transform:translateY(-50%);width:36px;height:36px;border:0;background:none;color:#a1a1a8;display:grid;place-items:center;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
  '.si-oeil svg{width:18px;height:18px}' +
  '.si-pied{display:flex;justify-content:flex-end}' +
  '.si-btn{border:0;border-radius:999px;background:#fff;color:#000;font-family:inherit;font-weight:400;font-size:13px;line-height:1;padding:0 12.5px;height:34px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .15s,color .15s}' +
  '.si-btn:disabled{background:#343436;color:#858586;cursor:default}' +
  '.si-btn.si-fait{background:#343436;color:#a1a1a8}.si-btn svg{width:12px;height:12px}' +
  '.si-err{color:#FF453A;font-size:13px;margin:8px 0 0}' +
  '.si-note{display:flex;align-items:flex-start;gap:8px;color:#555558;font-size:12px;line-height:17px;margin:11px 16px 0}' +
  '.si-note svg{width:11px;height:12px;flex:none;margin-top:2px}';
var IC = {
  cle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="17" cy="12" r="4.2"/><path d="M12.8 12H2.5M4.5 12v3.2M7.8 12v2.4"/></svg>',
  oeil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  oeilBarre: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.5M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20"/></svg>',
  bouclier: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  form: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>'
};
function style() {
  if (document.getElementById('si-carte-css')) return;
  var s = document.createElement('style'); s.id = 'si-carte-css'; s.textContent = CSS; document.head.appendChild(s);
}
function lireFaits() { try { return JSON.parse(localStorage.getItem('si_cartes_faites') || '{}'); } catch (e) { return {}; } }
function noterFait(k) { var f = lireFaits(); f[k] = Date.now(); try { localStorage.setItem('si_cartes_faites', JSON.stringify(f)); } catch (e) {} }
function e(nom, cls, txt) { var x = document.createElement(nom); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; }
function ico(nom) { var s = document.createElement('span'); s.style.display = 'contents'; s.innerHTML = IC[nom]; return s.firstChild; }

function ranger(jeton, nom, valeur, libelle, description) {
  return fetch(PROXY + '/coffre/' + encodeURIComponent(nom), { credentials: 'include', 
    method: 'PUT', headers: { Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' },
    body: JSON.stringify({ valeur: valeur, libelle: libelle, description: description })
  }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d && d.erreur || 'coffre ' + r.status); return d; }); });
}

/* spec : { type:'secret', nom, libelle, description } ou { type:'formulaire', titre, description, champs:[{nom, libelle, secret}] }
   Rendu : bloc = carte + petite note « Stocké de façon sécurisée… » sous la carte. */
function carte(spec, o) {
  style();
  var estSecret = spec.type === 'secret';
  var cleFaite = o.cle + ':' + (spec.nom || spec.titre || '');
  var bloc = e('div', 'si-bloc');
  var c = e('div', 'si-carte'); bloc.appendChild(c);
  ['click', 'touchstart', 'touchend', 'mousedown', 'contextmenu'].forEach(function (t) { bloc.addEventListener(t, function (ev) { ev.stopPropagation(); }); });
  var champs = estSecret ? [{ nom: spec.nom, libelle: spec.libelle || spec.nom, secret: true }] : (spec.champs || []);
  var aSecret = champs.some(function (ch) { return ch.secret; });
  var tete = e('div', 'si-tete'), boite = e('span', 'si-ico'); boite.appendChild(ico(estSecret || aSecret ? 'cle' : 'form')); tete.appendChild(boite);
  tete.appendChild(e('span', '', estSecret || aSecret ? 'Secrets' : 'Formulaire')); c.appendChild(tete);
  c.appendChild(e('h5', '', estSecret ? (spec.libelle || spec.nom) : (spec.titre || 'Formulaire')));
  if (spec.description) c.appendChild(e('p', 'si-desc', spec.description));
  if (aSecret) {
    var note = e('div', 'si-note'); note.appendChild(ico('bouclier'));
    note.appendChild(e('span', '', 'Stocké de façon sécurisée, jamais montré à Laura.')); bloc.appendChild(note);
  }
  var pied = e('div', 'si-pied');
  var b = e('button', 'si-btn', 'Enregistrer'); b.type = 'button';
  function etatFait() {
    c.querySelectorAll('.si-champ').forEach(function (z) { z.remove(); });
    champs.forEach(function (ch) {
      var z = e('div', 'si-champ'), i = document.createElement('input');
      i.type = 'text'; i.readOnly = true; i.tabIndex = -1; i.value = ch.secret ? '••••••••••••' : '';
      i.placeholder = ch.libelle || ch.nom; i.setAttribute('aria-label', ch.libelle || ch.nom);
      z.appendChild(i); c.insertBefore(z, pied);
    });
    b.disabled = true; b.className = 'si-btn si-fait'; b.textContent = '';
    b.appendChild(ico('ok')); b.appendChild(document.createTextNode('Enregistré'));
    if (err) err.hidden = true;
  }
  var err = null;
  if (lireFaits()[cleFaite]) { c.appendChild(pied); pied.appendChild(b); etatFait(); return bloc; }
  var ins = champs.map(function (ch) {
    var z = e('div', 'si-champ'), i = document.createElement('input');
    i.type = ch.secret ? 'password' : 'text';
    i.autocomplete = ch.secret ? 'new-password' : 'off'; i.setAttribute('autocapitalize', 'off'); i.setAttribute('autocorrect', 'off'); i.spellcheck = false;
    i.placeholder = ch.libelle || ch.nom; i.setAttribute('aria-label', ch.libelle || ch.nom);
    i.setAttribute('data-lpignore', 'true'); i.setAttribute('data-1p-ignore', 'true');
    z.appendChild(i);
    if (ch.secret) {
      var oe = e('button', 'si-oeil'); oe.type = 'button'; oe.setAttribute('aria-label', 'Afficher'); oe.appendChild(ico('oeil'));
      oe.onclick = function () {
        var voir = i.type === 'password'; i.type = voir ? 'text' : 'password';
        oe.innerHTML = ''; oe.appendChild(ico(voir ? 'oeilBarre' : 'oeil')); oe.setAttribute('aria-label', voir ? 'Masquer' : 'Afficher');
      };
      z.appendChild(oe);
    } else i.style.paddingRight = '14px';
    c.appendChild(z);
    i.addEventListener('input', maj);
    i.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); if (!b.disabled) b.click(); } });
    return { ch: ch, i: i };
  });
  function maj() { b.disabled = ins.some(function (x) { return !x.i.value.trim(); }); }
  c.appendChild(pied); pied.appendChild(b); maj();
  err = e('div', 'si-err'); err.hidden = true; c.appendChild(err);
  b.onclick = function () {
    if (ins.some(function (x) { return !x.i.value.trim(); })) return;
    b.disabled = true; err.hidden = true; b.textContent = 'Enregistrement…';
    var secrets = ins.filter(function (x) { return x.ch.secret; });
    var textes = ins.filter(function (x) { return !x.ch.secret; });
    Promise.all(secrets.map(function (x) {
      return ranger(o.jeton, x.ch.nom, x.i.value.trim(), x.ch.libelle || x.ch.nom, spec.description || '');
    })).then(function () {
      /* la valeur secrète ne quitte jamais la carte : seul le nom part dans le fil */
      ins.forEach(function (x) { if (x.ch.secret) x.i.value = ''; });
      noterFait(cleFaite);
      var msg = estSecret
        ? '🔐 Secret ' + spec.nom + ' enregistré dans le coffre.'
        : '📝 ' + (spec.titre || 'Formulaire') + '\n' + textes.map(function (x) { return '- ' + (x.ch.libelle || x.ch.nom) + ' : ' + x.i.value.trim(); }).join('\n') +
          (secrets.length ? '\n' + secrets.map(function (x) { return '- 🔐 secret ' + x.ch.nom + ' enregistré'; }).join('\n') : '');
      etatFait();
      if (o.envoyer) o.envoyer(msg);
    }, function () { b.textContent = 'Enregistrer'; maj(); err.textContent = 'Le coffre n’a pas répondu, réessaie.'; err.hidden = false; });
  };
  return bloc;
}
function specs(corps) {
  var out = [], re = /<!--\s*fsm-(secret|formulaire):\s*([\s\S]*?)-->/g, m;
  while ((m = re.exec(String(corps || '')))) {
    try { var j = JSON.parse(m[2]); j.type = m[1]; out.push(j); } catch (x) {}
  }
  return out;
}
/* La carte se pose sous la bulle (pas dedans), comme dans Grok Bot ; bulle vide = masquée. */
function cartes(node, corps, o) {
  var l = specs(corps);
  if (!l.length) return;
  var bulle = node.querySelector('.bubble');
  node.classList.add('si-avec-carte');
  if (bulle && !bulle.textContent.trim() && !bulle.querySelector('img,video,audio')) bulle.style.display = 'none';
  var apres = bulle || null;
  l.forEach(function (s) {
    var k = carte(s, o);
    if (apres && apres.parentNode === node) { node.insertBefore(k, apres.nextSibling); apres = k; }
    else node.appendChild(k);
  });
}

/* ---------- Voix de qualité (Worker /tts et /voix) ----------
   Lecture par AudioContext : PCM 24 kHz diffusé morceau par morceau (appel vocal), ou mp3 phrase par phrase (/tts).
   Repli sur la voix du navigateur seulement si /tts échoue. */
var V = { ctx: null, sources: [], fin: 0, gen: 0, surFin: null, minuteur: 0, ctl: null };
function ctxAudio() {
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!V.ctx) {
    try { V.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { V.ctx = new AC(); }
    /* iPhone : un appel entrant, Siri ou le changement de route audio « interrompt » le contexte ; on le relance aussitôt */
    V.ctx.onstatechange = function () { if (V.ctx && V.ctx.state !== 'running' && V.ctx.state !== 'closed' && V.actif) try { V.ctx.resume(); } catch (e) {} };
  }
  if (V.ctx.state !== 'running' && V.ctx.state !== 'closed' && V.ctx.resume) try { V.ctx.resume(); } catch (e) {}
  return V.ctx;
}
/* Session audio d’appel (Safari 16.4+) : fixée AVANT d’ouvrir le micro, pour qu’iOS ne bascule pas de mode
   en pleine phrase (c’est ce basculement qui coupait la voix). */
function sessionAppel(on) {
  V.actif = !!on;
  try { if (navigator.audioSession) navigator.audioSession.type = on ? 'play-and-record' : 'auto'; } catch (e) {}
}
/* Sortie de la voix de Laura par un analyseur : la vague de la barre d’appel suit le vrai niveau joué. */
function sortie(c) {
  if (V.an && V.anCtx === c) return V.an;
  try { V.an = c.createAnalyser(); V.an.fftSize = 1024; V.an.smoothingTimeConstant = 0.3; V.an.connect(c.destination); V.anCtx = c; V.anData = new Uint8Array(V.an.fftSize); return V.an; }
  catch (e) { return c.destination; }
}
function niveau() {
  if (!V.an || !V.anData || !V.sources.length) return 0;
  try { V.an.getByteTimeDomainData(V.anData); var x = 0; for (var i = 0; i < V.anData.length; i++) { var v = (V.anData[i] - 128) / 128; x += v * v; } return Math.min(1, Math.sqrt(x / V.anData.length) * 5.5); }
  catch (e) { return 0; }
}
function debloquer() {
  var c = ctxAudio(); if (!c) return;
  try { var b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {}
}
function programmer(buf, gen) {
  var c = ctxAudio(); if (!c || gen !== V.gen) return;
  var s = c.createBufferSource(); s.buffer = buf; s.connect(sortie(c));
  /* File audio sans trou : les morceaux sont collés bout à bout sur l’horloge audio. Au premier morceau (ou après
     un vrai manque de données) on garde 120 ms d’avance pour absorber les à-coups du réseau. */
  var avance = 0.12;
  var t = V.fin > c.currentTime + 0.005 ? V.fin : c.currentTime + avance;
  if (V.fin && c.currentTime + 0.005 > V.fin) { V.trous = (V.trous || 0) + 1; V.trouMs = (V.trouMs || 0) + Math.round((c.currentTime + avance - V.fin) * 1000); }
  s.start(t); V.fin = t + buf.duration;
  V.sources.push(s);
  if (!V.premierSon) { V.premierSon = performance.now() + (t - c.currentTime) * 1000; V.debutCtx = t; }
  s.onended = function () { var i = V.sources.indexOf(s); if (i >= 0) V.sources.splice(i, 1); verifierFin(gen); };
}
function verifierFin(gen) {
  clearTimeout(V.minuteur);
  if (gen !== V.gen) return;
  V.minuteur = setTimeout(function () {
    if (gen !== V.gen) return;
    if (!V.sources.length && V.fluxFini && !V.enAttente) { var f = V.surFin; V.surFin = null; if (f) f(); }
  }, 60);
}
function pcmVersBuffer(b64, rate) {
  var c = ctxAudio(); if (!c) return null;
  var bin = atob(b64), n = bin.length >> 1;
  var buf = c.createBuffer(1, n, rate || 24000), d = buf.getChannelData(0);
  for (var i = 0; i < n; i++) { var v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v >= 32768) v -= 65536; d[i] = v / 32768; }
  return buf;
}
function stop() {
  V.gen++; V.fluxFini = true; V.enAttente = 0; V.surFin = null;
  V.sources.forEach(function (s) { try { s.onended = null; s.stop(); } catch (e) {} });
  V.sources = []; V.fin = 0;
  if (V.ctl) { try { V.ctl.abort(); } catch (e) {} V.ctl = null; }
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
}
function occupe() { return V.sources.length > 0 || !V.fluxFini; }
function nettoyerVoix(t) {
  return String(t || '').replace(/<!--[\s\S]*?-->/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>|~]/g, '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
}
function couper(tampon, toutFini) {
  var out = [], re = /[^.!?…\n]*?[.!?…]+["»)\]]?(?=\s)|[^\n]+?\n/g, m, fin = 0;
  while ((m = re.exec(tampon))) { var p = m[0].trim(); fin = re.lastIndex; if (p) out.push(p); }
  var reste = tampon.slice(fin);
  if (toutFini && reste.trim()) { out.push(reste.trim()); reste = ''; }
  return [out, reste];
}
function voixNavigateur(t, gen, ok) {
  if (!window.speechSynthesis) { ok(); return; }
  var u = new SpeechSynthesisUtterance(t); u.lang = 'fr-FR'; u.rate = 1.02;
  var vs = speechSynthesis.getVoices() || [];
  var v = vs.find(function (x) { return /^fr/i.test(x.lang) && /(amelie|amélie|audrey|aurelie|marie|julie|female|femme|google)/i.test(x.name); }) || vs.find(function (x) { return /^fr/i.test(x.lang); });
  if (v) u.voice = v;
  u.onend = u.onerror = function () { if (gen === V.gen) ok(); };
  speechSynthesis.speak(u);
}
/* Lecteur de phrases (mp3 via /tts) : pousser(texteCumulé) au fil du flux, finir() à la fin. */
function lecteur(jeton, surFin) {
  stop();
  var gen = V.gen, dit = 0, tampon = '', file = Promise.resolve();
  V.fluxFini = false; V.enAttente = 0; V.surFin = surFin || null; V.premierSon = 0;
  function phrase(p) {
    var t = nettoyerVoix(p); if (!t) return;
    V.enAttente++;
    var req = fetch(PROXY + '/tts', { credentials: 'include',  method: 'POST', headers: { Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ texte: t }, window.SI_PREFS_VOIX ? window.SI_PREFS_VOIX() : {})) })
      .then(function (r) { if (!r.ok) throw new Error('tts ' + r.status); return r.arrayBuffer(); })
      .then(function (a) { var c = ctxAudio(); if (!c) throw new Error('audio'); return new Promise(function (ok, ko) { c.decodeAudioData(a, ok, ko); }); });
    file = file.then(function () { return req; }).then(function (buf) {
      if (gen !== V.gen) return;
      programmer(buf, gen);
    }, function () {
      if (gen !== V.gen) return;
      /* Repli : voix du navigateur, après ce qui est déjà programmé. */
      return new Promise(function (ok) {
        var c = V.ctx, attente = c ? Math.max(0, (V.fin - c.currentTime) * 1000) : 0;
        setTimeout(function () { voixNavigateur(t, gen, ok); }, attente);
      });
    }).then(function () { V.enAttente--; verifierFin(gen); });
  }
  return {
    pousser: function (total) {
      if (gen !== V.gen) return;
      tampon += String(total).slice(dit); dit = String(total).length;
      var r = couper(tampon, false); tampon = r[1]; r[0].forEach(phrase);
    },
    finir: function () {
      if (gen !== V.gen) return;
      couper(tampon, true)[0].forEach(phrase); tampon = '';
      V.fluxFini = true; verifierFin(gen);
    }
  };
}
function parler(jeton, texte, surFin) { var l = lecteur(jeton, surFin); l.pousser(String(texte || '') + '\n'); l.finir(); }

/* Appel vocal : audio → /voix (transcription, Laura, voix en PCM dans une seule réponse). */
function appel(jeton, blob, meta, h) {
  stop();
  var gen = V.gen; V.fluxFini = false; V.enAttente = 0; V.surFin = h.surFinAudio || null; V.premierSon = 0; V.trous = 0; V.trouMs = 0; if (!V.sources.length) V.fin = 0;
  var ctl = new AbortController(); V.ctl = ctl;
  var fd = new FormData();
  if (blob) fd.append('audio', blob, 'parole.' + (/webm/.test(blob.type) ? 'webm' : /ogg/.test(blob.type) ? 'ogg' : /mpeg|mp3/.test(blob.type) ? 'mp3' : 'm4a'));
  fd.append('meta', JSON.stringify(meta || {}));
  var t0 = performance.now(), texte = '', fin = null, premierPcm = 0;
  var horsDelai = false;
  var delai = setTimeout(function () { if (!premierPcm) { horsDelai = true; try { ctl.abort(); } catch (e) {} } }, 15000);
  V.trous = 0; V.trouMs = 0;
  return fetch(PROXY + '/voix', { credentials: 'include',  method: 'POST', headers: { Authorization: 'Bearer ' + jeton }, body: fd, signal: ctl.signal }).then(function (r) {
    if (!r.ok || !r.body) throw new Error('voix ' + r.status);
    var rd = r.body.getReader(), dec = new TextDecoder(), buf = '';
    function pompe() {
      return rd.read().then(function (x) {
        if (x.done) {
          clearTimeout(delai);
          V.fluxFini = true; verifierFin(gen);
          return { texte: texte, fin: fin, mesures: { premier_pcm_ms: Math.round(premierPcm), premier_son_ms: V.premierSon ? Math.round(V.premierSon - t0) : 0, trous_entre_morceaux: V.trous, trous_ms: V.trouMs } };
        }
        buf += dec.decode(x.value, { stream: true });
        var i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          var bloc = buf.slice(0, i).replace(/^data:\s*/, ''); buf = buf.slice(i + 2);
          var j; try { j = JSON.parse(bloc); } catch (e) { continue; }
          if (gen !== V.gen) continue;
          if (j.entendu != null && h.entendu) h.entendu(j.entendu, j);
          if (j.t) { texte += j.t; if (h.texte) h.texte(texte); }
          if (j.pcm) { if (!premierPcm) premierPcm = performance.now() - t0; var b = pcmVersBuffer(j.pcm, j.rate); if (b) programmer(b, gen); if (h.parle) h.parle(); }
          if (j.audio_echec) { V.enAttente++; voixNavigateur(j.phrase, gen, function () { V.enAttente--; verifierFin(gen); }); }
          if (j.pc_demande && window.PCTom) PCTom.demandeVocale(j.pc_demande);
          if (j.gmail_brouillon && window.GmailCarte) GmailCarte.demandeVocale(j.gmail_brouillon);
          if (j.ordi_capture && h.capture) h.capture(j.ordi_capture);   /* capture d'écran de Laura pendant l'appel : montrée dans le fil, jamais lue */
          if (j.fin) fin = j;
          if (j.erreur) { var e = new Error(j.erreur); e.etape = j.etape; throw e; }
        }
        return pompe();
      });
    }
    return pompe();
  }).catch(function (e) { clearTimeout(delai); if (horsDelai) throw new Error('délai voix'); throw e; });
}

function transcrire(jeton, blob) {
  return fetch(PROXY + '/stt', { credentials: 'include',  method: 'POST', headers: { Authorization: 'Bearer ' + jeton, 'Content-Type': blob.type || 'audio/mp4' }, body: blob })
    .then(function (r) { return r.json().then(function (d) { if (!r.ok || typeof d.texte !== 'string') throw new Error('stt ' + r.status); return d.texte; }); });
}

window.LauraRapide = { PROXY: PROXY, transcrire: transcrire, discuter: discuter, cartes: cartes, specs: specs, ranger: ranger,
  voix: { niveau: niveau, sessionAppel: sessionAppel, contexte: ctxAudio, debloquer: debloquer, lecteur: lecteur, parler: parler, appel: appel, stop: stop, occupe: occupe, mesures: function () { return V; } } };
})();
