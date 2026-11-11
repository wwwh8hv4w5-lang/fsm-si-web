/* Laura F.S.M · FSM SI — un seul cerveau : Laura FSM SI (Claude d’abord, Grok en secours).
   Un ancien choix « grok » éventuellement gardé (si_mode / si_mode_conv) est basculé vers fsmsi. */
(function () {
  'use strict';
  var NOMS = { fsmsi: 'Laura FSM SI' };
  function lire(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function ecrire(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function norm(m) { return 'fsmsi'; }
  function parConv() { try { return JSON.parse(lire('si_mode_conv') || '{}') || {}; } catch (e) { return {}; } }
  function migrer() {
    var change = false;
    if (lire('si_mode') === 'grok') { ecrire('si_mode', 'fsmsi'); change = true; }
    var p = parConv(), n = false, k;
    for (k in p) if (Object.prototype.hasOwnProperty.call(p, k) && p[k] === 'grok') { p[k] = 'fsmsi'; n = true; }
    if (n) ecrire('si_mode_conv', JSON.stringify(p));
    return change || n;
  }
  function convCourante() { try { return window.SI_conv ? window.SI_conv() : 0; } catch (e) { return 0; } }
  function actif(conv) {
    migrer();
    return 'fsmsi';
  }
  function choisir(mode, conv) {
    mode = 'fsmsi';
    conv = conv == null ? convCourante() : conv;
    ecrire('si_mode', mode);
    if (conv) { var p = parConv(); p[conv] = mode; ecrire('si_mode_conv', JSON.stringify(p)); }
    maj(true);
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
    return mode;
  }
  function maj(anime) {
    var m = actif();
    var av = document.getElementById('chatAv');
    document.documentElement.setAttribute('data-laura-mode', m);
    if (av) {
      av.classList.remove('mode-grok');
      if (anime) { av.classList.remove('mode-flash'); void 0; requestAnimationFrame(function () { av.classList.add('mode-flash'); setTimeout(function () { av.classList.remove('mode-flash'); }, 600); }); }
    }
    var who = document.getElementById('chatWho');
    if (who) who.setAttribute('aria-label', 'Laura F.S.M · FSM SI, ' + NOMS.fsmsi);
  }
  /* marqueur lu par le robot GitHub (même cerveau que la voie rapide) */
  function marquer(texte) {
    texte = String(texte || '');
    if (!texte || texte.charAt(0) === '/' || /<!--\s*fsm-mode:/.test(texte)) return texte;
    return texte + '\n\n<!-- fsm-mode: fsmsi -->';
  }
  /* qui a répondu : <!-- fsm-par: fsmsi claude-sonnet-5.5 --> (robot et voie rapide) */
  function parQui(corps) {
    var m = /<!--\s*fsm-par:\s*(grok|fsmsi)\s*([^\s>]*)\s*-->/.exec(String(corps || ''));
    if (!m) return null;
    return { mode: 'fsmsi', modele: (m[2] || '').replace(/^x-ai\//, '').replace(/^anthropic\//, ''), nom: NOMS.fsmsi };
  }
  function libelleModele(mod) {
    if (!mod) return '';
    return mod.replace(/-non-reasoning$/, '').replace(/^grok-/, 'Grok ').replace(/^claude-/, 'Claude ').replace(/-(\d)/g, ' $1').replace(/(\d) (\d)/, '$1.$2');
  }
  function infoBulle(node, sheet) {
    sheet = sheet || document.getElementById('reactSheet');
    if (!sheet) return;
    var el = document.getElementById('reactPar');
    if (!el) { el = document.createElement('div'); el.id = 'reactPar'; el.className = 'react-par'; sheet.appendChild(el); }
    var q = node && node.dataset.qui === 'bot' ? parQui(node._corps) : null;
    el.textContent = q ? 'Répondu par ' + q.nom + (q.modele ? ' · ' + libelleModele(q.modele) : '') : '';
    el.hidden = !q;
  }
  migrer();
  window.LauraMode = { actif: actif, choisir: choisir, maj: maj, marquer: marquer, parQui: parQui, infoBulle: infoBulle, NOMS: NOMS, libelleModele: libelleModele };
})();
