// Builderland traffic: six toy car models, a lane graph on the road tiles, and
// cars that keep right, slow at junctions and wait for the car ahead.
// Every model is two merged geometries: a "paint" part tinted per car and a "fixed" part (glass,
// tyres, lights) with baked vertex colours. All cars of a model share two InstancedMeshes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toon } from './engine/ink.js';
import { MAT, ACCENTS, PALETTE, INK } from './tokens.js';

const rb = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2));
const T = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
  if (rx || ry || rz) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  return geo.translate(x, y, z);
};
const TYRE = '#34313A', GLASS = MAT.glass, LIGHT = '#FFF3D6', TAIL = '#E4572E', CHROME = '#D8D2C6';
const SKIN = '#E9B48E';

function wheels(xs, zs, r = 0.075, w = 0.06) {
  const out = [];
  for (const x of xs) for (const z of zs) out.push([T(new THREE.CylinderGeometry(r, r, w, 14), x, r, z, Math.PI / 2), TYRE], [T(new THREE.CylinderGeometry(r * 0.5, r * 0.5, w + 0.01, 10), x, r, z, Math.PI / 2), CHROME]);
  return out;
}
function lights(x, y, zs, color, r = 0.032) { return zs.map((z) => [T(new THREE.SphereGeometry(r, 8, 6), x, y, z), color]); }

/** Model definitions: paint parts are tinted per car, fixed parts carry their own colour. Cars face +x. */
const MODELS = {
  hatchback: {
    len: 0.66, speed: 1.25,
    paint: [T(rb(0.64, 0.18, 0.34, 0.07), 0, 0.17, 0), T(rb(0.38, 0.17, 0.31, 0.08), -0.05, 0.32, 0)],
    fixed: [
      [T(new THREE.BoxGeometry(0.3, 0.1, 0.004), -0.05, 0.33, 0.157), GLASS], [T(new THREE.BoxGeometry(0.3, 0.1, 0.004), -0.05, 0.33, -0.157), GLASS],
      [T(new THREE.BoxGeometry(0.004, 0.11, 0.26), 0.14, 0.33, 0, 0, 0, -0.35), GLASS],
      [T(rb(0.05, 0.06, 0.35, 0.02), 0.32, 0.12, 0), CHROME], [T(rb(0.05, 0.06, 0.35, 0.02), -0.32, 0.12, 0), CHROME],
      ...wheels([-0.2, 0.2], [-0.16, 0.16]), ...lights(0.32, 0.19, [-0.11, 0.11], LIGHT), ...lights(-0.32, 0.19, [-0.11, 0.11], TAIL, 0.025),
    ],
  },
  taxi: {
    len: 0.66, speed: 1.2, color: ACCENTS[1],
    paint: [T(rb(0.64, 0.18, 0.34, 0.07), 0, 0.17, 0), T(rb(0.38, 0.17, 0.31, 0.08), -0.05, 0.32, 0)],
    fixed: [
      [T(new THREE.BoxGeometry(0.3, 0.1, 0.004), -0.05, 0.33, 0.157), GLASS], [T(new THREE.BoxGeometry(0.3, 0.1, 0.004), -0.05, 0.33, -0.157), GLASS],
      [T(new THREE.BoxGeometry(0.004, 0.11, 0.26), 0.14, 0.33, 0, 0, 0, -0.35), GLASS],
      [T(rb(0.16, 0.07, 0.12, 0.02), -0.05, 0.44, 0), '#FFFDF6'], [T(new THREE.BoxGeometry(0.62, 0.035, 0.345), 0, 0.2, 0), INK],
      ...wheels([-0.2, 0.2], [-0.16, 0.16]), ...lights(0.32, 0.19, [-0.11, 0.11], LIGHT),
    ],
  },
  convertible: {
    len: 0.7, speed: 1.4,
    paint: [T(rb(0.7, 0.17, 0.35, 0.08), 0, 0.16, 0), T(rb(0.24, 0.06, 0.33, 0.03), 0.18, 0.26, 0)],
    fixed: [
      [T(rb(0.2, 0.1, 0.26, 0.03), -0.08, 0.27, 0), '#5B4636'],                                   // seats
      [T(new THREE.BoxGeometry(0.01, 0.1, 0.28), 0.08, 0.32, 0, 0, 0, -0.4), GLASS],
      [T(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 8), -0.06, 0.36, 0.07), '#3B82F6'],        // tiny driver
      [T(new THREE.SphereGeometry(0.055, 10, 8), -0.06, 0.45, 0.07), SKIN],
      [T(new THREE.SphereGeometry(0.058, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), -0.065, 0.46, 0.07), '#7A4A2A'],
      ...wheels([-0.22, 0.22], [-0.165, 0.165], 0.08), ...lights(0.35, 0.18, [-0.12, 0.12], LIGHT), ...lights(-0.35, 0.18, [-0.12, 0.12], TAIL, 0.025),
    ],
  },
  foodtruck: {
    len: 0.85, speed: 0.95,
    paint: [T(rb(0.58, 0.42, 0.38, 0.08), -0.12, 0.33, 0), T(rb(0.26, 0.27, 0.36, 0.08), 0.29, 0.24, 0)],
    fixed: [
      [T(new THREE.BoxGeometry(0.4, 0.16, 0.004), -0.12, 0.38, 0.192), '#3B3A36'],                // hatch
      [T(new THREE.BoxGeometry(0.44, 0.03, 0.1), -0.12, 0.5, 0.23, 0.5), '#FFFDF6'],             // flap
      [T(new THREE.BoxGeometry(0.004, 0.11, 0.3), 0.42, 0.3, 0), GLASS],
      [T(rb(0.3, 0.09, 0.2, 0.03), -0.12, 0.59, 0), '#FFFDF6'],                                   // roof sign
      ...wheels([-0.26, 0.26], [-0.17, 0.17], 0.085), ...lights(0.42, 0.18, [-0.12, 0.12], LIGHT),
    ],
  },
  scooter: {
    len: 0.42, speed: 1.5, color: PALETTE.roofs.colors[2],
    paint: [T(new THREE.SphereGeometry(0.11, 14, 10).scale(1.25, 0.8, 0.75), -0.08, 0.17, 0), T(rb(0.06, 0.22, 0.13, 0.03), 0.13, 0.2, 0, 0, 0, -0.25)],
    fixed: [
      [T(rb(0.16, 0.035, 0.09, 0.015), -0.07, 0.26, 0), '#3B3A36'],
      [T(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 6), 0.15, 0.34, 0, Math.PI / 2), CHROME],
      [T(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), 0.17, 0.06, 0, Math.PI / 2), TYRE], [T(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), -0.13, 0.06, 0, Math.PI / 2), TYRE],
      [T(rb(0.09, 0.14, 0.1, 0.03), -0.05, 0.36, 0), ACCENTS[0]],                                 // rider
      [T(new THREE.SphereGeometry(0.06, 10, 8), -0.04, 0.48, 0), '#F2B705'],                     // helmet
      ...lights(0.17, 0.27, [0], LIGHT, 0.025),
    ],
  },
  bus: {
    len: 1.2, speed: 0.85, color: PALETTE.roofs.colors[0],
    paint: [T(rb(1.18, 0.4, 0.42, 0.14), 0, 0.3, 0)],
    fixed: [
      [T(new THREE.BoxGeometry(0.92, 0.12, 0.004), -0.05, 0.38, 0.212), GLASS], [T(new THREE.BoxGeometry(0.92, 0.12, 0.004), -0.05, 0.38, -0.212), GLASS],
      [T(new THREE.BoxGeometry(0.004, 0.14, 0.34), 0.592, 0.38, 0), GLASS],
      [T(rb(1.0, 0.05, 0.36, 0.02), 0, 0.51, 0), '#FBF5E8'],
      [T(new THREE.BoxGeometry(0.004, 0.06, 0.22), 0.594, 0.24, 0), '#FFD58A'],                  // destination
      ...wheels([-0.36, 0.36], [-0.19, 0.19], 0.09), ...lights(0.59, 0.18, [-0.15, 0.15], LIGHT),
    ],
  },
};
export const CAR_MODELS = Object.keys(MODELS);

/** Merges a list of geometries into one non-indexed geometry with a vertex colour per part. */
function bake(parts) {
  const geos = parts.map(([geo, color]) => {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  });
  return mergeGeometries(geos);
}
const BAKED = {};
function baked(model) {
  if (!BAKED[model]) {
    const m = MODELS[model];
    BAKED[model] = { paint: bake(m.paint.map((g) => [g, '#FFFFFF'])), fixed: bake(m.fixed) };
  }
  return BAKED[model];
}
const vcMat = () => {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toon('#fff').gradientMap });
  m.userData.own = true;
  return m;
};

/** One car as a plain Group (for parking lots and the style board). */
export function carMesh(model = 'hatchback', color) {
  const b = baked(model);
  const g = new THREE.Group();
  const paint = new THREE.Mesh(b.paint, vcMat());
  paint.material.color.set(color || MODELS[model].color || ACCENTS[0]);
  const fixed = new THREE.Mesh(b.fixed, vcMat());
  for (const m of [paint, fixed]) { m.castShadow = m.receiveShadow = true; m.userData.sharedGeo = true; g.add(m); }
  return g;
}

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

/**
 * Traffic on a set of road tiles. `roads` is a Set of "x,z" tile keys. Returns { group, update(t, dt) }.
 * Deterministic start: the same rng and roads give the same cars in the same places.
 */
export function createTraffic(roads, rng, count = 24) {
  const group = new THREE.Group();
  group.name = 'traffic';
  const key = (x, z) => `${x},${z}`;
  const tiles = [...roads].map((k) => k.split(',').map(Number));
  const nbrs = (x, z) => DIRS.filter(([dx, dz]) => roads.has(key(x + dx, z + dz)));
  const usable = tiles.filter(([x, z]) => nbrs(x, z).length > 0);
  if (!usable.length || count <= 0) return { group, update() {}, cars: [] };

  // mix: mostly hatchbacks and taxis, a few of everything else
  const mix = ['hatchback', 'hatchback', 'taxi', 'convertible', 'scooter', 'hatchback', 'foodtruck', 'bus', 'taxi', 'scooter', 'convertible', 'hatchback'];
  const paints = [ACCENTS[0], ACCENTS[2], ACCENTS[4], PALETTE.roofs.colors[0], PALETTE.roofs.colors[3], ACCENTS[5], '#FBF5E8', ACCENTS[3]];
  const cars = [];
  const taken = new Set();
  for (let n = 0; n < count && taken.size < usable.length; n++) {
    let tile, tries = 0;
    do { tile = rng.pick(usable); tries++; } while (taken.has(key(...tile)) && tries < 40);
    if (taken.has(key(...tile))) break;
    taken.add(key(...tile));
    const model = mix[n % mix.length];
    const [dx, dz] = rng.pick(nbrs(...tile));
    cars.push({ model, x: tile[0], z: tile[1], dx, dz, p: rng.range(0, 0.6), v: 0, speed: MODELS[model].speed * rng.range(0.85, 1.1), color: MODELS[model].color || paints[n % paints.length],
      pos: new THREE.Vector3(), yaw: Math.atan2(-dz, dx), lane: new THREE.Vector2(-dz, dx), init: false });
  }

  // two instanced meshes per model
  const byModel = {};
  for (const m of CAR_MODELS) {
    const list = cars.filter((c) => c.model === m);
    if (!list.length) continue;
    const b = baked(m);
    const paint = new THREE.InstancedMesh(b.paint, vcMat(), list.length);
    const fixed = new THREE.InstancedMesh(b.fixed, vcMat(), list.length);
    const cc = new THREE.Color();
    list.forEach((c, i) => { c.slot = i; paint.setColorAt(i, cc.set(c.color)); });
    for (const im of [paint, fixed]) { im.castShadow = im.receiveShadow = true; im.userData.sharedGeo = true; im.frustumCulled = false; group.add(im); }
    paint.name = `cars_${m}`;
    byModel[m] = { paint, fixed, list };
  }

  const LANE = 0.2;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), target = new THREE.Vector3();

  function update(t, dt) {
    dt = Math.min(dt, 0.05);
    for (const c of cars) {
      const nx = c.x + c.dx, nz = c.z + c.dz;
      const junction = roads.has(key(nx, nz)) && nbrs(nx, nz).length > 2;
      let want = c.speed * (junction && c.p > 0.35 ? 0.5 : 1);
      // keep distance: a car ahead in the same lane, on this tile or the next
      const ahead = cars.some((o) => o !== c && o.dx === c.dx && o.dz === c.dz && ((o.x === c.x && o.z === c.z && o.p > c.p && o.p - c.p < 0.75) || (o.x === nx && o.z === nz && o.p + 1 - c.p < 0.85)));
      if (ahead) want = 0;
      c.v += (want - c.v) * Math.min(1, dt * 4);
      c.p += c.v * dt;
      if (c.p >= 1) {
        if (!roads.has(key(nx, nz))) { c.dx = -c.dx; c.dz = -c.dz; c.p = 0; }       // dead end: U-turn
        else {
          const opts = nbrs(nx, nz).filter(([a, b]) => !(a === -c.dx && b === -c.dz));
          const choice = opts.length ? opts[Math.floor(((c.x * 7 + c.z * 13 + Math.floor(t * 3)) >>> 0) % opts.length)] : [-c.dx, -c.dz];
          c.x = nx; c.z = nz; c.p -= 1;
          [c.dx, c.dz] = choice;
        }
      }
      // target point: tile centre path, offset into the right-hand lane
      const fx = c.x + 0.5 + c.dx * (c.p - 0.5), fz = c.z + 0.5 + c.dz * (c.p - 0.5);
      c.lane.lerp(new THREE.Vector2(-c.dz, c.dx), Math.min(1, dt * 6));
      target.set(fx + c.lane.x * LANE, 0.01, fz + c.lane.y * LANE);
      if (!c.init) { c.pos.copy(target); c.init = true; } else c.pos.lerp(target, Math.min(1, dt * 12));
      const yaw = Math.atan2(-c.dz, c.dx);
      let d = yaw - c.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      c.yaw += d * Math.min(1, dt * 7);
      const bob = c.v > 0.1 ? Math.sin(t * 18 + c.slot) * 0.004 : 0;
      m4.compose(target.set(c.pos.x, c.pos.y + bob, c.pos.z), q.setFromAxisAngle(up, c.yaw), one);
      const bm = byModel[c.model];
      bm.paint.setMatrixAt(c.slot, m4);
      bm.fixed.setMatrixAt(c.slot, m4);
    }
    for (const bm of Object.values(byModel)) { bm.paint.instanceMatrix.needsUpdate = true; bm.fixed.instanceMatrix.needsUpdate = true; }
  }
  update(0, 0.016);
  return { group, update, cars };
}
