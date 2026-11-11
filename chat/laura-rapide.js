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

/* ---------- Cases sécurisées ---------- */
var CSS = '.si-carte{margin:8px 0 2px;background:#1C1C1E;border-radius:16px;padding:14px 14px 12px;color:#fff;max-width:340px;font:15px/1.35 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif}' +
  '.si-carte h5{margin:0 0 4px;font-size:15px;font-weight:600}.si-carte p{margin:0 0 10px;color:#8E8E93;font-size:13px}' +
  '.si-carte label{display:block;color:#8E8E93;font-size:12px;margin:8px 0 4px}' +
  '.si-carte input{width:100%;box-sizing:border-box;background:#2C2C2E;border:0;border-radius:10px;color:#fff;padding:11px 12px;font-size:16px;outline:none;-webkit-appearance:none}' +
  '.si-carte button{margin-top:12px;width:100%;border:0;border-radius:12px;background:#F25C05;color:#fff;font-weight:600;font-size:16px;padding:11px}' +
  '.si-carte button:disabled{opacity:.5}.si-carte .ok{color:#8E8E93;font-size:14px}.si-carte .err{color:#FF453A;font-size:13px;margin-top:8px}';
function style() {
  if (document.getElementById('si-carte-css')) return;
  var s = document.createElement('style'); s.id = 'si-carte-css'; s.textContent = CSS; document.head.appendChild(s);
}
function lireFaits() { try { return JSON.parse(localStorage.getItem('si_cartes_faites') || '{}'); } catch (e) { return {}; } }
function noterFait(k) { var f = lireFaits(); f[k] = Date.now(); try { localStorage.setItem('si_cartes_faites', JSON.stringify(f)); } catch (e) {} }
function e(nom, cls, txt) { var x = document.createElement(nom); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; }

function ranger(jeton, nom, valeur, libelle, description) {
  return fetch(PROXY + '/coffre/' + encodeURIComponent(nom), {
    method: 'PUT', headers: { Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' },
    body: JSON.stringify({ valeur: valeur, libelle: libelle, description: description })
  }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d && d.erreur || 'coffre ' + r.status); return d; }); });
}

/* spec : { type:'secret', nom, libelle, description } ou { type:'formulaire', titre, description, champs:[{nom, libelle, secret}] } */
function carte(spec, o) {
  style();
  var cleFaite = o.cle + ':' + (spec.nom || spec.titre || '');
  var c = e('div', 'si-carte');
  ['click', 'touchstart', 'touchend', 'mousedown', 'contextmenu'].forEach(function (t) { c.addEventListener(t, function (ev) { ev.stopPropagation(); }); });
  var champs = spec.type === 'secret' ? [{ nom: spec.nom, libelle: spec.libelle || spec.nom, secret: true }] : (spec.champs || []);
  c.appendChild(e('h5', '', spec.type === 'secret' ? (spec.libelle || spec.nom) : (spec.titre || 'Formulaire')));
  if (spec.description) c.appendChild(e('p', '', spec.description));
  if (lireFaits()[cleFaite]) { c.appendChild(e('div', 'ok', '🔒 Enregistré')); return c; }
  var ins = champs.map(function (ch) {
    if (spec.type !== 'secret') c.appendChild(e('label', '', ch.libelle || ch.nom));
    var i = document.createElement('input');
    i.type = ch.secret ? 'password' : 'text';
    i.autocomplete = ch.secret ? 'new-password' : 'off'; i.setAttribute('autocapitalize', 'off'); i.spellcheck = false;
    i.placeholder = ch.secret ? '••••••••' : '';
    c.appendChild(i); return { ch: ch, i: i };
  });
  var b = e('button', '', 'Enregistrer'); b.type = 'button'; c.appendChild(b);
  var err = e('div', 'err'); err.hidden = true; c.appendChild(err);
  b.onclick = function () {
    var vides = ins.filter(function (x) { return !x.i.value.trim(); });
    if (vides.length) { err.textContent = 'Il manque un champ.'; err.hidden = false; return; }
    b.disabled = true; err.hidden = true;
    var secrets = ins.filter(function (x) { return x.ch.secret; });
    var textes = ins.filter(function (x) { return !x.ch.secret; });
    Promise.all(secrets.map(function (x) {
      return ranger(o.jeton, x.ch.nom, x.i.value.trim(), x.ch.libelle || x.ch.nom, spec.description || '');
    })).then(function () {
      ins.forEach(function (x) { if (x.ch.secret) x.i.value = ''; });
      noterFait(cleFaite);
      var msg = spec.type === 'secret'
        ? '🔐 Secret ' + spec.nom + ' enregistré dans le coffre.'
        : '📝 ' + (spec.titre || 'Formulaire') + '\n' + textes.map(function (x) { return '- ' + (x.ch.libelle || x.ch.nom) + ' : ' + x.i.value.trim(); }).join('\n') +
          (secrets.length ? '\n' + secrets.map(function (x) { return '- 🔐 secret ' + x.ch.nom + ' enregistré'; }).join('\n') : '');
      while (c.children.length > 1) c.removeChild(c.lastChild);
      c.appendChild(e('div', 'ok', '🔒 Enregistré'));
      if (o.envoyer) o.envoyer(msg);
    }, function (x) { b.disabled = false; err.textContent = 'Le coffre n’a pas répondu, réessaie.'; err.hidden = false; });
  };
  return c;
}
function specs(corps) {
  var out = [], re = /<!--\s*fsm-(secret|formulaire):\s*([\s\S]*?)-->/g, m;
  while ((m = re.exec(String(corps || '')))) {
    try { var j = JSON.parse(m[2]); j.type = m[1]; out.push(j); } catch (x) {}
  }
  return out;
}
function cartes(node, corps, o) {
  var l = specs(corps);
  if (!l.length) return;
  var bulle = node.querySelector('.bubble') || node;
  l.forEach(function (s) { bulle.appendChild(carte(s, o)); });
}

window.LauraRapide = { PROXY: PROXY, discuter: discuter, cartes: cartes, specs: specs, ranger: ranger };
})();
