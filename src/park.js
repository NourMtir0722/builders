// Builderland parks and animals: playground, carousel, bandstand,
// skate bowl, picnic blankets, the hot spring with capybaras, rooftop cats and the Ferris wheel.
// Each feature returns { group, update?, folk? } in local coordinates; folk entries become people
// (kids on the slide and swings, riders on the seesaw, picnickers) once world.js places the feature.
import * as THREE from 'three';
import { toon, scribbleWater } from './engine/ink.js';
import { INK, MAT, ACCENTS, PALETTE, GROUND } from './tokens.js';
import { own, M, rbox, at, shade, stripes, logoMaterial, live } from './bkit.js';
import { bakedMesh } from './merge.js';

const FUR = '#9C6B45', FUR_DARK = '#7A5236';

// ── playground ──
function slide(color) {
  const g = new THREE.Group();
  // ladder at x = -0.45, platform at y 0.62, chute down to x = 0.75
  for (const z of [-0.14, 0.14]) g.add(at(M(new THREE.BoxGeometry(0.04, 0.7, 0.04), MAT.metal), -0.5, 0.35, z));
  for (let k = 1; k < 5; k++) g.add(at(M(new THREE.BoxGeometry(0.03, 0.03, 0.3), MAT.metal), -0.5, k * 0.13, 0));
  g.add(at(M(rbox(0.36, 0.06, 0.36, 0.02), MAT.woodBoard), -0.33, 0.62, 0));
  for (const [x, z] of [[-0.16, -0.16], [-0.16, 0.16]]) g.add(at(M(new THREE.BoxGeometry(0.04, 0.62, 0.04), MAT.metal), x, 0.31, z));
  g.add(at(M(new THREE.ConeGeometry(0.3, 0.3, 4).rotateY(Math.PI / 4), color), -0.33, 0.95, 0));
  for (const z of [-0.18, 0.18]) g.add(at(M(new THREE.BoxGeometry(0.04, 0.42, 0.04), MAT.metal), -0.33, 0.8, z));
  const len = Math.hypot(0.95, 0.58), ang = Math.atan2(0.58, 0.95);
  const chute = M(new THREE.BoxGeometry(len, 0.04, 0.26), color);
  chute.position.set(0.32, 0.33, 0); chute.rotation.z = -ang;
  g.add(chute);
  for (const z of [-0.14, 0.14]) { const r = M(new THREE.BoxGeometry(len, 0.08, 0.02), shade(color, -0.1)); r.position.set(0.32, 0.37, z); r.rotation.z = -ang; g.add(r); }
  // a kid climbs, sits at the top, slides down, walks back
  const path = (f) => {
    if (f < 0.35) { const k = f / 0.35; return { x: 0.6 - k * 1.15, y: 0, z: 0.35, yaw: Math.PI }; }
    if (f < 0.5) { const k = (f - 0.35) / 0.15; return { x: -0.55, y: k * 0.6, z: 0, yaw: 0 }; }
    if (f < 0.6) return { x: -0.3, y: 0.62, z: 0, yaw: 0, sit: true };
    const k = (f - 0.6) / 0.25;
    if (f < 0.85) return { x: -0.2 + k * 0.95, y: 0.62 - k * 0.6, z: 0, yaw: 0, sit: true };
    return { x: 0.75, y: 0.02, z: 0.1, yaw: Math.PI / 2, sit: true };
  };
  return { group: g, folk: [{ act: 'ride', kid: true, path, period: 7 }] };
}

function swings(color) {
  const g = new THREE.Group();
  for (const x of [-0.55, 0.55]) for (const z of [-0.22, 0.22]) {
    const leg = M(new THREE.BoxGeometry(0.04, 0.9, 0.04), MAT.metal);
    leg.position.set(x, 0.43, z * 0.6); leg.rotation.x = z > 0 ? -0.25 : 0.25;
    g.add(leg);
  }
  g.add(at(M(new THREE.CylinderGeometry(0.03, 0.03, 1.15, 8).rotateZ(Math.PI / 2), color), 0, 0.86, 0));
  const seats = [-0.25, 0.25].map((x) => {
    const s = live(new THREE.Group());
    s.position.set(x, 0.86, 0);
    for (const dx of [-0.08, 0.08]) s.add(at(M(new THREE.CylinderGeometry(0.006, 0.006, 0.62, 4), MAT.metal), dx, -0.31, 0));
    s.add(at(M(rbox(0.2, 0.03, 0.1, 0.01), INK), 0, -0.62, 0));
    g.add(s);
    return s;
  });
  const update = (t) => seats.forEach((s, i) => (s.rotation.x = Math.sin(t * 2.2 + i * 1.3) * 0.6));
  const folk = [-0.25, 0.25].map((x, i) => ({
    act: 'ride', kid: true, period: 2 * Math.PI / 2.2,
    path: (f, t) => { const a = Math.sin(t * 2.2 + i * 1.3) * 0.6; return { x, y: 0.86 - Math.cos(a) * 0.62 + 0.02 - 0.13 * 0.75, z: Math.sin(a) * 0.62, yaw: -Math.PI / 2, sit: true, lean: a }; },
  }));
  return { group: g, update, folk };
}

function seesaw(color) {
  const g = new THREE.Group();
  g.add(at(M(new THREE.ConeGeometry(0.12, 0.25, 4).rotateY(Math.PI / 4), MAT.metal), 0, 0.12, 0));
  const board = live(new THREE.Group());
  board.position.y = 0.25;
  board.add(M(rbox(1.2, 0.04, 0.14, 0.02), color));
  for (const x of [-0.5, 0.5]) board.add(at(M(new THREE.BoxGeometry(0.02, 0.12, 0.12), MAT.metal), x, 0.07, 0));
  g.add(board);
  const tilt = (t) => Math.sin(t * 1.8) * 0.28;
  const folk = [-0.52, 0.52].map((x) => ({
    act: 'ride', kid: true, period: 3.5,
    path: (f, t) => { const a = tilt(t); return { x: x * Math.cos(a) - 0.03 * Math.sign(x), y: 0.25 + x * Math.sin(a) + 0.02 - 0.13 * 0.75, z: 0, yaw: x < 0 ? 0 : Math.PI, sit: true }; },
  }));
  return { group: g, update: (t) => (board.rotation.z = tilt(t)), folk };
}

function sandbox() {
  const g = new THREE.Group();
  for (const [w, d, x, z] of [[1.0, 0.08, 0, -0.46], [1.0, 0.08, 0, 0.46], [0.08, 0.84, -0.46, 0], [0.08, 0.84, 0.46, 0]]) g.add(at(M(rbox(w, 0.12, d, 0.02), MAT.woodBoard), x, 0.06, z));
  g.add(at(M(new THREE.BoxGeometry(0.86, 0.06, 0.86), '#EBD9A8'), 0, 0.04, 0));
  g.add(at(M(new THREE.ConeGeometry(0.12, 0.14, 10), '#E2CC92'), 0.15, 0.13, -0.1));
  g.add(at(M(new THREE.CylinderGeometry(0.05, 0.04, 0.07, 8), ACCENTS[2]), -0.2, 0.1, 0.18));
  return { group: g, folk: [{ act: 'sit', kid: true, x: -0.12, z: 0.05, seatY: 0.08, yaw: 0.6 }] };
}

export function playground(rng) {
  const g = new THREE.Group();
  const out = { group: g, updates: [], folk: [] };
  const parts = [[slide(ACCENTS[0]), -0.95, -0.7, 0], [swings(ACCENTS[2]), 0.85, -0.85, 0], [seesaw(ACCENTS[1]), 0.8, 0.85, 0.3], [sandbox(), -0.85, 0.85, 0]];
  for (const [p, x, z, ry] of parts) {
    p.group.position.set(x, 0, z); p.group.rotation.y = ry;
    g.add(p.group);
    if (p.update) out.updates.push(p.update);
    for (const f of p.folk || []) out.folk.push(placeFolk(f, x, z, ry));
  }
  // rubber safety floor
  g.add(at(M(new THREE.CylinderGeometry(2.1, 2.1, 0.02, 40), '#D9B48F'), 0, 0.01, 0));
  return out;
}

/** Moves a feature's folk entry from part space into feature space. */
function placeFolk(f, ox, oz, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const tx = (x, z) => [ox + x * c + z * s, oz - x * s + z * c];
  if (f.path) {
    const path = f.path;
    return { ...f, path: (k, t) => { const p = path(k, t); const [x, z] = tx(p.x, p.z); return { ...p, x, z, yaw: p.yaw + ry }; } };
  }
  const [x, z] = tx(f.x, f.z);
  return { ...f, x, z, yaw: (f.yaw || 0) + ry };
}

// ── carousel, bandstand, skate bowl, picnic ──
export function carousel() {
  const g = new THREE.Group();
  g.add(at(M(new THREE.CylinderGeometry(1.25, 1.3, 0.16, 24), MAT.wall), 0, 0.08, 0));
  const spin = live(new THREE.Group());
  g.add(spin);
  spin.add(at(M(new THREE.CylinderGeometry(1.15, 1.15, 0.06, 24), '#E4572E'), 0, 0.19, 0));
  spin.add(at(M(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 12), '#F2B705'), 0, 0.8, 0));
  spin.add(at(M(new THREE.ConeGeometry(1.4, 0.55, 12, 1), stripes('#E4572E', MAT.awning, 12)), 0, 1.68, 0));
  spin.add(at(M(new THREE.SphereGeometry(0.1, 10, 8), '#F2B705'), 0, 2.0, 0));
  const horses = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const h = live(new THREE.Group());
    h.position.set(Math.cos(a) * 0.82, 0.5, Math.sin(a) * 0.82);
    h.rotation.y = -a;
    h.add(at(M(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 5), '#F2B705'), 0, 0.4, 0));
    h.add(at(M(new THREE.CapsuleGeometry(0.07, 0.2, 4, 8).rotateX(Math.PI / 2), ACCENTS[k % 6] === ACCENTS[1] ? MAT.wallWhite : ACCENTS[(k + 2) % 6]), 0, 0, 0));
    h.add(at(M(new THREE.CapsuleGeometry(0.04, 0.1, 4, 6).rotateX(0.7), MAT.wallWhite), 0, 0.1, 0.16));
    spin.add(h);
    horses.push(h);
  }
  const update = (t) => {
    spin.rotation.y = t * 0.6;
    horses.forEach((h, k) => (h.position.y = 0.5 + Math.sin(t * 2.4 + k) * 0.08));
  };
  return { group: g, updates: [update], folk: [] };
}

export function bandstand() {
  const g = new THREE.Group();
  g.add(at(M(new THREE.CylinderGeometry(1.0, 1.05, 0.3, 8), MAT.wall), 0, 0.15, 0));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    g.add(at(M(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 6), MAT.wallWhite), Math.cos(a) * 0.9, 0.8, Math.sin(a) * 0.9));
  }
  g.add(at(M(new THREE.ConeGeometry(1.25, 0.6, 8).rotateY(Math.PI / 8), PALETTE.roofs.colors[3]), 0, 1.6, 0));
  g.add(at(M(new THREE.SphereGeometry(0.08, 8, 6), '#F2B705'), 0, 1.95, 0));
  const folk = [[-0.35, -0.2], [0.3, -0.25], [0, 0.3]].map(([x, z], i) => ({ act: i === 2 ? 'wave' : 'cheer', x, z, y: 0.3, yaw: Math.PI / 4 }));
  // an audience on the grass
  for (let k = 0; k < 4; k++) folk.push({ act: k % 2 ? 'cheer' : 'idle', x: 1.4 + (k % 2) * 0.35, z: 0.9 + k * 0.3 - 0.4, yaw: Math.PI + 0.7 });
  return { group: g, updates: [], folk };
}

export function skateBowl() {
  const g = new THREE.Group();
  g.add(at(M(new THREE.CylinderGeometry(1.35, 1.35, 0.14, 32), '#C9C4BA'), 0, 0.07, 0));
  const bowl = M(new THREE.SphereGeometry(1.2, 32, 10, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), '#B9B3A8');
  bowl.material = toon('#B9B3A8');
  bowl.position.y = 1.05;
  g.add(bowl);
  g.add(at(M(new THREE.TorusGeometry(1.22, 0.04, 6, 40).rotateX(Math.PI / 2), MAT.metal), 0, 0.15, 0));
  const board = live(new THREE.Group());
  board.add(at(M(rbox(0.3, 0.025, 0.09, 0.01), ACCENTS[3]), 0, 0.04, 0));
  g.add(board);
  const folk = [{
    act: 'ride', period: 3,
    path: (f, t) => {
      const a = t * 2.1;
      const x = Math.sin(a) * 0.85, y = 0.15 + (1 - Math.cos(2 * a)) * 0.04 - 0.55 + Math.abs(Math.sin(a)) * 0.45;
      return { x, y: Math.max(0.06, y + 0.05), z: Math.cos(a) * 0.15, yaw: Math.cos(a) > 0 ? 0 : Math.PI };
    },
  }];
  const update = (t) => {
    const a = t * 2.1;
    board.position.set(Math.sin(a) * 0.85, Math.max(0.02, 0.15 - 0.55 + Math.abs(Math.sin(a)) * 0.45), Math.cos(a) * 0.15);
    board.rotation.z = Math.cos(a) * 0.5;
  };
  return { group: g, updates: [update], folk };
}

export function picnic(rng, n = 2) {
  const g = new THREE.Group();
  const folk = [];
  for (let k = 0; k < n; k++) {
    const x = (k - (n - 1) / 2) * 1.3, z = rng.range(-0.3, 0.3), ry = rng.range(-0.4, 0.4);
    const blanket = M(new THREE.BoxGeometry(0.85, 0.015, 0.65), stripes(ACCENTS[(k * 2) % 6], MAT.awning, 6));
    blanket.position.set(x, 0.01, z); blanket.rotation.y = ry;
    g.add(blanket);
    g.add(at(M(rbox(0.22, 0.14, 0.15, 0.03), MAT.woodBoard), x + 0.15, 0.08, z - 0.1));
    for (const [dx, yaw] of [[-0.25, 0], [0.25, Math.PI]]) folk.push({ act: 'sit', x: x + dx, z: z + 0.1, seatY: 0.02, yaw: yaw + ry });
  }
  return { group: g, updates: [], folk };
}

// ── animals ──
/** A capybara, soaking or standing. ~0.45 long. Faces +x. */
export function capybara({ orange = false } = {}) {
  const g = new THREE.Group();
  const body = M(new THREE.SphereGeometry(0.2, 16, 12), FUR); body.scale.set(1.25, 0.85, 0.85); body.position.y = 0.16;
  const head = live(new THREE.Group());
  head.position.set(0.26, 0.26, 0);
  head.add(M(rbox(0.2, 0.15, 0.15, 0.06), FUR));
  head.add(at(M(rbox(0.08, 0.1, 0.12, 0.04), FUR_DARK), 0.1, -0.015, 0));
  for (const z of [-0.06, 0.06]) {
    head.add(at(M(new THREE.SphereGeometry(0.03, 8, 6), FUR_DARK), -0.05, 0.08, z));
    head.add(at(M(new THREE.SphereGeometry(0.014, 6, 4), INK), 0.05, 0.035, z * 1.1));
  }
  if (orange) head.add(at(M(new THREE.SphereGeometry(0.05, 10, 8), '#F2994A'), -0.02, 0.11, 0));
  g.add(body, head);
  g.userData.head = head;
  return g;
}

/** The hot spring: warm water with steam and capybaras soaking in it. Sits in a 3×3 pond hole. */
export function hotSpring(rng) {
  const g = new THREE.Group();
  const updates = [];
  const wMat = own(new THREE.MeshToonMaterial({ map: scribbleWater('#A9D9D2'), gradientMap: toon('#fff').gradientMap }));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3, 3).rotateX(-Math.PI / 2), wMat);
  water.position.y = -0.14; water.receiveShadow = true;
  g.add(water);
  // rocks around the rim
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    const r = M(new THREE.DodecahedronGeometry(0.18 + (k % 3) * 0.04, 0), k % 2 ? '#A8A296' : '#9B9488');
    r.position.set(Math.cos(a) * 1.55, 0.02, Math.sin(a) * 1.55);
    r.scale.y = 0.7;
    g.add(r);
  }
  const capys = [[-0.5, -0.3, 0.6, true], [0.45, -0.45, 2.3, false], [0.1, 0.5, 4.2, true], [-0.6, 0.55, 5.4, false]].map(([x, z, yaw, orange]) => {
    const c = live(capybara({ orange }));
    c.position.set(x, -0.27, z); c.rotation.y = yaw;
    g.add(c);
    return c;
  });
  const steamMat = own(new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.55, depthWrite: false }));
  const steam = Array.from({ length: 10 }, (_, k) => {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), steamMat);
    s.layers.set(1);
    s.userData.o = [rng.range(-1, 1), rng.range(-1, 1), k / 10];
    g.add(s);
    return s;
  });
  updates.push((t) => {
    capys.forEach((c, k) => { c.position.y = -0.27 + Math.sin(t * 1.1 + k) * 0.015; c.userData.head.rotation.z = Math.sin(t * 0.5 + k * 2) * 0.12; });
    steam.forEach((s) => {
      const [x, z, ph] = s.userData.o;
      const q = (t * 0.25 + ph) % 1;
      s.position.set(x + Math.sin(t + ph * 9) * 0.1, -0.1 + q * 1.2, z);
      s.scale.setScalar(0.35 + q * 1.0);
    });
    steamMat.opacity = 0.3;
  });
  return { group: g, updates, folk: [] };
}

/** A cat: sleeping curled up, or sitting with its tail swishing. ~0.25 long. */
export function cat(color = '#F2994A', { sleeping = true } = {}) {
  const g = live(new THREE.Group());
  const body = live(M(new THREE.SphereGeometry(0.09, 12, 10), color));
  body.scale.set(1.3, sleeping ? 0.6 : 1.1, sleeping ? 1.1 : 0.9);
  body.position.y = sleeping ? 0.055 : 0.1;
  const head = new THREE.Group();
  head.position.set(sleeping ? 0.08 : 0.06, sleeping ? 0.07 : 0.2, sleeping ? 0.05 : 0);
  head.add(M(new THREE.SphereGeometry(0.06, 12, 10), color));
  for (const z of [-0.035, 0.035]) head.add(at(M(new THREE.ConeGeometry(0.022, 0.05, 4), color), 0, 0.055, z));
  if (!sleeping) for (const z of [-0.022, 0.022]) head.add(at(M(new THREE.SphereGeometry(0.009, 6, 4), INK), 0.054, 0.01, z));
  const tail = live(new THREE.Group());
  tail.position.set(-0.1, 0.05, 0);
  tail.add(at(M(new THREE.CapsuleGeometry(0.016, 0.13, 4, 6).rotateZ(sleeping ? Math.PI / 2 : 0.4), color), -0.03, sleeping ? 0 : 0.06, sleeping ? 0.04 : 0));
  g.add(body, head, tail);
  g.userData.update = (t, k = 0) => {
    if (sleeping) body.scale.y = 0.6 + Math.sin(t * 1.6 + k) * 0.03;
    else tail.rotation.x = Math.sin(t * 2 + k) * 0.5;
  };
  return g;
}

// ── the Ferris wheel (an XL-height landmark on one parcel) ──
export function ferrisWheel(place, slots = []) {
  const g = new THREE.Group();
  const R = 2.6, HUB = 3.1, N = 10;
  const leg = (x, z, s) => { const l = M(new THREE.CylinderGeometry(0.06, 0.08, HUB + 0.3, 8), MAT.wallWhite); l.position.set(x * 0.5, HUB / 2, z); l.rotation.z = s * 0.28; return l; };
  for (const z of [-0.45, 0.45]) g.add(leg(-1, z, -1), leg(1, z, 1));
  g.add(at(M(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 10).rotateX(Math.PI / 2), MAT.metal), 0, HUB, 0));
  g.add(at(M(rbox(2.4, 0.18, 1.3, 0.05), MAT.plinth[0]), 0, 0.09, 0));
  const wheel = live(new THREE.Group());
  wheel.position.set(0, HUB, 0);
  g.add(wheel);
  const bulbs = own(new THREE.MeshStandardMaterial({ color: '#FFF3D6', emissive: '#FFC86B', emissiveIntensity: 0 }));
  bulbs.userData.glow = true;
  for (const z of [-0.3, 0.3]) {
    wheel.add(at(M(new THREE.TorusGeometry(R, 0.05, 6, 48), place.color), 0, 0, z));
    wheel.add(at(M(new THREE.TorusGeometry(R * 0.35, 0.035, 6, 24), place.color), 0, 0, z));
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      const sp = M(new THREE.CylinderGeometry(0.02, 0.02, R, 5), MAT.wallWhite);
      sp.position.set(Math.cos(a) * R / 2, Math.sin(a) * R / 2, z);
      sp.rotation.z = a - Math.PI / 2;
      wheel.add(sp);
      for (let b = 0; b < 3; b++) {
        const ba = a + ((b + 1) / 4) * ((Math.PI * 2) / N);
        wheel.add(at(M(new THREE.SphereGeometry(0.035, 6, 4), bulbs), Math.cos(ba) * R, Math.sin(ba) * R, z));
      }
    }
  }
  const gondolas = [];
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2;
    const slot = slots[k] || { color: ACCENTS[k % ACCENTS.length] };
    const pivot = live(new THREE.Group());
    pivot.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    pivot.add(bakedMesh([
      [new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), MAT.metal, 0, -0.1, 0],
      [rbox(0.38, 0.3, 0.42, 0.08), slot.color, 0, -0.34, 0],
      [new THREE.ConeGeometry(0.28, 0.14, 4).rotateY(Math.PI / 4), shade(slot.color, 0.12), 0, -0.12, 0],
      [new THREE.BoxGeometry(0.39, 0.1, 0.3), MAT.glass, 0, -0.29, 0],
    ], toon('#fff').gradientMap));
    wheel.add(pivot);
    gondolas.push(pivot);
  }
  // ticket booth with the place's sign
  const booth = new THREE.Group();
  booth.add(at(M(rbox(0.7, 0.75, 0.55, 0.05), MAT.wall), 0, 0.375, 0));
  booth.add(at(M(new THREE.BoxGeometry(0.8, 0.05, 0.7), stripes(place.color, MAT.awning, 8)), 0, 0.8, 0.05));
  const sign = M(new THREE.BoxGeometry(1.2, 0.3, 0.05), [toon(INK), toon(INK), toon(INK), toon(INK), logoMaterial(place, 1.2 / 0.3), toon(INK)]);
  sign.position.set(0, 1.05, 0.05);
  booth.add(sign);
  booth.position.set(1.6, 0, 1.6); booth.rotation.y = Math.PI / 4;
  g.add(booth);
  g.userData.update = (t) => {
    wheel.rotation.z = t * 0.12;
    for (const p of gondolas) p.rotation.z = -wheel.rotation.z + Math.sin(t * 1.3 + p.id) * 0.04;
  };
  g.userData.spots = { stand: [{ x: 1.9, z: 2.3, yaw: Math.PI * 1.25 - Math.PI / 2 }, { x: 2.3, z: 2.0, yaw: Math.PI }, { x: 2.5, z: 2.6, yaw: Math.PI }] };
  g.userData.height = HUB + R + 0.5;
  return g;
}
