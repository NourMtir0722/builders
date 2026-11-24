import { createLand, normalizePlace } from './world.js';
import { sampleDesigners, normalizeDesigner, avatarDataURL, COLORS } from './people.js';
import { LAND_PARAMS } from './params.js';
import { PLACE_KINDS, KIND_LABEL } from './places.js';
import { download } from './engine/stage.js';
import { DEFAULT_TIME, LIGHT_PRESETS, lightName } from './tokens.js';
import { mountEditor } from './editor.js';

const $ = (id) => document.getElementById(id);
const STORE = 'builderland:v1';
const embed = new URLSearchParams(location.search).has('embed');

// Default places. Names are plain text. Upload a logo (PNG/SVG) per place to brand it.
const DEFAULT_PLACES = [
  { kind: 'lab', name: 'Claude', color: '#D97757', note: 'The AI lab by the plaza. Drop your favourite model here.', url: 'https://claude.ai' },
  { kind: 'logo', name: 'Figma', color: '#2B2530', note: 'A giant logo landmark. Upload an SVG logo and it becomes a 3D sculpture.', url: 'https://figma.com' },
  { kind: 'hq', name: 'Cursor', color: '#2F5D7C', url: 'https://cursor.com' },
  { kind: 'mall', name: 'Creator Mall', color: '#E4572E', note: 'Twelve bays, a billboard ring and a food-truck row. Its signs come from Build → Signs.' },
  { kind: 'shop', name: 'Framer', color: '#3B82F6', url: 'https://framer.com' },
  { kind: 'shop', name: 'Midjourney', color: '#2B2530' },
  { kind: 'wheel', name: 'Big Wheel', color: '#3B82F6', note: 'Ten gondolas, one per sponsor colour. Turns all day, lit at night.' },
  { kind: 'screen', name: 'Main Street screen', color: '#2B2530', note: 'Loops through every sign in Build → Signs.' },
  { kind: 'billboard', name: 'Your brand here', color: '#F2B705', ink: '#2B2530', note: 'Sponsor slot.' },
];

// The Signs list: one list drives every sponsor surface (mall bays, billboard ring,
// banners, bunting, food trucks, the screen billboard and the blimp). Names only: add official
// logos yourself in Build → Signs.
const DEFAULT_SIGNS = [
  { name: 'Your brand here', color: '#F2B705', ink: '#2B2530', note: 'The blimp is the premium slot. It goes to the first sign.' },
  { name: 'Framer', color: '#3B82F6' }, { name: 'Notion', color: '#2B2530' }, { name: 'Spline', color: '#7B61FF' },
  { name: 'Rive', color: '#E4572E' }, { name: 'Linear', color: '#5C8FD6' }, { name: 'Raycast', color: '#FF6FB5' },
  { name: 'Arc', color: '#17A398' },
];

// ── state (saved in this browser) ──
function load() {
  try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return null; }
}
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { toast('Browser storage is full. Export your land as JSON to keep it.'); }
  }, 300);
}
const saved = load();
const state = {
  title: saved?.title || 'Builderland',
  seed: saved?.seed || 'builderland',
  params: saved?.params || {},
  places: saved?.places || DEFAULT_PLACES,
  mine: saved?.mine || [],
  samples: saved?.samples ?? true,
  map: saved?.map || {},
  props: saved?.props || [],
  signs: saved?.signs || DEFAULT_SIGNS,
};
const builders = () => [...(state.samples ? sampleDesigners() : []), ...state.mine].map(normalizeDesigner);
const landConfig = () => ({ title: state.title, seed: state.seed, params: state.params, places: state.places, builders: builders(), map: state.map, props: state.props, signs: state.signs });

await Promise.race([document.fonts.load('600 64px Fredoka'), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});
const land = createLand($('stage'), landConfig(), { onSelect: showCard });
window.builderland = land;
if (embed) document.body.classList.add('hide-ui');
const refreshHeader = () => { document.title = state.title; };
refreshHeader();
const deep = location.hash.match(/r=([^&]+)/);
// #r=<id> glides to a builder or place; add &snap to jump there at once (handy for screenshots)
if (deep) setTimeout(() => land.focusById(decodeURIComponent(deep[1]), { duration: /snap/.test(location.hash) ? 0 : 1.3 }), 600);

let rebuildTimer = 0;
function rebuild({ now = false, focusId = null, keepCamera = false } = {}) {
  save();
  refreshHeader();
  clearTimeout(rebuildTimer);
  const run = () => land.setConfig(landConfig(), { focusId, keepCamera });
  if (now) run(); else rebuildTimer = setTimeout(run, 350);
}

// ── selection card (builders and places) ──
let current = null;
function showCard(sel) {
  current = sel;
  $('resident').classList.toggle('on', !!sel);
  if (!sel) { history.replaceState(null, '', location.pathname + location.search); return; }
  const d = sel.item;
  const isPlace = sel.type === 'place' || sel.type === 'sign';
  $('resAv').src = isPlace ? placeThumb(d) : avatarDataURL(d);
  $('resName').textContent = d.name;
  $('resRole').textContent = sel.type === 'sign' ? 'Sponsor · the blimp' : isPlace ? KIND_LABEL[d.kind] : d.role;
  $('resBar').style.background = d.color;
  $('resLinks').innerHTML = '';
  if (isPlace && d.url) {
    const a = document.createElement('a');
    a.className = 'btn sm'; a.href = d.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Visit ↗';
    $('resLinks').appendChild(a);
  }
  // Builder links are shown as labels only; they don't navigate anywhere.
  if (!isPlace) for (const l of d.links) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn sm'; b.textContent = l.label;
    $('resLinks').appendChild(b);
  }
  if (isPlace && d.note) { const p = document.createElement('div'); p.className = 'hint'; p.textContent = d.note; $('resLinks').appendChild(p); }
  $('resWork').innerHTML = '';
  if (!isPlace) for (const src of d.images) { const img = document.createElement('img'); img.src = src; img.alt = `${d.name}'s work`; $('resWork').appendChild(img); }
  $('removePlot').hidden = isPlace || d.sample;
  if (d.id) history.replaceState(null, '', `${location.pathname}${location.search}#r=${encodeURIComponent(d.id)}`);
}
function placeThumb(p) {
  if (p.logo) return p.logo;
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = p.color; g.fillRect(0, 0, 160, 160);
  g.fillStyle = p.ink || '#FFFDF6'; g.font = '600 64px Fredoka, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(p.name.slice(0, 2), 80, 86);
  return c.toDataURL();
}
$('closeRes').onclick = () => land.unfocus();
$('cardPlot').onclick = () => shareCard();
$('copyPlot').onclick = async () => { await navigator.clipboard?.writeText(location.href).catch(() => {}); toast('Link copied. It opens straight here.'); };
$('removePlot').onclick = () => {
  if (current?.type !== 'builder') return;
  state.mine = state.mine.filter((d) => d.id !== current.item.id);
  land.unfocus();
  rebuild({ now: true });
  toast('Plot removed');
};

// ── editor ──
const editor = mountEditor({
  land, state, toast, panel: $('editor'),
  commit: () => rebuild({ now: true, keepCamera: true }),
  onToggle: (on) => { document.body.classList.toggle('editing', on); if (on) $('build').classList.remove('on'); },
});
$('tEdit').onclick = () => editor.toggle();
// The same state and panels a person uses, for scripting the land from the console (tests, demo recordings)
window.builderlandUI = { state, editor, rebuild, landConfig, setTab: (t) => { activeTab = t; renderTab(); }, DEFAULT_PLACES };

// ── toolbar ──
$('tOverview').onclick = () => land.unfocus();
$('tourBtn').onclick = () => land.tour();
$('tLight').onclick = () => {
  const night = (state.params.time ?? DEFAULT_TIME) < 0.7;
  state.params.time = night ? 0.92 : DEFAULT_TIME;
  land.setTime(state.params.time);
  $('lightIcon').textContent = night ? '☀' : '☾';
  $('lightLabel').textContent = night ? 'Golden' : 'Night';
  save();
  if (activeTab === 'Light') renderTab();
};
$('tRecord').onclick = async () => {
  if (land.busy) return;
  document.body.classList.add('recording');
  try { await land.record('16:9'); toast('Video saved to your downloads'); } catch (e) { toast(e.message); } finally { document.body.classList.remove('recording'); }
};
$('tBuild').onclick = () => { if (editor.open) editor.toggle(false); $('build').classList.toggle('on'); renderTab(); };
$('closeBuild').onclick = () => $('build').classList.remove('on');

// find
$('tFind').onclick = () => { $('find').classList.toggle('on'); $('findInput').focus(); renderFind(); };
$('findInput').addEventListener('input', renderFind);
function renderFind() {
  const q = $('findInput').value.trim().toLowerCase();
  const rows = [
    ...land.config.places.map((p, i) => ({ id: p.id, name: p.name, sub: KIND_LABEL[p.kind], img: placeThumb(p), go: () => land.focusPlace(i) })),
    ...builders().map((d, i) => ({ id: d.id, name: d.name, sub: d.role, img: avatarDataURL(d, 60), go: () => land.focusBuilder(i) })),
  ].filter((r) => !q || r.name.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q)).slice(0, 40);
  $('findList').innerHTML = '';
  for (const r of rows) {
    const li = document.createElement('li');
    li.innerHTML = `<img alt="" src="${r.img}"><span>${esc(r.name)}<br><small>${esc(r.sub)}</small></span>`;
    li.onclick = () => { $('find').classList.remove('on'); r.go(); };
    $('findList').appendChild(li);
  }
}

// ── Build panel ──
const TABS = ['Land', 'Life', 'Nature', 'Light', 'Drawing', 'Places', 'Signs', 'Save'];
let activeTab = 'Land';
const tabsEl = document.querySelector('#build .btabs');
for (const t of TABS) {
  const b = document.createElement('button');
  b.textContent = t;
  b.setAttribute('role', 'tab');
  b.onclick = () => { activeTab = t; renderTab(); };
  tabsEl.appendChild(b);
}
const paramValue = (p) => land.config.params[p.key];
function fmt(p, v) {
  if (p.type !== 'range') return '';
  if (p.key === 'time') return lightName(v);
  if (p.key === 'sun') return `${v}°`;
  return Number.isInteger(p.step) ? String(v) : (+v).toFixed(2);
}
function control(p) {
  const v = paramValue(p);
  const row = document.createElement('div');
  row.className = 'ctl';
  row.innerHTML = `<span>${p.label}</span>${p.type === 'range'
    ? `<span class="val">${fmt(p, v)}</span><input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${v}" aria-label="${p.label}">`
    : p.type === 'select' ? `<select aria-label="${p.label}">${p.options.map((o) => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`
      : p.type === 'color' ? `<input type="color" value="${v}" aria-label="${p.label}">`
        : `<input type="checkbox" ${v ? 'checked' : ''} aria-label="${p.label}">`}`;
  const inp = row.querySelector('input, select');
  const out = row.querySelector('.val');
  let t = 0;
  inp.addEventListener('input', () => {
    const val = p.type === 'toggle' ? inp.checked : p.type === 'range' ? +inp.value : inp.value;
    state.params[p.key] = val;
    if (out) out.textContent = fmt(p, val);
    save();
    clearTimeout(t);
    t = setTimeout(() => land.setParams({ [p.key]: val }), p.type === 'range' ? 120 : 0);
  });
  return row;
}
function renderTab() {
  for (const b of tabsEl.children) b.setAttribute('aria-selected', b.textContent === activeTab);
  const body = $('buildBody');
  body.innerHTML = '';
  if (activeTab === 'Places') return renderPlaces(body);
  if (activeTab === 'Save') return renderSave(body);
  if (activeTab === 'Signs') { renderSigns(body); for (const p of LAND_PARAMS.filter((q) => q.group === 'Signs')) body.appendChild(control(p)); return; }
  if (activeTab === 'Light') {
    const pr = document.createElement('div'); pr.className = 'presets';
    for (const [n, t] of Object.entries(LIGHT_PRESETS).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), v])) {
      const b = document.createElement('button'); b.className = 'btn sm'; b.textContent = n;
      b.onclick = () => { state.params.time = t; land.setTime(t); save(); renderTab(); };
      pr.appendChild(b);
    }
    body.appendChild(pr);
  }
  if (activeTab === 'Nature') {
    const pr = document.createElement('div'); pr.className = 'presets';
    for (const s of ['spring', 'summer', 'autumn', 'winter']) {
      const b = document.createElement('button'); b.className = 'btn sm'; b.textContent = s[0].toUpperCase() + s.slice(1);
      b.onclick = () => { state.params.season = s; land.setParams({ season: s }); save(); renderTab(); };
      pr.appendChild(b);
    }
    body.appendChild(pr);
  }
  if (activeTab === 'Land') {
    const f = document.createElement('label'); f.className = 'field';
    f.innerHTML = 'Land name<input type="text" maxlength="32">';
    const inp = f.querySelector('input'); inp.value = state.title;
    inp.oninput = () => { state.title = inp.value || 'Builderland'; rebuild(); };
    const sd = document.createElement('label'); sd.className = 'field';
    sd.innerHTML = 'Seed <span class="hint">(same seed, same land)</span><div style="display:flex;gap:6px"><input type="text" maxlength="40"><button class="btn sm" type="button">🎲</button></div>';
    const si = sd.querySelector('input'); si.value = state.seed;
    si.oninput = () => { state.seed = si.value || 'builderland'; rebuild(); };
    sd.querySelector('button').onclick = () => { state.seed = `land-${Math.floor(Math.random() * 9000 + 1000)}`; si.value = state.seed; rebuild({ now: true }); };
    body.append(f, sd);
  }
  for (const p of LAND_PARAMS.filter((q) => q.group === activeTab)) body.appendChild(control(p));
}

function renderPlaces(body) {
  body.insertAdjacentHTML('beforeend', '<div class="hint">Buildings for tools, sponsors and friends. AI labs, logo landmarks and HQs take a whole block around the plaza. Shops and billboards take a lot. Upload a PNG or SVG logo. SVGs become 3D sculptures on logo landmarks.</div>');
  state.places.forEach((pl, i) => {
    const el = document.createElement('div');
    el.className = 'place';
    el.innerHTML = `
      <div class="ph"><input data-k="name" value="${esc(pl.name)}" aria-label="Place name"><button title="Go there" data-act="go">↗</button><button title="Remove" data-act="rm">×</button></div>
      <div class="pg">
        <label>Kind<select data-k="kind">${PLACE_KINDS.map((k) => `<option value="${k}" ${k === pl.kind ? 'selected' : ''}>${KIND_LABEL[k]}</option>`).join('')}</select></label>
        <label>Colour<input type="color" data-k="color" value="${pl.color || '#E4572E'}"></label>
        <label class="wide">Link<input data-k="url" value="${esc(pl.url || '')}" placeholder="https://…"></label>
        <label class="wide">Note<input data-k="note" value="${esc(pl.note || '')}" placeholder="Shown on its card"></label>
        <label class="wide">Logo (PNG or SVG)<input type="file" data-act="logo" accept="image/png,image/jpeg,image/svg+xml,.svg"></label>
      </div>`;
    for (const inp of el.querySelectorAll('[data-k]')) {
      inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
        state.places[i] = { ...state.places[i], [inp.dataset.k]: inp.value };
        rebuild({ now: inp.tagName === 'SELECT' });
      });
    }
    el.querySelector('[data-act=rm]').onclick = () => { state.places.splice(i, 1); rebuild({ now: true }); renderTab(); };
    el.querySelector('[data-act=go]').onclick = () => land.focusPlace(i);
    el.querySelector('[data-act=logo]').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const isSvg = f.type === 'image/svg+xml' || f.name.endsWith('.svg');
      const text = isSvg ? await f.text() : '';
      const url = isSvg ? `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}` : await shrink(f, 512);
      state.places[i] = { ...state.places[i], logo: url, svg: isSvg ? text : '' };
      rebuild({ now: true, focusId: normalizePlace(state.places[i], i).id });
      toast(isSvg ? 'SVG logo extruded into 3D on landmarks ✿' : 'Logo added');
    };
    body.appendChild(el);
  });
  const add = document.createElement('div');
  add.className = 'presets';
  for (const k of PLACE_KINDS) {
    const b = document.createElement('button'); b.className = 'btn sm'; b.textContent = `+ ${KIND_LABEL[k]}`;
    b.onclick = () => {
      const pl = { kind: k, name: `New ${KIND_LABEL[k].toLowerCase()}`, color: COLORS[state.places.length % COLORS.length] };
      state.places.push(pl);
      rebuild({ now: true, focusId: normalizePlace(pl, state.places.length - 1).id });
      renderTab();
    };
    add.appendChild(b);
  }
  body.appendChild(add);
}

// ── Signs: one list drives every banner, bay, billboard, gondola, truck and the blimp ──
function renderSigns(body) {
  body.insertAdjacentHTML('beforeend', '<div class="hint">One list rebrands the whole land: mall bays and its billboard ring, banners, bunting, food trucks, the screen billboard, gondola colours and the blimp. The <b>first sign</b> gets the blimp. Use official logo files and keep them unaltered.</div>');
  state.signs.forEach((sg, i) => {
    const el = document.createElement('div');
    el.className = 'place';
    el.innerHTML = `
      <div class="ph"><input data-k="name" value="${esc(sg.name)}" aria-label="Sign name">${i === 0 ? '<span title="Premium slot">🎈</span>' : ''}<button title="Move up" data-act="up" ${i ? '' : 'disabled'}>↑</button><button title="Remove" data-act="rm">×</button></div>
      <div class="pg">
        <label>Colour<input type="color" data-k="color" value="${sg.color || '#E4572E'}"></label>
        <label>Text colour<input type="color" data-k="ink" value="${sg.ink || '#FFFDF6'}"></label>
        <label class="wide">Link<input data-k="url" value="${esc(sg.url || '')}" placeholder="https://…"></label>
        <label class="wide">Logo (PNG or SVG)<input type="file" data-act="logo" accept="image/png,image/jpeg,image/svg+xml,.svg"></label>
      </div>`;
    for (const inp of el.querySelectorAll('[data-k]')) inp.addEventListener('input', () => { state.signs[i] = { ...state.signs[i], [inp.dataset.k]: inp.value }; rebuild({ keepCamera: true }); });
    el.querySelector('[data-act=rm]').onclick = () => { state.signs.splice(i, 1); rebuild({ now: true, keepCamera: true }); renderTab(); };
    el.querySelector('[data-act=up]').onclick = () => { [state.signs[i - 1], state.signs[i]] = [state.signs[i], state.signs[i - 1]]; rebuild({ now: true, keepCamera: true }); renderTab(); };
    el.querySelector('[data-act=logo]').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const isSvg = f.type === 'image/svg+xml' || f.name.endsWith('.svg');
      const url = isSvg ? `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(await f.text())))}` : await shrink(f, 512);
      state.signs[i] = { ...state.signs[i], logo: url };
      rebuild({ now: true, keepCamera: true });
      toast('Logo added to every surface that shows this sign');
    };
    body.appendChild(el);
  });
  const add = document.createElement('div');
  add.className = 'presets';
  add.innerHTML = '<button class="btn sm">+ Add a sign</button>';
  add.firstChild.onclick = () => { state.signs.push({ name: 'New sponsor', color: COLORS[state.signs.length % COLORS.length] }); rebuild({ now: true, keepCamera: true }); renderTab(); };
  body.appendChild(add);
}

function renderSave(body) {
  body.innerHTML = `
    <div class="ctl"><span>Show sample builders</span><input type="checkbox" id="sSamples" ${state.samples ? 'checked' : ''}></div>
    <div class="stack">
      <button class="btn" id="sExport">Export land (.json)</button>
      <label class="btn" style="justify-content:center">Import land (.json)<input type="file" id="sImport" accept="application/json,.json" hidden></label>
      <button class="btn" id="sFilm">▶ Play the film</button>
      <div class="ctl"><span>Film</span><select id="sLen"><option value="short" ${filmShort ? 'selected' : ''}>Short · 20 s, cut every 3 s</option><option value="full" ${filmShort ? '' : 'selected'}>Full · 28 s</option></select></div>
      <div class="ctl"><span>Video format</span><select id="sFormat">${['16:9', '1:1', '4:5', '9:16'].map((f) => `<option ${f === filmFormat ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
      <button class="btn go" id="sExportFilm">Export film (.mp4, frame-perfect)</button>
      <button class="btn" id="sCard">Share card (.png)</button>
      <button class="btn" id="sGlb">Download 3D (.glb)</button>
      <button class="btn" id="sPng">Save picture (.png)</button>
      <button class="btn" id="sReset">Reset to the default land</button>
    </div>
    <div class="hint">Your land saves automatically in this browser. Export it to share it, keep it, or load it into your own copy of the open-source kit.</div>`;
  $('sSamples').onchange = (e) => { state.samples = e.target.checked; rebuild({ now: true }); };
  $('sExport').onclick = () => download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), `${state.title.replace(/\W+/g, '-').toLowerCase() || 'land'}.json`);
  $('sImport').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      Object.assign(state, { title: data.title || 'Builderland', seed: data.seed || 'builderland', params: data.params || {}, places: data.places || [], mine: data.mine || data.builders || [], samples: data.samples ?? false, map: data.map || {}, props: data.props || [], signs: data.signs || DEFAULT_SIGNS });
      rebuild({ now: true });
      editor.resetHistory();
      renderTab();
      toast(`Loaded ${state.title}`);
    } catch { toast('That file is not a land export'); }
  };
  $('sFormat').onchange = (e) => (filmFormat = e.target.value);
  $('sLen').onchange = (e) => (filmShort = e.target.value === 'short');
  $('sFilm').onclick = () => { $('build').classList.remove('on'); document.body.classList.add('recording'); land.playFilm(filmShort).finally(() => document.body.classList.remove('recording')); };
  $('sExportFilm').onclick = exportFilm;
  $('sCard').onclick = () => shareCard();
  $('sGlb').onclick = () => land.exportGLB();
  $('sPng').onclick = () => land.savePNG();
  $('sReset').onclick = () => {
    Object.assign(state, { title: 'Builderland', seed: 'builderland', params: {}, places: DEFAULT_PLACES, samples: true, map: {}, props: [], signs: DEFAULT_SIGNS });
    rebuild({ now: true });
    editor.resetHistory();
    renderTab();
  };
}

// ── film export and share cards ──
let filmFormat = '16:9';
let filmShort = true;
async function exportFilm() {
  $('build').classList.remove('on');
  document.body.classList.add('recording');
  toast('Rendering the film frame by frame. Keep this tab open.');
  try {
    await land.exportFilm(filmFormat, (p) => { $('toast').textContent = `Rendering the film… ${Math.round(p * 100)}%`; $('toast').classList.add('show'); }, { short: filmShort });
    toast('Film saved to your downloads');
  } catch (e) { toast(e.message); } finally { document.body.classList.remove('recording'); }
}

/** A 1200×630 card for posting: the current view, the land's name, and the selected builder if any. */
async function shareCard() {
  const W = 1200, H = 630;
  const shot = land.snapshot(W, H);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(shot, 0, 0);
  const ink = '#2B2530', paper = '#FBF5E8';
  const card = (x, y, w, h) => { g.fillStyle = 'rgba(43,37,48,0.85)'; g.beginPath(); g.roundRect(x, y + 6, w, h, 22); g.fill(); g.fillStyle = paper; g.strokeStyle = ink; g.lineWidth = 5; g.beginPath(); g.roundRect(x, y, w, h, 22); g.fill(); g.stroke(); };
  const sel = current?.type === 'builder' ? current.item : null;
  g.textBaseline = 'alphabetic';
  if (sel) {
    card(40, H - 210, 560, 170);
    const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = avatarDataURL(sel, 240); });
    if (img) { g.save(); g.beginPath(); g.roundRect(64, H - 186, 122, 122, 16); g.clip(); g.drawImage(img, 64, H - 186, 122, 122); g.restore(); g.strokeStyle = ink; g.lineWidth = 4; g.beginPath(); g.roundRect(64, H - 186, 122, 122, 16); g.stroke(); }
    g.fillStyle = '#7D7164'; g.font = '500 24px Fredoka, system-ui'; g.fillText(`Come find me in ${state.title}`, 210, H - 150);
    g.fillStyle = ink; g.font = '600 46px Fredoka, system-ui'; g.fillText(sel.name.slice(0, 22), 210, H - 98);
    g.fillStyle = sel.color; g.fillRect(210, H - 82, 120, 10);
    g.fillStyle = '#7D7164'; g.font = '500 24px Fredoka, system-ui'; g.fillText(sel.role, 344, H - 72);
  } else {
    card(40, H - 190, 600, 150);
    g.fillStyle = ink; g.font = '600 56px Fredoka, system-ui'; g.fillText(state.title, 70, H - 110);
    g.fillStyle = '#7D7164'; g.font = '500 26px Fredoka, system-ui'; g.fillText(`${builders().length} builders live here`, 72, H - 66);
  }
  card(W - 330, 30, 290, 58);
  g.fillStyle = ink; g.font = '500 24px Fredoka, system-ui'; g.fillText('✿ made with Builderland', W - 306, 68);
  c.toBlob((b) => b && download(b, `${(sel ? sel.name : state.title).replace(/\W+/g, '-').toLowerCase()}-card.png`), 'image/png');
  toast('Share card saved');
}

function shrink(file, max) {
  return new Promise((res) => {
    if (!file) return res('');
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85));
    };
    img.onerror = () => res('');
    img.src = url;
  });
}

addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select')) return;
  if (e.key === 'Escape') { $('find').classList.remove('on'); land.unfocus(); }
  if (e.key === 'h' || e.key === 'H') document.body.classList.toggle('hide-ui');
  if (e.key === 'b' || e.key === 'B') $('tBuild').click();
  if ((e.key === 'e' || e.key === 'E') && !editor.open) editor.toggle(true);
});

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
let tt = 0;
function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 3200);
}
