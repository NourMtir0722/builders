// Builderland: a procedural, hand-drawn isometric land. Builders get garden plots,
// tools and sponsors get buildings, and every knob (size, nature, season, light, drawing) is live.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { createStage, download } from './engine/stage.js';
import { addMoebius } from './engine/moebius.js';
import { addInk, toon, scribbleWater } from './engine/ink.js';
import { createRng } from './engine/rng.js';
import { tagSprite } from './engine/label.js';
import { toGLB } from './engine/export.js';
import { normalizeDesigner } from './people.js';
import { landParams, SEASONS } from './params.js';
import { buildPlace, panda, KIND_SIZE, PLACE_KINDS } from './places.js';
import { templates, lantern, welcomeSign, builderPlot, bench, buildProp } from './props.js';
import { createTraffic } from './traffic.js';
import { blimp, bunting } from './signs.js';
import { mergeStatic, splitMultiMaterial } from './merge.js';
import { createFolk, folkLook, builderLook } from './folk.js';
import { playground, carousel, bandstand, skateBowl, picnic, hotSpring, cat } from './park.js';
import { PAPER, GROUND, MAT, ACCENTS, LANTERN_GLOW, applyLight as lightStage } from './tokens.js';

const P = 6;             // parcel pitch in tiles (5 interior + 1 path)
const STEP = 0.42;       // height of one terrace level
const BOTTOM = -1.7;     // bottom of the diorama slab
const DIR = new THREE.Vector3(1, 1.12, 1).normalize();
const PATH = GROUND.path;
const PLAZA = GROUND.plaza;
const LIVE = new Set(['time', 'sun', 'lanternColor', 'line', 'wobble', 'hatch', 'grain', 'style']);
const KIND_TAG = { lab: 'AI lab', logo: 'Landmark', hq: 'HQ', mall: 'Mall', wheel: 'Ferris wheel', shop: 'Shop', billboard: 'Billboard' };

export function normalizePlace(p, i = 0) {
  return {
    id: p.id || `place-${i}-${String(p.name || 'place').toLowerCase().replace(/\W+/g, '-')}`,
    kind: PLACE_KINDS.includes(p.kind) ? p.kind : 'shop',
    name: String(p.name || 'Place').slice(0, 40),
    color: /^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color : '#E4572E',
    ink: p.ink || '',
    logo: p.logo || '',
    svg: p.svg || '',
    note: String(p.note || '').slice(0, 200),
    url: /^https?:\/\//.test(p.url || '') ? p.url : '',
    slots: (p.slots || []).slice(0, 12),
    facade: p.facade || '',
  };
}

export function normalizeLand(cfg = {}) {
  return {
    title: String(cfg.title || 'Builderland').slice(0, 32),
    seed: String(cfg.seed || 'builderland'),
    params: landParams(cfg.params),
    builders: (cfg.builders || cfg.designers || []).map(normalizeDesigner),
    places: (cfg.places || []).map(normalizePlace),
    // hand edits: parcel brushes keyed by "i,j", and single props
    map: Object.fromEntries(Object.entries(cfg.map || {}).filter(([k, v]) => /^-?\d+,-?\d+$/.test(k) && (BRUSHES.includes(v) || /^place:/.test(v)))),
    props: (cfg.props || []).filter((q) => PROP_TYPES.includes(q?.type) && Number.isFinite(q.x) && Number.isFinite(q.z)).slice(0, 600)
      .map((q) => ({ type: q.type, x: +q.x, z: +q.z, rot: +q.rot || 0, ...(q.model ? { model: String(q.model) } : {}), ...(q.sign != null ? { sign: +q.sign || 0 } : {}) })),
    signs: (cfg.signs || []).slice(0, 24).map((g, i) => ({
      name: String(g.name || 'Your brand').slice(0, 40), color: /^#[0-9a-f]{6}$/i.test(g.color || '') ? g.color : ACCENTS[i % ACCENTS.length],
      ink: g.ink || '', logo: g.logo || '', url: /^https?:\/\//.test(g.url || '') ? g.url : '', note: String(g.note || '').slice(0, 200),
    })),
  };
}

/** Parcel brushes for the editor. 'road' paints a road block, 'none' erases. */
export const BRUSHES = ['forest', 'meadow', 'grove', 'park', 'pond', 'ruins', 'road', 'plaza', 'lots', 'none'];
/** Single props for the editor. */
export const PROP_TYPES = ['tree', 'pine', 'bush', 'flowers', 'bench', 'lamp', 'banner', 'billboard', 'car', 'capybara', 'cat', 'person'];

function spiral(n) {
  const out = [[0, 0]];
  for (let r = 1; out.length < n; r++) {
    let x = r, z = -r + 1;
    const push = (a, b) => out.length < n && out.push([a, b]);
    for (; z <= r; z++) push(x, z);
    for (z = r, x = r - 1; x >= -r; x--) push(x, z);
    for (x = -r, z = r - 1; z >= -r; z--) push(x, z);
    for (z = -r, x = -r + 1; x <= r; x++) push(x, z);
  }
  return out;
}

/** Deterministic layout: landmarks ring the plaza, then shops, then builders' plots, with nature in between. */
function layout(cfg) {
  const prm = cfg.params;
  const map = cfg.map || {};
  // places pinned to a cell by the editor ("place:<id>") skip the automatic layout
  const pinned = new Map();
  for (const [k, v] of Object.entries(map)) {
    if (!v.startsWith('place:')) continue;
    const idx = cfg.places.findIndex((p) => p.id === v.slice(6));
    if (idx >= 0 && KIND_SIZE[cfg.places[idx].kind] !== 'half' && ![...pinned.values()].includes(idx)) pinned.set(k, idx);
  }
  const isPinned = (i) => [...pinned.values()].includes(i);
  const full = cfg.places.map((p, i) => ({ p, i })).filter(({ p, i }) => KIND_SIZE[p.kind] === 'full' && !isPinned(i));
  const xl = cfg.places.map((p, i) => ({ p, i })).filter(({ p, i }) => KIND_SIZE[p.kind] === 'xl' && !isPinned(i));
  const half = cfg.places.map((p, i) => ({ p, i })).filter(({ p }) => KIND_SIZE[p.kind] === 'half');
  const inner = [];
  let lots = 0, extra = 0, fi = 0;
  const needLots = half.length + cfg.builders.length;
  const decoRng = createRng(`${cfg.seed}:deco`);
  const weights = [['pond', prm.ponds], ['ruins', prm.ruins], ['grove', 0.6], ['meadow', 0.6], ['park', prm.parks]];
  const pickDeco = () => {
    const total = weights.reduce((s, w) => s + w[1], 0) || 1;
    let r = decoRng.next() * total;
    for (const [t, w] of weights) if ((r -= w) <= 0) return t;
    return 'meadow';
  };
  const cells = spiral(900);
  // XL places claim a 2×2 block of parcels first, as close to the plaza as it fits
  const claimed = new Map();
  const BLOCK = [[0, 0], [1, 0], [0, 1], [1, 1]];
  for (const [k, idx] of pinned) {
    const [i, j] = k.split(',').map(Number);
    const entry = { p: cfg.places[idx], i: idx };
    if (KIND_SIZE[entry.p.kind] === 'xl') BLOCK.forEach(([a, b], n) => claimed.set(`${i + a},${j + b}`, n === 0 ? { ...entry, span: 2 } : null));
    else claimed.set(k, { ...entry, span: 1 });
  }
  for (const x of xl) {
    const at = cells.slice(1).find(([i, j]) => BLOCK.every(([a, b]) => !(i + a === 0 && j + b === 0) && !claimed.has(`${i + a},${j + b}`) && !map[`${i + a},${j + b}`]));
    const block = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => [at[0] + a, at[1] + b]);
    block.forEach(([i, j], n) => claimed.set(`${i},${j}`, n === 0 ? { ...x, span: 2 } : null));
  }
  let xlLeft = xl.length;
  const pushed = new Set();
  for (let k = 0; k < cells.length; k++) {
    const placed = fi >= full.length && xlLeft === 0 && lots >= needLots && inner.length >= 9;
    if (placed && extra >= prm.size) break;
    const [i, j] = cells[k];
    const ck = `${i},${j}`;
    if (claimed.has(ck)) {
      const x = claimed.get(ck);
      if (x) { inner.push({ i, j, k, type: 'place', place: x, span: x.span }); pushed.add(ck); if (x.span === 2 && !isPinned(x.i)) xlLeft--; }
      continue;
    }
    if (map[ck]) {
      const v = map[ck];
      if (v !== 'none' && !v.startsWith('place:')) { inner.push({ i, j, k, type: v === 'road' ? 'roadblock' : v, painted: true }); if (v === 'lots') lots += 2; }
      pushed.add(ck);
      continue;
    }
    let parcel;
    if (k === 0) parcel = { type: 'plaza' };
    else if (fi < full.length && (k % 2 === 1 || k > 8)) parcel = { type: 'place', place: full[fi++] };
    else if (k % 3 === 2 || placed) { parcel = { type: pickDeco() }; if (placed) extra++; }
    else { parcel = { type: 'lots' }; lots += 2; }
    inner.push({ i, j, k, ...parcel });
    pushed.add(ck);
  }
  // pinned places and painted cells past the automatic edge grow the land
  for (const [ck, x] of claimed) if (x && !pushed.has(ck)) { const [i, j] = ck.split(',').map(Number); inner.push({ i, j, k: 1e4, type: 'place', place: x, span: x.span }); }
  for (const [ck, v] of Object.entries(map)) {
    if (pushed.has(ck) || claimed.has(ck) || v === 'none' || v.startsWith('place:')) continue;
    const [i, j] = ck.split(',').map(Number);
    inner.push({ i, j, k: 1e4, type: v === 'road' ? 'roadblock' : v, painted: true });
    if (v === 'lots') lots += 2;
  }
  // builders always get a plot: add lots at the edge if painting took them away
  for (let k = 0, extraLots = 0; lots < needLots && k < cells.length; k++) {
    const ck = cells[k].join(',');
    if (pushed.has(ck) || claimed.has(ck) || map[ck] || inner.some((p) => p.i === cells[k][0] && p.j === cells[k][1])) continue;
    inner.push({ i: cells[k][0], j: cells[k][1], k: 2e4 + extraLots++, type: 'lots' });
    lots += 2;
  }
  const erased = Object.entries(map).filter(([, v]) => v === 'none').map(([k]) => k);
  const used = new Set([...inner.map((p) => `${p.i},${p.j}`), ...claimed.keys(), ...erased]);
  const fringe = [];
  const own = (p) => (p.span === 2 ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]]).map(([a, b]) => [p.i + a, p.j + b]);
  if (prm.fringe) for (const p of inner) for (const [ci, cj] of own(p)) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const key = `${ci + di},${cj + dj}`;
    if (!used.has(key)) { used.add(key); fringe.push({ i: ci + di, j: cj + dj, type: 'forest' }); }
  }
  return { inner, fringe, half };
}

export function createLand(container, config, { onSelect } = {}) {
  const stage = createStage(container, { tilt: 0, fov: 14 });
  const { scene, overlay, camera, controls, hemi, sun, renderer } = stage;
  const moebius = addMoebius(stage, { light: sun });
  const ink = addInk(stage);
  scene.background = new THREE.Color(PAPER);
  scene.fog = null;
  controls.maxPolarAngle = 1.15;

  let cfg = normalizeLand(config);
  let world = null;
  let busy = false;
  let selected = null;
  let hovered = null;
  const look = new THREE.Vector3();
  const lampMat = new THREE.MeshStandardMaterial({ color: '#FFF3D6', emissive: LANTERN_GLOW, emissiveIntensity: 0 });
  const light = { t: cfg.params.time };

  // ── light: dawn → day → golden → dusk → night (presets live in tokens.js) ──
  function applyLight() {
    const fit = world ? { center: world.box.getCenter(new THREE.Vector3()), radius: world.box.getSize(new THREE.Vector3()).length() / 2 + 4 } : {};
    const glow = lightStage(stage, light.t, cfg.params.sun, fit);
    lampMat.emissive.set(cfg.params.lanternColor);
    lampMat.emissiveIntensity = glow * 2.6;
    if (world) {
      for (const m of world.glow) m.emissiveIntensity = glow * 0.9;
      if (world.fireflies) world.fireflies.material.opacity = Math.max(0, glow - 0.45) * 1.6;
    }
  }
  function applyDrawing() {
    const p = cfg.params;
    moebius.enabled = p.style === 'moebius';
    ink.enabled = p.style === 'ink';
    const u = moebius.uniforms;
    u.thickness.value = p.line;
    u.amplitude.value = p.wobble;
    u.hatchStrength.value = p.hatch * 1.7;
    u.hatchLevels.value.set(0.26, 0.38, 0.5);
    u.grain.value = p.grain;
  }

  function clear() {
    if (!world) return;
    scene.remove(world.root);
    overlay.remove(world.tags);
    const seen = new Set();
    for (const r of [world.root, world.tags]) r.traverse((o) => {
      if (!o.userData.sharedGeo) o.geometry?.dispose();
      for (const m of [].concat(o.material || [])) if (m?.userData?.own && !seen.has(m)) { seen.add(m); m.map?.dispose(); m.dispose(); }
    });
    world = null;
  }

  function build(next, { focusId = null, keepCamera = false } = {}) {
    clear();
    cfg = normalizeLand(next);
    const prm = cfg.params;
    const S = SEASONS[prm.season] || SEASONS.summer;
    const rng = createRng(cfg.seed);
    const root = new THREE.Group(); root.name = 'builderland';
    const tags = new THREE.Group();
    scene.add(root);
    overlay.add(tags);
    applyDrawing();

    // ── tiles ──
    const { inner, fringe, half } = layout(cfg);
    const tiles = new Map();
    const key = (x, z) => `${x},${z}`;
    const setTile = (x, z, t) => tiles.set(key(x, z), { x, z, h: 0, type: 'grass', ...tiles.get(key(x, z)), ...t });
    const lotSlots = [];
    const parcels = [];
    for (const p of [...inner, ...fringe]) {
      const bx = p.i * P, bz = p.j * P;
      const isInner = p.type !== 'forest';
      const prng = rng.fork(`parcel:${p.i},${p.j}`);
      const raised = (p.type === 'forest' && prng.chance(prm.hills)) || (p.type === 'meadow' && prng.chance(prm.hills * 0.6));
      const N = (p.span || 1) * P - 1;   // interior tiles: 5, or 11 for an XL block
      for (let x = 1; x <= N; x++) for (let z = 1; z <= N; z++) {
        const t = { type: p.type === 'plaza' ? 'plaza' : p.type === 'place' ? 'yard' : 'grass', parcel: p, h: raised ? 1 : 0, stair: 0 };
        if (p.type === 'ruins') t.h = x >= 2 && x <= 4 && z >= 2 && z <= 4 ? 2 : 1;
        if (p.type === 'pond' && x >= 2 && x <= 4 && z >= 2 && z <= 4) { t.h = -1; t.type = 'pond'; }
        if (p.type === 'roadblock') { t.h = 0; if (x === 3 || z === 3) { t.type = 'path'; t.forceRoad = true; t.parcel = null; } }
        if (p.type === 'place' && p.place.p.kind === 'logo' && (x === 1 || x === N || z === 1 || z === N)) t.type = 'grass';
        setTile(bx + x, bz + z, t);
      }
      for (let s = 0; s <= N + 1; s++) for (const [x, z] of [[bx + s, bz], [bx + s, bz + N + 1], [bx, bz + s], [bx + N + 1, bz + s]]) {
        if (isInner) setTile(x, z, { type: 'path', h: 0, parcel: null, stair: 0, ...(p.type === 'roadblock' ? { forceRoad: true } : {}) });
        else if (!tiles.has(key(x, z))) setTile(x, z, { type: 'grass', parcel: p, h: raised ? 1 : 0 });
      }
      if (p.type === 'ruins') { setTile(bx + 3, bz + 5, { stair: 1, h: 0 }); setTile(bx + 3, bz + 4, { stair: 2, h: 1 }); }
      if (p.type === 'meadow' && raised) setTile(bx + 3, bz + 5, { stair: 1, h: 0 });
      if (p.type === 'lots') lotSlots.push({ x0: bx + 1, z0: bz + 4 }, { x0: bx + 4, z0: bz + 4 });
      parcels.push({ ...p, bx, bz, raised, c: (N + 2) / 2 });
    }
    // lots: shops & billboards first, then builders
    const lotUse = [...half.map((h) => ({ kind: 'place', ...h })), ...cfg.builders.map((d, i) => ({ kind: 'builder', d, i }))];
    lotUse.forEach((u, n) => {
      const slot = lotSlots[n];
      u.slot = slot;
      for (let x = 0; x < 2; x++) for (let z = 0; z < 2; z++) setTile(slot.x0 + x, slot.z0 + z, u.kind === 'builder' ? { type: 'plot', owner: u.i, h: 0 } : { type: 'yard', h: 0 });
    });
    for (const slot of lotSlots.slice(lotUse.length)) for (let x = 0; x < 2; x++) for (let z = 0; z < 2; z++) setTile(slot.x0 + x, slot.z0 + z, { type: 'grass', h: 0 });

    // ── roads: path tiles near the centre become roads; cars drive their lane graph ──
    const roads = new Set();
    const R = prm.roads;
    if (R > 0) for (const t of tiles.values()) {
      if (t.type === 'path' && t.x >= -R * P && t.x <= (R + 1) * P && t.z >= -R * P && t.z <= (R + 1) * P) { t.type = 'road'; roads.add(key(t.x, t.z)); }
    }
    for (const t of tiles.values()) if (t.forceRoad && t.type === 'path') { t.type = 'road'; roads.add(key(t.x, t.z)); }

    // ── terrain mesh ──
    const pos = [], nor = [], col = [];
    const cTmp = new THREE.Color();
    const quad = (a, b, c, d, nrm, color) => {
      cTmp.set(color);
      for (const v of [a, b, c, a, c, d]) { pos.push(...v); nor.push(...nrm); col.push(cTmp.r, cTmp.g, cTmp.b); }
    };
    const hashT = (x, z) => Math.abs(Math.sin(x * 127.1 + z * 311.7) * 43758.5453) % 1;
    const plotTint = new Map(cfg.builders.map((d, i) => [i, new THREE.Color(S.grass[1]).lerp(new THREE.Color(d.color), 0.18)]));
    for (const t of tiles.values()) {
      const y = t.h * STEP;
      const j = hashT(t.x, t.z);
      let top;
      if (t.type === 'path') top = PATH[Math.floor(j * PATH.length)];
      else if (t.type === 'road') top = GROUND.road[Math.floor(j * GROUND.road.length)];
      else if (t.type === 'plaza' || t.type === 'yard') top = PLAZA[Math.floor(j * PLAZA.length)];
      else if (t.type === 'pond') top = GROUND.pond;
      else if (t.type === 'plot') top = `#${plotTint.get(t.owner).clone().offsetHSL(0, 0, (j - 0.5) * 0.04).getHexString()}`;
      else top = S.grass[Math.floor(j * S.grass.length)];
      if (!t.stair) quad([t.x, y, t.z], [t.x, y, t.z + 1], [t.x + 1, y, t.z + 1], [t.x + 1, y, t.z], [0, 1, 0], top);
      const sides = [[1, 0, [t.x + 1, t.z + 1], [t.x + 1, t.z], [1, 0, 0]], [-1, 0, [t.x, t.z], [t.x, t.z + 1], [-1, 0, 0]], [0, 1, [t.x, t.z + 1], [t.x + 1, t.z + 1], [0, 0, 1]], [0, -1, [t.x + 1, t.z], [t.x, t.z], [0, 0, -1]]];
      for (const [dx, dz, a, b, n] of sides) {
        const nb = tiles.get(key(t.x + dx, t.z + dz));
        const ny = nb ? nb.h * STEP : BOTTOM;
        if (ny >= y) continue;
        const lip = Math.min(0.08, y - ny);
        quad([a[0], y, a[1]], [a[0], y - lip, a[1]], [b[0], y - lip, b[1]], [b[0], y, b[1]], n, t.type === 'grass' || t.type === 'plot' ? S.lip : GROUND.lipPath);
        quad([a[0], y - lip, a[1]], [a[0], ny, a[1]], [b[0], ny, b[1]], [b[0], y - lip, b[1]], n, nb ? GROUND.cliff : GROUND.cliffEdge);
      }
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    tg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const terrainMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toon('#fff').gradientMap });
    terrainMat.userData.own = true;
    const terrain = new THREE.Mesh(tg, terrainMat);
    terrain.receiveShadow = terrain.castShadow = true;
    terrain.name = 'terrain';
    root.add(terrain);

    for (const t of tiles.values()) {
      if (!t.stair) continue;
      for (let s = 0; s < 3; s++) {
        const h = ((s + 1) * STEP) / 3;
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.8, h + 0.02, 1 - s / 3), toon(GROUND.steps));
        st.position.set(t.x + 0.5, t.h * STEP + h / 2, t.z + (1 - s / 3) / 2);
        st.castShadow = st.receiveShadow = true;
        root.add(st);
      }
    }

    const waterMat = new THREE.MeshToonMaterial({ map: scribbleWater(prm.season === 'winter' ? GROUND.waterWinter : GROUND.water), gradientMap: toon('#fff').gradientMap, transparent: true, opacity: 0.94 });
    waterMat.userData.own = true;
    const springAt = prm.capybaras ? parcels.find((q) => q.type === 'pond') : null;
    for (const p of parcels.filter((q) => q.type === 'pond' && q !== springAt)) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(3, 3).rotateX(-Math.PI / 2), waterMat);
      w.position.set(p.bx + 3.5, -0.16, p.bz + 3.5);
      w.receiveShadow = true;
      root.add(w);
    }

    // ── flora ──
    const inst = { tree: [], pine: [], bush: [], flower: [], tuft: [], rock: [], mush: [], stone: [], monolith: [], dash: [] };
    const add = (kind, x, y, z, s = 1, color = null) => inst[kind].push({ x, y, z, s, color, r: rng.range(0, Math.PI * 2) });
    const winter = prm.season === 'winter';
    const treeColor = (r) => (winter ? r.pick(['#E9EFF1', '#DCE6EA', '#F2F6F7']) : r.pick(S.leaf));
    const pineColor = (r) => r.pick(winter ? S.leaf : ['#3F6E3A', '#4F7F3E', '#557F40']);
    const TS = prm.treeSize;
    for (const t of tiles.values()) {
      const y = t.h * STEP, cx = t.x + 0.5, cz = t.z + 0.5;
      const r = rng.fork(`t:${t.x},${t.z}`);
      const jx = () => r.range(-0.35, 0.35);
      if (t.type === 'path') { if (r.chance(0.55)) add('stone', cx + jx(), y + 0.01, cz + jx(), r.range(0.8, 1.2)); continue; }
      if (t.type === 'road') {
        // centre dashes on straight stretches
        const ew = roads.has(key(t.x - 1, t.z)) && roads.has(key(t.x + 1, t.z)), ns = roads.has(key(t.x, t.z - 1)) && roads.has(key(t.x, t.z + 1));
        if (ew !== ns) inst.dash.push({ x: cx, y: 0.005, z: cz, s: 1, color: GROUND.roadDash, r: ew ? 0 : Math.PI / 2 });
        continue;
      }
      if (t.type === 'plaza' || t.type === 'yard' || t.type === 'pond' || t.stair) continue;
      const pt = t.parcel?.type;
      if (pt === 'park') { if (r.chance(0.25)) add('tuft', cx + jx(), y, cz + jx(), r.range(0.7, 1.2), S.lip); continue; }
      if (t.type === 'plot') { if (r.chance(0.7 * Math.min(1.5, prm.flowers))) add('flower', cx + jx(), y, cz + jx(), 1, cfg.builders[t.owner].color); continue; }
      const tree = (chance, lo, hi) => {
        if (!r.chance(Math.min(0.95, chance * prm.trees))) return false;
        if (r.chance(winter ? 0.45 : 0.62)) add('tree', cx + jx() * 0.5, y, cz + jx() * 0.5, r.range(lo, hi) * TS, treeColor(r));
        else add('pine', cx + jx() * 0.5, y, cz + jx() * 0.5, r.range(lo, hi) * TS, pineColor(r));
        return true;
      };
      if (pt === 'forest') {
        if (!tree(0.42, 0.7, 1.05) && r.chance(0.5 * prm.bushes)) add('bush', cx + jx(), y, cz + jx(), r.range(0.8, 1.3), treeColor(r));
        if (r.chance(0.2 * prm.mushrooms)) add('mush', cx + jx(), y, cz + jx(), r.range(0.8, 1.3), r.pick(MAT.mushCap));
      } else if (pt === 'grove') {
        if (!tree(0.3, 0.7, 1.0) && r.chance(0.4 * prm.bushes)) add('bush', cx + jx(), y, cz + jx(), r.range(0.8, 1.2), treeColor(r));
        if (r.chance(0.3 * prm.mushrooms)) add('mush', cx + jx(), y, cz + jx(), 1, MAT.mushCap[0]);
      } else if (pt === 'ruins') {
        if (t.h === 2 && r.chance(0.3)) add('monolith', cx + jx() * 0.4, y, cz + jx() * 0.4, r.range(0.8, 1.3), MAT.monolith);
        if (r.chance(0.25)) add('rock', cx + jx(), y, cz + jx(), r.range(0.8, 1.4), MAT.rock);
      } else if (pt === 'lots') {
        const back = (((t.z % P) + P) % P) <= 2;
        if (!(back && tree(0.14, 0.6, 0.85)) && r.chance(0.3 * prm.bushes)) add('bush', cx + jx(), y, cz + jx(), r.range(0.7, 1.1), treeColor(r));
      } else if (pt === 'pond') {
        if (r.chance(0.12)) tree(1, 0.6, 0.9);
      }
      if (!winter) {
        const fl = (pt === 'meadow' ? 7 : pt === 'forest' ? 1 : 3) * prm.flowers;
        for (let k = 0; k < Math.ceil(fl); k++) if (r.chance(0.55)) add('flower', cx + jx() * 1.3, y, cz + jx() * 1.3, r.range(0.8, 1.2), r.pick(S.flower));
        for (let k = 0; k < 2; k++) if (r.chance(0.6)) add('tuft', cx + jx() * 1.3, y, cz + jx() * 1.3, r.range(0.7, 1.3), r.pick([S.lip, '#6E9A4E', '#4F7F3E']));
      }
      if (r.chance(0.05)) add('rock', cx + jx(), y, cz + jx(), r.range(0.7, 1.2), MAT.rock);
    }
    const T = templates();
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), cc = new THREE.Color();
    const instanced = (geo, items, colorOf, { cast = true } = {}) => {
      if (!items.length) return null;
      const mat = new THREE.MeshToonMaterial({ gradientMap: toon('#fff').gradientMap });
      mat.userData.own = true;
      const im = new THREE.InstancedMesh(geo, mat, items.length);
      im.userData.sharedGeo = true;
      items.forEach((it, i) => {
        m4.compose(v.set(it.x, it.y, it.z), q.setFromAxisAngle(up, it.r), sv.setScalar(it.s));
        im.setMatrixAt(i, m4);
        im.setColorAt(i, cc.set(colorOf(it)));
      });
      im.castShadow = cast;
      im.receiveShadow = true;
      root.add(im);
      return im;
    };
    instanced(T.trunk, inst.tree, () => MAT.trunk);
    instanced(T.canopy, inst.tree, (it) => it.color);
    instanced(T.pineTrunk, inst.pine, () => MAT.trunk);
    instanced(T.pine, inst.pine, (it) => it.color);
    if (winter) instanced(T.pineSnow, inst.pine, () => '#FFFFFF');
    instanced(T.bush, inst.bush, (it) => it.color);
    instanced(T.stem, inst.flower, () => '#5E8A45', { cast: false });
    instanced(T.flower, inst.flower, (it) => it.color, { cast: false });
    instanced(T.tuft, inst.tuft, (it) => it.color, { cast: false });
    instanced(T.rock, inst.rock, (it) => it.color);
    instanced(T.mushStem, inst.mush, () => MAT.mushStem);
    instanced(T.mushCap, inst.mush, (it) => it.color);
    instanced(T.stone, inst.stone, () => (winter ? GROUND.stoneWinter : GROUND.stone), { cast: false });
    instanced(T.monolith, inst.monolith, (it) => it.color);
    instanced(T.dash, inst.dash, () => GROUND.roadDash, { cast: false });

    // ── plaza: mascot + welcome sign + lanterns ──
    const updates = [];
    const plaza = parcels.find((p) => p.type === 'plaza') || parcels[0];
    const pcx = plaza.bx + 3.5, pcz = plaza.bz + 3.5;
    if (prm.mascot === 'panda') {
      const pd = panda({ pose: prm.pose, scarf: prm.scarf });
      pd.position.set(pcx - 0.2, 0, pcz - 0.5);
      pd.rotation.y = Math.PI / 4;
      root.add(pd);
      updates.push(pd.userData.update);
    } else if (prm.mascot === 'great tree') {
      const great = new THREE.Group();
      great.add(new THREE.Mesh(T.trunk, toon(MAT.trunk)), new THREE.Mesh(T.canopy, toon(winter ? '#E9EFF1' : S.leaf[0])));
      great.children.forEach((m) => { m.castShadow = m.receiveShadow = true; m.userData.sharedGeo = true; });
      great.scale.setScalar(2.1);
      great.position.set(pcx, 0, pcz - 0.4);
      root.add(great);
    }
    const plazaSeats = [];
    for (const [bx2, bz2] of [[-1.9, 1.75], [-0.85, 2.05]]) {
      const b = bench();
      b.position.set(pcx + bx2, 0, pcz + bz2);
      root.add(b);
      for (const s of b.userData.spots.sit) plazaSeats.push({ x: pcx + bx2 + s.x, z: pcz + bz2 + s.z, y: s.y, yaw: s.yaw });
    }
    const sign = welcomeSign(cfg.title, cfg.builders.length);
    sign.position.set(pcx + 1.6, 0, pcz + 1.9);
    root.add(sign);
    const lr = rng.fork('lanterns');
    for (const p of parcels.filter((o) => o.type !== 'forest')) {
      if (!lr.chance(prm.lanterns)) continue;
      const l = lantern(lampMat);
      l.position.set(p.bx + 0.5, 0, p.bz + 0.5);
      root.add(l);
    }

    // ── places ──
    const placeObjs = [];
    const addPlace = (pl, idx, x, z) => {
      // one Signs list drives every sponsor surface; a place's own slots override it
      const slots = pl.slots?.length ? pl.slots : cfg.signs.length ? cfg.signs : cfg.places.filter((o) => o.kind === 'shop' || o.kind === 'billboard').slice(0, 12);
      const g = buildPlace(pl, slots);
      g.position.set(x, 0, z);
      g.userData.place = idx;
      g.name = `${pl.kind}_${pl.name.replace(/\W+/g, '_')}`;
      root.add(g);
      if (g.userData.update) updates.push(g.userData.update);
      const h = g.userData.height || 2;
      const tag = tagSprite({ title: pl.name, subtitle: KIND_TAG[pl.kind], width: 0.024 });
      tag.position.set(x, h + 0.4, z);
      tags.add(tag);
      placeObjs.push({ p: pl, i: idx, group: g, tag, x, z, h });
    };
    for (const pc of parcels.filter((o) => o.type === 'place')) addPlace(pc.place.p, pc.place.i, pc.bx + pc.c, pc.bz + pc.c);
    for (const u of lotUse.filter((o) => o.kind === 'place')) addPlace(u.p, u.i, u.slot.x0 + 1, u.slot.z0 + 1);

    // ── builders' plots ──
    const plotObjs = lotUse.filter((u) => u.kind === 'builder').map((u) => {
      const d = u.d;
      const cx = u.slot.x0 + 1, cz = u.slot.z0 + 1;
      const { group: g, standee, flag } = builderPlot(d, { winter });
      g.position.set(cx, 0, cz);
      g.userData.builder = u.i;
      root.add(g);
      const tag = tagSprite({ title: d.name, subtitle: d.role, width: 0.024 });
      tag.position.set(cx + 0.1, 1.55, cz + 0.1);
      tags.add(tag);
      return { d, i: u.i, cx, cz, group: g, standee, flag, tag };
    });

    // ── signs: bunting across straight streets, the blimp overhead ──
    const spans = inst.dash.filter((d, n) => n % 9 === 4 && prm.bunting).map((d) => ({ x: d.x, z: d.z, axis: d.r === 0 ? 'x' : 'z' }));
    root.add(bunting(spans, cfg.signs));
    let airship = null;
    if (prm.blimp) {
      const lb = new THREE.Box3();
      for (const t of tiles.values()) lb.expandByPoint(v.set(t.x, 0, t.z));
      const sz = lb.getSize(new THREE.Vector3());
      airship = blimp(cfg.signs[0] || { name: cfg.title, color: ACCENTS[0] }, { center: lb.getCenter(new THREE.Vector3()), radius: Math.max(sz.x, sz.z) * 0.36, height: 10.5 });
      root.add(airship);
      updates.push(airship.userData.update);
    }

    // ── traffic ──
    const traffic = createTraffic(roads, rng.fork('traffic'), prm.cars);
    root.add(traffic.group);

    // ── people: sitters and queues at places, a crowd at the mascot, walkers, builder avatars ──
    const life = rng.fork('life');
    const folk = [];
    let budget = prm.people;
    const addFolk = (p, seed) => { if (budget-- > 0) folk.push({ look: folkLook(seed), ...p }); };
    root.updateMatrixWorld(true);
    const sv2 = new THREE.Vector3();
    const spotsOf = (obj, id) => {
      const sp = obj.userData.spots;
      if (!sp) return;
      (sp.sit || []).forEach((s, n) => { if (life.chance(0.75)) { sv2.set(s.x, 0, s.z).applyMatrix4(obj.matrixWorld); addFolk({ act: 'sit', x: sv2.x, z: sv2.z, seatY: s.y, yaw: (s.yaw || 0) + obj.rotation.y }, `${id}:sit:${n}`); } });
      (sp.stand || []).forEach((s, n) => { if (life.chance(0.8)) { sv2.set(s.x, 0, s.z).applyMatrix4(obj.matrixWorld); addFolk({ act: 'idle', x: sv2.x, z: sv2.z, yaw: (s.yaw || 0) + obj.rotation.y }, `${id}:stand:${n}`); } });
    };
    for (const po of placeObjs) spotsOf(po.group, po.p.id);
    plazaSeats.forEach((s, n) => life.chance(0.8) && addFolk({ act: 'sit', x: s.x, z: s.z, seatY: s.y, yaw: s.yaw }, `plaza:${n}`));
    if (prm.mascot !== 'none') {
      const mx = pcx - 0.2, mz = pcz - 0.5;
      for (let k = 0; k < 7; k++) {
        const a = Math.PI / 4 + (k - 3) * 0.3, r = 2.4 + (k % 2) * 0.35;
        const x = mx + Math.cos(a) * r, z = mz + Math.sin(a) * r;
        addFolk({ act: ['wave', 'cheer', 'idle'][k % 3], x, z, yaw: Math.atan2(z - mz, mx - x) }, `crowd:${k}`);
      }
    }
    // parks, the hot spring and rooftop cats
    const featureFolk = (list, ox, oz, id) => list.forEach((f, n) => {
      const look = `${id}:${n}`;
      const base = { scale: f.kid ? 0.72 : 1, ph: f.path ? n * 0.37 : undefined };
      if (f.path) { const path = f.path; addFolk({ ...f, ...base, x: ox, z: oz, yaw: 0, path: (k, t) => { const q = path(k, t); return { ...q, x: ox + q.x, z: oz + q.z }; } }, look); }
      else addFolk({ ...f, ...base, x: ox + f.x, z: oz + f.z, y: f.y || 0, yaw: f.yaw || 0 }, look);
    });
    const parkKinds = [carousel, bandstand, skateBowl, (r) => picnic(r, 2), playground];
    parcels.filter((q) => q.type === 'park').forEach((q, n) => {
      const pr = rng.fork(`park:${q.i},${q.j}`);
      const feat = (n === 0 ? playground : pr.pick(parkKinds))(pr);
      const ox = q.bx + 3.5, oz = q.bz + 3.5;
      feat.group.position.set(ox, 0, oz);
      root.add(feat.group);
      updates.push(...(feat.updates || []));
      featureFolk(feat.folk || [], ox, oz, `park:${q.i},${q.j}`);
      for (const [dx, dz] of [[-2, -2], [2, 2]]) {
        const tr = new THREE.Group();
        tr.add(new THREE.Mesh(T.trunk, toon(MAT.trunk)), new THREE.Mesh(T.canopy, toon(winter ? '#E9EFF1' : S.leaf[1])));
        tr.children.forEach((m) => { m.castShadow = m.receiveShadow = true; m.userData.sharedGeo = true; });
        tr.position.set(ox + dx, 0, oz + dz); tr.scale.setScalar(0.85);
        root.add(tr);
      }
    });
    if (springAt) {
      const hs = hotSpring(rng.fork('spring'));
      hs.group.position.set(springAt.bx + 3.5, 0, springAt.bz + 3.5);
      root.add(hs.group);
      updates.push(...hs.updates);
      for (const [k, [dx, dz]] of [[1.9, 1.2], [1.4, 1.9]].entries()) addFolk({ act: 'idle', x: springAt.bx + 3.5 + dx, z: springAt.bz + 3.5 + dz, yaw: Math.atan2(dz, -dx) }, `spring:${k}`);
    }
    if (prm.cats) {
      const fur = ['#F2994A', '#2B2530', '#F3E9D8', '#9C8E80'];
      let k = 0;
      for (const po of placeObjs) for (const s of po.group.userData.spots?.roof || []) {
        const c = cat(fur[k % fur.length], { sleeping: k % 2 === 0 });
        sv2.set(s.x, s.y, s.z).applyMatrix4(po.group.matrixWorld);
        c.position.copy(sv2); c.rotation.y = s.yaw + po.group.rotation.y;
        c.scale.setScalar(1.6);
        root.add(c);
        const kk = k++;
        updates.push((t) => c.userData.update(t, kk));
      }
    }
    // ── hand-placed props ──
    const propsG = new THREE.Group();
    propsG.name = 'props';
    root.add(propsG);
    cfg.props.forEach((pr, n) => {
      const y = (tiles.get(key(Math.floor(pr.x), Math.floor(pr.z)))?.h || 0) * STEP;
      if (pr.type === 'person') { folk.push({ look: folkLook(`prop:${n}:${pr.x}`), act: n % 3 ? 'idle' : 'wave', x: pr.x, z: pr.z, y, yaw: pr.rot, prop: n }); return; }
      const o = buildProp(pr, { lampMat, signs: cfg.signs });
      o.position.set(pr.x, y, pr.z);
      o.rotation.y = pr.rot;
      o.userData.prop = n;
      o.name = `prop_${n}_${pr.type}`;
      propsG.add(o);
      if (o.userData.update) updates.push(o.userData.update);
    });
    const walkTiles = new Set([...tiles.values()].filter((t) => t.type === 'path' || t.type === 'plaza').map((t) => key(t.x, t.z)));
    const walkList = [...walkTiles];
    while (budget > 0 && walkList.length) {
      const [x, z] = life.pick(walkList).split(',').map(Number);
      addFolk({ act: 'walk', x: x + 0.5, z: z + 0.5, yaw: 0, speed: 0.45, scale: life.chance(0.15) ? 0.75 : 1 }, `walk:${budget}`);
    }
    if (prm.avatars) for (const p of lotUse.filter((u) => u.kind === 'builder')) {
      const cx = p.slot.x0 + 1, cz = p.slot.z0 + 1;
      folk.push({ look: builderLook(p.d), act: 'pace', x: cx, z: cz + 1.08, a: { x: cx - 0.7, z: cz + 1.08 }, b: { x: cx + 0.7, z: cz + 1.08 }, faceYaw: Math.PI / 2, yaw: 0 });
    }
    const crowd = createFolk(folk, { walk: walkTiles, rng: life });
    root.add(crowd.group);

    // ── ambience: falling petals / leaves / snow, fireflies at night ──
    const box = new THREE.Box3();
    for (const t of tiles.values()) box.expandByPoint(v.set(t.x, 0, t.z)).expandByPoint(v.set(t.x + 1, 0, t.z + 1));
    let falling = null, fireflies = null;
    if (prm.ambient) {
      const fr = rng.fork('falling');
      const n = 160;
      const fm = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      fm.userData.own = true;
      falling = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.09, 0.06), fm, n);
      falling.layers.set(1);
      falling.userData.items = Array.from({ length: n }, () => ({ x: fr.range(box.min.x, box.max.x), z: fr.range(box.min.z, box.max.z), y: fr.range(0, 7), sp: fr.range(0.25, 0.6), ph: fr.range(0, 6.3) }));
      falling.userData.items.forEach((_, i) => falling.setColorAt(i, cc.set(fr.pick(S.falling))));
      root.add(falling);
      const ffm = new THREE.MeshBasicMaterial({ color: '#FFE48A', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      ffm.userData.own = true;
      fireflies = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), ffm, 90);
      fireflies.layers.set(1);
      fireflies.userData.items = Array.from({ length: 90 }, () => ({ x: fr.range(box.min.x, box.max.x), z: fr.range(box.min.z, box.max.z), y: fr.range(0.4, 1.8), ph: fr.range(0, 6.3) }));
      root.add(fireflies);
    }

    // ── merge static detail (< 1,500 draw calls) ──
    // clickable groups merge on their own so picking and hover still work; the rest merges as scenery
    splitMultiMaterial(root);
    for (const o of placeObjs.map((p) => p.group)) mergeStatic(o);
    const scenery = new THREE.Group();
    scenery.name = 'scenery';
    // plots keep only their clickable, textured parts; borders, posts and easel legs join the scenery
    for (const p of plotObjs) {
      p.group.updateMatrixWorld(true);
      const plain = [];
      p.group.traverse((o) => { if (o.isMesh && !o.material.map && !Array.isArray(o.material) && !o.userData.live && !o.parent.userData.live && !o.children.length) plain.push(o); });
      for (const o of plain) { o.matrixWorld.decompose(o.position, o.quaternion, o.scale); scenery.add(o); }
    }
    const keep = new Set([terrain, traffic.group, crowd.group, propsG, airship, ...placeObjs.map((p) => p.group), ...plotObjs.map((p) => p.group)]);
    for (const c of [...root.children]) if (!keep.has(c) && !c.isInstancedMesh && !c.userData.live) scenery.add(c);
    root.add(scenery);
    mergeStatic(scenery);
    const glow = new Set();
    root.traverse((o) => { for (const m of [].concat(o.material || [])) if (m?.userData?.glow) glow.add(m); });
    world = { root, tags, plots: plotObjs, places: placeObjs, box, updates, falling, fireflies, glow, traffic, crowd, roads, tiles, propsG, terrain, airship,
      marks: {
        panda: new THREE.Vector3(pcx - 0.2, 2.6, pcz - 0.5),
        park: (() => { const q = parcels.find((o) => o.type === 'park'); return q ? new THREE.Vector3(q.bx + 3.5, 0.6, q.bz + 3.5) : null; })(),
        spring: springAt ? new THREE.Vector3(springAt.bx + 3.5, 0.3, springAt.bz + 3.5) : null,
      } };
    light.t = prm.time;
    applyLight();
    if (!keepCamera) frame();
    if (focusId) {
      const p = plotObjs.find((o) => o.d.id === focusId);
      if (p) { p.standee.scale.setScalar(0.01); focusBuilder(p.i).then(() => gsap.to(p.standee.scale, { x: 1, y: 1, z: 1, duration: 0.9, ease: 'back.out(2.4)' })); }
      const pl = placeObjs.find((o) => o.p.id === focusId);
      if (pl) { pl.group.scale.setScalar(0.01); focusPlace(pl.i).then(() => gsap.to(pl.group.scale, { x: 1, y: 1, z: 1, duration: 1, ease: 'back.out(1.8)' })); }
    }
    return world;
  }

  // ── camera ──
  function overviewPose() {
    const target = world.box.getCenter(new THREE.Vector3()).setY(0);
    const pts = [];
    for (const x of [world.box.min.x, world.box.max.x]) for (const z of [world.box.min.z, world.box.max.z]) for (const y of [BOTTOM, 4]) pts.push(new THREE.Vector3(x, y, z));
    const cam = camera.clone();
    let dist = 200;
    for (let it = 0; it < 6; it++) {
      cam.position.copy(target).addScaledVector(DIR, dist);
      cam.lookAt(target);
      cam.updateMatrixWorld();
      let m = 0;
      for (const p of pts) { const q2 = p.clone().project(cam); m = Math.max(m, Math.abs(q2.x), Math.abs(q2.y)); }
      dist *= m / 0.9;
    }
    return { pos: target.clone().addScaledVector(DIR, dist), target, dist };
  }
  function frame() {
    const ov = overviewPose();
    camera.near = ov.dist / 60;
    camera.far = ov.dist * 3;
    camera.updateProjectionMatrix();
    camera.position.copy(ov.pos);
    controls.target.copy(ov.target);
    look.copy(ov.target);
    controls.maxDistance = ov.dist * 1.5;
    controls.minDistance = 8;
    controls.update();
  }
  stage.onResize(() => { if (world && !busy && selected === null) frame(); });

  function glide(pos, target, duration = 1.3) {
    if (!duration) {
      gsap.killTweensOf([camera.position, look]);
      camera.position.copy(pos); look.copy(target); controls.target.copy(target); camera.lookAt(target); controls.update();
      return Promise.resolve();
    }
    controls.enabled = false;
    gsap.killTweensOf([camera.position, look]);
    look.copy(controls.target);
    return new Promise((res) => {
      gsap.to(camera.position, { x: pos.x, y: pos.y, z: pos.z, duration, ease: 'power3.inOut' });
      gsap.to(look, { x: target.x, y: target.y, z: target.z, duration, ease: 'power3.inOut', onUpdate: () => camera.lookAt(look), onComplete: () => { controls.target.copy(look); controls.enabled = true; controls.update(); res(); } });
    });
  }
  function focusBuilder(i, { duration = 1.3 } = {}) {
    const p = world?.plots.find((o) => o.i === i);
    if (!p) return Promise.resolve();
    selected = `b${i}`;
    onSelect?.({ type: 'builder', item: p.d, index: i });
    gsap.timeline().to(p.standee.position, { y: 0.35, duration: 0.22, ease: 'power2.out' }).to(p.standee.position, { y: 0, duration: 0.6, ease: 'bounce.out' });
    const target = new THREE.Vector3(p.cx, 0.6, p.cz);
    return glide(target.clone().addScaledVector(DIR, 22), target, duration);
  }
  function focusPlace(i, { duration = 1.3 } = {}) {
    const p = world?.places.find((o) => o.i === i);
    if (!p) return Promise.resolve();
    selected = `p${i}`;
    onSelect?.({ type: 'place', item: p.p, index: i });
    gsap.timeline().to(p.group.scale, { y: 1.06, duration: 0.18 }).to(p.group.scale, { y: 1, duration: 0.5, ease: 'bounce.out' });
    const target = new THREE.Vector3(p.x, p.h * 0.4, p.z);
    return glide(target.clone().addScaledVector(DIR, 18 + p.h * 5), target, duration);
  }
  function unfocus() {
    selected = null;
    onSelect?.(null);
    const ov = overviewPose();
    return glide(ov.pos, ov.target);
  }

  // ── picking + hover ──
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const el = renderer.domElement;
  const pick = (e) => {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects([...world.plots.map((p) => p.group), ...world.places.map((p) => p.group), ...(world.airship ? [world.airship] : [])], true)[0];
    let o = hit?.object;
    while (o && o.userData.builder === undefined && o.userData.place === undefined && !o.userData.sign) o = o.parent;
    if (!o) return null;
    if (o.userData.sign) return 's0';
    return o.userData.builder !== undefined ? `b${o.userData.builder}` : `p${o.userData.place}`;
  };
  // ── editing: ground and prop picking, a brush cursor, left-drag paints ──
  let editing = false;
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const aim = (cx, cy) => {
    const r = el.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  };
  function pickGround(cx, cy) {
    if (!world) return null;
    aim(cx, cy);
    const hit = ray.intersectObject(world.terrain, false)[0]?.point || ray.ray.intersectPlane(groundPlane, new THREE.Vector3());
    if (!hit) return null;
    return { x: hit.x, z: hit.z, i: Math.floor(hit.x / P), j: Math.floor(hit.z / P) };
  }
  function pickProp(cx, cy) {
    if (!world) return -1;
    aim(cx, cy);
    let o = ray.intersectObjects(world.propsG.children, true)[0]?.object;
    while (o && o.userData.prop === undefined) o = o.parent;
    if (o) return o.userData.prop;
    // people placed as props: nearest within reach of the ground point
    const g = pickGround(cx, cy);
    if (!g) return -1;
    const near = world.crowd.people.filter((p) => p.prop !== undefined).find((p) => Math.hypot(p.pos.x - g.x, p.pos.z - g.z) < 0.35);
    return near ? near.prop : -1;
  }
  const cursor = new THREE.Group();
  cursor.name = 'editor-cursor';
  scene.add(cursor);
  const cursorMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.55, depthWrite: false });
  const ghostMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.55, depthWrite: false });
  /** Shows parcel highlights ({ cells: [[i, j]], color }) or a prop ghost ({ prop }); null hides it. */
  function setCursor(spec) {
    for (const c of [...cursor.children]) { cursor.remove(c); c.traverse((o) => o.geometry && !o.userData.sharedGeo && o.geometry.dispose()); }
    if (!spec) return;
    if (spec.cells) {
      cursorMat.color.set(spec.color || '#FFFFFF');
      for (const [i, j] of spec.cells) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(P - 0.9, 0.5, P - 0.9), cursorMat);
        const h = (world?.tiles.get(`${i * P + 3},${j * P + 3}`)?.h || 0) * STEP;
        m.position.set(i * P + 3.5, h + 0.2, j * P + 3.5);
        m.layers.set(1);
        cursor.add(m);
      }
    }
    if (spec.prop) {
      const pr = spec.prop;
      const o = pr.type === 'person' ? new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.3, 4, 8).translate(0, 0.25, 0), ghostMat) : buildProp(pr, { signs: cfg.signs });
      o.traverse((m) => { if (m.isMesh) { m.material = ghostMat; m.castShadow = false; m.layers.set(1); } });
      o.layers.set(1);
      const h = (world?.tiles.get(`${Math.floor(pr.x)},${Math.floor(pr.z)}`)?.h || 0) * STEP;
      o.position.set(pr.x, h, pr.z);
      o.rotation.y = pr.rot || 0;
      cursor.add(o);
    }
  }
  function setEditing(on) {
    editing = on;
    controls.mouseButtons.LEFT = on ? null : THREE.MOUSE.ROTATE;
    controls.mouseButtons.RIGHT = on ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
    if (!on) setCursor(null);
    el.style.cursor = on ? 'crosshair' : '';
  }

  let down = null, lastMove = 0;
  el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
  el.addEventListener('pointerup', (e) => {
    if (!down || busy || !world || editing) { down = null; return; }
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 5) return;
    const id = pick(e);
    if (!id) { if (selected !== null) unfocus(); return; }
    if (id === 's0') { selected = 's0'; onSelect?.({ type: 'sign', item: world.airship.userData.sign, index: 0 }); return; }
    if (id[0] === 'b') focusBuilder(+id.slice(1)); else focusPlace(+id.slice(1));
  });
  el.addEventListener('pointermove', (e) => {
    const now = performance.now();
    if (!world || editing || now - lastMove < 50 || e.buttons) return;
    lastMove = now;
    const id = pick(e);
    if (id === hovered) return;
    const obj = (h) => (h === 's0' ? null : h?.[0] === 'b' ? world.plots.find((p) => p.i === +h.slice(1))?.standee : h ? world.places.find((p) => p.i === +h.slice(1))?.group : null);
    const prev = obj(hovered);
    if (prev) gsap.to(prev.scale, { x: 1, y: 1, z: 1, duration: 0.25 });
    hovered = id;
    el.style.cursor = id ? 'pointer' : '';
    const cur = obj(id);
    if (cur) gsap.to(cur.scale, { x: 1.06, y: 1.06, z: 1.06, duration: 0.25, ease: 'back.out(2)' });
  });

  // ── per frame ──
  const fm4 = new THREE.Matrix4(), fq = new THREE.Quaternion(), fv = new THREE.Vector3(), fs = new THREE.Vector3(), fe = new THREE.Euler();
  stage.onFrame((t, dt) => {
    if (!world) return;
    for (const fn of world.updates) fn(t);
    world.traffic.update(t, dt);
    world.crowd.update(t, dt);
    for (const p of world.plots) {
      const wp = p.group.position;
      p.standee.rotation.y = Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z);
      p.flag.rotation.y = Math.sin(t * 2.2 + p.i) * 0.35;
      p.tag.position.y = 1.55 + p.standee.position.y + (p.standee.scale.y - 1) * 1.1;
      p.tag.visible = camera.position.distanceTo(wp) < 34 || `b${p.i}` === hovered || `b${p.i}` === selected;
    }
    for (const p of world.places) p.tag.visible = camera.position.distanceTo(p.group.position) < 44 || `p${p.i}` === hovered || `p${p.i}` === selected;
    const f = world.falling;
    if (f) {
      f.userData.items.forEach((it, i) => {
        it.y -= it.sp * dt;
        if (it.y < 0) it.y = 7;
        fv.set(it.x + Math.sin(t * 0.8 + it.ph) * 0.6, it.y, it.z + Math.cos(t * 0.6 + it.ph) * 0.4);
        fq.setFromEuler(fe.set(t * 1.3 + it.ph, t + it.ph, 0));
        fm4.compose(fv, fq, fs.setScalar(1));
        f.setMatrixAt(i, fm4);
      });
      f.instanceMatrix.needsUpdate = true;
    }
    const ff = world.fireflies;
    if (ff && ff.material.opacity > 0) {
      ff.userData.items.forEach((it, i) => {
        fv.set(it.x + Math.sin(t * 0.7 + it.ph) * 0.5, it.y + Math.sin(t * 1.3 + it.ph * 2) * 0.25, it.z + Math.cos(t * 0.5 + it.ph) * 0.5);
        fm4.compose(fv, fq.identity(), fs.setScalar(0.6 + 0.4 * Math.sin(t * 4 + it.ph)));
        ff.setMatrixAt(i, fm4);
      });
      ff.instanceMatrix.needsUpdate = true;
    }
  });

  // ── film: six shots as a pure function of time, so live playback and the
  // frame-perfect export see exactly the same camera ──
  const SHOTS = [[0, 5], [5, 10.5], [10.5, 15.5], [15.5, 20], [20, 23.5], [23.5, 28]];
  const FILM = SHOTS[SHOTS.length - 1][1];
  const UP = new THREE.Vector3(0, 1, 0);
  const ease = (x) => x * x * (3 - 2 * x);
  const chase = { pos: new THREE.Vector3(), target: new THREE.Vector3(), init: false };
  function shotPose(k, t, out) {
    const ov = overviewPose();
    const C = ov.target;
    const f = Math.min(1, Math.max(0, (t - SHOTS[k][0]) / (SHOTS[k][1] - SHOTS[k][0])));
    const orbit = (center, dist, a) => { out.pos.copy(center).addScaledVector(DIR.clone().applyAxisAngle(UP, a), dist); out.target.copy(center); };
    const hero = [...world.places].sort((a, b) => b.h - a.h)[0];
    if (k === 0) orbit(C, ov.dist * (1.04 - 0.14 * ease(f)), -0.45 + 0.45 * f);
    else if (k === 1 && hero) orbit(new THREE.Vector3(hero.x, hero.h * 0.32, hero.z), 18 + hero.h * 2.4, 0.55 - 1.1 * f);
    else if (k === 2 && world.traffic.cars.length) {
      const c = world.traffic.cars.reduce((a, b) => (b.model === 'convertible' ? b : a), world.traffic.cars[0]);
      const fwd = new THREE.Vector3(Math.cos(c.yaw), 0, -Math.sin(c.yaw));
      const tp = c.pos.clone().addScaledVector(fwd, 1.4).setY(0.3);
      const pp = c.pos.clone().addScaledVector(fwd, -3.4).setY(2.1).add(new THREE.Vector3(0.6, 0, 0.6));
      if (!chase.init || t - SHOTS[2][0] < 0.05) { chase.pos.copy(pp); chase.target.copy(tp); chase.init = true; }
      chase.pos.lerp(pp, 0.08); chase.target.lerp(tp, 0.15);
      out.pos.copy(chase.pos); out.target.copy(chase.target);
    } else if (k === 3) orbit(world.marks.spring || world.marks.park || C, 15 - 3 * f, -0.8 + 0.9 * f);
    else if (k === 4) orbit(world.marks.panda, 12 - 2.5 * ease(f), 0.12 * Math.sin(f * Math.PI));
    else orbit(C, ov.dist * (0.55 + 0.5 * ease(f)), 0.05 + 0.35 * f);
    return out;
  }
  const poseA = { pos: new THREE.Vector3(), target: new THREE.Vector3() }, poseB = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  /** Camera and light for film time t. Each shot blends in from the last one over 0.9 s. */
  function applyFilm(t) {
    const k = Math.max(0, SHOTS.findIndex(([a, b]) => t >= a && t < b));
    shotPose(k, t, poseB);
    const into = t - SHOTS[k][0];
    if (k > 0 && into < 0.9) {
      shotPose(k - 1, SHOTS[k - 1][1] - 1e-3, poseA);
      const e = ease(into / 0.9);
      poseB.pos.lerpVectors(poseA.pos, poseB.pos, e);
      poseB.target.lerpVectors(poseA.target, poseB.target, e);
    }
    camera.position.copy(poseB.pos);
    camera.lookAt(poseB.target);
    look.copy(poseB.target);
    const last = SHOTS[SHOTS.length - 1][0];
    light.t = t < last ? 0.6 : 0.6 + 0.37 * ease((t - last) / (FILM - last));
    applyLight();
  }
  // ── the short (for social): 20 s, cut like a city-builder reel ──
  // Open on the full map while every building pops in from the centre out, then hard-cut every
  // 3 s to one spot up close (same isometric angle, a slow sideways drift, no orbit), then end on
  // the full map again.
  const SHORT = 20;
  const BASE_FOV = camera.fov;
  const SHORT_CUTS = [0, 5, 8, 11, 14, 17, 20];
  const SCREEN_RIGHT = new THREE.Vector3(1, 0, -1).normalize();
  const placeOf = (kind) => world.places.find((p) => p.p.kind === kind);
  const backOut = (x) => { const c = 1.9; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
  let pops = null;
  /** Everything that pops in during the opening, nearest the centre first. */
  function popList() {
    if (pops && pops.world === world) return pops.list;
    const c = overviewPose().target;
    const list = [...world.places.map((p) => p.group), ...world.plots.map((p) => p.group)]
      .map((g) => ({ g, d: Math.hypot(g.position.x - c.x, g.position.z - c.z) }))
      .sort((a, b) => a.d - b.d)
      .map((o, i, all) => ({ g: o.g, at: 0.35 + (3.3 * i) / Math.max(1, all.length - 1) }));
    pops = { world, list };
    return list;
  }
  function setPops(t) {
    for (const { g, at } of popList()) {
      const k = Math.min(1, Math.max(0, (t - at) / 0.5));
      g.scale.setScalar(k <= 0 ? 0.0001 : backOut(k));
    }
  }
  /** Camera and light for short-film time t. */
  function applyShort(t) {
    const k = Math.max(0, SHORT_CUTS.findIndex((c, i) => t >= c && t < SHORT_CUTS[i + 1]));
    const f = (t - SHORT_CUTS[k]) / (SHORT_CUTS[k + 1] - SHORT_CUTS[k]);
    const out = poseB;
    // narrow (vertical) frames widen the lens on close shots, so the subject still fits across
    // without pulling the camera back behind buildings
    const wide = Math.max(1, Math.sqrt(1.6 / camera.aspect));
    const fov = k === 0 || k === 5 ? BASE_FOV : BASE_FOV * wide;
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    const ov = overviewPose();
    // a close shot: fixed isometric angle, slow drift to the right, a touch of push-in
    const drift = (center, dist) => {
      out.target.copy(center).addScaledVector(SCREEN_RIGHT, -0.9 + 1.8 * f);
      out.pos.copy(out.target).addScaledVector(DIR, dist * (1 - 0.05 * f));
    };
    const hero = placeOf('mall') || [...world.places].sort((a, b) => b.h - a.h)[0];
    setPops(k === 0 ? t : SHORT);
    if (k === 0) { out.target.copy(ov.target); out.pos.copy(ov.target).addScaledVector(DIR, ov.dist * (0.95 - 0.33 * ease(f))); }
    else if (k === 1 && hero) drift(new THREE.Vector3(hero.x, hero.h * 0.45, hero.z), 21 + hero.h * 1.6);
    else if (k === 2) drift((world.marks.spring || world.marks.park || ov.target).clone().setY(0.1), 9);
    else if (k === 3) drift((world.marks.park || world.marks.panda).clone().setY(0.3), 10);
    else if (k === 4) drift(world.marks.panda.clone().setY(2.0), 23);
    else { out.target.copy(ov.target); out.pos.copy(ov.target).addScaledVector(DIR, ov.dist * (0.6 + 0.05 * f)); }
    if (world.airship) world.airship.visible = k === 0 || k === 5;   // the blimp only crosses wide shots
    camera.position.copy(out.pos);
    camera.lookAt(out.target);
    look.copy(out.target);
    light.t = 0.6;
    applyLight();
  }

  function endFilm() {
    if (camera.fov !== BASE_FOV) { camera.fov = BASE_FOV; camera.updateProjectionMatrix(); }
    if (world?.airship) world.airship.visible = true;
    if (world) for (const g of [...world.places.map((p) => p.group), ...world.plots.map((p) => p.group)]) g.scale.setScalar(1);
    controls.target.copy(look);
    controls.enabled = true;
    light.t = cfg.params.time;
    applyLight();
    busy = false;
    chase.init = false;
  }
  /** Plays the film live (used by Record). `short` plays the 20 s cut-every-3 s version. */
  function playFilm(short = false) {
    const run = short ? applyShort : applyFilm, length = short ? SHORT : FILM;
    if (busy || !world) return Promise.resolve();
    busy = true;
    controls.enabled = false;
    onSelect?.(null);
    const t0 = stage.time;
    return new Promise((res) => {
      const off = stage.onFrame((t) => {
        const ft = t - t0;
        if (ft >= length) { off(); endFilm(); res(); return; }
        run(ft);
      });
    });
  }
  /** Renders the film frame by frame into an .mp4 (no dropped frames). */
  async function exportFilm(format = '16:9', onProgress, { short = false } = {}) {
    if (busy || !world) return null;
    busy = true;
    controls.enabled = false;
    onSelect?.(null);
    try {
      return await stage.renderVideo({ duration: short ? SHORT : FILM, fps: 30, format, name: short ? 'builderland-short' : 'builderland-film', step: (t) => (short ? applyShort : applyFilm)(t), onProgress });
    } finally { endFilm(); frame(); }
  }

  async function tour() {
    if (busy || !world) return;
    busy = true;
    try {
      for (const p of world.places.slice(0, 3)) { await focusPlace(p.i, { duration: 1.3 }); await new Promise((r) => gsap.delayedCall(0.9, r)); }
      for (const p of world.plots.slice(0, 3)) { await focusBuilder(p.i, { duration: 1.2 }); await new Promise((r) => gsap.delayedCall(0.8, r)); }
      await unfocus();
    } finally { busy = false; }
  }

  build(cfg);

  return {
    get config() { return cfg; },
    get busy() { return busy; },
    get world() { return world; },
    stage, camera, controls,
    setConfig: (next, opts) => build(next, opts),
    pickGround, pickProp, setCursor, setEditing, PARCEL: P,
    /** Change generator params: light & drawing update live, everything else regenerates. */
    setParams(partial) {
      const next = { ...cfg, params: { ...cfg.params, ...partial } };
      if (Object.keys(partial).every((k) => LIVE.has(k))) {
        cfg = normalizeLand(next);
        if ('time' in partial) gsap.to(light, { t: cfg.params.time, duration: 0.4, onUpdate: applyLight });
        applyLight();
        applyDrawing();
        return;
      }
      build(next);
    },
    setTime(t, duration = 2) { cfg.params.time = t; gsap.to(light, { t, duration, ease: 'sine.inOut', onUpdate: applyLight }); },
    focusBuilder, focusPlace, unfocus, tour, frame,
    focusById(id, opts) {
      const b = world?.plots.find((o) => o.d.id === id);
      if (b) return focusBuilder(b.i, opts);
      const p = world?.places.find((o) => o.p.id === id);
      return p ? focusPlace(p.i, opts) : Promise.resolve();
    },
    setInset: (px) => stage.setInset(px),
    record: (format) => stage.record(playFilm, format, 'builderland'),
    playFilm, exportFilm, applyFilm, applyShort, FILM, SHORT,
    overviewPose: () => overviewPose(),
    get look() { return look; },
    /** The current view at w×h, as a canvas (for share cards). */
    snapshot(w, h) {
      // the resize would otherwise re-frame the camera to the overview; keep the current view
      const was = busy;
      busy = true;
      try { return stage.snapshot(w, h); } finally { busy = was; }
    },
    savePNG: () => stage.savePNG('builderland'),
    async exportGLB() { const b = await toGLB([world.root]); download(b, 'builderland.glb'); return b; },
  };
}
