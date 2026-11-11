/* Laura F.S.M — voie rapide (Worker fsm-si-proxy toujours allumé) + cases sécurisées du coffre.
   Les valeurs saisies dans une case sécurisée partent directement au coffre chiffré :
   jamais dans le fil, jamais dans GitHub, jamais montrées au modèle. */
(function () {
'use strict';
var PROXY = 'https://fsm-si-proxy.fsmdev66.workers.dev';

function discuter(jeton, corps, surTexte) {
  var t0 = performance.now(), premier = 0;
  var ctl = new AbortController();
  var minuteur = setTimeout(function () { ctl.abort(); }, 12000); /* aucun mot en 12 s : on laisse le robot répondre */
  return fetch(PROXY + '/chat', {
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
var CSS = '.si-bloc{width:min(100%,420px);margin:2px 0 0;align-self:flex-start;font:15px/1.38 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;-webkit-touch-callout:default}' +
  '.msg.si-avec-carte{max-width:100%;width:100%}.msg.si-avec-carte>.bubble{max-width:86%}' +
  '.si-carte{box-sizing:border-box;width:100%;background:#1E1E20;border:1px solid rgba(255,255,255,.10);border-radius:20px;padding:14px 16px 16px;color:#fff}' +
  '.si-tete{display:flex;align-items:center;gap:7px;color:#9A9AA0;font-size:13px;font-weight:500;margin:0 0 12px}' +
  '.si-tete svg{width:15px;height:15px;flex:none}' +
  '.si-carte h5{margin:0 0 3px;font-size:17px;line-height:1.3;font-weight:700;color:#fff}' +
  '.si-carte p.si-desc{margin:0 0 14px;color:#9A9AA0;font-size:15px;line-height:1.38}' +
  '.si-champ{position:relative;margin:0 0 10px}' +
  '.si-champ input{display:block;width:100%;box-sizing:border-box;height:46px;background:#121213;border:1px solid rgba(255,255,255,.10);border-radius:12px;color:#fff;padding:0 46px 0 14px;font-size:16px;outline:none;-webkit-appearance:none;appearance:none;-webkit-user-select:text;user-select:text;font-family:inherit}' +
  '.si-champ input::placeholder{color:#6E6E73}.si-champ input:focus{border-color:rgba(255,255,255,.24)}' +
  '.si-champ input[readonly]{color:#9A9AA0}' +
  '.si-oeil{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:38px;height:38px;border:0;background:none;color:#8E8E93;display:grid;place-items:center;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
  '.si-oeil svg{width:19px;height:19px}' +
  '.si-pied{display:flex;justify-content:flex-end;margin-top:4px}' +
  '.si-btn{border:0;border-radius:999px;background:#fff;color:#000;font-family:inherit;font-weight:600;font-size:15px;line-height:1;padding:11px 18px;min-height:38px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .15s,color .15s}' +
  '.si-btn:disabled{background:#2C2C2E;color:#6E6E73;cursor:default}' +
  '.si-btn.si-fait{background:#2C2C2E;color:#C7C7CC}.si-btn svg{width:15px;height:15px}' +
  '.si-err{color:#FF453A;font-size:13px;margin:8px 0 0}' +
  '.si-note{display:flex;align-items:center;gap:6px;color:#8E8E93;font-size:12.5px;margin:8px 2px 0}' +
  '.si-note svg{width:13px;height:13px;flex:none}';
var IC = {
  cle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M16 7l3 3M18.5 4.5l2 2"/></svg>',
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
  return fetch(PROXY + '/coffre/' + encodeURIComponent(nom), {
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
  var tete = e('div', 'si-tete'); tete.appendChild(ico(estSecret || aSecret ? 'cle' : 'form'));
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

window.LauraRapide = { PROXY: PROXY, discuter: discuter, cartes: cartes, specs: specs, ranger: ranger };
})();
