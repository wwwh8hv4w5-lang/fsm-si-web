/* Transcription en continu de l'appel vocal (xAI grok-voice-transcribe-2.0, par le relais WebSocket /stt-flux du proxy).
   Micro → PCM 16 bits 16 kHz mono, trames de 100 ms ; résultats intermédiaires affichés ; fin de tour = « finalize » envoyé
   par l'app à 0,5 s de silence (ou fin de parole détectée par xAI), et le texte final part tout de suite vers /voix.
   Si le WebSocket ne s'ouvre pas ou tombe, l'app garde l'ancien chemin (enregistrement + transcription d'un bloc). */
(function () {
  'use strict';
  var PROXY = window.SI_PROXY_FLUX || (window.LauraRapide && LauraRapide.PROXY) || ((location.hostname === 'laura.fsmsibot.app') ? location.origin : 'https://fsm-si-proxy.fsmdev66.workers.dev');
  var BASE = (document.currentScript && document.currentScript.src) || location.href;   /* worklet à côté de ce fichier (aussi depuis la page du BOT) */
  var TRAME = 1600;                 /* 100 ms à 16 kHz */
  var F = { ws: null, pret: false, ferme: true, echecs: 0, jeton: '', langue: 'fr', h: {}, ac: null, src: null, noeud: null, muet: null,
            pos: 0, prec: 0, tampon: new Int16Array(TRAME), n: 0, anneau: [], fermeAvant: false, finDemandee: 0, dernier: 0, journal: [] };
  function noter(m) { F.journal.push([Date.now(), m]); if (F.journal.length > 40) F.journal.shift(); }
  function ticket() {
    /* 8 s au plus : une requête gelée par iOS en arrière-plan ne doit pas bloquer la reconnexion pour toujours */
    var ctl = window.AbortController ? new AbortController() : null, lim = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
    return fetch(window.SI_FLUX_TICKET || (PROXY + '/stt-flux/ticket'), { method: 'POST', credentials: 'include', headers: { Authorization: 'Bearer ' + F.jeton }, signal: ctl ? ctl.signal : undefined })
      .finally(function () { clearTimeout(lim); })
      .then(function (r) { if (!r.ok) throw new Error('ticket ' + r.status); return r.json(); })
      .then(function (d) { if (!d.ticket) throw new Error('ticket vide'); return d.ticket; });
  }
  /* Reconnexion (build 52) : jamais d'essai pendant que l'appli est en arrière-plan (iPhone : réseau et minuteries gelés,
     chaque essai échouait en < 1 s et, au 4e, la transcription en continu était abandonnée pour TOUT le reste de l'appel).
     Après 4 échecs au premier plan : nouvel essai toutes les 15 s au lieu d'un abandon définitif. Au retour : session neuve. */
  function planifier() {
    clearTimeout(F.minuteur); F.minuteur = 0;
    if (F.ferme || document.hidden) return;
    F.minuteur = setTimeout(connecter, F.echecs >= 4 ? 15000 : Math.min(4000, 400 * F.echecs));
  }
  function connecter() {
    clearTimeout(F.minuteur); F.minuteur = 0;
    if (F.ferme || F.ws || F.connexion) return;
    if (document.hidden) { noter('en attente du retour au premier plan'); return; }
    if (F.echecs === 4) noter('4 échecs : nouvel essai toutes les 15 s, ancien chemin en attendant');
    F.connexion = true;
    ticket().then(function (t) {
      F.connexion = false;
      if (F.ferme || F.ws) return;
      var ws = new WebSocket(PROXY.replace(/^http/, 'ws') + '/stt-flux?t=' + encodeURIComponent(t) + '&langue=' + encodeURIComponent(F.langue));
      ws.binaryType = 'arraybuffer';
      F.ws = ws; F.pret = false;
      var ouvert = Date.now();
      ws.onmessage = function (e) {
        if (F.ws !== ws) return;
        var d; try { d = JSON.parse(e.data); } catch (x) { return; }
        F.dernier = Date.now();
        if (d.type === 'transcript.created') { F.pret = true; F.echecs = 0; noter('prêt en ' + (Date.now() - ouvert) + ' ms'); return; }
        if (d.type === 'transcript.partial') {
          if (!d.is_final && F.h.partiel) F.h.partiel(d.text || '');
          if (d.speech_final) {
            var force = !!F.finDemandee, ms = F.finDemandee ? Math.round(performance.now() - F.finDemandee) : null;
            F.finDemandee = 0;
            if (F.h.final) F.h.final(String(d.text || '').trim(), { force: force, finalize_ms: ms });
          }
          return;
        }
        if (d.type === 'error') noter('erreur xAI : ' + String(d.message || '').slice(0, 80));
      };
      ws.onclose = function (e) {
        noter('fermé ' + e.code);
        if (F.ws !== ws) return;   /* ancienne session remplacée au retour : rien à relancer */
        F.ws = null; F.pret = false;
        if (!F.ferme) { if (!document.hidden) F.echecs++; planifier(); }
      };
      ws.onerror = function () { noter('erreur WebSocket'); };
    }).catch(function (e) {
      F.connexion = false;
      noter(String(e && e.message || e));
      if (!F.ferme) { if (!document.hidden) F.echecs++; planifier(); }
    });
  }
  /* Retour au premier plan : la session d'avant (gelée par iOS, souvent à moitié morte sans évènement « close »)
     est remplacée par une neuve, compteur d'échecs remis à zéro. */
  function relancer(pourquoi) {
    if (F.ferme) return;
    noter('relance : ' + (pourquoi || ''));
    F.echecs = 0;
    var ancien = F.ws;
    if (ancien) { F.ws = null; F.pret = false; try { ancien.close(1000, 'retour au premier plan'); } catch (e) {} }
    connecter();
  }
  document.addEventListener('visibilitychange', function () {
    if (F.ferme) return;
    if (document.hidden) { F.cacheDepuis = Date.now(); clearTimeout(F.minuteur); F.minuteur = 0; return; }
    var absent = F.cacheDepuis ? Date.now() - F.cacheDepuis : 0; F.cacheDepuis = 0;
    if (absent > 2500 || !F.ws) relancer('retour après ' + Math.round(absent / 1000) + ' s');
  });
  function envoyer(trame) {
    if (F.pret && F.ws && F.ws.readyState === 1) { try { F.ws.send(trame.buffer); } catch (e) {} }
  }
  /* Rééchantillonnage linéaire vers 16 kHz ; pendant que Laura parle ou micro coupé : silence envoyé (la session reste vivante,
     l'écho de Laura n'est jamais transcrit), et les 400 dernières ms réelles sont envoyées seulement si Tom a coupé Laura (barge-in). */
  function bloc(f32) {
    var pas = (F.ac ? F.ac.sampleRate : 48000) / 16000;
    var ferme = !!(F.h.ferme && F.h.ferme());
    if (F.fermeAvant && !ferme && F.h.bargeIn && F.h.bargeIn()) { for (var k = 0; k < F.anneau.length; k++) envoyer(F.anneau[k]); }
    F.fermeAvant = ferme;
    if (ferme) F.anneau.length = Math.min(F.anneau.length, 4); else F.anneau.length = 0;
    for (; F.pos < f32.length; F.pos += pas) {
      var i = Math.floor(F.pos), fr = F.pos - i;
      var x0 = i === 0 ? F.prec : f32[i - 1], x1 = f32[i];   /* entre l'échantillon précédent et celui-ci (retard d'un échantillon) */
      var v = x0 + (x1 - x0) * fr;
      v = Math.max(-1, Math.min(1, v));
      F.tampon[F.n++] = v < 0 ? v * 32768 : v * 32767;
      if (F.n === TRAME) {
        var t = F.tampon; F.tampon = new Int16Array(TRAME); F.n = 0;
        if (ferme) { F.anneau.push(t); if (F.anneau.length > 4) F.anneau.shift(); envoyer(new Int16Array(TRAME)); }
        else envoyer(t);
      }
    }
    F.pos -= f32.length; F.prec = f32[f32.length - 1];
  }
  function brancher(ac, src) {
    if (!ac || !src || (F.src === src && F.noeud)) return;
    debrancher();
    F.ac = ac; F.src = src; F.pos = 0; F.n = 0;
    var muet = ac.createGain(); muet.gain.value = 0; muet.connect(ac.destination); F.muet = muet;
    var viaScript = function () {
      var sp = ac.createScriptProcessor(2048, 1, 1);
      sp.onaudioprocess = function (e) { bloc(e.inputBuffer.getChannelData(0)); };
      src.connect(sp); sp.connect(muet); F.noeud = sp; noter('capture ScriptProcessor');
    };
    if (ac.audioWorklet && window.AudioWorkletNode) {
      ac.audioWorklet.addModule(new URL('stt-flux-worklet.js?v=20261111-74', BASE).href).then(function () {
        if (F.src !== src) return;
        var n = new AudioWorkletNode(ac, 'stt-flux-pcm', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
        n.port.onmessage = function (e) { bloc(e.data); };
        src.connect(n); n.connect(muet); F.noeud = n; noter('capture AudioWorklet ' + ac.sampleRate + ' Hz');
      }).catch(function () { if (F.src === src && !F.noeud) viaScript(); });
    } else viaScript();
  }
  function debrancher() {
    try { if (F.noeud) { if (F.noeud.port) F.noeud.port.onmessage = null; F.noeud.disconnect(); } } catch (e) {}
    try { if (F.src && F.noeud) F.src.disconnect(F.noeud); } catch (e) {}
    try { if (F.muet) F.muet.disconnect(); } catch (e) {}
    F.noeud = null; F.src = null; F.muet = null;
  }
  window.SttFlux = {
    ouvrir: function (jeton, langue, h) {
      if (!window.WebSocket) return;
      F.jeton = jeton; F.langue = /^[a-z]{2}$/.test(langue || '') ? langue : 'fr'; F.h = h || {};
      if (!F.ferme && (F.ws || F.connexion || F.minuteur)) return;   /* déjà ouverte ou reconnexion prévue */
      F.ferme = false; F.echecs = 0; connecter();
    },
    brancher: brancher,
    relancer: relancer,
    /* fin de tour demandée par l'app : on pousse la fin de trame en cours puis « finalize » (texte final ≈ 0,1 s après) */
    finir: function () {
      if (!this.sain()) return false;
      if (F.n) { envoyer(F.tampon.slice(0, F.n)); F.tampon = new Int16Array(TRAME); F.n = 0; }
      F.finDemandee = performance.now();
      try { F.ws.send(JSON.stringify({ type: 'finalize' })); } catch (e) { return false; }
      return true;
    },
    sain: function () { return !!(F.pret && F.ws && F.ws.readyState === 1 && F.noeud); },
    echec: function (pourquoi) { noter('repli : ' + pourquoi); },
    fermer: function () {
      F.ferme = true; F.pret = false; clearTimeout(F.minuteur); F.minuteur = 0; F.connexion = false;
      if (F.ws) { try { F.ws.send(JSON.stringify({ type: 'audio.done' })); } catch (e) {} try { F.ws.close(1000, 'fin d’appel'); } catch (e) {} F.ws = null; }
      debrancher(); F.echecs = 0;
    },
    etat: function () { return { pret: F.pret, ouvert: !!F.ws, capture: !!F.noeud, echecs: F.echecs, journal: F.journal.slice(-10) }; },
    _bloc: bloc, _F: F
  };
})();
