/* Laura F.S.M · FSM SI — deux modes, un seul geste.
   « fsmsi » : Laura FSM SI (Claude d’abord, Grok en secours).  « grok » : Laura · Grok (Grok d’abord, Claude en secours).
   Même mémoire, même style, mêmes outils, même coffre : seul le cerveau change.
   Choix gardé par appareil (si_mode) et par conversation (si_mode_conv) ; il s’applique dès le message suivant.
   Seul indice permanent : en mode Grok, le point vert de la photo devient un petit point blanc. */
(function () {
  'use strict';
  var NOMS = { fsmsi: 'Laura FSM SI', grok: 'Laura · Grok' };
  function lire(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function ecrire(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function norm(m) { return m === 'grok' ? 'grok' : 'fsmsi'; }
  function parConv() { try { return JSON.parse(lire('si_mode_conv') || '{}') || {}; } catch (e) { return {}; } }
  function convCourante() { try { return window.SI_conv ? window.SI_conv() : 0; } catch (e) { return 0; } }
  function actif(conv) {
    conv = conv == null ? convCourante() : conv;
    var m = conv ? parConv()[conv] : '';
    return norm(m || lire('si_mode'));
  }
  function choisir(mode, conv) {
    mode = norm(mode);
    conv = conv == null ? convCourante() : conv;
    ecrire('si_mode', mode);
    if (conv) { var p = parConv(); p[conv] = mode; ecrire('si_mode_conv', JSON.stringify(p)); }
    maj(true);
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
    return mode;
  }
  /* indice discret : point de présence blanc en mode Grok, petit fondu au changement */
  function maj(anime) {
    var m = actif();
    var av = document.getElementById('chatAv');
    document.documentElement.setAttribute('data-laura-mode', m);
    if (av) {
      av.classList.toggle('mode-grok', m === 'grok');
      if (anime) { av.classList.remove('mode-flash'); void 0; requestAnimationFrame(function () { av.classList.add('mode-flash'); setTimeout(function () { av.classList.remove('mode-flash'); }, 600); }); }
    }
    var who = document.getElementById('chatWho');
    if (who) who.setAttribute('aria-label', 'Laura F.S.M · F.S.M AI, ' + NOMS[m]);
  }
  /* marqueur lu par le robot GitHub (même cerveau que la voie rapide) */
  function marquer(texte) {
    texte = String(texte || '');
    if (!texte || texte.charAt(0) === '/' || /<!--\s*fsm-mode:/.test(texte)) return texte;
    return texte + '\n\n<!-- fsm-mode: ' + actif() + ' -->';
  }
  /* qui a répondu : <!-- fsm-par: grok grok-4.20-non-reasoning --> (robot et voie rapide) */
  function parQui(corps) {
    var m = /<!--\s*fsm-par:\s*(grok|fsmsi)\s*([^\s>]*)\s*-->/.exec(String(corps || ''));
    if (!m) return null;
    return { mode: m[1], modele: (m[2] || '').replace(/^x-ai\//, '').replace(/^anthropic\//, ''), nom: NOMS[m[1]] };
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
  window.LauraMode = { actif: actif, choisir: choisir, maj: maj, marquer: marquer, parQui: parQui, infoBulle: infoBulle, NOMS: NOMS, libelleModele: libelleModele };
})();
