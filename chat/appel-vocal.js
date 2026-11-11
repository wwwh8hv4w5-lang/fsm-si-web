/* Appel vocal partagé FSM SI (build 20261111-83) — même moteur que l'appel de LAURA :
   micro ouvert tout l'appel, transcription en continu (stt-flux.js, relais /stt-flux vers xAI) avec repli sur l'enregistrement,
   fin de tour à 0,5 s de silence (« finalize »), réponse en voix PCM phrase par phrase (laura-rapide.js, /voix en SSE),
   coupure de la voix quand on parle par-dessus (barge-in), reprise propre au retour au premier plan (iPhone).
   Utilisé par FSM SI BOT (bot.fsmsibot.app) ; mêmes seuils et mêmes correctifs que chat/app.js (LAURA).
   AppelVocal.ouvrir({ nom, photo, meta(), surTour(tour), reglages(), textes:{} }) ; AppelVocal.fermer(). */
(function () {
'use strict';
var A = { on: false, etat: 'idle', muet: false, flux: null, src: null, an: null, data: null, freq: null, anV: null, dataV: null,
          mr: null, gum: false, gumEchecs: 0, coupeOS: false, tapReprise: false, appel: false, tour: 0, enCours: null,
          finParole: 0, fluxDernier: '', fluxReprise: '', bargeIn: false, speakAt: 0, niveau: 0, nivMic: 0, anim: 0, verrou: null, o: {}, journal: [] };
window.SI_APPEL = A;
function noter(x) { A.journal.push([Date.now(), x]); if (A.journal.length > 60) A.journal.shift(); }
function $(i) { return document.getElementById(i); }
var LR = function () { return window.LauraRapide && LauraRapide.voix; };
var T = { listen: 'Écoute…', wait: 'Réfléchit…', speak: 'Parle…', idle: 'Touche pour parler', muet: 'Micro coupé',
          toucher: 'Touche l’écran pour reprendre l’appel.', repris: 'Appel repris', micKo: 'Micro indisponible : touche pour réessayer.', micRefus: 'Micro refusé : touche pour réessayer.' };
function t(k) { return (A.o.textes && A.o.textes[k]) || T[k]; }

/* ---------- interface : la pastille d'appel de LAURA (avatar, vague réelle, pause/réglages, micro, raccrocher) ---------- */
var CSS = '#avScreen{position:fixed;inset:0;z-index:60;pointer-events:none;color:#fff}#avScreen[hidden]{display:none!important}' +
  '#avDock{position:absolute;left:20px;right:20px;top:calc(env(safe-area-inset-top,0px) + 52px);display:flex;flex-direction:column;align-items:center;pointer-events:auto}' +
  '#avPill{width:100%;height:60px;border-radius:30px;background:rgba(28,28,30,.78);border:1px solid rgba(255,255,255,.14);-webkit-backdrop-filter:blur(28px) saturate(180%);backdrop-filter:blur(28px) saturate(180%);box-shadow:0 8px 28px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.08);display:flex;align-items:center;gap:8px;padding:8px;box-sizing:border-box}' +
  '#avAv{width:44px;height:44px;border-radius:50%;overflow:hidden;flex:none;background:#2C2C2E}#avAv img{width:100%;height:100%;object-fit:cover;display:block}' +
  '#avWave{flex:1;min-width:0;height:44px;width:100%;display:block}' +
  '.av-btn{width:43px;height:43px;border-radius:50%;background:#2C2C2E;color:#fff;display:grid;place-items:center;flex:none;border:0;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
  '.av-btn svg{width:18px;height:18px}.av-btn.hang{background:#FF453A}.av-btn.hang svg{width:22px;height:22px}.av-btn.muted{background:#3A3A3C;color:#FF453A}.av-btn .hidden{display:none!important}' +
  '#avState{margin:10px 0 0;font:13px/1.3 -apple-system,system-ui,sans-serif;color:rgba(255,255,255,.72);text-align:center;min-height:17px}' +
  '#avCaption{margin:4px 0 0;font:14px/1.35 -apple-system,system-ui,sans-serif;color:#fff;text-align:center;max-width:100%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}';
var IC = {
  roue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.7.9 1.2 1.5 1.3H21a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="3.6" height="14" rx="1.2"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2"/></svg>',
  micOn: '<svg class="on" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v5a4 4 0 0 0 4 4zm7-4a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21a1 1 0 1 0 2 0v-3.08A7 7 0 0 0 19 11z"/></svg>',
  micOff: '<svg class="off hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l16 16"/><path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 0 0-6.3-3.3"/><path d="M8.1 8.1V11a3.9 3.9 0 0 0 5.4 3.6"/><path d="M5 11a7 7 0 0 0 11.5 5.4"/><path d="M19 11a6.7 6.7 0 0 1-.5 2.5"/><path d="M12 18.9V21"/></svg>',
  hang: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.07 13.4c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.93 4.99c.18.18.29.43.29.71 0 .28-.11.53-.29.7l-2.7 2.7c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.5-.56-.9V9.72C15.15 9.25 13.6 9 12 9z"/></svg>'
};
function interface_() {
  if ($('avScreen')) return;
  var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
  var d = document.createElement('section'); d.id = 'avScreen'; d.hidden = true;
  d.innerHTML = '<div id="avDock"><div id="avPill"><div id="avAv"><img alt=""></div><canvas id="avWave" width="280" height="56" aria-hidden="true"></canvas>' +
    '<button type="button" class="av-btn" id="avGear" aria-label="Réglages">' + IC.roue + '</button>' +
    '<button type="button" class="av-btn" id="avMute" aria-label="Couper le micro" aria-pressed="false">' + IC.micOn + IC.micOff + '</button>' +
    '<button type="button" class="av-btn hang" id="avHang" aria-label="Raccrocher">' + IC.hang + '</button></div>' +
    '<p id="avState" aria-live="polite"></p><p id="avCaption"></p></div>';
  document.body.appendChild(d);
  $('avHang').onclick = function (e) { e.stopPropagation(); fermer(); };
  $('avMute').onclick = function (e) { e.stopPropagation(); basculerMuet(); };
  $('avGear').onclick = function (e) { e.stopPropagation(); if (A.etat === 'speak') { interrompre(); return; } if (A.tapReprise) { toucher(); return; } if (A.o.reglages) A.o.reglages(); };
  $('avPill').onclick = function () { if (A.tapReprise || A.etat === 'idle') toucher(); };
}
function etatUI(etat, legende) {
  A.etat = etat;
  var g = $('avGear');
  if (g) { var p = etat === 'speak'; if (g._p !== p) { g._p = p; g.innerHTML = p ? IC.pause : IC.roue; g.setAttribute('aria-label', p ? 'Interrompre' : 'Réglages'); } }
  if ($('avState')) $('avState').textContent = A.muet && etat === 'listen' ? t('muet') : (t(etat) || '');
  if (legende != null && $('avCaption')) $('avCaption').textContent = legende;
}
function vague(niveau) {
  var cv = $('avWave'); if (!cv) return;
  var rect = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  var w = Math.max(2, Math.round((rect.width || 200) * dpr)), h = Math.max(2, Math.round((rect.height || 44) * dpr));
  if (cv.width !== w) cv.width = w; if (cv.height !== h) cv.height = h;
  var ctx = cv.getContext('2d'); ctx.clearRect(0, 0, w, h);
  var gap = 2 * dpr, bar = 4 * dpr, n = Math.max(10, Math.floor((w + gap) / (bar + gap))), tps = performance.now() / 1000;
  var nv = Math.max(0, Math.min(1, niveau || 0)); if (nv < 0.035) nv = 0;
  var freq = null;
  if (nv > 0 && A.etat !== 'speak' && A.an && A.freq) { try { A.an.getByteFrequencyData(A.freq); freq = A.freq; } catch (e) {} }
  for (var i = 0; i < n; i++) {
    var pos = i / Math.max(1, n - 1), forme = 0.6 + 0.4 * Math.sin(tps * 9 + i * 0.6);
    if (freq) { var idx = Math.min(freq.length - 1, Math.floor((0.04 + pos * 0.5) * freq.length)); forme = Math.max(0.25, Math.min(1, (freq[idx] - 90) / 120)); }
    var bh = nv ? Math.max(bar, bar + nv * forme * (h - bar - 2 * dpr)) : Math.max(2, 2 * dpr), bw = nv ? bar : bar + gap * 0.5;
    ctx.fillStyle = (A.o.couleur || '#FF2D8A'); ctx.globalAlpha = nv ? 1 : 0.55; ctx.beginPath();
    var x = i * (bar + gap) + (bar - bw) / 2, y = (h - bh) / 2;
    if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, Math.min(bw, bh) / 2); else ctx.rect(x, y, bw, bh);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function niveauMic() {
  var an = A.anV || A.an, data = A.anV ? A.dataV : A.data;
  if (!an || !data) return A.nivMic || 0;
  try { an.getByteTimeDomainData(data); var s = 0; for (var i = 0; i < data.length; i++) { var v = (data[i] - 128) / 128; s += v * v; } return Math.min(1, Math.sqrt(s / data.length) * 4.2); } catch (e) { return 0; }
}
function animer(on) {
  cancelAnimationFrame(A.anim);
  if (!on) { A.niveau = 0; vague(0); return; }
  (function frame() {
    if (!A.on) return;
    var cible = 0, V = LR();
    if (A.etat === 'speak' && V && V.niveau) cible = V.niveau();
    if (A.an && A.data && !A.muet) {
      A.nivMic = niveauMic();
      var pl = A.etat === 'speak' ? 0.22 : 0.08;
      cible = Math.max(cible, Math.max(0, (A.nivMic - pl) / (1 - pl)));
    }
    A.niveau += (cible - A.niveau) * (cible > A.niveau ? 0.45 : 0.2);
    vague(A.niveau);
    A.anim = requestAnimationFrame(frame);
  })();
}

/* ---------- minuteries fiables (Worker) : le navigateur ralentit setInterval quand l'appli est cachée ---------- */
var tw = null, tn = 0, tf = {};
function ticW() {
  if (tw !== null) return tw;
  try {
    tw = new Worker(URL.createObjectURL(new Blob(['var t={};onmessage=function(e){var d=e.data;if(d.c==="i")t[d.id]=setInterval(function(){postMessage(d.id)},d.ms);else{clearInterval(t[d.id]);delete t[d.id];}}'], { type: 'text/javascript' })));
    tw.onmessage = function (e) { var f = tf[e.data]; if (f) try { f(); } catch (x) {} };
  } catch (e) { tw = false; }
  return tw;
}
function tic(fn, ms) { var w = ticW(); if (!w) return setInterval(fn, ms); var id = 'w' + (++tn); tf[id] = fn; w.postMessage({ c: 'i', id: id, ms: ms }); return id; }
function stopTic(id) { if (typeof id === 'string') { delete tf[id]; if (tw) tw.postMessage({ c: 'x', id: id }); } else clearInterval(id); }

/* ---------- micro ---------- */
function couperMicro() {
  if (A.src) { try { A.src.disconnect(); } catch (e) {} A.src = null; }
  A.an = A.data = A.freq = A.anV = A.dataV = null;
  if (A.flux) { A.flux.getTracks().forEach(function (x) { x.stop(); }); A.flux = null; }
}
function stopRec(annuler) {
  var r = A.mr; if (!r) return;
  stopTic(r._int); r._annule = !!annuler; A.mr = null;
  try { r.stop(); } catch (e) {}
}
function micVivant() { return !!(A.flux && A.flux.getAudioTracks().some(function (x) { return x.readyState === 'live' && !x.muted; })); }
function surveiller(flux) {
  flux.getAudioTracks().forEach(function (x) {
    x.addEventListener('ended', function () { if (A.flux === flux) coupeOS('ended'); });
    x.addEventListener('mute', function () { if (A.flux === flux) coupeOS('mute'); });
    x.addEventListener('unmute', function () { if (A.flux === flux && !document.hidden) reprise('unmute'); });
  });
}
function typeRec() {
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
  var l = ['audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
  for (var i = 0; i < l.length; i++) if (MediaRecorder.isTypeSupported(l[i])) return l[i];
  return '';
}
/* Écoute : micro ouvert pour tout l'appel, enregistrement en secours, détection de parole toutes les 100 ms. */
function ecouter(pendantParole, propre) {
  if (!A.on || A.muet) return;
  if (!pendantParole && (A.etat === 'speak' || A.etat === 'wait')) return;
  if (A.mr || A.gum) return;
  if (!navigator.mediaDevices || !window.MediaRecorder) { etatUI('idle', t('micKo')); return; }
  var vivant = A.flux && A.flux.getAudioTracks().some(function (x) { return x.readyState === 'live' && x.enabled; });
  if (!vivant && document.hidden) { A.coupeOS = true; return; }   /* iOS : pas de micro en arrière-plan, on le rouvrira au retour */
  var obtenir = vivant ? Promise.resolve(A.flux) : navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  if (!vivant) A.gum = true;
  obtenir.then(function (flux) {
    A.gum = false; A.gumEchecs = 0; A.tapReprise = false;
    if (!A.on || A.muet || A.mr) { if (flux !== A.flux) flux.getTracks().forEach(function (x) { x.stop(); }); return; }
    var V = LR();
    if (flux !== A.flux) {
      couperMicro(); A.flux = flux; surveiller(flux);
      var ac = V.contexte();
      var src = ac.createMediaStreamSource(flux); A.src = src;
      if (window.SttFlux) { SttFlux.brancher(ac, src); SttFlux.ouvrir(A.o.jeton || 'cookie', (A.o.langue || 'fr').slice(0, 2), rappelsFlux()); }
      var an = ac.createAnalyser(); an.fftSize = 256; an.smoothingTimeConstant = 0.55; src.connect(an);
      var anV = ac.createAnalyser(); anV.fftSize = 2048; anV.smoothingTimeConstant = 0; src.connect(anV);
      A.an = an; A.data = new Uint8Array(an.fftSize); A.freq = new Uint8Array(an.frequencyBinCount); A.anV = anV; A.dataV = new Uint8Array(anV.fftSize);
    }
    var mime = typeRec(), morceaux = [], rec;
    try { rec = mime ? new MediaRecorder(flux, { mimeType: mime }) : new MediaRecorder(flux); } catch (e) { rec = new MediaRecorder(flux); }
    A.mr = rec; rec._propre = !!propre;
    rec.ondataavailable = function (e) { if (e.data && e.data.size) morceaux.push(e.data); };
    rec.onstop = function () {
      if (A.mr === rec) A.mr = null;
      stopTic(rec._int);
      if (rec._annule) return;
      if (!morceaux.length || rec._bruit) { if (A.on && !A.muet && A.etat !== 'wait') setTimeout(function () { ecouter(A.etat === 'speak'); }, 60); return; }
      var typ = rec.mimeType || mime || 'audio/mp4';
      direct(new Blob(morceaux, { type: typ }), typ);
    };
    try { rec.start(250); } catch (e) { A.mr = null; return; }
    if (!pendantParole) etatUI('listen', '');
    var parle = false, silencieux = 0, fort = 0, debut = Date.now(), debutParole = 0, haut = 0, fond = [], voixPendant = 0, etaitSpeak = false, repr = 0, envoi = false, attenteFlux = 0;
    var envoyerBloc = function (texte) {
      envoi = true; rec._propre = false;
      if (attenteFlux) { clearTimeout(attenteFlux); attenteFlux = 0; }
      if (!texte) A.fluxReprise = '';
      try { rec.requestData(); } catch (e) {}
      setTimeout(function () {
        envoi = false;
        if (A.mr !== rec || !A.on) return;
        var typ = rec.mimeType || mime || 'audio/mp4';
        parle = false; silencieux = 0; fort = 0;
        var blob = new Blob(morceaux.slice(), { type: typ });
        if (texte) direct(blob, typ, texte, 'flux'); else direct(blob, typ);
      }, texte ? 0 : 40);
    };
    var envoyerTour = function () {
      if (window.SttFlux && SttFlux.sain() && SttFlux.finir()) {
        if (attenteFlux) return;
        parle = false; silencieux = 0; fort = 0;
        attenteFlux = setTimeout(function () {
          attenteFlux = 0;
          if (A.mr !== rec || !A.on || envoi || A.etat !== 'listen') return;
          SttFlux.echec('pas de texte final en 0,9 s'); envoyerBloc('');
        }, 900);
        return;
      }
      envoyerBloc('');
    };
    rec._fluxFin = function (texte, info) {
      if (A.mr !== rec || envoi) return false;
      if (!texte) { if (attenteFlux && info && info.force) { SttFlux.echec('texte final vide'); envoyerBloc(''); } return false; }
      envoyerBloc(texte); return true;
    };
    rec._int = tic(function () {
      if (!A.on || A.mr !== rec) { stopTic(rec._int); return; }
      var niv = niveauMic(), sp = A.etat === 'speak';
      if (etaitSpeak && !sp && voixPendant >= 3 && !parle) { parle = true; fort = 3; silencieux = 0; debutParole = Date.now(); A.finParole = performance.now(); }
      if (!sp && etaitSpeak) voixPendant = 0;
      etaitSpeak = sp;
      if (sp) {
        fond.push(niv); if (fond.length > 30) fond.shift();
        var tri = fond.slice().sort(function (a, b) { return a - b; }), plancher = tri[Math.floor(tri.length / 2)] || 0;
        var seuil = Math.max(0.2, Math.min(0.6, plancher * 1.8 + 0.06));
        if (niv > seuil && fond.length >= 4) haut++; else haut = Math.max(0, haut - 1);
        if (niv > 0.18) voixPendant++;
        if (haut >= 3) {
          /* barge-in : on parle par-dessus la voix, elle s'arrête et l'écoute reprend sans perdre les premiers mots */
          haut = 0; parle = true; fort = 3; silencieux = 0; debutParole = Date.now(); A.finParole = performance.now(); fond = [];
          A.appel = false; A.bargeIn = true;
          sauverTour(A.enCours, true);
          LR().stop();
          etatUI('listen', '');
        }
        return;
      }
      if (envoi) return;
      if (A.etat === 'wait') {
        if (niv > 0.18) repr++; else repr = Math.max(0, repr - 1);
        if (repr >= 3) {
          repr = 0; A.tour++; A.appel = false; LR().stop();
          A.fluxReprise = A.fluxDernier || '';
          parle = true; fort = 3; silencieux = 0; A.finParole = performance.now();
          etatUI('listen', '');
        }
        return;
      }
      repr = 0;
      if (niv > (parle ? 0.10 : 0.18)) { if (!parle) debutParole = Date.now(); parle = true; silencieux = 0; if (niv > 0.18) fort++; A.finParole = performance.now(); }
      else if (parle) {
        silencieux++;
        if (silencieux >= (Date.now() - debutParole > 2500 ? 7 : 5)) { if (fort < 3) { parle = false; silencieux = 0; fort = 0; } else envoyerTour(); }
      }
      if (parle && Date.now() - debutParole > 30000) envoyerTour();
      if (!parle && Date.now() - debut > 20000) { rec._annule = true; stopTic(rec._int); try { rec.stop(); } catch (e) {} A.mr = null; ecouter(false); }
    }, 100);
  }, function (err) {
    /* échec d'ouverture du micro : on réessaie, puis un toucher le relance (jamais de bascule définitive) */
    A.gum = false; A.gumEchecs++;
    noter('micro : ' + (err && err.name));
    if (!A.on || A.muet) return;
    if (document.hidden) { A.gumEchecs = 0; A.coupeOS = true; return; }
    if (A.gumEchecs <= 2) { setTimeout(function () { if (A.on && !A.muet && !A.mr) ecouter(pendantParole || A.etat === 'speak', propre); }, 700); return; }
    A.tapReprise = true;
    var m = err && err.name === 'NotAllowedError' ? t('micRefus') : t('micKo');
    if (A.etat === 'speak' || A.etat === 'wait') { if ($('avCaption')) $('avCaption').textContent = m; } else etatUI('idle', m);
  }).catch(function (e) { A.gum = false; noter('écoute : ' + (e && e.message)); A.tapReprise = true; if (A.on && A.etat !== 'speak' && A.etat !== 'wait') etatUI('idle', t('micKo')); });
}
function rappelsFlux() {
  return {
    ferme: function () { return !A.on || A.muet || A.etat === 'speak'; },
    bargeIn: function () { var v = A.bargeIn; A.bargeIn = false; return v; },
    partiel: function () {},   /* jamais affiché : la parole de la personne n'est pas écrite à l'écran (statut seul, comme Grok Bot) */
    final: function (texte, info) {
      if (!A.on || A.muet || A.etat === 'speak' || A.etat === 'wait') return;   /* pendant la réflexion : seule la détection locale décide */
      var rec = A.mr; if (!rec || !rec._fluxFin) return;
      texte = String(texte || '').trim();
      if (!(info && info.force) && performance.now() - (A.finParole || 0) > 2500) return;
      var complet = texte && A.fluxReprise ? A.fluxReprise + ' ' + texte : texte;
      if (rec._fluxFin(complet, info) && texte) A.fluxReprise = '';
    }
  };
}

/* ---------- un tour : texte (ou audio en secours) → /voix → voix PCM ---------- */
function sauverTour(tt, coupe) {
  if (!tt || tt.sauve || !tt.tom) return;
  tt.sauve = true;
  var dit = tt.laura;
  if (coupe) { try { var V = LR().mesures(), c = V.ctx; if (c && V.debutCtx != null && V.fin > V.debutCtx) { var f = Math.max(0, Math.min(1, (c.currentTime - V.debutCtx) / (V.fin - V.debutCtx))); var n = Math.round(dit.length * f), cp = dit.slice(0, n), esp = cp.lastIndexOf(' '); dit = esp > 0 && n < dit.length ? cp.slice(0, esp) : cp; } } catch (e) {} }
  if (A.o.surTour) try { A.o.surTour({ tom: tt.tom, reponse: (dit || '').trim(), coupe: !!coupe, conv: tt.conv }); } catch (e) {}
}
function direct(blob, type, texteSeul, source) {
  var V = LR(); if (!V) return;
  if (texteSeul && window.FSMChat && typeof FSMChat.traiterAccord === 'function' && FSMChat.traiterAccord(texteSeul)) {
    etatUI('listen', '');
    return;
  }
  etatUI('wait', '');
  A.appel = true;
  var entendu = '', parlait = false;
  var tt = A.enCours = { tom: '', laura: '', sauve: false, audioFini: false, final: false };
  if (source === 'flux') A.fluxDernier = texteSeul;
  var tour = ++A.tour;
  var relancer = function () { if (!A.on) return; etatUI('listen', ''); if (A.mr && A.mr._propre) return; if (!A.muet) ecouter(); };
  var meta = Object.assign({}, A.o.meta ? A.o.meta() : {});
  if (texteSeul) { meta.texte = texteSeul; meta.stt = source === 'flux' ? 'flux' : 'texte'; }
  V.appel(A.o.jeton || 'cookie', texteSeul ? null : blob, meta, {
    entendu: function (x) { entendu = x; tt.tom = String(x || '').trim(); },   /* gardé pour l'historique, jamais affiché */
    capture: function (c) { if (A.o.surCapture) try { A.o.surCapture(c); } catch (e) {} },   /* capture de l'ordinateur pendant l'appel : montrée dans le fil, jamais lue */
    aide: function (x) { if (A.o.surAide) try { A.o.surAide(x); } catch (e) {} },
    coffre: function (x) { if (A.o.surCoffre) try { A.o.surCoffre(x); } catch (e) {} },   /* case sécurisée (FSM SI BOT), jamais lue */   /* carte « Prendre le contrôle » (FSM SI BOT), jamais lue */
    texte: function (x) { tt.laura = String(x || '').trim(); },   /* v71 : la réponse est dite, jamais écrite (ni sous-titre) */
    parle: function () {
      if (parlait || !A.appel || tour !== A.tour) return;
      parlait = true; A.speakAt = performance.now();
      etatUI('speak', '');
      stopRec(true); ecouter(true, true);   /* écoute neuve pendant que la voix parle (barge-in) */
    },
    surFinAudio: function () {
      if (!A.appel || tour !== A.tour) return;
      tt.audioFini = true; if (tt.final) sauverTour(tt, false);
      A.appel = false; relancer();
    }
  }).then(function (r) {
    if (tour !== A.tour) return;
    if (!parlait) stopRec(true);
    var fin = r.fin || {};
    if (fin.erreur || fin.code) { if ($('avCaption')) $('avCaption').textContent = fin.erreur || ''; }
    if (!entendu.trim() || fin.vide || !String(r.texte || '').trim()) { A.appel = false; relancer(); return; }
    tt.tom = entendu.trim(); tt.laura = r.texte.trim(); tt.final = true; tt.conv = fin.conv;
    if (tt.audioFini || !parlait) { sauverTour(tt, false); if (!parlait) { A.appel = false; relancer(); } }
  }).catch(function (e) {
    if (!A.on || tour !== A.tour) return;
    A.appel = false;
    if (e && e.name === 'AbortError') return;
    noter('tour : ' + (e && e.message));
    if (e && e.etape === 'stt') { etatUI('listen', e.message); if (!A.muet) ecouter(); return; }
    if (e && e.etape === 'quota') { etatUI('idle', e.message); return; }
    if (parlait) { sauverTour(tt, true); relancer(); return; }   /* flux coupé après le début de la voix : pas de rejeu */
    if (blob && !blob._reessai) { blob._reessai = true; setTimeout(function () { if (A.on) direct(blob, type); }, 600); return; }
    etatUI('listen', e && e.message ? e.message : ''); relancer();
  });
}
function interrompre() {
  if (!A.on) return;
  if (A.etat === 'speak' || A.appel) { sauverTour(A.enCours, true); A.appel = false; LR().stop(); etatUI('listen', ''); if (!A.muet) ecouter(); return; }
  if (A.etat === 'idle' || (A.etat === 'listen' && !A.mr)) { if (!A.muet) ecouter(); }
}
function basculerMuet() {
  if (!A.on) return;
  A.muet = !A.muet;
  var b = $('avMute'); b.classList.toggle('muted', A.muet); b.setAttribute('aria-pressed', A.muet ? 'true' : 'false');
  b.querySelector('.on').classList.toggle('hidden', A.muet); b.querySelector('.off').classList.toggle('hidden', !A.muet);
  if (A.muet) { stopRec(true); couperMicro(); if (A.etat === 'listen') etatUI('listen'); }
  else if (A.etat !== 'speak' && A.etat !== 'wait') ecouter();
}

/* ---------- arrière-plan et retour (iPhone) : mêmes règles que LAURA ---------- */
function garderEcran() {
  if (!A.on || document.hidden || A.verrou || !navigator.wakeLock) return;
  navigator.wakeLock.request('screen').then(function (v) { A.verrou = v; v.addEventListener('release', function () { if (A.verrou === v) A.verrou = null; }); }, function () {});
}
function sessionMedia(on) {
  var ms = navigator.mediaSession; if (!ms) return;
  try {
    if (on) { if (window.MediaMetadata) ms.metadata = new MediaMetadata({ title: 'Appel', artist: A.o.nom || 'FSM SI' }); ms.playbackState = 'playing';
      try { ms.setActionHandler('hangup', fermer); } catch (e) {} try { ms.setActionHandler('togglemicrophone', basculerMuet); } catch (e) {} }
    else { ms.playbackState = 'none'; ms.metadata = null; try { ms.setActionHandler('hangup', null); } catch (e) {} try { ms.setActionHandler('togglemicrophone', null); } catch (e) {} }
  } catch (e) {}
}
function coupeOS(quoi) {
  if (!A.on || A.muet) return;
  noter('coupe:' + quoi); A.coupeOS = true;
  if (!document.hidden) setTimeout(function () { if (A.coupeOS && !document.hidden) reprise('coupe-visible'); }, quoi === 'mute' ? 1500 : 200);
}
var enReprise = false, rejouer = '';
function reprise(pourquoi) {
  if (!A.on) return;
  noter('reprise:' + pourquoi);
  garderEcran();
  if (enReprise) { rejouer = pourquoi; return; }
  enReprise = true;
  var V = LR(), gen0 = V.mesures().generation;
  V.reveiller().then(function (ok) {
    if (!A.on || ok) return ok;
    try { V.mesures().ctx.close(); } catch (e) {}
    return V.reveiller();
  }).then(function (ok) {
    enReprise = false;
    if (!A.on) return;
    var neuf = V.mesures().generation !== gen0;
    if (!ok || neuf) {
      if (A.etat === 'speak' || A.appel) { sauverTour(A.enCours, A.etat === 'speak'); A.tour++; A.appel = false; V.stop(); etatUI('listen', ''); }
      if (neuf) A.coupeOS = true;
    }
    if (!ok) { A.tapReprise = true; stopRec(true); couperMicro(); etatUI('idle', t('toucher')); return; }
    if (!A.muet) {
      if (A.coupeOS || (A.flux && !micVivant())) { A.coupeOS = false; stopRec(true); couperMicro(); }
      if (A.mr && A.mr.state === 'paused') try { A.mr.resume(); } catch (e) {}
      if (A.etat === 'speak' || A.etat === 'wait') { if (!A.mr) ecouter(true, true); }
      else if (!A.mr) { etatUI('listen', ''); ecouter(); }
    }
    if (rejouer) { var r = rejouer; rejouer = ''; if (r === 'unmute' || r === 'coupe-visible') reprise(r); }
  });
}
function toucher() {
  /* un toucher = geste : iOS laisse démarrer le son et le micro */
  A.tapReprise = false; A.gumEchecs = 0;
  LR().debloquer();
  if (A.etat === 'idle') etatUI('listen', '');
  A.coupeOS = true;
  reprise('toucher');
}
/* iPhone : une appli de l'écran d'accueil perd le micro dès qu'elle passe en arrière-plan ou que l'écran se verrouille
   (WebKit arrête la capture, bug 236509) ; au retour, l'appel reprend tout seul et le dit dans la barre. */
document.addEventListener('visibilitychange', function () {
  if (!A.on) return;
  if (document.hidden) { A.cacheDepuis = Date.now(); noter('cache'); return; }
  var absent = A.cacheDepuis ? Date.now() - A.cacheDepuis : 0; A.cacheDepuis = 0;
  reprise('visible');
  if (absent > 3000 && $('avCaption') && !A.tapReprise) { $('avCaption').textContent = t('repris'); setTimeout(function () { if ($('avCaption') && $('avCaption').textContent === t('repris')) $('avCaption').textContent = ''; }, 3000); }
});
window.addEventListener('pageshow', function (e) { if (e.persisted) reprise('pageshow'); });
document.addEventListener('resume', function () { reprise('resume'); });

/* ---------- ouverture / fermeture ---------- */
function ouvrir(o) {
  var V = LR(); if (!V) throw new Error('moteur vocal absent');
  A.o = o || {};
  interface_();
  if (A.on) return;
  V.sessionAppel(true); V.debloquer();   /* dans le geste du toucher : iOS autorise le son */
  A.on = true; A.muet = false; A.appel = false; A.gumEchecs = 0; A.tapReprise = false; A.gum = false; A.coupeOS = false; A.fluxDernier = ''; A.fluxReprise = '';
  var img = $('avAv').querySelector('img'); if (A.o.photo) { img.src = A.o.photo; img.style.display = ''; } else img.style.display = 'none';
  img.alt = A.o.nom || '';
  var b = $('avMute'); b.classList.remove('muted'); b.querySelector('.on').classList.remove('hidden'); b.querySelector('.off').classList.add('hidden');
  $('avScreen').hidden = false;
  etatUI('listen', '');
  animer(true);
  ecouter();
  garderEcran(); sessionMedia(true); ticW();
}
function fermer() {
  if (!A.on) return;
  var e = A.enCours; if (e && !e.sauve && e.laura) sauverTour(e, !e.audioFini && A.etat === 'speak');
  A.on = false; A.appel = false; A.tour++;
  var V = LR(); if (V) { V.stop(); V.sessionAppel(false); }
  if (window.SttFlux) SttFlux.fermer();
  stopRec(true); couperMicro(); animer(false);
  if (A.verrou) { try { A.verrou.release(); } catch (x) {} A.verrou = null; }
  sessionMedia(false);
  A.etat = 'idle';
  if ($('avScreen')) $('avScreen').hidden = true;
  if ($('avCaption')) $('avCaption').textContent = '';
  if (A.o.surFin) try { A.o.surFin(); } catch (x) {}
}
window.AppelVocal = { ouvrir: ouvrir, fermer: fermer, actif: function () { return A.on; }, etat: function () { return { etat: A.etat, muet: A.muet, flux: window.SttFlux && SttFlux.etat(), journal: A.journal.slice(-10) }; } };
})();
