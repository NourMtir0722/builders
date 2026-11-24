// The Creator Mall v2: the XL landmark and the money building, on a 2×2 parcel block.
// Primary: three floors, a glass atrium dome and a rooftop billboard ring.
// Secondary: 12 sponsor bays, a glass entrance tower with visible escalators, hanging banners.
// Tertiary: fountain, parking with toy cars, a food-truck row, AC units, flags, lamps and planters.
// Origin sits at the centre of the 11×11-tile footprint, on the ground. Front faces +z.
import * as THREE from 'three';
import { toon, scribbleWater } from './engine/ink.js';
import { FONT } from './engine/label.js';
import { INK, MAT, ACCENTS, PALETTE, GROUND, LANTERN_GLOW } from './tokens.js';
import { ramp, own, M, rbox, at, shade, loadImg, logoMaterial, stripes, windows, live } from './bkit.js';
import { templates } from './props.js';
import { carMesh } from './traffic.js';

export const MALL_BAYS = 12;

const F = 1.45;                 // floor height
const FLOORS = 3;
const W = 8.4, D = 4.4;         // main block
const ZB = -2.8;                // block centre (z)
const FRONT = ZB + D / 2;       // front facade plane
const TOP = F * FLOORS;         // top of the third floor
const ROOF = TOP + 0.13;        // walkable roof
const BAY_X = [-3.35, -1.85, 1.85, 3.35];

/** Fills all 12 bays: the mall's own slots first, then placeholders in accent colours. */
export function mallBays(slots = []) {
  return Array.from({ length: MALL_BAYS }, (_, i) => {
    const list = slots.filter((s) => s?.name);
    return list.length ? list[i % list.length] : { name: 'Your brand', color: ACCENTS[i % ACCENTS.length], ink: i % ACCENTS.length === 1 ? INK : '' };
  });
}

/** A tall hanging banner with the name running vertically (or the logo at the top). */
function bannerMaterial(slot) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 460;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const draw = (img) => {
    g.fillStyle = slot.color; g.fillRect(0, 0, 128, 460);
    g.fillStyle = 'rgba(255,253,246,.9)'; g.fillRect(0, 22, 128, 8); g.fillRect(0, 430, 128, 8);
    g.lineWidth = 8; g.strokeStyle = INK; g.strokeRect(4, 4, 120, 452);
    if (img) {
      const k = Math.min(96 / img.width, 96 / img.height);
      g.drawImage(img, 64 - (img.width * k) / 2, 50, img.width * k, img.height * k);
    }
    g.save();
    g.translate(64, img ? 300 : 230);
    g.rotate(-Math.PI / 2);
    let fs = 70;
    const room = img ? 230 : 380;
    g.font = `600 ${fs}px ${FONT}`;
    while (g.measureText(slot.name).width > room && fs > 18) g.font = `600 ${(fs -= 3)}px ${FONT}`;
    g.fillStyle = slot.ink || '#FFFDF6'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(slot.name, 0, 4);
    g.restore();
    tex.needsUpdate = true;
  };
  draw(null);
  loadImg(slot.logo).then((img) => img && draw(img));
  return own(new THREE.MeshToonMaterial({ map: tex, gradientMap: ramp(), side: THREE.DoubleSide }));
}

const signBox = (w, h, d, mat) => M(new THREE.BoxGeometry(w, h, d), [toon(INK), toon(INK), toon(INK), toon(INK), mat, toon(INK)]);

/** A food truck with its serving hatch on the -x side. Faces +z. */
function foodTruck(slot) {
  const g = new THREE.Group();
  g.add(at(M(rbox(0.78, 0.82, 1.45, 0.1), slot.color), 0, 0.55, -0.12));
  g.add(at(M(rbox(0.74, 0.55, 0.46, 0.1), shade(slot.color, 0.1)), 0, 0.42, 0.78));
  g.add(at(M(new THREE.BoxGeometry(0.6, 0.22, 0.01), MAT.glass), 0, 0.55, 1.012));
  g.add(at(M(new THREE.BoxGeometry(0.02, 0.36, 0.85), '#3B3A36'), -0.4, 0.62, -0.12));          // hatch
  const flap = M(new THREE.BoxGeometry(0.42, 0.03, 0.95), stripes(slot.color, MAT.awning, 6));
  flap.position.set(-0.56, 0.86, -0.12); flap.rotation.z = -0.35;
  g.add(flap);
  g.add(at(M(new THREE.BoxGeometry(0.2, 0.05, 0.85), MAT.woodBoard), -0.48, 0.47, -0.12));      // counter
  const sign = signBox(1.1, 0.26, 0.06, logoMaterial(slot, 1.1 / 0.26));
  sign.rotation.y = -Math.PI / 2;           // logo faces the plaza (-x)
  sign.position.set(0, 1.1, -0.12);
  g.add(sign);
  const wheel = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12).rotateZ(Math.PI / 2);
  for (const x of [-0.36, 0.36]) for (const z of [-0.55, 0.7]) g.add(at(M(wheel, '#3B3A36'), x, 0.12, z));
  return g;
}

export function creatorMall(place, slots = []) {
  const g = new THREE.Group();
  const bays = mallBays(slots);
  const updates = [];
  const wall = MAT.wallAlt;
  const band = place.color;

  // glows: shop windows, lamps (world.js drives every material flagged userData.glow)
  const shopGlow = own(new THREE.MeshToonMaterial({ color: MAT.glass, emissive: MAT.windowLit, emissiveIntensity: 0, gradientMap: ramp() }));
  shopGlow.userData.glow = true;
  const lampGlow = own(new THREE.MeshStandardMaterial({ color: '#FFF3D6', emissive: LANTERN_GLOW, emissiveIntensity: 0 }));
  lampGlow.userData.glow = true;

  // ── primary: three floors ──
  for (let f = 0; f < FLOORS; f++) {
    const y0 = f * F;
    const side = windows(wall, 6, 1);
    side.userData.own = true;
    const plain = toon(wall);
    g.add(at(M(rbox(W, F - 0.14, D, 0.06), [side, side, plain, plain, plain, plain]), 0, y0 + (F - 0.14) / 2, ZB));
    const top = f === FLOORS - 1;
    g.add(at(M(rbox(W + (top ? 0.4 : 0.26), top ? 0.26 : 0.15, D + (top ? 0.4 : 0.26), 0.05), top ? MAT.wall : band), 0, y0 + F - (top ? 0.06 : 0.07), ZB));
    if (top) g.add(at(M(rbox(W + 0.44, 0.08, D + 0.44, 0.03), band), 0, y0 + F - 0.2, ZB));

    // ── secondary: four bays per floor = 12 sponsor bays ──
    BAY_X.forEach((x, b) => {
      const slot = bays[f * 4 + b];
      const gh = F - 0.66;
      g.add(at(M(new THREE.BoxGeometry(1.15, gh, 0.06), shopGlow), x, y0 + 0.1 + gh / 2, FRONT + 0.02));
      g.add(at(M(new THREE.BoxGeometry(0.05, gh, 0.09), MAT.metal), x, y0 + 0.1 + gh / 2, FRONT + 0.04));
      g.add(at(M(new THREE.BoxGeometry(1.25, 0.06, 0.1), MAT.metal), x, y0 + 0.1, FRONT + 0.04));
      g.add(at(signBox(1.22, 0.3, 0.07, logoMaterial(slot, 1.22 / 0.3)), x, y0 + F - 0.36, FRONT + 0.05));
      if (f === 0) {
        const aw = M(new THREE.BoxGeometry(1.3, 0.05, 0.5), stripes(slot.color, MAT.awning, 6));
        aw.position.set(x, y0 + F - 0.62, FRONT + 0.26); aw.rotation.x = 0.35;
        g.add(aw);
      } else {
        g.add(at(M(rbox(1.34, 0.07, 0.42, 0.03), MAT.wall), x, y0 + 0.035, FRONT + 0.21));
        g.add(at(M(new THREE.BoxGeometry(1.34, 0.035, 0.035), MAT.metal), x, y0 + 0.3, FRONT + 0.41));
        for (let k = 0; k < 5; k++) g.add(at(M(new THREE.BoxGeometry(0.025, 0.26, 0.025), MAT.metal), x - 0.64 + k * 0.32, y0 + 0.17, FRONT + 0.41));
        const pot = new THREE.Group();
        pot.add(at(M(new THREE.CylinderGeometry(0.09, 0.07, 0.12, 8), MAT.terracotta), 0, 0.13, 0));
        pot.add(at(M(new THREE.IcosahedronGeometry(0.11, 1), b % 2 ? '#F4A6B8' : '#6A9A4C'), 0, 0.26, 0));
        g.add(at(pot, x + (b < 2 ? 0.5 : -0.5), y0, FRONT + 0.26));
      }
    });
  }

  // ── glass entrance tower with escalators inside ──
  const AZ = FRONT + 0.2, AH = TOP + 0.4;
  const glassMat = own(new THREE.MeshToonMaterial({ color: MAT.glassAtrium, transparent: true, opacity: 0.42, depthWrite: false, gradientMap: ramp() }));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, AH, 1.0), glassMat);
  glass.position.set(0, AH / 2, AZ);
  glass.layers.set(1);                       // the outline prepass looks through the glass at the escalators
  glass.renderOrder = 2;
  g.add(glass);
  for (const x of [-0.95, 0.95]) for (const z of [AZ - 0.5, AZ + 0.5]) g.add(at(M(new THREE.BoxGeometry(0.08, AH, 0.08), MAT.metal), x, AH / 2, z));
  for (let f = 1; f <= FLOORS; f++) {
    g.add(at(M(new THREE.BoxGeometry(1.98, 0.07, 0.07), MAT.metal), 0, f * F, AZ + 0.5));
    for (const x of [-0.95, 0.95]) g.add(at(M(new THREE.BoxGeometry(0.07, 0.07, 1.0), MAT.metal), x, f * F, AZ));
  }
  const run = 1.3, len = Math.hypot(run, F), ang = Math.atan2(F, run);
  for (let f = 0; f < FLOORS; f++) {
    const dir = f % 2 ? -1 : 1;
    const esc = new THREE.Group();
    esc.add(M(new THREE.BoxGeometry(len, 0.08, 0.36), '#D8D2C6'));
    for (const z of [-0.2, 0.2]) esc.add(at(M(new THREE.BoxGeometry(len, 0.16, 0.04), band), 0, 0.1, z));
    esc.rotation.z = dir * ang;
    esc.position.set(0, f * F + F / 2, AZ - 0.05);
    g.add(esc);
    if (f > 0) g.add(at(M(new THREE.BoxGeometry(0.5, 0.06, 0.8), '#D8D2C6'), dir * -0.68, f * F, AZ));
  }
  // entrance: doors and canopy
  g.add(at(M(new THREE.BoxGeometry(1.0, 0.95, 0.04), MAT.glass), 0, 0.475, AZ + 0.52));
  g.add(at(M(new THREE.BoxGeometry(0.03, 0.95, 0.06), MAT.metal), 0, 0.475, AZ + 0.53));
  g.add(at(M(rbox(2.5, 0.09, 0.8, 0.04), band), 0, 1.18, AZ + 0.8));
  // main sign over the entrance
  g.add(at(signBox(3.7, 0.78, 0.12, logoMaterial(place, 3.7 / 0.78)), 0, ROOF + 0.62, FRONT + 0.25));
  for (const x of [-1.4, 1.4]) g.add(at(M(new THREE.BoxGeometry(0.07, 0.4, 0.07), MAT.metal), x, ROOF + 0.12, FRONT + 0.2));

  // ── roof: glass dome, billboard ring, flags, AC units ──
  g.add(at(M(new THREE.CylinderGeometry(1.6, 1.66, 0.34, 32), MAT.wall), 0, ROOF + 0.17, ZB));
  g.add(at(M(new THREE.CylinderGeometry(1.68, 1.68, 0.06, 32), band), 0, ROOF + 0.34, ZB));
  const dome = M(new THREE.SphereGeometry(1.48, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), MAT.glassAtrium);
  dome.position.set(0, ROOF + 0.34, ZB);
  g.add(dome);
  for (let k = 0; k < 6; k++) {
    const rib = M(new THREE.TorusGeometry(1.49, 0.035, 6, 28, Math.PI), band);
    rib.rotation.y = (k * Math.PI) / 6;
    rib.position.set(0, ROOF + 0.34, ZB);
    g.add(rib);
  }
  const lat = M(new THREE.TorusGeometry(1.49 * Math.cos(0.55), 0.03, 6, 40).rotateX(Math.PI / 2), band);
  lat.position.set(0, ROOF + 0.34 + 1.49 * Math.sin(0.55), ZB);
  g.add(lat);
  g.add(at(M(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), MAT.metal), 0, ROOF + 0.34 + 1.48 + 0.15, ZB));
  g.add(at(M(new THREE.IcosahedronGeometry(0.13, 1), band), 0, ROOF + 0.34 + 1.48 + 0.34, ZB));

  const ring = live(new THREE.Group());
  ring.position.set(0, ROOF, ZB);
  const R = 2.0, N = 8;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const slot = bays[(i * 3) % MALL_BAYS];
    const lm = logoMaterial(slot, 1.25 / 0.56);
    const panel = M(new THREE.BoxGeometry(1.25, 0.56, 0.06), [toon(INK), toon(INK), toon(INK), toon(INK), lm, lm]);
    panel.position.set(Math.sin(a) * R, 1.3, Math.cos(a) * R);
    panel.rotation.y = a;
    ring.add(panel);
    const pa = a + Math.PI / N;
    ring.add(at(M(new THREE.CylinderGeometry(0.03, 0.03, 1.62, 6), MAT.metal), Math.sin(pa) * R, 0.81, Math.cos(pa) * R));
  }
  for (const y of [1.0, 1.6]) ring.add(at(M(new THREE.TorusGeometry(R, 0.035, 6, 48).rotateX(Math.PI / 2), band), 0, y, 0));
  g.add(ring);
  updates.push((t) => { ring.rotation.y = t * 0.18; });

  for (const [x, z] of [[-3.5, -4.4], [3.4, -4.3], [-3.5, -1.6]]) {
    g.add(at(M(rbox(0.62, 0.34, 0.5, 0.05), MAT.metalLight), x, ROOF + 0.17, z));
    g.add(at(M(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 14), '#3B3A36'), x, ROOF + 0.35, z));
  }
  for (const [x, z] of [[3.5, -1.5], [2.8, -4.6]]) g.add(at(M(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 8), MAT.metalLight), x, ROOF + 0.15, z));
  const flags = [];
  for (const [x, c] of [[-4.05, band], [4.05, ACCENTS[1]]]) {
    g.add(at(M(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 6), MAT.metal), x, ROOF + 0.7, FRONT - 0.25));
    const fl = M(new THREE.PlaneGeometry(0.55, 0.34).translate(0.275, 0, 0), toon(c));
    fl.position.set(x, ROOF + 1.22, FRONT - 0.25);
    g.add(live(fl));
    flags.push(fl);
  }
  updates.push((t) => flags.forEach((fl, i) => (fl.rotation.y = Math.sin(t * 2.1 + i * 1.7) * 0.4 + (i ? Math.PI : 0))));

  // ── hanging banners on the visible side ──
  const banners = [];
  [ZB - 1.15, ZB + 1.15].forEach((z, i) => {
    const slot = bays[8 + i];
    const bn = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2.75).translate(0, -1.375, 0).rotateY(Math.PI / 2), bannerMaterial(slot));
    bn.castShadow = true;
    bn.position.set(W / 2 + 0.09, TOP - 0.16, z);
    g.add(bn);
    g.add(at(M(new THREE.BoxGeometry(0.3, 0.05, 0.9), MAT.metal), W / 2 + 0.06, TOP - 0.14, z));
    banners.push(bn);
  });
  updates.push((t) => banners.forEach((b, i) => (b.rotation.z = Math.sin(t * 1.3 + i) * 0.025)));

  // ── tertiary: forecourt ──
  // fountain
  const fz = 2.7;
  g.add(at(M(new THREE.CylinderGeometry(1.15, 1.22, 0.32, 32), MAT.plinth[0]), 0, 0.16, fz));
  const wMat = own(new THREE.MeshToonMaterial({ map: scribbleWater(GROUND.water), gradientMap: ramp() }));
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.0, 32).rotateX(-Math.PI / 2), wMat);
  water.position.set(0, 0.3, fz); water.receiveShadow = true;
  g.add(water);
  g.add(at(M(new THREE.CylinderGeometry(0.1, 0.14, 0.75, 10), MAT.plinth[1]), 0, 0.55, fz));
  g.add(at(M(new THREE.CylinderGeometry(0.46, 0.2, 0.16, 20), MAT.plinth[0]), 0, 0.96, fz));
  g.add(at(M(new THREE.IcosahedronGeometry(0.1, 1), band), 0, 1.1, fz));
  const dropMat = own(new THREE.MeshBasicMaterial({ color: '#FFFFFF' }));
  const drops = Array.from({ length: 14 }, (_, i) => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), dropMat);
    d.layers.set(1);
    d.userData.a = (i / 14) * Math.PI * 2;
    d.userData.ph = (i * 0.37) % 1;
    g.add(d);
    return d;
  });
  updates.push((t) => drops.forEach((d) => {
    const p = (t * 0.9 + d.userData.ph) % 1;
    const r = 0.42 + p * 0.5;
    d.position.set(Math.cos(d.userData.a) * r, 1.02 + Math.sin(p * Math.PI) * 0.3 - p * 0.72, fz + Math.sin(d.userData.a) * r);
  }));
  // benches and lamps around it
  for (const s of [-1, 1]) {
    const bench = new THREE.Group();
    bench.add(at(M(rbox(0.9, 0.06, 0.3, 0.02), MAT.woodBoard), 0, 0.26, 0));
    bench.add(at(M(rbox(0.9, 0.24, 0.05, 0.02), MAT.woodBoard), 0, 0.42, -0.14));
    for (const x of [-0.38, 0.38]) bench.add(at(M(new THREE.BoxGeometry(0.05, 0.26, 0.26), MAT.metal), x, 0.13, 0));
    bench.position.set(s * 1.85, 0, fz);
    bench.rotation.y = -s * Math.PI / 2;
    g.add(bench);
  }
  for (const [x, z] of [[-2.05, 0.75], [2.05, 0.75], [-2.05, 4.7], [2.05, 4.7]]) {
    g.add(at(M(new THREE.CylinderGeometry(0.03, 0.04, 1.2, 6), MAT.lantern), x, 0.6, z));
    g.add(at(M(new THREE.SphereGeometry(0.11, 10, 8), lampGlow), x, 1.28, z));
  }
  // planters with trees by the entrance
  const T = templates();
  for (const s of [-1, 1]) {
    const tree = new THREE.Group();
    tree.add(at(M(rbox(0.7, 0.36, 0.7, 0.06), MAT.terracotta), 0, 0.18, 0));
    tree.add(at(M(T.trunk, MAT.trunk), 0, 0.3, 0), at(M(T.canopy, PALETTE.grass.colors[1]), 0, 0.3, 0));
    tree.children[1].scale.setScalar(0.7); tree.children[2].scale.setScalar(0.7);
    tree.position.set(s * 1.45, 0, FRONT + 1.35);
    g.add(tree);
  }

  // parking on the left
  const asphalt = '#B3AC9E';
  g.add(at(M(new THREE.BoxGeometry(2.7, 0.03, 4.7), asphalt), -3.95, 0.015, 2.95));
  for (let k = 0; k <= 6; k++) g.add(at(M(new THREE.BoxGeometry(1.05, 0.012, 0.04), '#FFFDF6'), -4.45, 0.035, 0.85 + k * 0.7));
  [0, 1, 3, 5].forEach((k, i) => {
    const car = carMesh(['hatchback', 'convertible', 'hatchback', 'taxi'][i], [ACCENTS[2], PALETTE.roofs.colors[0], ACCENTS[4], ACCENTS[1]][i]);
    car.scale.setScalar(1.3);
    car.position.set(-4.4, 0.03, 1.2 + k * 0.7);
    car.rotation.y = Math.PI;
    g.add(car);
  });
  const pSign = signBox(0.36, 0.36, 0.04, logoMaterial({ name: 'P', color: PALETTE.roofs.colors[2] }, 1));
  pSign.position.set(-2.75, 1.0, 0.75);
  g.add(pSign, at(M(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 6), MAT.metal), -2.75, 0.42, 0.73));

  // food-truck row on the right
  [[4.1, 1.55, bays[10]], [4.1, 3.9, bays[11]]].forEach(([x, z, slot]) => g.add(at(foodTruck(slot), x, 0, z)));
  const table = new THREE.Group();
  table.add(at(M(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 16), MAT.wall), 0, 0.42, 0));
  table.add(at(M(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 6), MAT.metal), 0, 0.6, 0));
  table.add(at(M(new THREE.ConeGeometry(0.55, 0.25, 8), stripes(band, MAT.awning, 8)), 0, 1.25, 0));
  table.position.set(2.95, 0, 2.75);
  g.add(table);

  // where people sit and queue (local coordinates; world.js turns them into folk)
  g.userData.spots = {
    roof: [{ x: -3.2, y: ROOF, z: -1.0, yaw: 0.4 }, { x: 2.9, y: ROOF, z: -4.4, yaw: 2.2 }],
    sit: [
      ...[-0.22, 0.22].map((dz) => ({ x: -1.83, z: fz + dz, y: 0.29, yaw: 0 })),
      ...[-0.22, 0.22].map((dz) => ({ x: 1.83, z: fz + dz, y: 0.29, yaw: Math.PI })),
    ],
    stand: [
      { x: 3.4, z: 1.45, yaw: 0 }, { x: 3.05, z: 1.5, yaw: 0 }, { x: 2.72, z: 1.42, yaw: 0 },
      { x: 3.4, z: 3.8, yaw: 0 }, { x: 3.05, z: 3.86, yaw: 0 },
      { x: 2.62, z: 2.75, yaw: 0 }, { x: 3.28, z: 2.75, yaw: Math.PI },
      { x: -0.6, z: FRONT + 1.0, yaw: Math.PI / 2 + 0.6 }, { x: 0.55, z: 4.6, yaw: -Math.PI / 2 },
    ],
  };
  g.userData.update = (t) => updates.forEach((fn) => fn(t));
  g.userData.height = ROOF + 0.34 + 1.48 + 0.5;
  return g;
}
