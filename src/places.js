// Builderland places: the buildings tools and sponsors live in, plus the mascot.
// Every builder returns a Group whose origin sits at the centre of its footprint, on the ground.
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { toon } from './engine/ink.js';
import { FONT } from './engine/label.js';
import { INK, MAT, ACCENTS } from './tokens.js';

export const PLACE_KINDS = ['lab', 'logo', 'hq', 'shop', 'mall', 'wheel', 'billboard', 'screen'];
export const KIND_LABEL = { lab: 'AI lab', logo: 'Logo landmark', hq: 'HQ tower', shop: 'Shop', mall: 'Mall', wheel: 'Ferris wheel', billboard: 'Billboard', screen: 'Screen billboard' };
/** Footprint: 'half' = a 2×2 lot (two per parcel), 'full' = a whole 5×5 parcel, 'xl' = a 2×2 block of parcels (11×11). */
export const KIND_SIZE = { lab: 'full', logo: 'full', hq: 'full', mall: 'xl', wheel: 'full', shop: 'half', billboard: 'half', screen: 'half' };

import { ramp, own, M, rbox, at, shade, logoMaterial, stripes, windows, planter, live } from './bkit.js';
export { logoMaterial };
import { creatorMall } from './mall.js';
import { ferrisWheel } from './park.js';
import { screenBillboard } from './signs.js';

// ── buildings v2 ─────────────────────────────────────────────────
const FLOWERS = ['#F4A6B8', '#F7D35C', '#FFFFFF', '#B69CF0', '#F2994A'];
const signBox = (w, h, d, mat) => M(new THREE.BoxGeometry(w, h, d), [toon(INK), toon(INK), toon(INK), toon(INK), mat, toon(INK)]);
const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const glowMat = (color = '#FFF3D6', emissive = '#FFC86B') => {
  const m = own(new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0 }));
  m.userData.glow = true;
  return m;
};

export const FACADES = ['cafe', 'bookshop', 'studio', 'bakery', 'print', 'ramen'];
export const FACADE_LABEL = { cafe: 'Café', bookshop: 'Bookshop', studio: 'Studio', bakery: 'Bakery', print: 'Print shop', ramen: 'Ramen bar' };
/** A shop's facade: its own `facade`, or one picked from its name so it stays the same. */
export const facadeOf = (place) => (FACADES.includes(place.facade) ? place.facade : FACADES[hash(place.name) % FACADES.length]);

function gableRoof(w, d, h, color, overhang = 0.12) {
  const s = new THREE.Shape([new THREE.Vector2(-w / 2 - overhang, 0), new THREE.Vector2(w / 2 + overhang, 0), new THREE.Vector2(0, h)]);
  return M(new THREE.ExtrudeGeometry(s, { depth: d + overhang * 2, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 }).translate(0, 0, -(d + overhang * 2) / 2).rotateY(Math.PI / 2), color);
}
function table(color) {
  const t = new THREE.Group();
  t.add(at(M(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12), MAT.wall), 0, 0.32, 0));
  t.add(at(M(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6), MAT.metal), 0, 0.16, 0));
  for (const s of [-1, 1]) t.add(at(M(rbox(0.13, 0.17, 0.13, 0.03), color), s * 0.24, 0.085, 0));
  return t;
}

export function shop(place) {
  const g = new THREE.Group();
  const kind = facadeOf(place);
  const c = place.color;
  const updates = [];
  const glass = own(new THREE.MeshToonMaterial({ color: MAT.glass, emissive: MAT.windowLit, emissiveIntensity: 0, gradientMap: ramp() }));
  glass.userData.glow = true;
  const body = (w, h, d, color = MAT.wall, z = -0.2) => g.add(at(M(rbox(w, h, d, 0.06), color), 0, h / 2, z));

  if (kind === 'cafe') {
    body(1.7, 1.15, 1.2);
    g.add(at(gableRoof(1.7, 1.2, 0.5, shade(c, -0.1)), 0, 1.15, -0.2));
    g.add(at(M(new THREE.BoxGeometry(1.1, 0.55, 0.04), glass), -0.2, 0.55, 0.41));
    g.add(at(M(new THREE.BoxGeometry(0.34, 0.75, 0.04), MAT.door), 0.6, 0.375, 0.41));
    const aw = M(new THREE.BoxGeometry(1.75, 0.05, 0.55), stripes(c, MAT.awning)); aw.position.set(0, 0.95, 0.65); aw.rotation.x = 0.38; g.add(aw);
    g.add(at(signBox(1.2, 0.32, 0.06, logoMaterial(place, 1.2 / 0.32)), 0, 1.4, 0.43));
    // a giant coffee cup on the ridge
    const cup = new THREE.Group();
    cup.add(at(M(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 14), MAT.wallWhite), 0, 0.15, 0));
    cup.add(at(M(new THREE.TorusGeometry(0.08, 0.025, 6, 12), MAT.wallWhite), 0.21, 0.16, 0));
    cup.add(at(M(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 14), MAT.door), 0, 0.29, 0));
    g.add(at(cup, 0.45, 1.55, -0.2));
    g.add(at(table(c), -0.55, 0, 0.85), at(table(c), 0.5, 0, 0.88));
    g.userData.spots = { sit: [[-0.55, 0.85], [0.5, 0.88]].flatMap(([x, z]) => [{ x: x - 0.24, z, y: 0.19, yaw: 0 }, { x: x + 0.24, z, y: 0.19, yaw: Math.PI }]) };
  } else if (kind === 'bookshop') {
    const wood = shade(c, -0.18);
    body(1.6, 1.35, 1.15, MAT.wallAlt);
    g.add(at(M(rbox(1.72, 1.0, 0.12, 0.03), wood), 0, 0.5, 0.42));
    g.add(at(gableRoof(1.6, 1.15, 0.45, '#5C4A3E'), 0, 1.35, -0.2));
    // bay window full of books
    g.add(at(M(rbox(0.9, 0.62, 0.3, 0.04), wood), -0.3, 0.55, 0.55));
    g.add(at(M(new THREE.BoxGeometry(0.78, 0.5, 0.02), glass), -0.3, 0.57, 0.71));
    for (let row = 0; row < 2; row++) for (let k = 0; k < 7; k++) {
      const h = 0.13 + ((k * 7 + row * 3) % 5) * 0.015;
      g.add(at(M(new THREE.BoxGeometry(0.075, h, 0.12), [ACCENTS[k % 6], MAT.wall, '#5C8B45', MAT.door][(k + row) % 4]), -0.6 + k * 0.1, 0.36 + row * 0.24 + h / 2, 0.6));
    }
    g.add(at(M(new THREE.BoxGeometry(0.32, 0.75, 0.04), MAT.door), 0.5, 0.375, 0.49));
    g.add(at(signBox(1.3, 0.3, 0.06, logoMaterial(place, 1.3 / 0.3, { bg: wood })), 0, 1.15, 0.49));
    // hanging bracket sign
    g.add(at(M(new THREE.BoxGeometry(0.03, 0.03, 0.32), MAT.metal), 0.82, 1.15, 0.6));
    const hs = signBox(0.28, 0.28, 0.03, logoMaterial(place, 1)); hs.rotation.y = Math.PI / 2;
    g.add(at(hs, 0.82, 0.96, 0.66));
    const cart = new THREE.Group();
    cart.add(at(M(rbox(0.5, 0.06, 0.28, 0.02), wood), 0, 0.32, 0));
    for (let k = 0; k < 4; k++) cart.add(at(M(new THREE.BoxGeometry(0.09, 0.14, 0.2), ACCENTS[(k + 2) % 6]), -0.17 + k * 0.11, 0.42, 0));
    for (const x of [-0.2, 0.2]) cart.add(at(M(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 10).rotateX(Math.PI / 2), MAT.metal), x, 0.06, 0.15), at(M(new THREE.BoxGeometry(0.03, 0.3, 0.03), MAT.metal), x, 0.16, 0));
    g.add(at(cart, 0.45, 0, 0.85));
  } else if (kind === 'studio') {
    body(1.75, 1.25, 1.2, '#EEF1F2');
    g.add(at(M(rbox(1.85, 0.1, 1.3, 0.03), c), 0, 1.27, -0.2));
    // sawtooth skylights
    for (let k = 0; k < 3; k++) {
      const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 0.3)]);
      const tooth = M(new THREE.ExtrudeGeometry(s, { depth: 1.0, bevelEnabled: false }).translate(-0.25, 0, -0.5), k % 2 ? MAT.wall : MAT.glassAtrium);
      tooth.position.set(-0.55 + k * 0.55, 1.32, -0.2);
      g.add(tooth);
    }
    g.add(at(M(new THREE.BoxGeometry(1.45, 0.85, 0.04), glass), -0.05, 0.5, 0.41));
    for (const x of [-0.53, -0.05, 0.43]) g.add(at(M(new THREE.BoxGeometry(0.04, 0.85, 0.06), INK), x, 0.5, 0.42));
    g.add(at(signBox(1.0, 0.24, 0.05, logoMaterial(place, 1.0 / 0.24, { bg: INK })), 0.25, 1.07, 0.44));
    const easel = new THREE.Group();
    for (const s of [-1, 1]) { const l = M(new THREE.BoxGeometry(0.035, 0.75, 0.035), MAT.woodPost); l.position.set(s * 0.16, 0.37, 0); l.rotation.z = s * 0.12; easel.add(l); }
    easel.add(at(M(new THREE.BoxGeometry(0.45, 0.35, 0.03), [toon('#FFFDF6'), toon('#FFFDF6'), toon('#FFFDF6'), toon('#FFFDF6'), logoMaterial({ name: '✿', color: ACCENTS[(hash(place.name) % 6)] }, 1.3), toon('#FFFDF6')]), 0, 0.6, 0.03));
    easel.rotation.y = 0.5;
    g.add(at(easel, -0.6, 0, 0.8), at(planter(), 0.75, 0, 0.75));
    g.userData.spots = { roof: [{ x: 0.7, y: 1.32, z: 0.25, yaw: -0.6 }] };
  } else if (kind === 'bakery') {
    body(1.65, 1.1, 1.15, '#FBEFE0');
    g.add(at(gableRoof(1.65, 1.15, 0.55, shade(c, -0.05)), 0, 1.1, -0.2));
    g.add(at(M(new THREE.BoxGeometry(0.22, 0.5, 0.22), MAT.terracotta), -0.45, 1.5, -0.45));
    g.add(at(M(new THREE.BoxGeometry(1.0, 0.5, 0.04), glass), -0.25, 0.52, 0.38));
    for (let k = 0; k < 5; k++) g.add(at(M(new THREE.SphereGeometry(0.07, 10, 6).scale(1.4, 0.8, 1), '#D9A066'), -0.62 + k * 0.18, 0.33, 0.43));
    g.add(at(M(new THREE.BoxGeometry(1.0, 0.04, 0.12), MAT.woodBoard), -0.25, 0.27, 0.43));
    g.add(at(M(new THREE.BoxGeometry(0.34, 0.75, 0.04), '#F4A6B8'), 0.55, 0.375, 0.38));
    const aw = M(new THREE.BoxGeometry(1.7, 0.05, 0.45), stripes('#F4A6B8', MAT.awning)); aw.position.set(0, 0.92, 0.6); aw.rotation.x = 0.4; g.add(aw);
    g.add(at(signBox(1.2, 0.32, 0.06, logoMaterial(place, 1.2 / 0.32)), 0, 1.33, 0.38));
    // smoke puffs from the chimney
    const puffs = [0, 1, 2].map((k) => { const p = M(new THREE.IcosahedronGeometry(0.1, 1), '#FFFFFF'); p.castShadow = false; p.layers.set(1); g.add(p); return p; });
    updates.push((t) => puffs.forEach((p, k) => {
      const q = (t * 0.35 + k / 3) % 1;
      p.position.set(-0.45 + q * 0.25, 1.8 + q * 0.9, -0.45);
      p.scale.setScalar(0.6 + q * 1.4);
    }));
    g.add(at(planter('#F4A6B8'), 0.85, 0, 0.7));
  } else if (kind === 'print') {
    body(1.75, 1.2, 1.2, '#E8E4DA');
    g.add(at(M(rbox(1.85, 0.12, 1.3, 0.03), MAT.metal), 0, 1.22, -0.2));
    // roll-up door half open, presses inside
    g.add(at(M(new THREE.BoxGeometry(0.85, 0.55, 0.03), '#3B3A36'), -0.35, 0.3, 0.41));
    g.add(at(M(new THREE.BoxGeometry(0.88, 0.3, 0.06), stripes(MAT.metalLight, '#C9C4BA', 10)), -0.35, 0.72, 0.42));
    g.add(at(M(rbox(0.5, 0.3, 0.3, 0.03), c), -0.35, 0.15, 0.2));
    // poster wall
    for (let k = 0; k < 6; k++) {
      const p = M(new THREE.BoxGeometry(0.2, 0.27, 0.01), ACCENTS[(k + hash(place.name)) % 6]);
      p.position.set(0.32 + (k % 3) * 0.22, 0.45 + Math.floor(k / 3) * 0.32, 0.405);
      p.rotation.z = ((k * 37) % 7 - 3) * 0.03;
      g.add(p);
    }
    g.add(at(signBox(1.5, 0.3, 0.06, logoMaterial(place, 1.5 / 0.3)), 0, 1.0, 0.44));
    for (let k = 0; k < 3; k++) g.add(at(M(new THREE.BoxGeometry(0.3, 0.08, 0.22), '#FFFDF6'), 0.75, 0.04 + k * 0.08, 0.8 - k * 0.01));
    // rooftop paper roll
    g.add(at(M(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 14).rotateZ(Math.PI / 2), '#FFFDF6'), 0.2, 1.44, -0.3));
    g.userData.spots = { roof: [{ x: -0.55, y: 1.28, z: 0.1, yaw: 0.8 }] };
  } else {
    // ramen: deep eaves, noren curtain, red lanterns
    body(1.65, 1.15, 1.15, '#F3E6CF');
    const eave = M(rbox(2.0, 0.12, 1.55, 0.04), '#3F3A40'); eave.position.set(0, 1.2, -0.15); g.add(eave);
    g.add(at(gableRoof(1.6, 1.3, 0.42, '#4A4450', 0.05), 0, 1.26, -0.2));
    g.add(at(M(new THREE.BoxGeometry(1.5, 0.1, 0.12), MAT.woodPost), 0, 0.95, 0.46));
    for (let k = 0; k < 4; k++) {
      const n = live(M(new THREE.BoxGeometry(0.33, 0.42, 0.015), c));
      n.position.set(-0.54 + k * 0.36, 0.69, 0.5);
      g.add(n);
      updates.push((t) => (n.rotation.x = Math.sin(t * 1.6 + k) * 0.06));
    }
    g.add(at(M(new THREE.BoxGeometry(1.2, 0.45, 0.04), glass), 0, 0.3, 0.39));
    g.add(at(signBox(1.1, 0.3, 0.06, logoMaterial(place, 1.1 / 0.3, { bg: '#3F3A40' })), 0, 1.45, 0.62));
    const lan = glowMat('#E4572E', '#FF6A3D');
    for (const x of [-0.9, 0.9]) {
      g.add(at(M(new THREE.SphereGeometry(0.12, 12, 8).scale(1, 1.25, 1), lan), x, 0.92, 0.62));
      g.add(at(M(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 10), INK), x, 1.08, 0.62));
    }
    // a bowl on the roof
    const bowl = M(new THREE.SphereGeometry(0.26, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#FFFDF6');
    g.add(at(bowl, 0.5, 1.85, -0.3), at(M(new THREE.CircleGeometry(0.24, 16).rotateX(-Math.PI / 2), '#E9B86A'), 0.5, 1.85, -0.3));
    for (const x of [0.45, 0.52]) { const st = M(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 5), MAT.woodBoard); st.position.set(x, 1.98, -0.3); st.rotation.z = -0.5; g.add(st); }
  }
  if (updates.length) g.userData.update = (t) => updates.forEach((fn) => fn(t));
  g.userData.height = 1.9;
  return g;
}

export function hq(place, signs = []) {
  const g = new THREE.Group();
  const tiers = [[3.0, 1.45, 2.6], [2.4, 1.3, 2.0], [1.8, 1.15, 1.5]];
  let y = 0;
  const plants = [];
  tiers.forEach(([w, h, d], i) => {
    const glass = windows('#EEF1F2', Math.round(w * 3), Math.round(h * 3));
    const side = windows('#E4E9EB', Math.round(d * 3), Math.round(h * 3));
    g.add(at(M(rbox(w, h, d, 0.08), [side, side, toon('#E4E9EB'), toon('#E4E9EB'), glass, glass]), 0, y + h / 2, -0.2));
    // vertical fins on the facade
    for (let k = 1; k < 4; k++) g.add(at(M(new THREE.BoxGeometry(0.05, h, 0.12), '#D5DADC'), -w / 2 + (k * w) / 4, y + h / 2, -0.2 + d / 2 + 0.04));
    y += h;
    g.add(at(M(rbox(w + 0.14, 0.16, d + 0.14, 0.06), place.color), 0, y, -0.2));
    y += 0.08;
    // setback terrace gardens on the lower tiers
    const next = tiers[i + 1];
    if (next) for (const s of [-1, 1]) {
      const px = s * (next[0] / 2 + (w - next[0]) / 4);
      plants.push([px, y, -0.2 + d / 2 - 0.2]);
    }
  });
  for (const [x, py, z] of plants) {
    g.add(at(M(rbox(0.28, 0.12, 0.7, 0.03), MAT.terracotta), x, py + 0.06, z - 0.2));
    for (let k = 0; k < 3; k++) g.add(at(M(new THREE.IcosahedronGeometry(0.1, 1), k % 2 ? '#6A9A4C' : '#5C8B45'), x, py + 0.17, z - 0.45 + k * 0.25));
  }
  // rooftop: logo, antenna with a blinking light
  const badge = M(rbox(1.15, 1.15, 0.2, 0.1), [toon(INK), toon(INK), toon(INK), toon(INK), logoMaterial(place, 1, { bg: '#FFFDF6' }), logoMaterial(place, 1, { bg: '#FFFDF6' })]);
  badge.position.set(-0.15, y + 0.85, -0.2); badge.rotation.y = Math.PI / 4;
  g.add(badge, at(M(new THREE.CylinderGeometry(0.06, 0.08, 0.3, 8), MAT.metal), -0.15, y + 0.15, -0.2));
  g.add(at(M(new THREE.CylinderGeometry(0.02, 0.03, 1.1, 6), MAT.metal), 0.65, y + 0.55, -0.65));
  const beacon = own(new THREE.MeshStandardMaterial({ color: '#E4572E', emissive: '#FF3B2E', emissiveIntensity: 0.4 }));
  g.add(at(M(new THREE.SphereGeometry(0.05, 8, 6), beacon), 0.65, y + 1.12, -0.65));
  // entrance: canopy on columns, revolving door, flags
  g.add(at(M(new THREE.BoxGeometry(4.4, 0.05, 1.4), MAT.forecourt), 0, 0.025, 1.7));
  g.add(at(M(rbox(1.7, 0.08, 0.9, 0.03), place.color), 0, 0.95, 1.45));
  for (const x of [-0.75, 0.75]) g.add(at(M(new THREE.CylinderGeometry(0.04, 0.04, 0.92, 8), MAT.metal), x, 0.46, 1.8));
  g.add(at(M(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 16, 1, true), MAT.glassAtrium), 0, 0.4, 1.15));
  const flags = [];
  for (const [k, x] of [-1.7, -1.35, -1.0].entries()) {
    g.add(at(M(new THREE.CylinderGeometry(0.018, 0.018, 1.5, 6), MAT.metal), x, 0.75, 2.1));
    const f = M(new THREE.PlaneGeometry(0.4, 0.25).translate(0.2, 0, 0), [place.color, MAT.wall, ACCENTS[1]][k]);
    f.position.set(x, 1.35, 2.1);
    g.add(live(f));
    flags.push(f);
  }
  for (const x of [1.4, 1.9]) g.add(at(planter(), x, 0, 1.9));
  // hanging banners on the front, from the Signs list
  [-1.15, 1.15].forEach((x, k) => {
    const s = signs.length ? signs[(k + 1) % signs.length] : { name: place.name, color: place.color };
    const lm = logoMaterial(s, 0.55 / 1.6, { pad: 0.08 });
    const bn = live(new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.6).translate(0, -0.8, 0), lm));
    bn.position.set(x, 2.75, -0.2 + 1.3 + 0.1);
    g.add(bn, at(M(new THREE.BoxGeometry(0.06, 0.06, 0.25), MAT.metal), x, 2.77, -0.2 + 1.3 + 0.05));
    flags.push(bn);
  });
  g.userData.update = (t) => {
    beacon.emissiveIntensity = (t % 1.6) < 0.2 ? 2.5 : 0.2;
    flags.forEach((f, i) => (i < 3 ? (f.rotation.y = Math.sin(t * 2 + i) * 0.35) : (f.rotation.x = Math.sin(t * 1.4 + i) * 0.04)));
  };
  g.userData.height = y + 1.5;
  return g;
}

export function lab(place) {
  const g = new THREE.Group();
  const white = MAT.wallWhite;
  const dome = M(new THREE.SphereGeometry(1.9, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), white);
  dome.position.set(0, 0.35, -0.4);
  g.add(dome);
  for (let i = 0; i < 3; i++) {
    const rib = M(new THREE.TorusGeometry(1.9 * Math.cos((i + 1) * 0.38), 0.05, 6, 40).rotateX(Math.PI / 2), place.color);
    rib.position.set(0, 0.35 + 1.9 * Math.sin((i + 1) * 0.38), -0.4);
    g.add(rib);
  }
  // observatory slit
  const slit = M(new THREE.BoxGeometry(0.4, 0.05, 1.9), MAT.glass);
  slit.position.set(0, 0.35 + 1.15, -0.4 + 0.6); slit.rotation.x = -0.65;
  g.add(slit);
  g.add(at(M(new THREE.CylinderGeometry(2.0, 2.05, 0.35, 36), shade(place.color, 0.15)), 0, 0.175, -0.4));
  // annex: glass front with server racks inside, rooftop garden on top
  g.add(at(M(rbox(1.7, 1.05, 1.25, 0.06), white), 1.25, 0.525, 1.2));
  const gl = own(new THREE.MeshToonMaterial({ color: MAT.glassAtrium, transparent: true, opacity: 0.35, depthWrite: false, gradientMap: ramp() }));
  const pane = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 0.03), gl);
  pane.position.set(1.25, 0.42, 1.84); pane.layers.set(1);
  g.add(pane, at(M(new THREE.BoxGeometry(1.4, 0.06, 0.06), MAT.metal), 1.25, 0.8, 1.85));
  const leds = [0, 1].map((k) => own(new THREE.MeshStandardMaterial({ color: '#1C2A22', emissive: k ? '#7BFFB1' : place.color, emissiveIntensity: 1 })));
  for (let r = 0; r < 4; r++) {
    g.add(at(M(new THREE.BoxGeometry(0.24, 0.62, 0.3), '#3B3A40'), 0.77 + r * 0.32, 0.36, 1.62));
    for (let k = 0; k < 4; k++) g.add(at(M(new THREE.BoxGeometry(0.05, 0.025, 0.01), leds[(r + k) % 2]), 0.72 + r * 0.32 + (k % 2) * 0.09, 0.2 + k * 0.12, 1.78));
  }
  g.add(at(M(new THREE.BoxGeometry(1.65, 0.05, 1.2), '#86AC5E'), 1.25, 1.075, 1.2));
  for (const [x, z, s] of [[0.75, 0.8, 1], [1.7, 1.5, 0.8], [1.6, 0.85, 0.9]]) g.add(at(M(new THREE.IcosahedronGeometry(0.16 * s, 1), '#5C8B45'), x, 1.2, z));
  g.add(at(M(new THREE.CylinderGeometry(0.02, 0.025, 0.4, 6), MAT.trunk), 0.95, 1.3, 1.5), at(M(new THREE.IcosahedronGeometry(0.22, 1), '#6A9A4C'), 0.95, 1.6, 1.5));
  const sign = signBox(1.4, 0.4, 0.06, logoMaterial(place, 1.4 / 0.4));
  sign.position.set(-1.2, 0.6, 1.6); sign.rotation.y = 0.35;
  g.add(sign);
  for (const x of [-1.75, -0.65]) g.add(at(M(new THREE.BoxGeometry(0.06, 0.4, 0.06), MAT.metal), x, 0.2, 1.4 + (x + 1.2) * -0.35));
  // satellite dish
  const dish = M(new THREE.SphereGeometry(0.45, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), white);
  dish.rotation.x = -0.8;
  dish.position.set(-1.7, 1.0, 0.6);
  g.add(at(M(new THREE.CylinderGeometry(0.05, 0.07, 0.8, 8), MAT.metalLight), -1.7, 0.4, 0.6), dish);
  // the thinking orb, with smaller thoughts orbiting it
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), own(new THREE.MeshStandardMaterial({ color: place.color, emissive: place.color, emissiveIntensity: 0.6, roughness: 0.4, flatShading: true })));
  orb.position.set(0, 3.0, -0.4);
  orb.castShadow = true;
  g.add(live(orb));
  const moons = [ACCENTS[2], ACCENTS[1], ACCENTS[5]].map((col, k) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13 - k * 0.02, 1), own(new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.5, flatShading: true })));
    m.castShadow = true;
    g.add(live(m));
    return m;
  });
  g.userData.update = (t) => {
    orb.position.y = 3.0 + Math.sin(t * 1.4) * 0.18;
    orb.rotation.set(t * 0.4, t * 0.7, 0);
    moons.forEach((m, k) => {
      const a = t * (0.9 + k * 0.35) + k * 2.1, r = 0.85 + k * 0.22;
      m.position.set(Math.cos(a) * r, orb.position.y + Math.sin(a * 1.3 + k) * 0.25, -0.4 + Math.sin(a) * r);
    });
    leds[0].emissiveIntensity = (t * 3) % 1 < 0.5 ? 1.4 : 0.3;
    leds[1].emissiveIntensity = (t * 2.3 + 0.4) % 1 < 0.5 ? 1.4 : 0.3;
  };
  g.userData.height = 3.7;
  return g;
}

export function billboard(place) {
  const g = new THREE.Group();
  for (const x of [-0.6, 0.6]) g.add(at(M(new THREE.BoxGeometry(0.09, 1.2, 0.09), MAT.metal), x, 0.6, 0));
  const face = M(new THREE.BoxGeometry(1.8, 1.0, 0.08), [toon(INK), toon(INK), toon(INK), toon(INK), logoMaterial(place, 1.8), logoMaterial(place, 1.8)]);
  face.position.set(0, 1.65, 0);
  g.add(face);
  g.rotation.y = Math.PI / 4;
  return g;
}

/** A plaque with the place's name and link host, for the foot of a landmark. */
function plaqueMaterial(place) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 200;
  const g = c.getContext('2d');
  g.fillStyle = '#3F3A40'; g.fillRect(0, 0, 512, 200);
  g.lineWidth = 10; g.strokeStyle = '#C9A878'; g.strokeRect(10, 10, 492, 180);
  g.fillStyle = '#F3E6CF'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 78;
  g.font = `600 ${fs}px ${FONT}`;
  while (g.measureText(place.name).width > 440 && fs > 26) g.font = `600 ${(fs -= 4)}px ${FONT}`;
  const host = place.url ? place.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : '';
  g.fillText(place.name, 256, host ? 82 : 100);
  if (host) { g.font = `500 34px ${FONT}`; g.fillStyle = '#C9A878'; g.fillText(host, 256, 150); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return own(new THREE.MeshToonMaterial({ map: t, gradientMap: ramp() }));
}

/** Logo landmark v2: an official SVG extruded on a tiered plinth, ringed with flowers, with a plaque. Images become a thick badge. */
export function logoLandmark(place) {
  const g = new THREE.Group();
  g.add(at(M(new THREE.CylinderGeometry(1.75, 1.85, 0.3, 8), MAT.plinth[1]), 0, 0.15, 0));
  g.add(at(M(new THREE.CylinderGeometry(1.45, 1.55, 0.3, 8), MAT.plinth[0]), 0, 0.45, 0));
  g.add(at(M(new THREE.CylinderGeometry(1.15, 1.22, 0.22, 8), MAT.plinth[1]), 0, 0.71, 0));
  g.add(at(M(new THREE.CylinderGeometry(1.17, 1.17, 0.05, 8), place.color), 0, 0.845, 0));
  // flower ring on the lowest tier
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    const f = M(new THREE.IcosahedronGeometry(0.075, 0), FLOWERS[k % FLOWERS.length]);
    f.position.set(Math.cos(a) * 1.6, 0.36, Math.sin(a) * 1.6);
    g.add(f);
    if (k % 2) g.add(at(M(new THREE.IcosahedronGeometry(0.1, 1), '#5C8B45'), Math.cos(a + 0.1) * 1.62, 0.33, Math.sin(a + 0.1) * 1.62));
  }
  // plaque at the front
  const plaque = M(new THREE.BoxGeometry(1.1, 0.43, 0.06), [toon('#3F3A40'), toon('#3F3A40'), toon('#3F3A40'), toon('#3F3A40'), plaqueMaterial(place), toon('#3F3A40')]);
  plaque.position.set(0, 0.42, 1.68); plaque.rotation.x = -0.35;
  g.add(plaque, at(M(rbox(1.25, 0.32, 0.3, 0.04), MAT.plinth[0]), 0, 0.16, 1.62));
  // bollards
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    g.add(at(M(new THREE.CylinderGeometry(0.07, 0.09, 0.5, 8), MAT.metal), Math.cos(a) * 2.15, 0.25, Math.sin(a) * 2.15));
    g.add(at(M(new THREE.SphereGeometry(0.09, 10, 8), MAT.wall), Math.cos(a) * 2.15, 0.55, Math.sin(a) * 2.15));
  }
  const holder = live(new THREE.Group());
  holder.position.set(0, 2.55, 0);
  g.add(holder);
  const badge = () => {
    const b = M(rbox(2.5, 2.5, 0.4, 0.3), [toon(INK), toon(INK), toon(INK), toon(INK), logoMaterial(place, 1, { pad: 0.16 }), logoMaterial(place, 1, { pad: 0.16 })]);
    holder.add(b);
  };
  if (place.svg) {
    try {
      const data = new SVGLoader().parse(place.svg);
      const parts = new THREE.Group();
      for (const path of data.paths) {
        const fill = path.userData?.style?.fill;
        if (fill === 'none') continue;
        const mat = toon(`#${(path.color || new THREE.Color(place.color)).getHexString()}`);
        for (const shape of SVGLoader.createShapes(path)) {
          const geo = new THREE.ExtrudeGeometry(shape, { depth: 18, bevelEnabled: true, bevelThickness: 3, bevelSize: 2, bevelSegments: 3 });
          parts.add(M(geo, mat));
        }
      }
      const box = new THREE.Box3().setFromObject(parts);
      const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      const s = 2.7 / Math.max(size.x, size.y);
      parts.children.forEach((m) => m.geometry.translate(-c.x, -c.y, -c.z));
      parts.scale.set(s, -s, s);
      if (parts.children.length) holder.add(parts); else badge();
    } catch { badge(); }
  } else badge();
  g.userData.update = (t) => { holder.rotation.y = t * 0.35; holder.position.y = 2.55 + Math.sin(t * 1.1) * 0.08; };
  g.userData.height = 4.2;
  return g;
}

export function buildPlace(place, slots) {
  switch (place.kind) {
    case 'shop': return shop(place);
    case 'hq': return hq(place, slots);
    case 'lab': return lab(place);
    case 'mall': return creatorMall(place, slots);
    case 'wheel': return ferrisWheel(place, slots);
    case 'billboard': return billboard(place);
    case 'screen': return screenBillboard(place, slots);
    default: return logoLandmark(place);
  }
}

// ── the mascot ───────────────────────────────────────────────────────────────
/**
 * Panda v2: the hero mascot, ~4 units tall. A softer silhouette, a scarf in the brand colour and
 * three poses for content: 'pencil' (hugs a giant pencil, waves), 'laptop' (types on its lap), 'wave'.
 */
export function panda({ pose = 'pencil', scarf = ACCENTS[0] } = {}) {
  const g = new THREE.Group();
  const W = '#FAF7F0', K = INK;
  const ell = (rx, ry, rz, color, x, y, z) => { const m = M(new THREE.SphereGeometry(1, 32, 24), color); m.scale.set(rx, ry, rz); m.position.set(x, y, z); return m; };
  const body = live(new THREE.Group());
  g.add(body);
  body.add(ell(1.25, 1.12, 1.08, W, 0, 1.12, 0));
  body.add(ell(0.78, 0.72, 0.32, '#F1EBDD', 0, 1.02, 0.85));
  for (const s of [-1, 1]) g.add(ell(0.44, 0.34, 0.56, K, s * 0.66, 0.3, 0.75));
  for (const s of [-1, 1]) g.add(ell(0.22, 0.24, 0.08, '#F4A6B8', s * 0.66, 0.32, 1.27));   // paw pads
  // scarf: a ring at the neck and a tail over the shoulder
  body.add(at(M(new THREE.TorusGeometry(0.78, 0.17, 10, 28).rotateX(Math.PI / 2).scale(1, 1, 0.95), scarf), 0, 2.02, 0.05));
  const tail = M(rbox(0.3, 0.75, 0.12, 0.06), scarf);
  tail.position.set(0.45, 1.65, 0.82); tail.rotation.set(0.15, 0, 0.2);
  body.add(tail, at(M(new THREE.BoxGeometry(0.3, 0.05, 0.125), shade(scarf, 0.15)), 0.52, 1.36, 0.86));
  const head = live(new THREE.Group());
  head.position.set(0, 2.6, 0.1);
  head.add(ell(0.97, 0.86, 0.86, W, 0, 0, 0));
  for (const s of [-1, 1]) {
    head.add(ell(0.3, 0.3, 0.18, K, s * 0.7, 0.68, -0.05));
    head.add(ell(0.15, 0.15, 0.08, '#F4A6B8', s * 0.7, 0.68, 0.06));
    const patch = ell(0.22, 0.3, 0.1, K, s * 0.32, 0.05, 0.76); patch.rotation.z = s * -0.5; head.add(patch);
  }
  const eyes = [-1, 1].map((s) => { const e = live(ell(0.07, 0.07, 0.04, '#FFFFFF', s * 0.31, 0.1, 0.85)); head.add(e); return e; });
  head.add(ell(0.13, 0.09, 0.08, K, 0, -0.18, 0.85));
  const mouth = M(new THREE.TorusGeometry(0.07, 0.018, 6, 12, Math.PI), K);
  mouth.position.set(0, -0.3, 0.83); mouth.rotation.z = Math.PI;
  head.add(mouth);
  for (const s of [-1, 1]) head.add(ell(0.12, 0.07, 0.03, '#F4A6B8', s * 0.55, -0.22, 0.73));
  body.add(head);
  const arm = (x, len) => { const a = live(new THREE.Group()); a.position.set(x, 1.8, 0.32); a.add(at(M(new THREE.CapsuleGeometry(0.3, len, 6, 14), K), 0, 0.5, 0)); body.add(a); return a; };
  const armL = arm(-0.95, 0.72), armR = arm(0.95, 0.75);
  let anim;
  if (pose === 'laptop') {
    const laptop = new THREE.Group();
    laptop.add(at(M(rbox(1.0, 0.07, 0.7, 0.03), '#C9C4BA'), 0, 0, 0));
    const lid = new THREE.Group(); lid.position.set(0, 0.03, -0.33); lid.rotation.x = -1.2;
    const screenMat = own(new THREE.MeshStandardMaterial({ color: '#2F3B4C', emissive: scarf, emissiveIntensity: 0.35 }));
    lid.add(at(M(rbox(1.0, 0.68, 0.05, 0.03), '#C9C4BA'), 0, 0.34, 0), at(M(new THREE.BoxGeometry(0.9, 0.58, 0.01), screenMat), 0, 0.34, 0.03));
    laptop.add(lid);
    laptop.position.set(0, 0.98, 1.05); laptop.rotation.x = 0.15;
    body.add(laptop);
    armL.rotation.set(-1.75, 0, 0.35); armR.rotation.set(-1.75, 0, -0.35);
    anim = (t) => {
      armL.rotation.x = -1.75 + Math.max(0, Math.sin(t * 14)) * 0.08;
      armR.rotation.x = -1.75 + Math.max(0, Math.sin(t * 14 + 1.7)) * 0.08;
      head.rotation.x = 0.18 + Math.sin(t * 0.6) * 0.04;
      screenMat.emissiveIntensity = 0.3 + Math.sin(t * 3) * 0.08;
    };
  } else if (pose === 'wave') {
    anim = (t) => {
      armR.rotation.z = -2.4 + Math.sin(t * 3.4) * 0.4;
      armL.rotation.z = 2.4 + Math.sin(t * 3.4 + Math.PI) * 0.4;
      body.position.y = Math.abs(Math.sin(t * 3.4)) * 0.06;
    };
  } else {
    armL.rotation.set(-0.6, 0, 2.8);
    armL.position.y = 1.75;
    const pencil = new THREE.Group();
    pencil.add(at(M(new THREE.CylinderGeometry(0.11, 0.11, 2.2, 6), '#F2B705'), 0, 0, 0));
    pencil.add(at(M(new THREE.ConeGeometry(0.11, 0.3, 6), '#E9C9A0'), 0, -1.25, 0));
    pencil.add(at(M(new THREE.ConeGeometry(0.035, 0.1, 6), K), 0, -1.38, 0).rotateX(Math.PI));
    pencil.add(at(M(new THREE.CylinderGeometry(0.115, 0.115, 0.25, 6), '#F4A6B8'), 0, 1.2, 0));
    pencil.position.set(-0.75, 1.3, 0.95); pencil.rotation.set(0.3, 0, -0.25);
    body.add(pencil);
    anim = (t) => { armR.rotation.z = -0.5 + Math.sin(t * 3.2) * 0.45; };
  }
  g.userData.update = (t) => {
    anim(t);
    if (pose !== 'laptop') head.rotation.z = Math.sin(t * 0.8) * 0.06;
    const blink = (t % 4.2) < 0.12 ? 0.15 : 1;
    eyes.forEach((e) => (e.scale.y = 0.07 * blink));
  };
  g.userData.height = 4.1;
  return g;
}
