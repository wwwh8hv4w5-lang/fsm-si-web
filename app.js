/* FSM SI — interface web. Parle directement à l'API GitHub depuis le navigateur.
   Aucun serveur, aucun secret dans le code : le jeton est collé par l'utilisateur et reste dans ce navigateur. */
'use strict';
(() => {
const API = 'https://api.github.com';
const LS = {
  get: (k, d) => { try { const v = localStorage.getItem('fsmsi.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: (k, v) => { try { localStorage.setItem('fsmsi.' + k, JSON.stringify(v)); } catch (e) {} },
  del: (k) => { try { localStorage.removeItem('fsmsi.' + k); } catch (e) {} },
};
const MARK_PROGRESS = '<!-- robot-progress -->';
const MAX_FILE = 25 * 1024 * 1024;
const RUNNING = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending']);

const S = {
  token: LS.get('token', ''), repo: LS.get('repo', 'wwwh8hv4w5-lang/fsm-si'), me: null, branch: 'main', perms: null,
  open: [], closed: [], filter: 'open', current: null, view: 'chat', runs: [], running: new Set(),
  comments: [], issue: null, sig: '', awaiting: LS.get('awaiting', {}), seen: LS.get('seen', null),
  files: [], search: '', searchHits: null, timer: null, lastList: 0, lastRuns: 0, knownBot: new Set(), blobs: new Map(),
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const owner = () => S.repo.split('/')[0];
const R = () => '/repos/' + S.repo;
const ghUrl = (p = '') => 'https://github.com/' + S.repo + p;
const encPath = (p) => String(p).split('/').map(encodeURIComponent).join('/');
const fmtTime = (d) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtShort = (d) => { const x = new Date(d), n = new Date(); return x.toDateString() === n.toDateString() ? x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : x.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); };
const fmtSize = (n) => n < 1024 ? n + ' o' : n < 1048576 ? (n / 1024).toFixed(0) + ' Ko' : (n / 1048576).toFixed(1) + ' Mo';
const fmtDur = (s) => s < 60 ? Math.round(s) + ' s' : Math.floor(s / 60) + ' min ' + String(Math.round(s % 60)).padStart(2, '0');
const isValidation = (i) => (i.labels || []).some((l) => (l.name || l) === 'validation') || /^⏸️?\s*Validation/.test(i.title || '');
const isBot = (u) => !!u && (u.type === 'Bot' || /\[bot\]$/.test(u.login || ''));
const IMG_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;
const ext = (n) => (String(n).match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
const fileIcon = (n) => ({ pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', csv: '📗', zip: '🗜️', html: '🌐', htm: '🌐', js: '📜', json: '🧾', md: '📝', txt: '📝', mp4: '🎬', mov: '🎬', mp3: '🎵', wav: '🎵', glb: '🧊', gltf: '🧊' }[ext(n)] || (IMG_RE.test(n) ? '🖼️' : '📄'));

/* ---------------- API ---------------- */
class ApiError extends Error { constructor(msg, status, kind) { super(msg); this.status = status; this.kind = kind; } }
async function api(path, opt = {}) {
  const headers = { Authorization: 'Bearer ' + (opt.token || S.token), Accept: opt.accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (opt.body !== undefined) headers['Content-Type'] = 'application/json';
  let r;
  try {
    r = await fetch(path.startsWith('http') ? path : API + path, { method: opt.method || 'GET', headers, body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined, cache: 'no-cache' });
  } catch (e) { throw new ApiError('Connexion à GitHub impossible. Vérifie ta connexion internet.', 0, 'network'); }
  if (r.status === 204) return null;
  if (!r.ok) throw await apiError(r);
  if (opt.raw === 'blob') return r.blob();
  if (opt.raw === 'text') return r.text();
  return r.json();
}
async function apiError(r) {
  let msg = '';
  try { msg = (await r.json()).message || ''; } catch (e) {}
  const rem = r.headers.get('x-ratelimit-remaining'), reset = r.headers.get('x-ratelimit-reset');
  if ((r.status === 403 || r.status === 429) && (rem === '0' || /rate limit/i.test(msg))) {
    const t = reset ? new Date(reset * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'dans quelques minutes';
    return new ApiError('Limite de requêtes GitHub atteinte. Reprise à ' + t + '.', r.status, 'rate');
  }
  if (r.status === 401) return new ApiError('Jeton refusé ou expiré. Reconnecte-toi avec un nouveau jeton.', 401, 'auth');
  if (r.status === 403) return new ApiError('Permission manquante pour ce jeton (' + (msg || 'accès refusé') + '). Vérifie les permissions du jeton.', 403, 'perm');
  if (r.status === 404) return new ApiError('Introuvable (ou le jeton n’a pas accès au dépôt ' + S.repo + ').', 404, 'notfound');
  if (r.status === 422) return new ApiError('GitHub a refusé la demande : ' + msg, 422, 'invalid');
  return new ApiError('Erreur GitHub ' + r.status + (msg ? ' : ' + msg : ''), r.status, 'other');
}
function handleErr(e, where) {
  console.warn(where, e);
  if (e && e.kind === 'auth') { banner(e.message + ' ', h('a', { href: '#', onclick: (ev) => { ev.preventDefault(); logout(); } }, 'Se reconnecter')); return; }
  if (e && (e.kind === 'rate' || e.kind === 'network')) { banner(e.message); return; }
  toast((where ? where + ' : ' : '') + (e && e.message || e), 'err');
}
async function allPages(path) {
  const out = [];
  for (let p = 1; p < 20; p++) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await api(path + sep + 'per_page=100&page=' + p, { accept: 'application/vnd.github.full+json' });
    out.push(...r);
    if (r.length < 100) break;
  }
  return out;
}

/* ---------------- UI helpers ---------------- */
function toast(msg, kind, onclick) {
  const t = h('div', { class: 'toast ' + (kind || ''), role: 'status' }, msg);
  t.onclick = () => { t.remove(); onclick && onclick(); };
  $('#toasts').append(t);
  setTimeout(() => t.remove(), kind === 'err' ? 7000 : 4000);
}
function banner(...kids) { const b = $('#banner'); b.className = 'banner'; b.replaceChildren(...kids); }
function clearBanner() { $('#banner').className = 'banner hidden'; }
function sheet(build) {
  const sh = $('#sheet'), body = $('#sheetBody');
  return new Promise((resolve) => {
    const close = (v) => { sh.classList.add('hidden'); body.replaceChildren(); sh.onclick = null; document.removeEventListener('keydown', esc); resolve(v); };
    const esc = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', esc);
    sh.onclick = (e) => { if (e.target === sh) close(null); };
    body.replaceChildren(...[].concat(build(close)).flat(Infinity).filter(Boolean));
    sh.classList.remove('hidden');
    const f = body.querySelector('input,textarea'); if (f) setTimeout(() => f.focus(), 60);
  });
}
const confirmBox = (title, text, okLabel = 'Confirmer', danger) => sheet((close) => [
  h('h3', { text: title }), text ? h('p', { class: 'muted', text }) : null,
  h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => close(false) }, 'Annuler'), h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => close(true) }, okLabel)),
]);
const promptBox = (title, label, value = '', { required, multiline, okLabel = 'OK' } = {}) => sheet((close) => {
  const inp = multiline ? h('textarea', {}) : h('input', { type: 'text', autocapitalize: 'off' });
  inp.value = value;
  const ok = () => { const v = inp.value.trim(); if (required && !v) { inp.focus(); return; } close(v); };
  if (!multiline) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
  return [h('h3', { text: title }), label ? h('label', { class: 'muted', text: label }) : null, inp,
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => close(null) }, 'Annuler'), h('button', { class: 'btn primary', onclick: ok }, okLabel))];
});
function md(text) {
  const html = window.marked ? window.marked.parse(String(text || ''), { gfm: true, breaks: true }) : h('div', { text }).innerHTML;
  return sanitize(html);
}
function sanitize(html) {
  return window.DOMPurify.sanitize(html, { ADD_ATTR: ['target'], FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'video', 'audio', 'object', 'embed'], FORBID_ATTR: ['style'] });
}
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  $('meta[name=theme-color]').setAttribute('content', t === 'light' ? '#f5f6fa' : '#0b0d12');
  LS.set('theme', t);
}

/* ---------------- Fichiers du dépôt ---------------- */
function repoPathFromUrl(u) {
  if (!u) return null;
  try {
    const x = new URL(u, location.href);
    if (x.hostname !== 'github.com' && x.hostname !== 'raw.githubusercontent.com') return null;
    const parts = x.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const [o, r] = S.repo.toLowerCase().split('/');
    if (x.hostname === 'github.com') {
      if (parts.length < 5 || parts[0].toLowerCase() !== o || parts[1].toLowerCase() !== r || !/^(blob|raw|tree)$/.test(parts[2])) return null;
      return { ref: parts[3], path: parts.slice(4).join('/'), tree: parts[2] === 'tree' };
    }
    if (parts.length < 4 || parts[0].toLowerCase() !== o || parts[1].toLowerCase() !== r) return null;
    return { ref: parts[2], path: parts.slice(3).join('/') };
  } catch (e) { return null; }
}
async function repoBlob(path, ref) {
  const key = (ref || S.branch) + ':' + path;
  if (S.blobs.has(key)) return S.blobs.get(key);
  const p = api(R() + '/contents/' + encPath(path) + '?ref=' + encodeURIComponent(ref || S.branch), { accept: 'application/vnd.github.raw', raw: 'blob' })
    .then((b) => {
      let type = b.type;
      if (!type || type === 'application/octet-stream') type = ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf', mp4: 'video/mp4' })[ext(path)] || type;
      const bb = type !== b.type ? new Blob([b], { type }) : b;
      return { url: URL.createObjectURL(bb), size: bb.size, type };
    });
  S.blobs.set(key, p);
  p.catch(() => S.blobs.delete(key));
  return p;
}
async function downloadRepoFile(path, ref) {
  const name = path.split('/').pop();
  try {
    toast('Téléchargement de ' + name + '…');
    const b = await repoBlob(path, ref);
    const a = h('a', { href: b.url, download: name });
    document.body.append(a); a.click(); a.remove();
  } catch (e) { handleErr(e, 'Téléchargement'); }
}
async function openRepoFile(path, ref) {
  const name = path.split('/').pop();
  if (IMG_RE.test(name)) { try { lightbox((await repoBlob(path, ref)).url); } catch (e) { handleErr(e, 'Image'); } return; }
  if (/\.(pdf|txt|md|json|csv|html?)$/i.test(name)) {
    const w = window.open('', '_blank');
    try { const b = await repoBlob(path, ref); if (w) w.location = b.url; else location.href = b.url; } catch (e) { if (w) w.close(); handleErr(e, 'Ouverture'); }
    return;
  }
  downloadRepoFile(path, ref);
}
function lightbox(src) { const lb = $('#lightbox'); $('img', lb).src = src; lb.classList.remove('hidden'); }
function fileCard(f) {
  const isImg = IMG_RE.test(f.name);
  const thumb = h('div', { class: 'thumb' }, isImg ? '⏳' : fileIcon(f.name));
  if (isImg) repoBlob(f.path).then((b) => thumb.replaceChildren(h('img', { src: b.url, alt: f.name, loading: 'lazy', onclick: () => lightbox(b.url) }))).catch(() => { thumb.textContent = '🖼️'; });
  return h('div', { class: 'file' }, thumb,
    h('div', { class: 'fn' }, f.name, f.size != null ? h('span', { class: 'muted' }, ' · ' + fmtSize(f.size)) : null),
    h('div', { class: 'fa' },
      h('button', { class: 'btn small', onclick: () => openRepoFile(f.path) }, 'Ouvrir'),
      h('button', { class: 'btn small primary', onclick: () => downloadRepoFile(f.path) }, '⬇︎')));
}
async function listDir(path, depth = 2) {
  let items;
  try { items = await api(R() + '/contents/' + encPath(path) + '?ref=' + encodeURIComponent(S.branch)); } catch (e) { if (e.status === 404) return []; throw e; }
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const it of items) {
    if (it.type === 'file') out.push({ name: it.name, path: it.path, size: it.size });
    else if (it.type === 'dir' && depth > 1) out.push(...(await listDir(it.path, depth - 1)).map((f) => ({ ...f, name: it.name + '/' + f.name })));
  }
  return out;
}
/* Enrichit le HTML d'un message : liens et images vers les fichiers du dépôt privé. */
function enhance(root) {
  const shown = new Set();
  for (const img of $$('img', root)) {
    const src = img.getAttribute('data-canonical-src') || img.getAttribute('src');
    const rp = repoPathFromUrl(src);
    img.loading = 'lazy';
    if (rp) {
      shown.add(rp.path);
      img.removeAttribute('src'); img.alt = img.alt || rp.path.split('/').pop();
      repoBlob(rp.path, rp.ref).then((b) => { img.src = b.url; }).catch(() => img.replaceWith(h('span', { class: 'img-missing' }, '🖼️ ' + rp.path.split('/').pop())));
      const a = img.closest('a'); if (a) a.removeAttribute('href');
    }
    img.addEventListener('click', (e) => { if (img.src) { e.preventDefault(); lightbox(img.src); } });
    img.addEventListener('error', () => { if (img.src && !img.dataset.failed) { img.dataset.failed = 1; img.replaceWith(h('a', { href: src, target: '_blank', rel: 'noopener', class: 'img-missing' }, '🖼️ Image (ouvrir sur GitHub)')); } }, { once: true });
  }
  const thumbs = [];
  for (const a of $$('a[href]', root)) {
    a.target = '_blank'; a.rel = 'noopener noreferrer';
    const rp = repoPathFromUrl(a.getAttribute('href'));
    if (!rp || rp.tree) continue;
    a.addEventListener('click', (e) => { e.preventDefault(); openRepoFile(rp.path, rp.ref); });
    a.after(' ', h('button', { class: 'btn small', title: 'Télécharger', onclick: (e) => { e.preventDefault(); downloadRepoFile(rp.path, rp.ref); } }, '⬇︎'));
    if (IMG_RE.test(rp.path) && !shown.has(rp.path)) { shown.add(rp.path); thumbs.push(rp); }
  }
  if (thumbs.length) {
    const box = h('div', { class: 'files-inline' });
    for (const rp of thumbs) {
      const im = h('img', { alt: rp.path.split('/').pop(), style: null });
      im.className = 'thumb-inline';
      repoBlob(rp.path, rp.ref).then((b) => { im.src = b.url; im.onclick = () => lightbox(b.url); }).catch(() => im.remove());
      box.append(im);
    }
    root.append(box);
  }
}

/* ---------------- Connexion ---------------- */
async function login(token, repo) {
  const me = await api('/user', { token });
  const r = await api('/repos/' + repo, { token });
  return { me, r };
}
async function start() {
  try {
    const { me, r } = await login(S.token, S.repo);
    S.me = me; S.branch = r.default_branch || 'main'; S.perms = r.permissions || null;
  } catch (e) {
    if (e.kind === 'network') { showApp(); banner(e.message); schedule(10000); return; }
    showLogin(e.message); return;
  }
  showApp();
  if (S.me.login.toLowerCase() !== owner().toLowerCase()) {
    const b = $('#banner'); b.className = 'banner';
    b.textContent = '⚠️ Connecté en tant que ' + S.me.login + ' : FSM SI ne répond qu’au propriétaire du dépôt (' + owner() + '). Crée le jeton depuis ce compte.';
  }
  await refreshList(true);
  route();
  schedule(1500);
}
function showLogin(err) {
  $('#app').classList.add('hidden'); $('#login').classList.remove('hidden');
  $('#repoInput').value = S.repo;
  const el = $('#loginError');
  if (err) { el.textContent = err; el.classList.remove('hidden'); } else el.classList.add('hidden');
}
function showApp() { $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); }
function logout() {
  LS.del('token'); S.token = ''; clearTimeout(S.timer);
  for (const p of S.blobs.values()) p.then((b) => URL.revokeObjectURL(b.url)).catch(() => {});
  S.blobs.clear();
  location.hash = '';
  showLogin();
}
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = $('#tokenInput').value.trim(), repo = $('#repoInput').value.trim().replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { showLogin('Dépôt invalide : écris propriétaire/nom.'); return; }
  const btn = $('#loginBtn'); btn.disabled = true; btn.textContent = 'Vérification…';
  try {
    await login(token, repo);
    S.token = token; S.repo = repo; LS.set('token', token); LS.set('repo', repo);
    $('#tokenInput').value = '';
    await start();
  } catch (err) {
    showLogin(err.kind === 'notfound' ? 'Le jeton fonctionne, mais n’a pas accès au dépôt ' + repo + '. Dans « Repository access », choisis ce dépôt.' : err.message);
  } finally { btn.disabled = false; btn.textContent = 'Se connecter'; }
});

/* ---------------- Liste des conversations ---------------- */
async function refreshRuns() {
  try {
    const r = await api(R() + '/actions/runs?per_page=30');
    S.runs = r.workflow_runs || [];
    S.running = new Set(S.runs.filter((x) => RUNNING.has(x.status)).map((x) => (String(x.display_title || '').match(/#(\d+)/) || [])[1]).filter(Boolean).map(Number));
    S.lastRuns = Date.now();
  } catch (e) { if (e.kind === 'perm' || e.kind === 'notfound') S.runsDenied = true; else throw e; }
}
async function refreshList(first) {
  try {
    const reqs = [api(R() + '/issues?state=open&sort=created&direction=desc&per_page=100')];
    if (S.filter === 'closed') reqs.push(api(R() + '/issues?state=closed&sort=updated&direction=desc&per_page=100'));
    const [open, closed] = await Promise.all(reqs);
    S.open = open.filter((i) => !i.pull_request);
    if (closed) S.closed = closed.filter((i) => !i.pull_request);
    if (!S.runsDenied) await refreshRuns().catch((e) => handleErr(e));
    S.lastList = Date.now();
    clearBannerIfTransient();
    detectNews(first);
    renderList();
  } catch (e) { handleErr(e, first ? 'Chargement' : ''); }
}
function clearBannerIfTransient() { const b = $('#banner'); if (/Limite|Connexion/.test(b.textContent)) clearBanner(); }
function detectNews(first) {
  const all = S.open.concat(S.closed);
  if (!S.seen) { S.seen = {}; for (const i of all) S.seen[i.number] = i.comments; LS.set('seen', S.seen); }
  if (first) { S.prevCounts = Object.fromEntries(all.map((i) => [i.number, i.comments])); return; }
  for (const i of S.open) {
    const prev = S.prevCounts[i.number];
    if (prev != null && i.comments > prev && i.number !== S.current) {
      const t = isValidation(i) ? 'Validation #' + i.number : '#' + i.number + ' · ' + i.title;
      toast('💬 Nouveau message : ' + t, '', () => go('#/c/' + i.number));
      notify('FSM SI — ' + t, 'Nouveau message', i.number);
    } else if (prev == null && isValidation(i)) {
      toast('⏸️ Nouvelle validation : ' + i.title, '', () => go('#/c/' + i.number));
      notify('FSM SI — validation demandée', i.title, i.number);
    }
    S.prevCounts[i.number] = i.comments;
  }
  updateBadge();
}
function unread(i) { return S.seen && S.seen[i.number] != null ? i.comments > S.seen[i.number] : (S.seen && !(i.number in S.seen)); }
function markSeen(i) { if (!S.seen) S.seen = {}; S.seen[i.number] = i.comments; LS.set('seen', S.seen); updateBadge(); }
function updateBadge() {
  const n = S.open.filter((i) => !isValidation(i) && unread(i) && i.number !== S.current).length + S.open.filter(isValidation).length;
  document.title = (n ? '(' + n + ') ' : '') + 'FSM SI';
  if (navigator.setAppBadge) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
}
function renderList() {
  const q = S.search.toLowerCase();
  const vals = S.open.filter(isValidation);
  $('#validationsBox').classList.toggle('hidden', !vals.length);
  $('#valCount').textContent = vals.length;
  $('#validationsList').replaceChildren(...vals.map((v) => h('div', { class: 'val-item' },
    h('div', { class: 'vt', onclick: () => go('#/c/' + v.number) }, '#' + v.number + ' ' + v.title.replace(/^⏸️\s*Validation\s*:\s*/, '')),
    h('div', { class: 'vb' },
      h('button', { class: 'btn small ok', onclick: () => answerValidation(v, 'valider') }, '✓ Valider'),
      h('button', { class: 'btn small danger', onclick: () => answerValidation(v, 'refuser') }, '✕ Refuser'),
      h('button', { class: 'btn small', onclick: () => go('#/c/' + v.number) }, 'Détails')))));
  let list = (S.filter === 'open' ? S.open : S.closed).filter((i) => !isValidation(i));
  if (q) list = list.filter((i) => (i.title + ' ' + (i.body || '') + ' #' + i.number).toLowerCase().includes(q) || (S.searchHits && S.searchHits.has(i.number)));
  if (q && S.searchHits) for (const n of S.searchHits) if (!list.some((i) => i.number === n)) { const x = (S.searchItems || {})[n]; if (x && !isValidation(x)) list.push(x); }
  $('#convList').replaceChildren(...list.map((i) => {
    const busy = S.running.has(i.number) || isAwaiting(i.number);
    return h('li', { class: 'conv' + (i.number === S.current ? ' active' : ''), onclick: () => go('#/c/' + i.number) },
      h('div', { class: 'num' }, '#' + i.number),
      h('div', { class: 'txt' }, h('div', { class: 't' }, i.title), h('div', { class: 's' }, (i.state === 'closed' ? '🗄️ ' : '') + fmtShort(i.updated_at) + ' · ' + i.comments + ' message' + (i.comments > 1 ? 's' : ''))),
      busy ? h('div', { class: 'spin', title: 'En cours' }) : unread(i) && i.number !== S.current ? h('div', { class: 'dot', title: 'Nouveau' }) : null);
  }));
  $('#convEmpty').classList.toggle('hidden', list.length > 0);
  updateBadge();
}
let searchT;
$('#searchInput').addEventListener('input', (e) => {
  S.search = e.target.value.trim(); S.searchHits = null; renderList();
  clearTimeout(searchT);
  if (S.search.length >= 3) searchT = setTimeout(async () => {
    try {
      const r = await api('/search/issues?per_page=50&q=' + encodeURIComponent('repo:' + S.repo + ' is:issue ' + S.search));
      S.searchHits = new Set(r.items.map((i) => i.number)); S.searchItems = Object.fromEntries(r.items.map((i) => [i.number, i]));
      renderList();
    } catch (err) { /* recherche locale seulement */ }
  }, 500);
});
$$('.tab').forEach((t) => t.addEventListener('click', () => {
  $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
  S.filter = t.dataset.filter; renderList(); if (S.filter === 'closed') refreshList();
}));

/* ---------------- Routage ---------------- */
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
window.addEventListener('hashchange', route);
function route() {
  if (!S.token || !S.me) return;
  const m = location.hash.match(/^#\/(c|v)\/([\w-]+)/);
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', !!m && m[1] === 'v' && b.dataset.view === m[2]));
  if (m && m[1] === 'c') openConversation(Number(m[2]));
  else if (m && m[1] === 'v') openView(m[2]);
  else if (location.hash === '#/new') openNew();
  else { openNew(true); }
}
function showMain(on) { $('#app').classList.toggle('show-main', on); }
$('#backBtn').addEventListener('click', () => { showMain(false); S.current = null; history.replaceState(null, '', location.pathname + location.search); renderList(); });
$('#newBtn').addEventListener('click', () => go('#/new'));

function setMode(mode) {
  S.view = mode;
  $('#chat').classList.toggle('hidden', mode !== 'chat');
  $('#composer').classList.toggle('hidden', mode !== 'chat');
  $('#panel').classList.toggle('hidden', mode === 'chat');
  $('#filesBtn').classList.toggle('hidden', mode !== 'chat' || !S.current);
  $('#menuBtn').classList.toggle('hidden', mode !== 'chat' || !S.current);
}
function openNew(listOnly) {
  saveDraft();
  S.current = null; S.issue = null; S.comments = []; S.sig = '';
  setMode('chat');
  $('#convTitle').textContent = 'Nouvelle conversation'; $('#convMeta').textContent = 'Ta demande ouvre une nouvelle issue sur ' + S.repo;
  $('#messages').replaceChildren(); $('#welcome').classList.remove('hidden'); $('#typing').classList.add('hidden');
  $('#chips').classList.add('hidden');
  restoreDraft();
  showMain(!listOnly);
  renderList();
  if (!listOnly && matchMedia('(hover:hover)').matches) $('#msgInput').focus();
}

/* ---------------- Conversation ---------------- */
function isAwaiting(n) { const t = S.awaiting[n]; return !!t && Date.now() - t < 3 * 60 * 1000; }
function setAwaiting(n, on) { if (on) S.awaiting[n] = Date.now(); else delete S.awaiting[n]; LS.set('awaiting', S.awaiting); }
async function openConversation(n, quiet) {
  if (S.current !== n) { saveDraft(); S.current = n; S.issue = (S.open.concat(S.closed)).find((i) => i.number === n) || null; S.comments = []; S.sig = ''; S.knownBot = null; $('#messages').replaceChildren(); restoreDraft(); }
  setMode('chat'); showMain(true);
  $('#welcome').classList.add('hidden');
  $('#chips').classList.remove('hidden');
  if (S.issue) renderHeader();
  else { $('#convTitle').textContent = '#' + n; $('#convMeta').textContent = 'Chargement…'; }
  renderList();
  try {
    const [issue, comments] = await Promise.all([api(R() + '/issues/' + n, { accept: 'application/vnd.github.full+json' }), allPages(R() + '/issues/' + n + '/comments')]);
    if (S.current !== n) return;
    S.issue = issue; S.comments = comments;
    renderHeader(); renderMessages(); markSeen(issue);
  } catch (e) { if (!quiet) handleErr(e, 'Conversation #' + n); }
}
function costOf(body) {
  const m = String(body || '').match(/<sub>([\s\S]*?)<\/sub>\s*$/) || String(body || '').match(/<sub>([^<]*\$[^<]*)<\/sub>/);
  if (!m) return null;
  const c = m[1].match(/~\s*([\d.,]+)\s*\$/);
  return c ? parseFloat(c[1].replace(',', '.')) : null;
}
function renderHeader() {
  const i = S.issue; if (!i) return;
  $('#convTitle').textContent = (i.state === 'closed' ? '🗄️ ' : '') + i.title;
  const total = S.comments.reduce((a, c) => a + (isBot(c.user) ? costOf(c.body) || 0 : 0), 0);
  const parts = ['#' + i.number, fmtTime(i.created_at)];
  if (total) parts.push('~' + total.toFixed(3).replace('.', ',') + ' $');
  if (S.running.has(i.number)) parts.push('⚙️ en cours');
  $('#convMeta').textContent = parts.join(' · ');
}
function footerChips(body) {
  const m = String(body || '').match(/<sub>([^<]*·[^<]*)<\/sub>/g);
  if (!m) return null;
  const txt = m[m.length - 1].replace(/<\/?sub>/g, '');
  if (!/\$|appels|vérifi/.test(txt)) return null;
  const box = h('div', { class: 'footer-cost' });
  for (const p of txt.split('·').map((x) => x.trim()).filter(Boolean)) {
    const cls = /non vérifiée/i.test(p) ? 'pill err' : /vérifiée/i.test(p) ? 'pill ok' : /\$/.test(p) ? 'pill warn' : 'pill';
    box.append(h('span', { class: cls }, (/^vérifiée/i.test(p) ? '✓ ' : /non vérifiée/i.test(p) ? '⚠︎ ' : '') + p));
  }
  return box;
}
function bubble(c, isIssue) {
  const mine = S.me && c.user && c.user.login === S.me.login && !isBot(c.user);
  const bot = isBot(c.user);
  const progress = String(c.body || '').includes(MARK_PROGRESS);
  const cmd = mine && /^\s*\//.test(c.body || '');
  const content = h('div', { class: 'md' });
  let html = c.body_html ? sanitize(c.body_html) : md(c.body);
  content.innerHTML = html;
  const chips = bot ? footerChips(c.body) : null;
  if (chips) { $$('sub', content).forEach((s) => { if (/·/.test(s.textContent) && /\$|appels/.test(s.textContent)) s.remove(); }); }
  enhance(content);
  const tools = h('div', { class: 'tools' },
    h('button', { title: 'Copier', 'aria-label': 'Copier', onclick: () => copyText(c.body || '') }, '📋'),
    mine && !progress ? h('button', { title: 'Modifier', 'aria-label': 'Modifier', onclick: () => editMessage(c, isIssue) }, '✏️') : null);
  const who = h('div', { class: 'who' }, h('span', {}, bot ? 'FSM SI' : mine ? 'Toi' : (c.user && c.user.login) || '?'), h('span', {}, fmtTime(c.created_at)), !isIssue && !bot && c.updated_at && new Date(c.updated_at) - new Date(c.created_at) > 3000 ? h('span', {}, '(modifié)') : null, tools);
  const av = h('div', { class: 'av' }, bot ? h('img', { src: 'icons/icon-192.png', alt: '' }) : c.user && c.user.avatar_url ? h('img', { src: c.user.avatar_url + '&s=56', alt: '' }) : '👤');
  return h('div', { class: 'msg' + (mine ? ' me' : '') + (cmd ? ' cmd' : '') + (progress ? ' progress' : ''), 'data-id': c.id || 'issue' }, av, h('div', { class: 'bubble' }, who, content, chips));
}
function renderMessages(force) {
  const i = S.issue; if (!i) return;
  const sig = [i.updated_at, i.body ? i.body.length : 0, ...S.comments.map((c) => c.id + ':' + c.updated_at)].join('|');
  const last = S.comments[S.comments.length - 1];
  if (S.awaiting[i.number] && last && isBot(last.user) && !String(last.body).includes(MARK_PROGRESS) && new Date(last.created_at) >= S.awaiting[i.number] - 10000) setAwaiting(i.number, false);
  const busy = S.running.has(i.number) || S.comments.some((c) => String(c.body).includes(MARK_PROGRESS)) || isAwaiting(i.number);
  updateTyping(busy);
  if (sig === S.sig && !force) return;
  // Nouvelle réponse du robot ?
  const botIds = S.comments.filter((c) => isBot(c.user) && !String(c.body).includes(MARK_PROGRESS)).map((c) => c.id);
  if (S.knownBot) {
    const fresh = S.comments.filter((c) => botIds.includes(c.id) && !S.knownBot.has(c.id));
    if (fresh.length) {
      setAwaiting(i.number, false);
      if (document.hidden) notify('FSM SI — #' + i.number, (fresh[fresh.length - 1].body || '').replace(/<[^>]+>/g, '').slice(0, 140), i.number);
    }
  }
  S.knownBot = new Set(botIds);
  const chat = $('#chat');
  const nearBottom = !S.sig || chat.scrollHeight - chat.scrollTop - chat.clientHeight < 160;
  S.sig = sig;
  const box = $('#messages');
  const nodes = [bubble({ ...i, body_html: i.body_html, created_at: i.created_at }, true)];
  if (isValidation(i) && i.state === 'open') nodes.push(h('div', { class: 'card row' }, h('div', { class: 'grow' }, '⏸️ Cette action attend ta décision.'),
    h('button', { class: 'btn ok', onclick: () => answerValidation(i, 'valider') }, '✓ Valider'), h('button', { class: 'btn danger', onclick: () => answerValidation(i, 'refuser') }, '✕ Refuser')));
  for (const c of S.comments) nodes.push(bubble(c));
  box.replaceChildren(...nodes);
  renderHeader();
  updateTyping(busy);
  if (nearBottom) requestAnimationFrame(() => { chat.scrollTop = chat.scrollHeight; });
}
function updateTyping(busy) {
  const t = $('#typing');
  t.classList.toggle('hidden', !busy);
  if (busy) {
    const run = S.runs.find((r) => RUNNING.has(r.status) && (String(r.display_title).match(/#(\d+)/) || [])[1] == S.current);
    const since = run ? (Date.now() - new Date(run.run_started_at || run.created_at)) / 1000 : null;
    $('#typingText').textContent = run ? (run.status === 'queued' ? 'En file d’attente…' : 'FSM SI travaille… ' + fmtDur(since)) : 'Envoi au robot…';
  }
}
async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('Copié ✓', 'ok'); } catch (e) { toast('Copie impossible', 'err'); } }
async function editMessage(c, isIssue) {
  const v = await promptBox('Modifier le message', 'La modification ne relance pas le robot (envoie un nouveau message pour ça).', c.body || '', { multiline: true, okLabel: 'Enregistrer' });
  if (v == null || v === (c.body || '').trim()) return;
  try {
    if (isIssue) await api(R() + '/issues/' + c.number, { method: 'PATCH', body: { body: v } });
    else await api(R() + '/issues/comments/' + c.id, { method: 'PATCH', body: { body: v } });
    toast('Message modifié ✓', 'ok'); openConversation(S.current);
  } catch (e) { handleErr(e, 'Modification'); }
}
async function answerValidation(v, word) {
  const ok = await confirmBox(word === 'valider' ? 'Valider cette action ?' : 'Refuser cette action ?', v.title, word === 'valider' ? '✓ Valider' : '✕ Refuser', word !== 'valider');
  if (!ok) return;
  try {
    await api(R() + '/issues/' + v.number + '/comments', { method: 'POST', body: { body: word } });
    toast(word === 'valider' ? 'Validé ✓ — le robot exécute l’action.' : 'Refusé ✓', 'ok');
    setAwaiting(v.number, true);
    refreshList(); if (S.current === v.number) openConversation(v.number);
  } catch (e) { handleErr(e, 'Validation'); }
}

/* ---------------- Menu de conversation ---------------- */
$('#menuBtn').addEventListener('click', () => {
  const i = S.issue; if (!i) return;
  sheet((close) => [h('h3', { text: '#' + i.number + ' · ' + i.title }), h('div', { class: 'menu-list' },
    h('button', { onclick: async () => { close(); const t = await promptBox('Renommer', 'Nouveau titre', i.title, { required: true }); if (t) patchIssue({ title: t }, 'Renommée ✓'); } }, '✎ Renommer'),
    i.state === 'open'
      ? h('button', { onclick: async () => { close(); if (await confirmBox('Archiver la conversation ?', 'Elle sera fermée sur GitHub. Tu pourras la rouvrir.', 'Archiver')) patchIssue({ state: 'closed' }, 'Archivée ✓'); } }, '🗄️ Archiver (fermer)')
      : h('button', { onclick: () => { close(); patchIssue({ state: 'open' }, 'Rouverte ✓'); } }, '↩︎ Rouvrir'),
    h('button', { onclick: () => { close(); showFiles(); } }, '📎 Fichiers livrés (sorties/' + i.number + ')'),
    h('button', { onclick: () => { close(); copyText(location.href.split('#')[0] + '#/c/' + i.number); } }, '🔗 Copier le lien'),
    h('button', { onclick: () => { close(); window.open(i.html_url, '_blank', 'noopener'); } }, '↗︎ Ouvrir sur GitHub'),
    h('button', { onclick: () => close() }, 'Fermer'))]);
});
async function patchIssue(body, msg) {
  try { await api(R() + '/issues/' + S.current, { method: 'PATCH', body }); toast(msg, 'ok'); await refreshList(); openConversation(S.current); }
  catch (e) { handleErr(e, 'Modification'); }
}
$('#filesBtn').addEventListener('click', () => showFiles());
async function showFiles() {
  const n = S.current; if (!n) return;
  const body = h('div', {}, h('h3', { text: '📎 Fichiers de #' + n }), h('p', { class: 'muted', text: 'Chargement…' }));
  sheet((close) => { body.append(h('div', { class: 'actions', style: null }, h('button', { class: 'btn', onclick: () => close() }, 'Fermer'))); return body; });
  try {
    const [out, inp] = await Promise.all([listDir('sorties/' + n), listDir('entree/' + n)]);
    const sec = (title, files, dir) => [h('h4', {}, title + ' ', h('a', { href: ghUrl('/tree/' + S.branch + '/' + dir), target: '_blank', rel: 'noopener', class: 'muted' }, dir + '/')),
      files.length ? h('div', { class: 'file-grid' }, files.map(fileCard)) : h('p', { class: 'muted', text: 'Aucun fichier.' })];
    body.children[1].replaceWith(h('div', {}, sec('Livrés par FSM SI', out, 'sorties/' + n), sec('Envoyés par toi', inp, 'entree/' + n)));
  } catch (e) { body.children[1].textContent = e.message; }
}

/* ---------------- Composer ---------------- */
const input = $('#msgInput');
function autoGrow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, window.innerHeight * 0.4) + 'px'; updateSend(); }
function updateSend() { $('#sendBtn').disabled = !input.value.trim() && !S.files.length; }
const draftKey = () => 'draft.' + (S.current || 'new');
function saveDraft() { if (!input) return; const v = input.value; if (v.trim()) LS.set(draftKey(), v); else LS.del(draftKey()); }
function restoreDraft() { input.value = LS.get(draftKey(), ''); autoGrow(); }
input.addEventListener('input', () => { autoGrow(); saveDraft(); });
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(hover:hover) and (pointer:fine)').matches) { e.preventDefault(); send(); } });
$('#sendBtn').addEventListener('click', () => send());

function safeName(n) {
  const base = String(n || 'fichier').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(-80);
  return base || 'fichier';
}
function stamp() { const d = new Date(), p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); }
function addFiles(list) {
  for (const f of list) {
    if (!f || !f.size && !f.name) continue;
    const item = { file: f, id: Math.random().toString(36).slice(2), name: f.name || ('image-' + stamp() + '.' + ((f.type.split('/')[1] || 'png').replace('jpeg', 'jpg'))) };
    if (/^image\//.test(f.type)) item.preview = URL.createObjectURL(f);
    S.files.push(item);
    if (f.size > MAX_FILE) toast(item.name + ' dépasse 25 Mo : trop gros pour l’envoi par le navigateur.', 'err');
  }
  renderAttachments();
}
function renderAttachments() {
  const box = $('#attachments');
  box.classList.toggle('hidden', !S.files.length);
  box.replaceChildren(...S.files.map((it) => h('div', { class: 'att' + (it.file.size > MAX_FILE ? ' big' : ''), title: it.name + ' · ' + fmtSize(it.file.size) },
    h('div', { class: 'th' }, it.preview ? h('img', { src: it.preview, alt: '' }) : fileIcon(it.name)),
    it.progress != null ? h('div', { class: 'prog' }, h('i', { style: 'width:' + Math.round(it.progress * 100) + '%' })) : null,
    h('div', { class: 'nm' }, it.name),
    h('button', { class: 'x', 'aria-label': 'Retirer', onclick: () => { if (it.preview) URL.revokeObjectURL(it.preview); S.files = S.files.filter((x) => x !== it); renderAttachments(); } }, '✕'))));
  updateSend();
}
function pickFiles(accept, capture) {
  const fi = $('#fileInput');
  fi.value = ''; fi.accept = accept || ''; if (capture) fi.setAttribute('capture', capture); else fi.removeAttribute('capture');
  fi.click();
}
$('#fileInput').addEventListener('change', (e) => addFiles([...e.target.files]));
$('#attachBtn').addEventListener('click', () => sheet((close) => [h('h3', { text: 'Joindre' }), h('div', { class: 'menu-list' },
  h('button', { onclick: () => { close(); pickFiles('image/*,video/*'); } }, '🖼️ Photos et vidéos'),
  h('button', { onclick: () => { close(); pickFiles('image/*', 'environment'); } }, '📷 Prendre une photo'),
  h('button', { onclick: () => { close(); pickFiles(''); } }, '📄 Fichiers (PDF, Word, Excel, ZIP…)'),
  h('button', { onclick: () => close() }, 'Annuler')),
  h('p', { class: 'muted', text: 'Les fichiers sont déposés dans entree/ du dépôt privé (25 Mo max par fichier), puis signalés au robot dans ton message. Astuce : tu peux aussi coller une image ou glisser-déposer.' })]));
input.addEventListener('paste', (e) => { const fs = [...(e.clipboardData && e.clipboardData.files || [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } });
const mainEl = $('#main');
let dragN = 0;
mainEl.addEventListener('dragenter', (e) => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); dragN++; mainEl.classList.add('dragging'); } });
mainEl.addEventListener('dragover', (e) => { if ([...(e.dataTransfer.types || [])].includes('Files')) e.preventDefault(); });
mainEl.addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; mainEl.classList.remove('dragging'); } });
mainEl.addEventListener('drop', (e) => { e.preventDefault(); dragN = 0; mainEl.classList.remove('dragging'); if (S.view === 'chat') addFiles([...e.dataTransfer.files]); });

function readB64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new Error('Lecture du fichier impossible')); r.readAsDataURL(file); });
}
function putFile(path, b64, message, onprog) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('PUT', API + R() + '/contents/' + encPath(path));
    x.setRequestHeader('Authorization', 'Bearer ' + S.token);
    x.setRequestHeader('Accept', 'application/vnd.github+json');
    x.setRequestHeader('X-GitHub-Api-Version', '2022-11-28');
    x.setRequestHeader('Content-Type', 'application/json');
    x.upload.onprogress = (e) => { if (e.lengthComputable) onprog(e.loaded / e.total); };
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) return resolve(JSON.parse(x.responseText));
      let m = ''; try { m = JSON.parse(x.responseText).message; } catch (e) {}
      if (x.status === 403 || x.status === 404) return reject(new ApiError('Envoi refusé : le jeton doit avoir « Contents : Read and write » (' + (m || x.status) + ').', x.status, 'perm'));
      if (x.status === 401) return reject(new ApiError('Jeton refusé ou expiré.', 401, 'auth'));
      reject(new ApiError('Envoi impossible (' + x.status + (m ? ' : ' + m : '') + ').', x.status));
    };
    x.onerror = () => reject(new ApiError('Connexion perdue pendant l’envoi.', 0, 'network'));
    x.send(JSON.stringify({ message, content: b64, branch: S.branch }));
  });
}
async function uploadAll(folder, label) {
  const done = [], ts = stamp();
  for (const it of S.files) {
    if (it.uploaded) { done.push(it.uploaded); continue; }
    if (it.file.size > MAX_FILE) throw new Error(it.name + ' dépasse 25 Mo. Retire-le, ou dépose-le dans entree/ depuis GitHub.');
    const path = 'entree/' + folder + '/' + ts + '-' + safeName(it.name);
    it.progress = 0; renderAttachments();
    const b64 = await readB64(it.file);
    await putFile(path, b64, 'web: fichier pour ' + label + ' (' + it.name + ')', (p) => { it.progress = p; const bar = $$('.att .prog i')[S.files.indexOf(it)]; if (bar) bar.style.width = Math.round(p * 100) + '%'; });
    it.uploaded = { name: it.name, path, size: it.file.size, image: /^image\//.test(it.file.type) };
    it.progress = 1; renderAttachments();
    done.push(it.uploaded);
  }
  return done;
}
function attachmentBlock(files) {
  if (!files.length) return '';
  return '\n\n📎 **Fichiers joints** (déposés dans le dépôt, à lire dans `entree/`) :\n' +
    files.map((f) => '- [' + f.name.replace(/[\[\]]/g, '') + '](' + ghUrl('/blob/' + S.branch + '/' + encPath(f.path)) + ') — `' + f.path + '` (' + fmtSize(f.size) + ')').join('\n');
}
let sending = false;
async function send(textOverride) {
  if (sending) return;
  const text = (textOverride != null ? textOverride : input.value).trim();
  const withFiles = textOverride == null && S.files.length > 0;
  if (!text && !withFiles) return;
  if (/^\//.test(text) && withFiles) { toast('Une commande ne peut pas avoir de fichiers joints. Retire la « / » ou les fichiers.', 'err'); return; }
  if (/^\//.test(text) && !S.current) { toast('Les commandes s’envoient dans une conversation : ouvre-en une d’abord.', 'err'); return; }
  sending = true; $('#sendBtn').disabled = true;
  const n = S.current;
  try {
    let files = [];
    if (withFiles) files = await uploadAll(n ? String(n) : 'nouvelle-' + stamp(), n ? '#' + n : 'nouvelle conversation');
    const body = (text || (files.length ? 'Voici des fichiers.' : '')) + attachmentBlock(files);
    if (!n) {
      const first = (text || files.map((f) => f.name).join(', ')).split('\n')[0].trim();
      const title = first.length > 60 ? first.slice(0, 59).trimEnd() + '…' : first || 'Nouvelle conversation';
      const iss = await api(R() + '/issues', { method: 'POST', body: { title, body } });
      LS.del('draft.new');
      clearComposer(textOverride == null);
      setAwaiting(iss.number, true);
      S.open.unshift(iss); markSeen(iss);
      go('#/c/' + iss.number);
    } else {
      const c = await api(R() + '/issues/' + n + '/comments', { method: 'POST', body: { body } });
      if (textOverride == null) { LS.del('draft.' + n); clearComposer(true); }
      if (!/^\//.test(text)) setAwaiting(n, true);
      S.comments.push(c); renderMessages();
      if (S.issue && S.issue.state === 'closed') toast('Conversation archivée : rouvre-la si le robot ne répond pas.', '');
    }
    S.fastUntil = Date.now() + 90000;
    schedule(2500);
  } catch (e) { handleErr(e, 'Envoi'); for (const it of S.files) it.progress = null; renderAttachments(); }
  finally { sending = false; updateSend(); }
}
function clearComposer(all) {
  if (all) { input.value = ''; autoGrow(); }
  for (const it of S.files) if (it.preview) URL.revokeObjectURL(it.preview);
  S.files = []; renderAttachments();
}
/* Commandes rapides */
async function runCommand(cmd, argLabel, required, confirmText, target) {
  const n = target || commandTarget(); if (!n) return;
  if (confirmText && !(await confirmBox(cmd, confirmText, 'Envoyer'))) return;
  let arg = '';
  if (argLabel) { const v = await promptBox(cmd, argLabel, '', { required: !!required, okLabel: 'Envoyer' }); if (v == null) return; arg = v; }
  const text = (cmd + ' ' + arg).trim();
  try {
    const c = await api(R() + '/issues/' + n + '/comments', { method: 'POST', body: { body: text } });
    S.fastUntil = Date.now() + 60000;
    if (S.current === n) { S.comments.push(c); renderMessages(); }
    else toast('Commande ' + cmd + ' envoyée dans #' + n + '. Touche pour voir la réponse.', 'ok', () => go('#/c/' + n));
    schedule(3000);
  } catch (e) { handleErr(e, 'Commande'); }
}
function commandTarget() {
  if (S.current && S.issue && !isValidation(S.issue)) return S.current;
  const c = S.open.find((i) => !isValidation(i));
  if (!c) { toast('Ouvre d’abord une conversation : les commandes y répondent.', 'err'); return null; }
  return c.number;
}
$$('.chip').forEach((c) => c.addEventListener('click', () => runCommand(c.dataset.cmd, c.dataset.arg, c.dataset.required, c.dataset.confirm)));

/* Dictée vocale */
(() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = $('#micBtn');
  if (!SR) { btn.classList.add('hidden'); return; }
  let rec = null, base = '';
  btn.addEventListener('click', () => {
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = 'fr-FR'; rec.continuous = true; rec.interimResults = true;
    base = input.value ? input.value.replace(/\s*$/, ' ') : '';
    rec.onresult = (e) => { let fin = '', tmp = ''; for (const r of e.results) (r.isFinal ? (fin += r[0].transcript) : (tmp += r[0].transcript)); input.value = base + fin + tmp; autoGrow(); saveDraft(); };
    rec.onerror = (e) => { if (e.error === 'not-allowed') toast('Micro refusé. Autorise-le dans les réglages du navigateur.', 'err'); };
    rec.onend = () => { rec = null; btn.classList.remove('on'); $('#composer').classList.remove('mic-live'); };
    try { rec.start(); btn.classList.add('on'); $('#composer').classList.add('mic-live'); } catch (e) { rec = null; }
  });
})();

/* ---------------- Vues ---------------- */
$$('.nav-btn').forEach((b) => b.addEventListener('click', () => go('#/v/' + b.dataset.view)));
async function openView(v) {
  saveDraft();
  S.current = null; S.issue = null; S.sig = ''; renderList();
  setMode('panel'); showMain(true);
  const titles = { projets: '📁 Projets', taches: '📅 Tâches planifiées', memoire: '🧠 Mémoire', runs: '⚙️ Activité du robot', reglages: '☰ Réglages' };
  $('#convTitle').textContent = titles[v] || v; $('#convMeta').textContent = S.repo;
  const body = $('#panelBody'); body.replaceChildren(h('p', { class: 'muted', text: 'Chargement…' }));
  try { body.replaceChildren(...[].concat(await (VIEWS[v] || (() => h('p', { text: 'Vue inconnue.' })))()).flat(Infinity).filter(Boolean)); }
  catch (e) { body.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'error', text: e.message }))); }
}
const rawText = (p) => api(R() + '/contents/' + encPath(p) + '?ref=' + encodeURIComponent(S.branch), { accept: 'application/vnd.github.raw', raw: 'text' });
const VIEWS = {
  async projets() {
    let items = [];
    try { items = (await api(R() + '/contents/projets?ref=' + S.branch)).filter((x) => x.type === 'dir'); } catch (e) { if (e.status !== 404) throw e; }
    if (!items.length) return [h('div', { class: 'card' }, h('p', { class: 'muted', text: 'Aucun projet pour l’instant. Chaque jeu créé par l’agent code aura son dossier projets/<nom>/ avec un NOTES.md.' }))];
    return items.map((d) => {
      const notes = h('div', { class: 'md muted', text: 'Notes…' });
      const filesBox = h('div', {});
      rawText(d.path + '/NOTES.md').then((t) => { notes.className = 'md'; notes.innerHTML = md(t); enhance(notes); }).catch(() => { notes.textContent = '(pas de NOTES.md)'; });
      return h('div', { class: 'card' },
        h('div', { class: 'row' }, h('h3', { class: 'grow', text: '📁 ' + d.name }),
          h('button', { class: 'btn small', onclick: async (e) => { e.target.disabled = true; try { const fs = await listDir(d.path, 3); filesBox.replaceChildren(fs.length ? h('div', { class: 'file-grid' }, fs.slice(0, 60).map(fileCard)) : h('p', { class: 'muted', text: 'Vide.' })); } catch (err) { handleErr(err); } } }, 'Fichiers'),
          h('a', { class: 'btn small', href: ghUrl('/tree/' + S.branch + '/' + encPath(d.path)), target: '_blank', rel: 'noopener' }, 'GitHub ↗︎')),
        notes, filesBox);
    });
  },
  async taches() {
    let l = [];
    try { l = JSON.parse(await rawText('taches/planifiees.json')); } catch (e) { if (e.status !== 404) throw e; }
    const f = { once: 'une fois', hour: 'toutes les heures', day: 'tous les jours', week: 'toutes les semaines' };
    const act = l.filter((t) => t.actif), old = l.filter((t) => !t.actif);
    const card = (t) => h('div', { class: 'card' + (t.actif ? '' : ' muted') }, h('div', { class: 'row' },
      h('div', { class: 'grow' }, h('h3', { text: (t.actif ? '📅 ' : '✖️ ') + (t.titre || t.id) }),
        h('div', { class: 'kv' }, (f[t.frequence] || t.frequence || '') + (t.frequence !== 'hour' && t.heure ? ' à ' + t.heure : '') + (t.prochaine && t.actif ? ' · prochaine : ' + fmtTime(t.prochaine) : '') + ' · ', h('code', { text: t.id }))),
      t.actif ? h('button', { class: 'btn small danger', onclick: () => runCommand('/annuler ' + t.id, null, false, 'Annuler la tâche « ' + (t.titre || t.id) + ' » ?') }, 'Annuler') : null),
      t.mission ? h('p', { class: 'kv', text: t.mission }) : null);
    return [
      h('div', { class: 'card row' }, h('div', { class: 'grow' }, 'Pour créer une tâche, écris-la en conversation : « tous les jours à 8 h, fais… ».'),
        h('button', { class: 'btn small primary', onclick: () => { go('#/new'); setTimeout(() => { input.value = 'Tous les jours à 8 h, '; autoGrow(); input.focus(); }, 50); } }, '+ Nouvelle')),
      act.length ? act.map(card) : h('p', { class: 'muted', text: 'Aucune tâche planifiée active.' }),
      old.length ? [h('h4', { class: 'muted', text: 'Terminées ou annulées' }), old.slice(-20).reverse().map(card)] : null,
    ];
  },
  async memoire() {
    let items = [];
    try { items = (await api(R() + '/contents/memoire/faits?ref=' + S.branch)).filter((x) => x.name.endsWith('.json')); } catch (e) { if (e.status !== 404) throw e; }
    items.sort((a, b) => b.name.localeCompare(a.name));
    const total = items.length; items = items.slice(0, 80);
    const facts = [];
    for (let k = 0; k < items.length; k += 8) {
      const part = await Promise.all(items.slice(k, k + 8).map((it) => rawText(it.path).then((t) => JSON.parse(t)).catch(() => null)));
      facts.push(...part.filter(Boolean));
    }
    const list = h('div', {});
    const draw = (q) => list.replaceChildren(...facts.filter((x) => x.active !== false && (!q || (x.content + ' ' + x.id).toLowerCase().includes(q))).map((x) => h('div', { class: 'card' },
      h('div', { class: 'row' }, h('div', { class: 'grow kv' }, h('code', { text: x.id }), ' · ' + (x.created ? fmtTime(x.created) : '') + (x.source ? ' · ' + String(x.source).slice(0, 40) : '')),
        h('button', { class: 'btn small danger', onclick: () => runCommand('/oublier ' + x.id, null, false, 'Oublier ce fait ?\n« ' + x.content.slice(0, 160) + ' »') }, 'Oublier')),
      h('p', { text: x.content }))));
    const search = h('input', { type: 'search', placeholder: 'Filtrer la mémoire…', style: null });
    search.className = 'search-in'; search.addEventListener('input', () => draw(search.value.toLowerCase()));
    draw('');
    if (!facts.length) list.replaceChildren(h('p', { class: 'muted', text: 'La mémoire est vide pour l’instant.' }));
    return [h('div', { class: 'card row' }, h('div', { class: 'grow' }, total + ' fait' + (total > 1 ? 's' : '') + ' enregistré' + (total > 1 ? 's' : '') + (total > 80 ? ' (80 plus récents affichés)' : '')),
      h('button', { class: 'btn small', onclick: () => runCommand('/memoire', 'Mot-clé (facultatif)') }, '/memoire')), h('div', { class: 'search' }, search), list];
  },
  async runs() {
    await refreshRuns();
    const st = (r) => RUNNING.has(r.status) ? h('span', { class: 'pill run' }, r.status === 'queued' ? 'en file' : 'en cours') :
      r.conclusion === 'success' ? h('span', { class: 'pill ok' }, 'réussi') : r.conclusion === 'cancelled' ? h('span', { class: 'pill' }, 'arrêté') : r.conclusion === 'skipped' ? h('span', { class: 'pill' }, 'ignoré') : h('span', { class: 'pill err' }, r.conclusion || r.status);
    const runs = S.runs.filter((r) => r.conclusion !== 'skipped');
    return [h('div', { class: 'card row' }, h('div', { class: 'grow' }, 'Exécutions récentes (GitHub Actions). Le journal détaillé est dans ', h('a', { href: ghUrl('/tree/' + S.branch + '/journal'), target: '_blank', rel: 'noopener' }, 'journal/'), '.'),
      h('button', { class: 'btn small', onclick: () => openView('runs') }, '↻')),
    runs.length ? runs.map((r) => {
      const n = (String(r.display_title).match(/#(\d+)/) || [])[1];
      const dur = r.run_started_at ? ((RUNNING.has(r.status) ? Date.now() : new Date(r.updated_at)) - new Date(r.run_started_at)) / 1000 : null;
      return h('div', { class: 'card row' }, h('div', { class: 'grow' }, h('h3', {}, r.display_title || r.name, ' ', st(r)),
        h('div', { class: 'kv' }, r.name + ' · ' + fmtTime(r.created_at) + (dur != null ? ' · ' + fmtDur(dur) : ''))),
        n ? h('button', { class: 'btn small', onclick: () => go('#/c/' + n) }, '#' + n) : null,
        h('a', { class: 'btn small', href: r.html_url, target: '_blank', rel: 'noopener' }, 'Détails ↗︎'));
    }) : h('p', { class: 'muted', text: S.runsDenied ? 'Le jeton n’a pas la permission « Actions : Read-only ».' : 'Aucune exécution récente.' })];
  },
  async reglages() {
    let rl = null; try { rl = (await api('/rate_limit')).resources.core; } catch (e) {}
    const theme = document.documentElement.dataset.theme;
    const notif = 'Notification' in window ? Notification.permission : 'indisponible';
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return [
      h('div', { class: 'card' }, h('h3', { text: '👤 Compte' }), h('p', { class: 'kv' }, 'Connecté : ', h('b', { text: S.me.login }), ' · dépôt ', h('a', { href: ghUrl(), target: '_blank', rel: 'noopener' }, S.repo), ' (branche ' + S.branch + ')'),
        S.perms ? h('p', { class: 'kv', text: 'Accès au dépôt : ' + (S.perms.push ? 'lecture et écriture' : 'lecture seule') }) : null,
        rl ? h('p', { class: 'kv', text: 'Requêtes GitHub restantes : ' + rl.remaining + ' / ' + rl.limit + ' (renouvellement à ' + new Date(rl.reset * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ')' }) : null,
        h('button', { class: 'btn danger', onclick: async () => { if (await confirmBox('Se déconnecter ?', 'Le jeton sera effacé de ce navigateur.', 'Se déconnecter', true)) logout(); } }, 'Se déconnecter')),
      h('div', { class: 'card' }, h('h3', { text: '🎨 Apparence' }), h('div', { class: 'row' },
        h('button', { class: 'btn' + (theme === 'dark' ? ' primary' : ''), onclick: () => { setTheme('dark'); openView('reglages'); } }, '🌙 Sombre'),
        h('button', { class: 'btn' + (theme === 'light' ? ' primary' : ''), onclick: () => { setTheme('light'); openView('reglages'); } }, '☀️ Clair'))),
      h('div', { class: 'card' }, h('h3', { text: '🔔 Notifications' }),
        h('p', { class: 'kv', text: 'Quand une réponse arrive pendant que FSM SI est ouvert : message dans l’app, compteur sur l’icône et notification. Sur iPhone/iPad, les notifications marchent seulement une fois l’app ajoutée à l’écran d’accueil. État : ' + notif + '.' }),
        notif === 'default' ? h('button', { class: 'btn primary', onclick: async () => { await Notification.requestPermission(); openView('reglages'); } }, 'Activer les notifications') : null,
        notif === 'granted' ? h('button', { class: 'btn', onclick: () => notify('FSM SI', 'Test de notification ✓') }, 'Tester') : null),
      h('div', { class: 'card' }, h('h3', { text: '📲 Installer sur l’écran d’accueil' }),
        h('p', { class: 'kv', text: standalone ? 'Déjà installée ✓' : 'Safari : bouton Partager → « Sur l’écran d’accueil ». Chrome/Edge : menu → « Installer l’application ».' })),
      h('div', { class: 'card' }, h('h3', { text: '🧹 Données locales' }), h('p', { class: 'kv', text: 'Brouillons, thème et suivi des messages lus sont gardés dans ce navigateur uniquement.' }),
        h('button', { class: 'btn', onclick: () => { Object.keys(localStorage).filter((k) => k.startsWith('fsmsi.draft.')).forEach((k) => localStorage.removeItem(k)); input.value = ''; toast('Brouillons effacés ✓', 'ok'); } }, 'Effacer les brouillons')),
      h('p', { class: 'muted center', text: 'FSM SI web · interface statique, sans serveur. Code : ' }, h('a', { href: 'https://github.com/' + owner() + '/fsm-si-web', target: '_blank', rel: 'noopener' }, 'fsm-si-web')),
    ];
  },
};

/* ---------------- Notifications ---------------- */
async function notify(title, body, issue) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const data = { issue, url: location.href.split('#')[0] + (issue ? '#/c/' + issue : '') };
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'fsmsi-' + (issue || 'x'), data });
    else new Notification(title, { body, icon: 'icons/icon-192.png' }).onclick = () => { window.focus(); if (issue) go('#/c/' + issue); };
  } catch (e) {}
}

/* ---------------- Boucle de rafraîchissement ---------------- */
function schedule(ms) { clearTimeout(S.timer); S.timer = setTimeout(tick, ms); }
async function tick() {
  if (!S.token || !S.me) return;
  const n = S.current;
  const busy = n && (S.running.has(n) || isAwaiting(n) || S.comments.some((c) => String(c.body).includes(MARK_PROGRESS)));
  const fast = busy || (S.fastUntil && Date.now() < S.fastUntil);
  try {
    if (document.hidden && !fast) { schedule(60000); return; }
    if (fast || Date.now() - S.lastList > 20000) await refreshList();
    if (n && S.view === 'chat' && S.current === n) {
      const comments = await allPages(R() + '/issues/' + n + '/comments');
      if (S.current === n) {
        S.comments = comments;
        const it = S.open.concat(S.closed).find((i) => i.number === n);
        if (it && S.issue && (it.updated_at !== S.issue.updated_at || it.title !== S.issue.title || it.state !== S.issue.state)) {
          S.issue = await api(R() + '/issues/' + n, { accept: 'application/vnd.github.full+json' });
        }
        renderMessages(); if (S.issue) markSeen({ ...S.issue, comments: comments.length });
      }
    }
  } catch (e) { handleErr(e); }
  const busy2 = n && (S.running.has(n) || isAwaiting(n) || S.comments.some((c) => String(c.body).includes(MARK_PROGRESS)));
  schedule(busy2 || (S.fastUntil && Date.now() < S.fastUntil) ? 5000 : 20000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.me) schedule(300); });
setInterval(() => { if (S.view === 'chat' && S.current && !$('#typing').classList.contains('hidden')) updateTyping(true); }, 1000);

/* ---------------- Démarrage ---------------- */
$('#lightbox').addEventListener('click', () => $('#lightbox').classList.add('hidden'));
setTheme(LS.get('theme', 'dark'));
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.open) go('#/c/' + e.data.open); });
}
window.FSMSI = { S, api, send, uploadAll, putFile, attachmentBlock, addFiles }; // pour les tests
if (S.token) start(); else showLogin();
})();
