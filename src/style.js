// Builderland style board: every asset on a turntable in day, golden hour and
// night, side by side, drawn by the same passes as the land. Colours and light come from tokens.js.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { createStage } from './engine/stage.js';
import { addMoebius } from './engine/moebius.js';
import { addInk, toon, scribbleWater } from './engine/ink.js';
import { buildPlace, panda, FACADES, FACADE_LABEL } from './places.js';
import { templates, lantern, welcomeSign, builderPlot } from './props.js';
import { normalizePlace } from './world.js';
import { playground, carousel, bandstand, hotSpring, capybara, cat } from './park.js';
import { carMesh, CAR_MODELS } from './traffic.js';
import { createFolk, folkLook } from './folk.js';
import { createRng } from './engine/rng.js';
import { sampleDesigners, normalizeDesigner } from './people.js';
import { landParams, SEASONS } from './params.js';
import { PALETTE, ACCENTS, GROUND, MAT, INK, SHARE, RULES, LIGHT_PRESETS, LANTERN_GLOW, audit, hsl, applyLight } from './tokens.js';

const $ = (id) => document.getElementById(id);
const DIR = new THREE.Vector3(1, 1.12, 1).normalize();
const COLS = 6;
const PITCH = 7.5;         // column spacing
const ROW_PITCH = 11.5;    // rows sit further apart: the isometric view squashes depth
const FIT = 5.2;           // largest side of an asset in Fit mode
const S = SEASONS.summer;
const PRM = landParams({});

// An original demo mark for the SVG landmark. The repo ships no third-party logos.
const STAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="${ACCENTS[0]}" d="M50 4 C54 4 56 8 58 13 L65 31 L84 32 C90 32 94 34 95 38 C96 42 93 45 89 48 L74 60 L79 79 C80 85 80 89 76 91 C72 93 68 91 64 88 L50 77 L36 88 C32 91 28 93 24 91 C20 89 20 85 21 79 L26 60 L11 48 C7 45 4 42 5 38 C6 34 10 32 16 32 L35 31 L42 13 C44 8 46 4 50 4 Z"/></svg>`;

const place = (p) => normalizePlace(p);
const mesh = (geo, color, { cast = true } = {}) => { const m = new THREE.Mesh(geo, toon(color)); m.castShadow = cast; m.receiveShadow = true; return m; };

/** Every asset on the board. `tier` is what it measures today, `target` the size tier it is meant to read as. */
const ASSETS = [
  { id: 'mall', name: 'Creator Mall', tier: 'XL', base: 11, top: 'plaza',
    make: () => buildPlace(place({ kind: 'mall', name: 'Creator Mall', color: ACCENTS[0] }), [
      { name: 'Bay 1', color: ACCENTS[2] }, { name: 'Bay 2', color: INK }, { name: 'Bay 3', color: ACCENTS[3] }, { name: 'Bay 4', color: ACCENTS[4] }].map(place)) },
  { id: 'lab', name: 'AI lab', tier: 'L', base: 5, top: 'plaza', make: () => buildPlace(place({ kind: 'lab', name: 'AI Lab', color: ACCENTS[3] })) },
  { id: 'hq', name: 'HQ tower', tier: 'L', base: 5, top: 'plaza', make: () => buildPlace(place({ kind: 'hq', name: 'HQ', color: PALETTE.roofs.colors[3] })) },
  { id: 'logo', name: 'Logo landmark', tier: 'L', base: 5, top: 'grass', make: () => buildPlace(place({ kind: 'logo', name: 'Landmark', color: ACCENTS[0], svg: STAR_SVG })) },
  ...FACADES.map((f, i) => ({ id: `shop-${f}`, name: FACADE_LABEL[f], tier: 'M', base: 2, top: 'plaza',
    make: () => buildPlace(place({ kind: 'shop', facade: f, name: FACADE_LABEL[f], color: [ACCENTS[4], PALETTE.roofs.colors[3], ACCENTS[3], ACCENTS[0], ACCENTS[2], ACCENTS[0]][i] })) })),
  { id: 'billboard', name: 'Billboard', tier: 'M', base: 2, top: 'plaza', make: () => buildPlace(place({ kind: 'billboard', name: 'Your brand', color: ACCENTS[1], ink: INK })) },
  { id: 'panda', name: 'Panda · pencil', tier: 'L', base: 3, top: 'plaza', make: () => panda() },
  { id: 'panda-laptop', name: 'Panda · laptop', tier: 'L', base: 3, top: 'plaza', make: () => panda({ pose: 'laptop', scarf: ACCENTS[2] }) },
  { id: 'wheel', name: 'Ferris wheel', tier: 'L', base: 5, top: 'plaza', make: () => buildPlace(place({ kind: 'wheel', name: 'Big Wheel', color: ACCENTS[2] })) },
  { id: 'screen', name: 'Screen billboard', tier: 'M', base: 2, top: 'plaza', make: () => buildPlace(place({ kind: 'screen', name: 'Screen', color: INK }), [{ name: 'Your brand', color: ACCENTS[1], ink: INK }, { name: 'Framer', color: ACCENTS[2] }].map(place)) },
  { id: 'playground', name: 'Playground', tier: 'M', base: 5, top: 'grass', make: () => featureGroup(playground(createRng('board'))) },
  { id: 'carousel', name: 'Carousel', tier: 'M', base: 3, top: 'grass', make: () => featureGroup(carousel()) },
  { id: 'bandstand', name: 'Bandstand', tier: 'M', base: 3, top: 'grass', make: () => featureGroup(bandstand()) },
  { id: 'spring', name: 'Hot spring', tier: 'M', base: 4, top: 'grass', make: () => {
    // in the land the spring sits in a sunken pond; on the board, lift it above the slab
    const g = new THREE.Group();
    const sp = featureGroup(hotSpring(createRng('board')));
    sp.position.y = 0.16;
    g.add(sp);
    g.userData.update = sp.userData.update;
    return g;
  } },
  { id: 'capybara', name: 'Capybara', tier: 'S', base: 1, top: 'grass', make: () => { const c = capybara({ orange: true }); c.scale.setScalar(1.6); return c; } },
  { id: 'cat', name: 'Cat', tier: 'S', base: 1, top: 'path', make: () => { const c = cat('#F2994A', { sleeping: false }); c.scale.setScalar(2.4); return c; } },
  { id: 'cars', name: 'Cars', tier: 'S', base: 3, top: 'path', make: () => {
    const g = new THREE.Group();
    CAR_MODELS.forEach((m, i) => { const c = carMesh(m, [ACCENTS[0], undefined, ACCENTS[4], ACCENTS[2], undefined, undefined][i]); c.position.set(-0.9 + (i % 2) * 1.6, 0, -1 + Math.floor(i / 2) * 0.9); g.add(c); });
    return g;
  } },
  { id: 'people', name: 'People', tier: 'S', base: 2, top: 'plaza', make: () => {
    const acts = ['wave', 'idle', 'cheer', 'idle', 'wave', 'idle'];
    const crowd = createFolk(acts.map((act, i) => ({ look: folkLook(`board:${i}`, { style: i }), act, x: -0.55 + (i % 3) * 0.55, z: -0.35 + Math.floor(i / 3) * 0.7, yaw: -Math.PI / 4, scale: 1.6 })));
    crowd.group.userData.update = (t) => crowd.update(t, 0.016);
    return crowd.group;
  } },
  { id: 'plot', name: 'Builder plot', tier: 'M', base: 2, top: 'plot', make: () => {
    const d = normalizeDesigner(sampleDesigners()[2]);
    const p = builderPlot(d);
    p.group.userData.standee = p.standee;
    p.group.userData.flag = p.flag;
    return p.group;
  } },
  { id: 'tree', name: 'Round tree', tier: 'S', base: 1, top: 'grass', make: () => {
    const T = templates(), g = new THREE.Group();
    g.add(mesh(T.trunk, MAT.trunk), mesh(T.canopy, S.leaf[1]));
    return g;
  } },
  { id: 'pine', name: 'Pine', tier: 'S', base: 1, top: 'grass', make: () => {
    const T = templates(), g = new THREE.Group();
    g.add(mesh(T.pineTrunk, MAT.trunk), mesh(T.pine, S.leaf[2]));
    return g;
  } },
  { id: 'meadow', name: 'Meadow', tier: 'S', base: 1, top: 'grass', make: () => {
    const T = templates(), g = new THREE.Group();
    const b = mesh(T.bush, S.leaf[3]); b.position.set(-0.18, 0, -0.18); g.add(b);
    [[0.25, 0.1], [0.3, -0.25], [-0.3, 0.3], [0.05, 0.35], [0.38, 0.32], [-0.05, -0.38]].forEach(([x, z], i) => {
      const f = new THREE.Group(); f.add(mesh(T.stem, '#5E8A45', { cast: false }), mesh(T.flower, S.flower[i % S.flower.length], { cast: false }));
      f.position.set(x, 0, z); g.add(f);
    });
    for (const [x, z] of [[0.1, -0.05], [-0.36, 0.0]]) { const t = mesh(T.tuft, S.lip, { cast: false }); t.position.set(x, 0, z); g.add(t); }
    return g;
  } },
  { id: 'forest', name: 'Forest floor', tier: 'S', base: 1, top: 'grass', make: () => {
    const T = templates(), g = new THREE.Group();
    [[0.15, 0.2, 1.2], [-0.05, 0.32, 0.9], [0.3, -0.05, 0.8]].forEach(([x, z, s], i) => {
      const m = new THREE.Group(); m.add(mesh(T.mushStem, MAT.mushStem), mesh(T.mushCap, MAT.mushCap[i]));
      m.position.set(x, 0, z); m.scale.setScalar(s * 1.4); g.add(m);
    });
    const r = mesh(T.rock, MAT.rock); r.position.set(-0.25, 0, -0.2); r.scale.setScalar(1.4); g.add(r);
    return g;
  } },
  { id: 'ruins', name: 'Ruins', tier: 'S', base: 1, top: 'grass', make: () => {
    const T = templates(), g = new THREE.Group();
    const a = mesh(T.monolith, MAT.monolith); a.position.set(-0.15, 0, -0.1); a.rotation.y = 0.4;
    const b = mesh(T.monolith, MAT.monolith); b.position.set(0.22, 0, 0.18); b.rotation.set(0, -0.3, 0.35); b.scale.setScalar(0.7);
    const r = mesh(T.rock, MAT.rock); r.position.set(0.25, 0, -0.25);
    g.add(a, b, r);
    return g;
  } },
  { id: 'lantern', name: 'Lantern', tier: 'S', base: 1, top: 'path', make: (ctx) => lantern(ctx.lampMat) },
  { id: 'sign', name: 'Welcome sign', tier: 'M', base: 2, top: 'path', make: () => welcomeSign('Builderland', 24) },
  { id: 'pond', name: 'Pond', tier: 'M', base: 3, top: 'grass', make: () => {
    const T = templates(), g = new THREE.Group();
    const rim = mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.02, 24), GROUND.pond, { cast: false }); rim.position.y = 0.012; g.add(rim);
    const wm = new THREE.MeshToonMaterial({ map: scribbleWater(GROUND.water), gradientMap: toon('#fff').gradientMap });
    wm.userData.own = true;
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.95, 28).rotateX(-Math.PI / 2), wm); w.position.y = 0.03; w.receiveShadow = true; g.add(w);
    for (const [x, z] of [[1.1, 0.6], [0.9, 0.95], [-1.15, -0.4]]) { const t = mesh(T.tuft, S.lip); t.position.set(x, 0, z); t.scale.setScalar(1.6); g.add(t); }
    const st = mesh(T.stone, GROUND.stone); st.position.set(-0.9, 0, 1.05); g.add(st);
    return g;
  } },
];

/** Wraps a park feature (group + updates) as a board asset. */
function featureGroup(f) {
  f.group.userData.update = (t) => (f.updates || []).forEach((fn) => fn(t));
  return f.group;
}

const TOPS = { grass: S.grass[0], plaza: GROUND.plaza[0], path: GROUND.path[0], plot: new THREE.Color(S.grass[1]).lerp(new THREE.Color(ACCENTS[3]), 0.18).getStyle() };

/** A slab of land under each asset, like a tile cut out of the land. */
function slab(n, top) {
  const g = new THREE.Group();
  const side = mesh(new THREE.BoxGeometry(n, 0.34, n), GROUND.cliff);
  side.position.y = -0.23;
  const lip = mesh(new THREE.BoxGeometry(n, 0.06, n), top === 'grass' || top === 'plot' ? S.lip : GROUND.lipPath);
  lip.position.y = -0.03;
  const face = mesh(new THREE.BoxGeometry(n - 0.02, 0.012, n - 0.02), TOPS[top], { cast: false });
  face.position.y = 0.0;
  if (top !== 'grass' && n >= 3) {
    // a grass rim around paved parcels, as in the land
    face.scale.set((n - 0.5) / n, 1, (n - 0.5) / n);
    const rim = mesh(new THREE.BoxGeometry(n - 0.02, 0.01, n - 0.02), S.grass[1], { cast: false });
    rim.position.y = -0.002;
    g.add(rim);
  }
  g.add(side, lip, face);
  return g;
}

// grid position: columns run along screen-right, rows down the screen
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const DOWN = new THREE.Vector3(1, 0, 1).normalize();
const cellPos = (i) => {
  const c = i % COLS, r = Math.floor(i / COLS), rows = Math.ceil(ASSETS.length / COLS);
  return new THREE.Vector3().addScaledVector(RIGHT, (c - (COLS - 1) / 2) * PITCH).addScaledVector(DOWN, (r - (rows - 1) / 2) * ROW_PITCH);
};
const CENTER = new THREE.Vector3();
const RADIUS = Math.hypot(COLS * PITCH, Math.ceil(ASSETS.length / COLS) * ROW_PITCH) / 2 + 2;

// ── shared board state ──
const view = { scale: 'fit', style: 'moebius', paused: false, spin: 0, focus: -1, leader: null };
const LIGHTS = [
  { key: 'day', name: 'Day', t: LIGHT_PRESETS.day },
  { key: 'golden', name: 'Golden hour', t: LIGHT_PRESETS.golden, note: 'content default' },
  { key: 'night', name: 'Night', t: LIGHT_PRESETS.night, note: 'second hero look' },
];

await Promise.race([document.fonts.load('600 64px Fredoka'), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});

const boards = LIGHTS.map(makeBoard);

function makeBoard(L) {
  const card = document.createElement('article');
  card.className = 'card light';
  card.innerHTML = `<div class="cap"><strong>${L.name}</strong><small>time ${L.t.toFixed(2)}${L.note ? ` · ${L.note}` : ''}</small></div><div class="view"><div class="labels"></div></div>`;
  $('lights').appendChild(card);
  const viewEl = card.querySelector('.view');
  const stage = createStage(viewEl, { tilt: 0, fov: 14 });
  viewEl.insertBefore(stage.renderer.domElement, viewEl.firstChild);
  const { scene, camera, controls } = stage;
  scene.fog = null;
  scene.background = new THREE.Color();
  controls.maxPolarAngle = 1.2;
  const moebius = addMoebius(stage, { light: stage.sun });
  const ink = addInk(stage);
  const u = moebius.uniforms;
  u.thickness.value = PRM.line; u.amplitude.value = PRM.wobble; u.hatchStrength.value = PRM.hatch * 1.7;
  u.hatchLevels.value.set(0.26, 0.38, 0.5); u.grain.value = PRM.grain;

  const lampMat = new THREE.MeshStandardMaterial({ color: '#FFF3D6', emissive: LANTERN_GLOW, emissiveIntensity: 0 });
  const labelsEl = card.querySelector('.labels');
  const cells = ASSETS.map((a, i) => {
    const pivot = new THREE.Group();
    pivot.position.copy(cellPos(i));
    pivot.userData.cell = i;
    const content = new THREE.Group();
    content.add(slab(a.base, a.top));
    const obj = a.make({ lampMat });
    obj.position.set(0, 0, 0);
    content.add(obj);
    pivot.add(content);
    scene.add(pivot);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const height = Math.max(0, box.max.y);
    const span = Math.max(a.base, size.x, size.z, height * 1.1);
    const fit = FIT / span;
    content.scale.setScalar(view.scale === 'fit' ? fit : 1);
    const label = document.createElement('span');
    const short = a.target && a.target !== a.tier;
    label.innerHTML = `${a.name} <small>${a.tier} · ${height.toFixed(1)} m</small>${short ? ` <span class="chip bad">target ${a.target}</span>` : ''}`;
    labelsEl.appendChild(label);
    return { a, pivot, content, obj, fit, span, height, label };
  });

  const glow = new Set();
  scene.traverse((o) => { for (const m of [].concat(o.material || [])) if (m?.userData?.glow) glow.add(m); });
  const g = applyLight(stage, L.t, PRM.sun, { center: CENTER, radius: RADIUS });
  lampMat.emissiveIntensity = g * 2.6;
  for (const m of glow) m.emissiveIntensity = g * 0.9;

  const b = { L, card, stage, scene, camera, controls, moebius, ink, cells };

  // orbit any view and the other two follow
  stage.renderer.domElement.addEventListener('pointerdown', (e) => { view.leader = b; down = { x: e.clientX, y: e.clientY, b }; });
  controls.addEventListener('change', () => {
    if (view.leader !== b) return;
    for (const o of boards) if (o !== b) { o.camera.position.copy(camera.position); o.controls.target.copy(controls.target); o.camera.lookAt(controls.target); }
  });

  const tmp = new THREE.Vector3(), toCam = new THREE.Vector3();
  stage.onFrame((t) => {
    applyStyle(b);
    const w = viewEl.clientWidth, h = viewEl.clientHeight;
    for (const [i, c] of cells.entries()) {
      c.pivot.rotation.y = view.spin + (view.paused && view.spin === 0 ? 0 : i * 0.05);
      c.obj.userData.update?.(t);
      const sd = c.obj.userData.standee;
      if (sd) {
        sd.getWorldPosition(tmp);
        sd.rotation.y = Math.atan2(camera.position.x - tmp.x, camera.position.z - tmp.z) - c.pivot.rotation.y;
        c.obj.userData.flag.rotation.y = Math.sin(t * 2.2) * 0.35;
      }
      // label sits under the front corner of the slab
      const s = c.content.scale.x;
      toCam.copy(camera.position).sub(c.pivot.position).setY(0).normalize();
      tmp.copy(c.pivot.position).addScaledVector(toCam, c.a.base * s * 0.72).setY(-0.45 * s);
      tmp.project(camera);
      const show = (view.focus < 0 || view.focus === i) && tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
      c.label.style.display = show ? '' : 'none';
      if (show) { c.label.style.left = `${((tmp.x + 1) / 2) * w}px`; c.label.style.top = `${((1 - tmp.y) / 2) * h + 4}px`; }
    }
  });
  stage.onResize(() => { if (view.focus < 0) frame(b, 0); else focus(view.focus, 0); });
  return b;
}

function applyStyle(b) {
  b.moebius.enabled = view.style === 'moebius';
  b.ink.enabled = view.style === 'ink';
}

// ── camera ──
function overviewPose(b) {
  const rows = Math.ceil(ASSETS.length / COLS);
  const pts = [];
  for (const c of [0, COLS - 1]) for (const r of [0, rows - 1]) for (const y of [-0.6, view.scale === 'fit' ? 4.6 : 6.5]) {
    const p = cellPos(r * COLS + c);
    for (const k of [-1, 1]) pts.push(p.clone().addScaledVector(RIGHT, (k * PITCH) / 2.2).setY(y), p.clone().addScaledVector(DOWN, (k * PITCH) / 2.2).setY(y));
  }
  const cam = b.camera.clone();
  let dist = 200;
  for (let it = 0; it < 6; it++) {
    cam.position.copy(CENTER).addScaledVector(DIR, dist);
    cam.lookAt(CENTER);
    cam.updateMatrixWorld();
    let m = 0;
    for (const p of pts) { const q = p.clone().project(cam); m = Math.max(m, Math.abs(q.x), Math.abs(q.y)); }
    dist *= m / 0.94;
  }
  return { pos: CENTER.clone().addScaledVector(DIR, dist), target: CENTER.clone(), dist };
}
function glide(b, pos, target, duration) {
  const { camera, controls } = b;
  gsap.killTweensOf([camera.position, controls.target]);
  if (!duration) { camera.position.copy(pos); controls.target.copy(target); camera.lookAt(target); controls.update(); return; }
  controls.enabled = false;
  gsap.to(camera.position, { x: pos.x, y: pos.y, z: pos.z, duration, ease: 'power3.inOut' });
  gsap.to(controls.target, { x: target.x, y: target.y, z: target.z, duration, ease: 'power3.inOut', onUpdate: () => camera.lookAt(controls.target), onComplete: () => { controls.enabled = true; controls.update(); } });
}
function frame(b, duration = 1.1) {
  const ov = overviewPose(b);
  b.camera.near = ov.dist / 40; b.camera.far = ov.dist * 3; b.camera.updateProjectionMatrix();
  b.controls.maxDistance = ov.dist * 1.6; b.controls.minDistance = 6;
  glide(b, ov.pos, ov.target, duration);
}
function focus(i, duration = 1.1) {
  view.focus = i;
  for (const b of boards) {
    const c = b.cells[i];
    const s = view.scale === 'fit' ? c.fit : 1;
    const target = c.pivot.position.clone().setY(c.height * s * 0.42);
    const dist = Math.max(c.span * s, 1.2) * 6.4;
    glide(b, target.clone().addScaledVector(DIR, dist), target, duration);
  }
  syncAssetButtons();
}
function overview(duration = 1.1) {
  view.focus = -1;
  for (const b of boards) frame(b, duration);
  syncAssetButtons();
}

// ── picking ──
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let down = null;
window.addEventListener('pointerup', (e) => {
  if (!down) return;
  const { b } = down;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > 5) return;
  const r = b.stage.renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, b.camera);
  let o = ray.intersectObjects(b.cells.map((c) => c.pivot), true)[0]?.object;
  while (o && o.userData.cell === undefined) o = o.parent;
  if (!o || o.userData.cell === view.focus) overview(); else focus(o.userData.cell);
});
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') overview(); });

// ── turntable clock (one for all three views, so they stay in sync) ──
let last = performance.now();
(function tick(now) {
  if (!view.paused) view.spin += ((now - last) / 1000) * 0.35;
  last = now;
  requestAnimationFrame(tick);
})(last);

// ── controls ──
const press = (sel, val, attr) => document.querySelectorAll(sel).forEach((x) => x.setAttribute('aria-pressed', x.dataset[attr] === val));
document.querySelectorAll('[data-scale]').forEach((btn) => (btn.onclick = () => {
  view.scale = btn.dataset.scale;
  press('[data-scale]', view.scale, 'scale');
  for (const b of boards) for (const c of b.cells) gsap.to(c.content.scale, { x: view.scale === 'fit' ? c.fit : 1, y: view.scale === 'fit' ? c.fit : 1, z: view.scale === 'fit' ? c.fit : 1, duration: 0.8, ease: 'power2.inOut' });
  if (view.focus >= 0) focus(view.focus); else overview();
}));
document.querySelectorAll('[data-style]').forEach((btn) => (btn.onclick = () => { view.style = btn.dataset.style; press('[data-style]', view.style, 'style'); }));
$('gray').onclick = () => { const on = document.body.classList.toggle('gray'); $('gray').setAttribute('aria-pressed', on); };
$('spin').onclick = () => { view.paused = !view.paused; $('spin').setAttribute('aria-pressed', view.paused); $('spin').textContent = view.paused ? 'Spin' : 'Pause'; };
$('png').onclick = () => boards.forEach((b) => b.stage.savePNG(`builderland-style-${b.L.key}`));

const assetBtns = ASSETS.map((a, i) => {
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.innerHTML = `${a.name}<small>${a.tier}</small>`;
  btn.onclick = () => (view.focus === i ? overview() : focus(i));
  $('assets').appendChild(btn);
  return btn;
});
function syncAssetButtons() { assetBtns.forEach((btn, i) => btn.setAttribute('aria-pressed', i === view.focus)); }
syncAssetButtons();
overview(0);
// deep link: style.html#a=mall opens zoomed on that asset
const deep = location.hash.match(/a=([\w-]+)/);
if (/still/.test(location.hash)) { view.paused = true; view.spin = 0; $('spin').textContent = 'Spin'; $('spin').setAttribute('aria-pressed', true); }
if (deep) { const i = ASSETS.findIndex((a) => a.id === deep[1]); if (i >= 0) focus(i, 0); }

// ── palette, balance and values (all generated from tokens.js) ──
let drift = 0;
for (const [key, role] of Object.entries(PALETTE)) {
  const tr = document.createElement('tr');
  const cells = role.colors.map((hex) => {
    const r = audit(hex, key);
    if (!r.ok) drift++;
    return `<span class="tok"><span class="sw" style="background:${hex}"></span><span>${hex}</span><span>S${r.s} L${r.l}</span><span><span class="chip ${r.ok ? 'ok' : 'bad'}">${r.note}</span>${r.fix ? ` <span class="fix">→ <i style="background:${r.fix}"></i>${r.fix.toUpperCase()}</span>` : ''}</span></span>`;
  });
  tr.innerHTML = `<td>${role.label}<br><small style="color:var(--muted)">${role.share}</small></td><td><div class="row-sw">${cells.join('')}</div></td>`;
  $('palette').appendChild(tr);
}
$('paletteNote').innerHTML = `Bases sit at ${RULES.baseSat[0]}–${RULES.baseSat[1]}% saturation and only accents go above ${RULES.accentSat}%. Near-whites and near-blacks (L under ${RULES.satExempt[0]} or over ${RULES.satExempt[1]}) are exempt, since HSL saturation means nothing there. Stone greys may sit under 25%, and roofs are mid colours allowed up to the accent line. `
  + (drift ? `<strong>${drift} token${drift > 1 ? 's' : ''} drift</strong> from the rules. The suggested fix keeps hue and lightness and only moves saturation. Approve it or keep the original.` : 'Every token is in budget.');

const shareColor = { nature: PALETTE.grass.colors[0], built: PALETTE.path.colors[0], accent: ACCENTS[0] };
$('share').innerHTML = Object.entries(SHARE).map(([k, v]) => `<div style="flex:${v};background:${shareColor[k]};color:${k === 'accent' ? '#FFFDF6' : INK}">${Math.round(v * 100)}%</div>`).join('');
const all = Object.values(PALETTE).flatMap((r) => r.colors).sort((a, b) => hsl(b).l - hsl(a).l);
$('values').innerHTML = all.map((hex) => `<div title="${hex}" style="background:${hex}"></div>`).join('');

window.styleBoard = { boards, view, focus, overview };
