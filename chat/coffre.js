/* Coffre-fort personnel — chiffré sur l’appareil (WebCrypto).
   Les valeurs ne sont jamais écrites en clair dans localStorage,
   les journaux, le cache du service worker, ni envoyées au robot. */
(function (global) {
  'use strict';

  var DB_NAME = 'fsm-si-coffre';
  var DB_VER = 1;
  var ITER = 310000;
  var LOCK_MS = 5 * 60 * 1000;
  var VERROU_OK = 'fsm-si-coffre-ok';

  var _db = null;
  var _key = null;
  var _entries = null;
  var _timer = 0;
  var _vue = 'vide';
  var _box = null;
  var _filtre = 'tout';
  var _recherche = '';
  var _editId = null;
  var _busy = false;

  var TYPES = [
    { id: 'identifiant', tab: 'identifiant', label: 'Identifiant', pluriel: 'Identifiants' },
    { id: 'carte', tab: 'carte', label: 'Carte', pluriel: 'Paiements' },
    { id: 'coordonnees', tab: 'coordonnees', label: 'Coordonnées', pluriel: 'Coordonnées' },
    { id: 'code', tab: 'code', label: 'Code', pluriel: 'Codes' },
    { id: 'note', tab: 'note', label: 'Note secrète', pluriel: 'Notes secrètes' }
  ];
  /* Onglets comme Grok Bot : Tout, Identifiants, Paiements, Coordonnées (codes et notes restent dans « Tout »). */
  var TABS = [{ id: 'tout', label: 'Tout' }].concat(TYPES.filter(function (t) { return /^(identifiant|carte|coordonnees)$/.test(t.id); }).map(function (t) {
    return { id: t.id, label: t.pluriel };
  }));

  function $(id) { return document.getElementById(id); }
  function el(n, c, t) {
    var e = document.createElement(n);
    if (c) e.className = c;
    if (t != null) e.textContent = t;
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function b64(buf) {
    var u = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
    var s = '';
    for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s);
  }
  function deB64(s) {
    var raw = atob(s);
    var u = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) u[i] = raw.charCodeAt(i);
    return u;
  }
  function uid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    var u = crypto.getRandomValues(new Uint8Array(16));
    u[6] = (u[6] & 0x0f) | 0x40; u[8] = (u[8] & 0x3f) | 0x80;
    var h = Array.from(u, function (x) { return x.toString(16).padStart(2, '0'); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  function ouvrirDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise(function (ok, ko) {
      var r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      r.onsuccess = function () { _db = r.result; ok(_db); };
      r.onerror = function () { ko(r.error || new Error('IndexedDB indisponible')); };
    });
  }
  function kvGet(k) {
    return ouvrirDB().then(function (db) {
      return new Promise(function (ok, ko) {
        var q = db.transaction('kv', 'readonly').objectStore('kv').get(k);
        q.onsuccess = function () { ok(q.result); };
        q.onerror = function () { ko(q.error); };
      });
    });
  }
  function kvSet(k, v) {
    return ouvrirDB().then(function (db) {
      return new Promise(function (ok, ko) {
        var q = db.transaction('kv', 'readwrite').objectStore('kv').put(v, k);
        q.onsuccess = function () { ok(); };
        q.onerror = function () { ko(q.error); };
      });
    });
  }

  function deriver(mdp, sel, iter) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(mdp), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: sel, iterations: iter || ITER, hash: 'SHA-256' },
        base,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    });
  }
  function chiffrer(key, obj) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var pt = new TextEncoder().encode(JSON.stringify(obj));
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, pt).then(function (ct) {
      return { iv: b64(iv), ct: b64(ct) };
    });
  }
  function dechiffrer(key, blob) {
    var iv = deB64(blob.iv);
    var ct = deB64(blob.ct);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct).then(function (pt) {
      return JSON.parse(new TextDecoder().decode(pt));
    });
  }

  function toucher() {
    if (!_key) return;
    clearTimeout(_timer);
    _timer = setTimeout(verrouiller, LOCK_MS);
  }
  function surActivite() { if (_key) toucher(); }
  function surFond() {
    if (document.hidden && _key) verrouiller();
  }

  function brancherGarde() {
    document.addEventListener('pointerdown', surActivite, { passive: true });
    document.addEventListener('keydown', surActivite);
    document.addEventListener('touchstart', surActivite, { passive: true });
    document.addEventListener('visibilitychange', surFond);
    window.addEventListener('pagehide', verrouiller);
    window.addEventListener('freeze', verrouiller);
  }
  var _garde = false;
  function assurerGarde() {
    if (_garde) return;
    _garde = true;
    brancherGarde();
  }

  function verrouiller() {
    clearTimeout(_timer);
    _timer = 0;
    _key = null;
    _entries = null;
    _editId = null;
    _vue = 'verrou';
    fermerMenu();
    if (_box && $('push') && !$('push').hidden && $('push').classList.contains('coffre-ecran')) {
      rendre();
    }
  }

  function enregistrer() {
    if (!_key || !_entries) return Promise.reject(new Error('Coffre verrouillé'));
    var payload = { v: 1, check: VERROU_OK, entries: _entries, updated: Date.now() };
    return chiffrer(_key, payload).then(function (blob) {
      blob.v = 1;
      return kvSet('blob', blob);
    });
  }

  function titreDe(e) {
    if (!e) return '';
    if (e.type === 'identifiant') return e.site || e.login || 'Identifiant';
    if (e.type === 'carte') return e.name || 'Carte';
    if (e.type === 'coordonnees') return e.name || e.email || 'Coordonnées';
    if (e.type === 'code') return e.label || 'Code';
    if (e.type === 'note') return (e.title || (e.body || '').split('\n')[0] || 'Note secrète').slice(0, 60);
    return e.title || 'Entrée';
  }
  function sousDe(e) {
    if (!e) return '';
    if (e.type === 'identifiant') return e.login || e.site || '';
    if (e.type === 'carte') {
      var n = String(e.number || '').replace(/\s+/g, '');
      var fin = n.length >= 4 ? n.slice(-4) : '';
      var exp = e.expiry || '';
      var parts = [];
      if (fin) parts.push('•••• ' + fin);
      if (exp) parts.push(exp);
      return parts.join('  ·  ');
    }
    if (e.type === 'coordonnees') return e.email || e.phone || '';
    if (e.type === 'code') return '';
    if (e.type === 'note') return '';
    return '';
  }
  function initiale(e) {
    var t = titreDe(e).trim();
    return t ? t.charAt(0).toUpperCase() : '•';
  }

  function svg(path, view) {
    return '<svg viewBox="' + (view || '0 0 24 24') + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>';
  }
  var ICO = {
    identifiant: svg('<circle cx="7.5" cy="12" r="3.4"/><path d="M11 12h9M16.5 12v3M19.5 12v2.2"/>'),
    carte: svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/>'),
    coordonnees: svg('<circle cx="12" cy="8" r="3.2"/><path d="M5 19c.8-3.2 3.4-5 7-5s6.2 1.8 7 5"/>'),
    code: svg('<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 17h6M17 14v6"/>'),
    note: svg('<path d="M7 3h8l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M15 3v6h6"/><path d="M9 13h6M9 17h4"/>'),
    lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    eyeOff: svg('<path d="M3 3l18 18"/><path d="M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2"/><path d="M17.9 17.9C16.2 19 14.2 19.7 12 19.7 5.5 19.7 2 12 2 12a18 18 0 0 1 5.1-5.4"/><path d="M9.9 5.1A11 11 0 0 1 12 4.3c6.5 0 10 7.7 10 7.7a18.5 18.5 0 0 1-4.2 5"/>'),
    copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4h12"/>')
  };

  function fermerMenu() {
    var m = $('coffreMenu');
    if (m) m.hidden = true;
    var dim = $('coffreMenuDim');
    if (dim) dim.hidden = true;
  }

  function viderExtra() {
    var ex = $('pushExtra');
    if (ex) ex.textContent = '';
    $('push') && $('push').classList.remove('coffre-ecran');
    fermerMenu();
  }

  function boutonsTete(ouverts) {
    var ex = $('pushExtra');
    if (!ex) return;
    ex.textContent = '';
    if (!ouverts) return;
    var lock = el('button', 'round-btn coffre-head-btn', '');
    lock.type = 'button';
    lock.id = 'coffreLockBtn';
    lock.setAttribute('aria-label', 'Verrouiller');
    lock.innerHTML = ICO.lock;
    lock.onclick = function (e) { e.preventDefault(); verrouiller(); };
    var plus = el('button', 'round-btn coffre-head-btn', '');
    plus.type = 'button';
    plus.id = 'coffrePlusBtn';
    plus.setAttribute('aria-label', 'Ajouter');
    plus.innerHTML = ICO.plus;
    plus.onclick = function (e) { e.preventDefault(); e.stopPropagation(); ouvrirMenu(plus); };
    ex.appendChild(lock);
    ex.appendChild(plus);
  }

  function assurerMenu() {
    if ($('coffreMenu')) return;
    var dim = el('div', 'coffre-menu-dim');
    dim.id = 'coffreMenuDim';
    dim.hidden = true;
    dim.onclick = fermerMenu;
    var m = el('div', 'coffre-menu');
    m.id = 'coffreMenu';
    m.hidden = true;
    m.setAttribute('role', 'menu');
    TYPES.forEach(function (t) {
      var b = el('button', 'coffre-menu-item', '');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.dataset.type = t.id;
      b.innerHTML = '<span class="cm-ico">' + ICO[t.id] + '</span><span>' + esc(t.label) + '</span>';
      b.onclick = function () { fermerMenu(); ouvrirFormulaire(t.id, null); };
      m.appendChild(b);
    });
    document.body.appendChild(dim);
    document.body.appendChild(m);
  }

  function ouvrirMenu(btn) {
    assurerMenu();
    var m = $('coffreMenu'), dim = $('coffreMenuDim');
    dim.hidden = false;
    m.hidden = false;
    var r = btn.getBoundingClientRect();
    var w = Math.max(220, m.offsetWidth || 220);
    var left = Math.min(window.innerWidth - w - 10, Math.max(10, r.right - w));
    var top = r.bottom + 8;
    m.style.left = left + 'px';
    m.style.top = top + 'px';
  }

  function msg(box, texte, cls) {
    box.appendChild(el('p', cls || 'invite', texte));
  }

  function champ(opts) {
    var wrap = el('label', 'cf-field');
    wrap.appendChild(el('span', 'cf-lab', opts.label));
    var row = el('div', 'cf-ctrl');
    var inp;
    if (opts.area) {
      inp = document.createElement('textarea');
      inp.rows = opts.rows || 4;
    } else {
      inp = document.createElement('input');
      inp.type = opts.type || 'text';
    }
    inp.className = 'cf-input';
    inp.autocomplete = 'off';
    inp.autocapitalize = 'off';
    inp.spellcheck = false;
    inp.dataset.lpignore = 'true';
    if (opts.name) inp.name = 'cf_' + opts.name;
    if (opts.placeholder) inp.placeholder = opts.placeholder;
    if (opts.value && !opts.secret) inp.value = opts.value;
    if (opts.secret) {
      inp.type = 'password';
      inp.value = opts.value || '';
    }
    row.appendChild(inp);
    if (opts.secret) {
      var eye = el('button', 'cf-ico-btn', '');
      eye.type = 'button';
      eye.setAttribute('aria-label', 'Afficher');
      eye.innerHTML = ICO.eye;
      var shown = false;
      eye.onclick = function () {
        shown = !shown;
        inp.type = shown ? 'text' : 'password';
        eye.innerHTML = shown ? ICO.eyeOff : ICO.eye;
        eye.setAttribute('aria-label', shown ? 'Masquer' : 'Afficher');
      };
      row.appendChild(eye);
    }
    if (opts.copy) {
      var cp = el('button', 'cf-ico-btn', '');
      cp.type = 'button';
      cp.setAttribute('aria-label', 'Copier');
      cp.innerHTML = ICO.copy;
      cp.onclick = function () {
        var v = inp.value || '';
        if (!v) return;
        (navigator.clipboard && navigator.clipboard.writeText(v) ? navigator.clipboard.writeText(v) : Promise.reject()).then(function () {
          if (global.alerte) global.alerte('Copié');
        }).catch(function () {
          inp.removeAttribute('type');
          inp.type = 'text';
          inp.select();
          try { document.execCommand('copy'); if (global.alerte) global.alerte('Copié'); } catch (e) {}
        });
      };
      row.appendChild(cp);
    }
    wrap.appendChild(row);
    wrap._input = inp;
    return wrap;
  }

  function rendreVerrou(premiere) {
    boutonsTete(false);
    _box.textContent = '';
    var card = el('div', 'cf-lock');
    card.appendChild(el('div', 'cf-lock-ico')).innerHTML = ICO.lock;
    if (premiere) {
      card.appendChild(el('h3', '', 'Créer un mot de passe maître'));
      card.appendChild(el('p', 'cf-warn', 'Ce mot de passe chiffre le coffre sur cet appareil. Il n’y a aucun moyen de le récupérer si vous l’oubliez. Laura ne voit jamais les valeurs.'));
      var a = champ({ label: 'Mot de passe (8 caractères min.)', secret: true, name: 'new1' });
      var b = champ({ label: 'Confirmer le mot de passe', secret: true, name: 'new2' });
      card.appendChild(a);
      card.appendChild(b);
      var err = el('p', 'cf-err', '');
      err.hidden = true;
      card.appendChild(err);
      var go = el('button', 'cf-btn primary', 'Créer le coffre');
      go.type = 'button';
      go.onclick = function () {
        var p1 = a._input.value, p2 = b._input.value;
        a._input.value = ''; b._input.value = '';
        if ((p1 || '').length < 8) { err.hidden = false; err.textContent = 'Le mot de passe doit contenir au moins 8 caractères.'; return; }
        if (p1 !== p2) { err.hidden = false; err.textContent = 'Les deux saisies ne correspondent pas.'; return; }
        creerMaitre(p1).then(function () { p1 = p2 = ''; rendre(); }).catch(function (e) {
          err.hidden = false; err.textContent = 'Impossible de créer le coffre.';
        });
      };
      card.appendChild(go);
      var imp = el('button', 'cf-btn ghost', 'Importer une sauvegarde chiffrée');
      imp.type = 'button';
      imp.onclick = function () { importer(true); };
      card.appendChild(imp);
    } else {
      card.appendChild(el('h3', '', 'Coffre verrouillé'));
      card.appendChild(el('p', 'cf-warn', 'Entrez le mot de passe maître. Il n’existe aucun moyen de récupération en cas d’oubli.'));
      var p = champ({ label: 'Mot de passe', secret: true, name: 'unlock' });
      card.appendChild(p);
      var err = el('p', 'cf-err', '');
      err.hidden = true;
      card.appendChild(err);
      var go = el('button', 'cf-btn primary', 'Déverrouiller');
      go.type = 'button';
      go.onclick = function () {
        var mdp = p._input.value;
        p._input.value = '';
        deverrouiller(mdp).then(function () { mdp = ''; rendre(); }).catch(function () {
          err.hidden = false; err.textContent = 'Mot de passe incorrect.';
        });
      };
      p._input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') go.click();
      });
      card.appendChild(go);
    }
    _box.appendChild(card);
  }

  function creerMaitre(mdp) {
    var sel = crypto.getRandomValues(new Uint8Array(16));
    return deriver(mdp, sel, ITER).then(function (key) {
      _key = key;
      _entries = [];
      var meta = { v: 1, kdf: 'PBKDF2', hash: 'SHA-256', iterations: ITER, salt: b64(sel) };
      return kvSet('meta', meta).then(function () { return enregistrer(); });
    }).then(function () {
      toucher();
      _vue = 'liste';
    });
  }

  function deverrouiller(mdp) {
    return kvGet('meta').then(function (meta) {
      if (!meta || !meta.salt) return Promise.reject(new Error('no meta'));
      return deriver(mdp, deB64(meta.salt), meta.iterations || ITER).then(function (key) {
        return kvGet('blob').then(function (blob) {
          if (!blob) {
            _key = key; _entries = []; toucher(); _vue = 'liste'; return;
          }
          return dechiffrer(key, blob).then(function (data) {
            if (!data || data.check !== VERROU_OK) return Promise.reject(new Error('bad'));
            _key = key;
            _entries = Array.isArray(data.entries) ? data.entries : [];
            toucher();
            _vue = 'liste';
          });
        });
      });
    });
  }

  function comptes() {
    var c = { tout: (_entries || []).length };
    TYPES.forEach(function (t) { c[t.id] = 0; });
    (_entries || []).forEach(function (e) { if (c[e.type] != null) c[e.type]++; });
    return c;
  }
  function filtrées() {
    var list = (_entries || []).slice().sort(function (a, b) {
      return String(titreDe(a)).localeCompare(String(titreDe(b)), 'fr');
    });
    if (_filtre && _filtre !== 'tout') list = list.filter(function (e) { return e.type === _filtre; });
    var q = (_recherche || '').trim().toLowerCase();
    if (q) {
      list = list.filter(function (e) {
        var blob = (titreDe(e) + ' ' + sousDe(e)).toLowerCase();
        return blob.indexOf(q) >= 0;
      });
    }
    return list;
  }

  function rendreListe() {
    _vue = 'liste';
    _editId = null;
    boutonsTete(true);
    _box.textContent = '';
    var root = el('div', 'coffre-root');
    var main = el('div', 'coffre-main');
    var tabs = el('div', 'coffre-tabs');
    tabs.setAttribute('role', 'tablist');
    var c = comptes();
    TABS.forEach(function (t) {
      var b = el('button', 'coffre-tab' + (_filtre === t.id ? ' on' : ''), '');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', _filtre === t.id ? 'true' : 'false');
      b.innerHTML = esc(t.label) + ' <span class="n">' + (c[t.id] || 0) + '</span>';
      b.onclick = function () { _filtre = t.id; rendreListe(); };
      tabs.appendChild(b);
    });
    main.appendChild(tabs);

    var list = filtrées();
    var card = el('div', 'group coffre-card');
    if (!list.length) {
      card.appendChild(el('p', 'cf-empty', (_entries || []).length ? 'Aucun résultat.' : 'Aucune entrée. Touchez + pour en ajouter.'));
    } else {
      list.forEach(function (e, i) {
        var r = el('button', 'row coffre-row', '');
        r.type = 'button';
        var ico = el('div', 'cf-av' + (e.type === 'coordonnees' ? ' rond' : ''));
        ico.innerHTML = ICO[e.type] || ('<span>' + esc(initiale(e)) + '</span>');
        r.appendChild(ico);
        var t = el('div', 'row-txt');
        t.innerHTML = '<div class="t">' + esc(titreDe(e)) + '</div>' +
          (sousDe(e) ? '<div class="s">' + esc(sousDe(e)) + '</div>' : '');
        r.appendChild(t);
        if (e.type === 'identifiant' || e.type === 'carte') {
          var g = el('span', 'cf-gerer', 'Gérer');
          g.setAttribute('role', 'button');
          r.appendChild(g);
        } else r.appendChild(el('span', 'chev', '›'));
        r.onclick = function () { ouvrirDetail(e.id); };
        card.appendChild(r);
      });
    }
    main.appendChild(card);
    if (_filtre === 'coordonnees') main.appendChild(el('p', 'cf-disclaimer', 'Vos coordonnées servent à remplir les formulaires pour vous. Elles restent chiffrées dans votre coffre.'));
    main.appendChild(el('p', 'cf-disclaimer', 'Chiffré sur cet appareil. Laura ne voit jamais les valeurs.'));
    var acts = el('div', 'cf-backup');
    var exp = el('button', 'cf-link', 'Exporter');
    exp.type = 'button';
    exp.onclick = exporter;
    var imp = el('button', 'cf-link', 'Importer une sauvegarde');
    imp.type = 'button';
    imp.onclick = function () { importer(false); };
    acts.appendChild(exp);
    acts.appendChild(imp);
    main.appendChild(acts);
    root.appendChild(main);

    var cherche = el('div', 'float-search');
    cherche.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
    var inp = document.createElement('input');
    inp.type = 'search';
    inp.placeholder = 'Rechercher dans le coffre-fort';
    inp.value = _recherche;
    inp.autocomplete = 'off';
    inp.addEventListener('input', function () { _recherche = inp.value; rendreListe(); var n = _box.querySelector('.float-search input'); if (n) { n.focus(); n.value = _recherche; try { n.setSelectionRange(_recherche.length, _recherche.length); } catch (e) {} } });
    cherche.appendChild(inp);
    root.appendChild(cherche);
    _box.appendChild(root);
  }

  function trouver(id) {
    return (_entries || []).filter(function (e) { return e.id === id; })[0];
  }

  function ouvrirDetail(id) {
    var e = trouver(id);
    if (!e) return rendreListe();
    _vue = 'detail';
    _editId = id;
    boutonsTete(true);
    _box.textContent = '';
    var head = el('div', 'cf-detail-head');
    var ico = el('div', 'cf-av lg' + (e.type === 'coordonnees' ? ' rond' : ''));
    ico.innerHTML = ICO[e.type] || ('<span>' + esc(initiale(e)) + '</span>');
    head.appendChild(ico);
    head.appendChild(el('h3', '', titreDe(e)));
    _box.appendChild(head);

    var card = el('div', 'group');
    champsPour(e, true).forEach(function (c) { card.appendChild(c); });
    _box.appendChild(card);

    var mod = el('button', 'cf-btn primary', 'Modifier');
    mod.type = 'button';
    mod.onclick = function () { ouvrirFormulaire(e.type, e.id); };
    _box.appendChild(mod);
    var del = el('button', 'cf-btn danger', 'Supprimer');
    del.type = 'button';
    del.onclick = function () { confirmerSuppr(e.id); };
    _box.appendChild(del);
  }

  function champsPour(e, lecture) {
    var out = [];
    function add(name, label, secret, area) {
      var v = e[name] || '';
      if (lecture && !v && !secret) return;
      out.push(champ({
        label: label,
        name: name,
        value: v,
        secret: !!secret,
        area: !!area,
        copy: !!lecture
      }));
    }
    if (e.type === 'identifiant') {
      add('site', 'Site');
      add('login', 'Identifiant');
      add('password', 'Mot de passe', true);
      add('notes', 'Notes', false, true);
    } else if (e.type === 'carte') {
      add('name', 'Nom');
      add('number', 'Numéro', true);
      add('expiry', 'Expiration');
      add('cvc', 'CVC', true);
    } else if (e.type === 'coordonnees') {
      add('name', 'Nom');
      add('email', 'E-mail');
      add('phone', 'Téléphone');
      add('address', 'Adresse', false, true);
    } else if (e.type === 'code') {
      add('label', 'Libellé');
      add('value', 'Valeur', true);
    } else if (e.type === 'note') {
      add('title', 'Titre');
      add('body', 'Note', true, true);
    }
    return out;
  }

  function ouvrirFormulaire(type, id) {
    var e = id ? (trouver(id) || { id: id, type: type }) : { type: type };
    _vue = 'form';
    _editId = id || null;
    boutonsTete(true);
    _box.textContent = '';
    var typ = TYPES.filter(function (t) { return t.id === type; })[0];
    _box.appendChild(el('h3', 'cf-form-title', id ? 'Modifier' : (typ ? typ.label : 'Nouvelle entrée')));
    var card = el('div', 'group cf-form');
    var champs = champsPour(e, false);
    champs.forEach(function (c) { card.appendChild(c); });
    _box.appendChild(card);
    var err = el('p', 'cf-err', '');
    err.hidden = true;
    _box.appendChild(err);
    var save = el('button', 'cf-btn primary', 'Enregistrer');
    save.type = 'button';
    save.onclick = function () {
      if (_busy) return;
      var data = { type: type };
      card.querySelectorAll('.cf-field').forEach(function (f) {
        var inp = f._input || f.querySelector('.cf-input');
        if (!inp || !inp.name) return;
        data[inp.name.replace(/^cf_/, '')] = inp.value;
        inp.value = '';
      });
      if (type === 'identifiant' && !(data.site || data.login)) {
        err.hidden = false; err.textContent = 'Indiquez au moins un site ou un identifiant.'; return;
      }
      if (type === 'carte' && !(data.name || data.number)) {
        err.hidden = false; err.textContent = 'Indiquez au moins un nom ou un numéro.'; return;
      }
      if (type === 'coordonnees' && !(data.name || data.email)) {
        err.hidden = false; err.textContent = 'Indiquez au moins un nom ou un e-mail.'; return;
      }
      if (type === 'code' && !data.label) {
        err.hidden = false; err.textContent = 'Indiquez un libellé.'; return;
      }
      if (type === 'note' && !(data.title || data.body)) {
        err.hidden = false; err.textContent = 'La note est vide.'; return;
      }
      _busy = true;
      sauverEntree(id, data).then(function (ne) {
        _busy = false;
        ouvrirDetail(ne.id);
      }).catch(function () {
        _busy = false;
        err.hidden = false; err.textContent = 'Enregistrement impossible.';
      });
    };
    _box.appendChild(save);
    var ann = el('button', 'cf-btn ghost', 'Annuler');
    ann.type = 'button';
    ann.onclick = function () { if (id) ouvrirDetail(id); else rendreListe(); };
    _box.appendChild(ann);
  }

  function sauverEntree(id, data) {
    if (!_entries) _entries = [];
    var now = Date.now();
    var e;
    if (id) {
      e = trouver(id);
      if (!e) { e = { id: id, type: data.type, created: now }; _entries.push(e); }
    } else {
      e = { id: uid(), type: data.type, created: now };
      _entries.push(e);
    }
    Object.keys(data).forEach(function (k) { e[k] = data[k]; });
    e.updated = now;
    return enregistrer().then(function () { toucher(); return e; });
  }

  function confirmerSuppr(id) {
    var go = function () {
      _entries = (_entries || []).filter(function (x) { return x.id !== id; });
      enregistrer().then(function () { rendreListe(); }).catch(function () { rendreListe(); });
    };
    if (typeof global.iosAlerte === 'function') {
      global.iosAlerte('Supprimer cette entrée ?', 'Cette action est définitive.', go);
    } else if (confirm('Supprimer cette entrée ?')) go();
  }

  function exporter() {
    return kvGet('meta').then(function (meta) {
      return kvGet('blob').then(function (blob) {
        if (!meta || !blob) throw new Error('vide');
        var pack = {
          v: 1,
          app: 'fsm-si-coffre',
          kdf: meta.kdf,
          hash: meta.hash,
          iterations: meta.iterations,
          salt: meta.salt,
          iv: blob.iv,
          ct: blob.ct
        };
        var blobF = new Blob([JSON.stringify(pack)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blobF);
        a.download = 'coffre-fsm-si.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      });
    }).catch(function () {
      if (global.alerte) global.alerte('Rien à exporter.');
    });
  }

  function importer(premiere) {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json,.json';
    inp.hidden = true;
    document.body.appendChild(inp);
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var pack;
        try { pack = JSON.parse(String(reader.result || '')); } catch (err) { pack = null; }
        reader.result = null;
        if (!pack || !pack.salt || !pack.iv || !pack.ct) {
          if (global.alerte) global.alerte('Fichier de sauvegarde invalide.');
          return;
        }
        demanderMdpImport(pack, premiere);
      };
      reader.readAsText(f);
    };
    inp.click();
  }

  function demanderMdpImport(pack, premiere) {
    _vue = 'import';
    boutonsTete(!!_key);
    _box.textContent = '';
    var card = el('div', 'cf-lock');
    card.appendChild(el('h3', '', 'Importer la sauvegarde'));
    card.appendChild(el('p', 'cf-warn', 'Entrez le mot de passe maître avec lequel ce fichier a été chiffré.'));
    var p = champ({ label: 'Mot de passe du fichier', secret: true, name: 'imp' });
    card.appendChild(p);
    var err = el('p', 'cf-err', '');
    err.hidden = true;
    card.appendChild(err);
    var go = el('button', 'cf-btn primary', 'Importer');
    go.type = 'button';
    go.onclick = function () {
      var mdp = p._input.value;
      p._input.value = '';
      var sel = deB64(pack.salt);
      deriver(mdp, sel, pack.iterations || ITER).then(function (keyF) {
        return dechiffrer(keyF, { iv: pack.iv, ct: pack.ct }).then(function (data) {
          if (!data || data.check !== VERROU_OK) throw new Error('bad');
          var entries = Array.isArray(data.entries) ? data.entries : [];
          if (_key) {
            _entries = entries;
            return enregistrer();
          }
          _key = keyF;
          _entries = entries;
          var meta = { v: 1, kdf: 'PBKDF2', hash: 'SHA-256', iterations: pack.iterations || ITER, salt: pack.salt };
          return kvSet('meta', meta).then(function () {
            return kvSet('blob', { v: 1, iv: pack.iv, ct: pack.ct });
          });
        });
      }).then(function () {
        mdp = '';
        toucher();
        _vue = 'liste';
        rendreListe();
      }).catch(function () {
        err.hidden = false; err.textContent = 'Mot de passe incorrect ou fichier illisible.';
      });
    };
    card.appendChild(go);
    var ann = el('button', 'cf-btn ghost', 'Annuler');
    ann.type = 'button';
    ann.onclick = function () { _vue = _key ? 'liste' : (premiere ? 'setup' : 'verrou'); rendre(); };
    card.appendChild(ann);
    _box.appendChild(card);
  }

  function rendre() {
    if (!_box) return;
    if (!_key) {
      kvGet('meta').then(function (meta) {
        if (!_box) return;
        if (meta && meta.salt) rendreVerrou(false);
        else rendreVerrou(true);
      }).catch(function () { rendreVerrou(true); });
      return;
    }
    if (_vue === 'detail' && _editId) ouvrirDetail(_editId);
    else if (_vue === 'form') rendreListe();
    else rendreListe();
  }

  function retour() {
    if (!$('push') || $('push').hidden || !$('push').classList.contains('coffre-ecran')) return false;
    if (_key && (_vue === 'detail' || _vue === 'form' || _vue === 'import')) {
      rendreListe();
      return true;
    }
    return false;
  }

  function ouvrir(box) {
    _box = box;
    assurerGarde();
    assurerMenu();
    $('push') && $('push').classList.add('coffre-ecran');
    _filtre = 'tout';
    _recherche = '';
    _editId = null;
    if (_key) { toucher(); _vue = 'liste'; rendreListe(); }
    else { _vue = 'verrou'; rendre(); }
  }

  function surFermeture() {
    fermerMenu();
    viderExtra();
    _box = null;
    /* la clé reste en mémoire jusqu’au verrouillage automatique */
  }

  var Coffre = {
    ouvrir: ouvrir,
    retour: retour,
    verrouiller: verrouiller,
    surFermeture: surFermeture,
    estOuvert: function () { return !!_key; },
    compter: function () { return (_entries || []).length; }
  };
  global.Coffre = Coffre;
})(window);
