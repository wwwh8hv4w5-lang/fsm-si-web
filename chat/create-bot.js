/* Créer un nouveau Bot — relevé image par image sur l’enregistrement Grok Bot de Tom (build 20261111-24). */
(function () {
  'use strict';
  var $ = function (i) { return document.getElementById(i); };
  var CLE = 'si_local_bots';
  var DEF_SHAPE = 4;
  var DEF_COLOR = '#FFFFFF';
  var sel = { shape: DEF_SHAPE, color: DEF_COLOR };
  /* LAURA (demande de Tom, 11/11) : l’écran « Créer un nouveau Bot » reste, mais le profil est verrouillé sur Laura :
     nom et photo fixes, non modifiables, aucun autre Bot ni portrait au choix. Le serveur n’accepte que ce profil sur l’hôte LAURA. */
  var VERROU = location.hostname !== 'bot.fsmsibot.app';
  var LAURA = { nom: 'Laura F.S.M · FSM SI', photo: './icons/laura.png' };
  function imgLaura(cls) { return '<img class="' + (cls || '') + ' laura-photo" src="' + LAURA.photo + '" alt="">'; }

  function hap() { try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {} }
  function lireBotsBruts() {
    try { return JSON.parse(localStorage.getItem(CLE) || '[]') || []; } catch (e) { return []; }
  }
  function lireBots() {
    var l = lireBotsBruts();
    if (VERROU) l.forEach(function (b) { b.name = LAURA.nom; b.laura = true; });
    return l;
  }
  function sauverBots(l) {
    /* garde-fou : sur LAURA, aucun Bot de plus que ceux déjà gardés (jamais de création) */
    if (VERROU && l.length > lireBotsBruts().length) return;
    try { localStorage.setItem(CLE, JSON.stringify(l)); } catch (e) {}
  }
  function estLocal(c) {
    c = (c == null && window.SI_conv) ? window.SI_conv() : c;
    return typeof c === 'string' && c.charAt(0) === 'L';
  }
  function botDe(id) {
    var l = lireBots(), i;
    for (i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  function bodyColor(c) {
    return (window.BOT_COLOR_BODY || function (x) { return x; })(c);
  }
  function svgPour(shape, color, cls, rotate) {
    if (VERROU) return imgLaura(cls);
    var sh = (window.BOT_SHAPES || [])[shape] || (window.BOT_SHAPES || [])[DEF_SHAPE] || { d: '' };
    var rot = rotate ? ' transform="rotate(' + rotate + ' 50 50)"' : '';
    return '<svg class="' + (cls || '') + '" viewBox="0 0 100 100" aria-hidden="true"><path fill="' + bodyColor(color) + '" fill-rule="evenodd"' + rot + ' d="' + sh.d + '"/></svg>';
  }
  function appliqueForme() {
    var path = $('botBlobPath');
    var svg = $('botBlob');
    var sh = (window.BOT_SHAPES || [])[sel.shape];
    if (!path || !sh) return;
    path.setAttribute('d', sh.d);
    path.setAttribute('fill', bodyColor(sel.color));
    if (svg) svg.setAttribute('data-shape', sh.id || String(sel.shape));
  }
  function peindreGrilles() {
    var sg = $('shapeGrid'), cg = $('colorGrid');
    if (!sg || !cg || !window.BOT_SHAPES) return;
    sg.textContent = '';
    cg.textContent = '';
    window.BOT_SHAPES.forEach(function (sh, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'shape-cell' + (i === sel.shape ? ' on' : '');
      b.setAttribute('aria-label', 'Forme ' + (i + 1));
      b.dataset.i = String(i);
      /* Le carré arrondi est légèrement tourné dans la grille Grok, droit en grand. */
      b.innerHTML = svgPour(i, sel.color, 'shape-svg', i === 2 ? 18 : 0);
      b.addEventListener('click', function () {
        sel.shape = i;
        Array.prototype.forEach.call(sg.children, function (x, j) { x.classList.toggle('on', j === i); });
        appliqueForme();
        hap();
      });
      sg.appendChild(b);
    });
    (window.BOT_COLORS || []).forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch' + (c.toUpperCase() === sel.color.toUpperCase() ? ' on' : '');
      b.style.setProperty('--c', c);
      b.setAttribute('aria-label', 'Couleur ' + c);
      b.addEventListener('click', function () {
        sel.color = c;
        Array.prototype.forEach.call(cg.children, function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        Array.prototype.forEach.call(sg.querySelectorAll('.shape-svg path'), function (p) {
          p.setAttribute('fill', bodyColor(c));
        });
        appliqueForme();
        hap();
      });
      cg.appendChild(b);
    });
  }
  function animerParticules() {
    var box = $('botPreview');
    if (!box) return;
    box.classList.remove('assembled', 'assembling');
    void box.offsetWidth;
    box.classList.add('assembling');
    window.setTimeout(function () {
      box.classList.add('assembled');
      box.classList.remove('assembling');
    }, 560);
  }
  function verrouiller() {
    var sheet = $('createSheet'), nom = $('botName'), prev = $('botPreview');
    if (sheet) sheet.classList.add('verrou-laura');
    if (nom) { nom.value = LAURA.nom; nom.readOnly = true; nom.tabIndex = -1; nom.setAttribute('aria-readonly', 'true'); }
    if (prev && !prev.querySelector('img.laura-photo')) prev.insertAdjacentHTML('beforeend', imgLaura('create-laura'));
    ['shapeGrid', 'colorGrid'].forEach(function (id) { var g = $(id); if (g) { g.textContent = ''; g.hidden = true; } });
    /* Bouton « Créer » sous la photo supprimé (demande de Tom, 11/11 22 h 02) ; retiré aussi d’une ancienne page en cache. */
    if ($('botCreate')) $('botCreate').remove();
    /* Mention sous le nom (demande de Tom, 11/11 22 h 10) ; créée aussi si la page en cache ne l’a pas encore. */
    var note = $('botNote');
    if (!note && nom) { note = document.createElement('p'); note.id = 'botNote'; note.className = 'create-note'; note.textContent = 'Laura FSM SI est un modèle custom - non modifiable'; nom.insertAdjacentElement('afterend', note); }
    if (note) note.hidden = false;
    /* profil donné par le serveur (seul permis sur l’hôte LAURA) */
    try {
      fetch('/profil', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (!d || !d.profil || !d.profil.nom) return;
        LAURA.nom = d.profil.nom;
        if (nom) nom.value = LAURA.nom;
      }).catch(function () {});
    } catch (e) {}
  }
  function ouvrir() {
    sel.shape = DEF_SHAPE;
    sel.color = DEF_COLOR;
    var nom = $('botName');
    if (VERROU) verrouiller();
    else {
      if (nom) { nom.value = ''; nom.tabIndex = 0; }
      if ($('botCreate')) $('botCreate').disabled = true;
      peindreGrilles();
      appliqueForme();
    }
    var back = $('createBackdrop'), sheet = $('createSheet');
    if (back) { back.classList.add('hide'); back.hidden = false; }
    if (sheet) {
      sheet.classList.remove('open', 'kb', 'drag');
      sheet.style.transform = '';
      sheet.hidden = false;
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (back) back.classList.remove('hide');
        if (sheet) sheet.classList.add('open');
        animerParticules();
      });
    });
  }
  function fermer() {
    var sheet = $('createSheet'), back = $('createBackdrop');
    if (sheet) { sheet.classList.remove('open', 'kb'); }
    if (back) back.classList.add('hide');
    if ($('botName')) { $('botName').blur(); $('botName').tabIndex = -1; }
    var wait = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ? 0 : 400;
    window.setTimeout(function () {
      if (sheet) sheet.hidden = true;
      if (back) { back.hidden = true; back.classList.remove('hide'); }
    }, wait);
  }
  /* LAURA (cause racine du doublon de Tom, 11/11 ~15:2x) : « Créer » poussait quand même un nouveau Bot local
     (si_local_bots, id « L… ») affiché en Laura = deuxième Laura à l’accueil. Sur LAURA, rien n’est jamais créé :
     la feuille se ferme et on retombe sur la Laura existante (sa conversation, son historique). */
  function allerLaura() {
    fermer();
    if (typeof window.ouvrirLaura === 'function') window.ouvrirLaura();
  }
  function creer() {
    if (VERROU) { allerLaura(); return; }
    var nom = ($('botName') && $('botName').value || '').trim();
    if (!nom) return;
    var id = 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var gre = 'Bonjour, je suis ' + nom + '. Comment puis-je t’aider ?';
    var bot = {
      id: id,
      name: nom,
      shape: sel.shape,
      color: sel.color,
      created: new Date().toISOString(),
      messages: [{ cle: 'g' + id, genre: 'tx', corps: gre, date: new Date().toISOString() }]
    };
    var l = lireBotsBruts();
    l.push(bot);
    sauverBots(l);
    fermer();
    peindreAccueil();
    if (typeof window.ouvrirBotLocal === 'function') window.ouvrirBotLocal(id);
  }
  function peindreAccueil() {
    var box = $('homeBots');
    if (!box) return;
    var l = lireBots();
    box.textContent = '';
    box.hidden = !l.length;
    l.forEach(function (b) {
      var bt = document.createElement('button');
      bt.type = 'button';
      bt.className = 'home-bot';
      bt.setAttribute('aria-label', 'Ouvrir ' + b.name);
      bt.innerHTML = svgPour(b.shape, b.color, 'home-bot-svg') + '<span class="nm">' + String(b.name).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }) + '</span>';
      bt.addEventListener('click', function () {
        if (typeof window.ouvrirBotLocal === 'function') window.ouvrirBotLocal(b.id);
      });
      box.appendChild(bt);
    });
  }
  function messagesDe(id) {
    var b = botDe(id);
    return b && b.messages ? b.messages : [];
  }
  function ajouterMsg(id, genre, corps) {
    var l = lireBotsBruts(), i, b;
    for (i = 0; i < l.length; i++) if (l[i].id === id) { b = l[i]; break; }
    if (!b) return null;
    var it = { cle: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), genre: genre, corps: corps, date: new Date().toISOString() };
    b.messages = b.messages || [];
    b.messages.push(it);
    sauverBots(l);
    return it;
  }
  function entete() {
    var av = $('chatAv'), nm = $('chatName');
    if (!av || !nm) return;
    var id = window.SI_conv ? window.SI_conv() : 0;
    var b = estLocal(id) ? botDe(id) : null;
    var img = av.querySelector('img');
    var old = av.querySelector('svg.bot-av');
    if (old) old.remove();
    if (b && VERROU) b = null;   /* LAURA : l’en-tête reste celui de Laura (photo et nom) */
    if (b) {
      av.insertAdjacentHTML('afterbegin', svgPour(b.shape, b.color, 'bot-av'));
      if (img) img.hidden = true;
      var dot = av.querySelector('.dot');
      if (dot) dot.hidden = true;
      nm.textContent = b.name;
    } else {
      if (img) img.hidden = false;
      var d2 = av.querySelector('.dot');
      if (d2) d2.hidden = false;
      nm.textContent = 'Laura F.S.M · FSM SI';
    }
  }
  function rafraichir() {
    var id = window.SI_conv ? window.SI_conv() : 0;
    if (!estLocal(id)) return Promise.resolve();
    var items = messagesDe(id).map(function (m) {
      return { cle: m.cle, genre: m.genre, corps: m.corps, date: m.date };
    });
    if (typeof window.majFilLocal === 'function') window.majFilLocal(items);
    return Promise.resolve();
  }
  function envoyer(texte) {
    var id = window.SI_conv ? window.SI_conv() : 0;
    if (!estLocal(id)) return Promise.resolve();
    texte = String(texte || '').trim();
    if (!texte) return Promise.resolve();
    ajouterMsg(id, 'moi', texte);
    if (typeof window.bulleLocale === 'function') { /* already drawn by envoyer caller? */ }
    rafraichir();
    var b = botDe(id);
    var hist = (b && b.messages || []).map(function (m) {
      return { role: m.genre === 'moi' ? 'user' : 'assistant', content: String(m.corps || '') };
    }).slice(-16);
    if (window.LauraRapide && window.S_JETON) {
      return LauraRapide.discuter(window.S_JETON, { messages: hist, mode: 'fsmsi' }, function () {}).then(function (r) {
        var txt = String((r && r.texte) || '').replace(/\[\[TACHE\]\]/g, '').trim();
        if (txt) ajouterMsg(id, 'tx', txt);
        return rafraichir();
      }).catch(function () { return rafraichir(); });
    }
    return Promise.resolve();
  }

  function syncClavier() {
    var sheet = $('createSheet');
    if (!sheet || sheet.hidden) return;
    var focus = document.activeElement === $('botName');
    var kb = 0;
    if (window.visualViewport) {
      kb = Math.max(0, (window.innerHeight || 0) - visualViewport.height - (visualViewport.offsetTop || 0));
    }
    /* resizes-content : innerHeight a déjà rétréci ; on se fie aussi au focus. */
    var serre = (window.innerHeight && window.innerHeight < 620) || kb > 80;
    sheet.classList.toggle('kb', !!(focus && serre) || (focus && kb > 40));
  }

  function brancher() {
    var btn = $('newBtn');
    if (btn) btn.addEventListener('click', ouvrir);
    if ($('createClose')) $('createClose').addEventListener('click', fermer);
    if ($('createBackdrop')) $('createBackdrop').addEventListener('click', fermer);
    if ($('botCreate')) $('botCreate').addEventListener('click', creer);
    if ($('botName')) {
      $('botName').addEventListener('input', function () {
        if (VERROU) { this.value = LAURA.nom; return; }
        if ($('botCreate')) $('botCreate').disabled = !this.value.trim();
      });
      $('botName').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
      });
      $('botName').addEventListener('focus', syncClavier);
      $('botName').addEventListener('blur', function () {
        window.setTimeout(syncClavier, 80);
      });
    }
    if (window.visualViewport) {
      visualViewport.addEventListener('resize', syncClavier);
      visualViewport.addEventListener('scroll', syncClavier);
    }
    window.addEventListener('resize', syncClavier);
    peindreAccueil();
  }

  window.CreateBot = {
    ouvrir: ouvrir,
    fermer: fermer,
    estLocal: estLocal,
    botDe: botDe,
    lireBots: lireBots,
    peindreAccueil: peindreAccueil,
    rafraichir: rafraichir,
    envoyer: envoyer,
    entete: entete,
    messagesDe: messagesDe,
    ajouterMsg: ajouterMsg,
    svgPour: svgPour,
    verrou: VERROU,
    LAURA: LAURA
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', brancher);
  else brancher();
})();
