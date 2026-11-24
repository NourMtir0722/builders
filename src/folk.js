// Builderland people: chibi folk ~2.5 heads tall from modular parts
// (head, 6 hairstyles, top, bottom, shoes), recoloured per person, animated without bones:
// walk (bob + leg swing), sit, wave, cheer and idle. Every part is one InstancedMesh, so a
// crowd of hundreds costs 12 draw calls. Builders get a walking avatar that matches their portrait.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toon } from './engine/ink.js';
import { createRng } from './engine/rng.js';
import { ACCENTS, PALETTE } from './tokens.js';

// the same picks as drawAvatar() in people.js, so a builder's walker matches their portrait
export const SKINS = ['#F6D3B3', '#E9B48E', '#C98E62', '#8D5A3B', '#F2C7A5', '#5E3B28'];
export const HAIRS = ['#E4572E', '#2B2530', '#7A4A2A', '#E9C46A', '#B5651D', '#3B3054', '#D96C3E', '#F0E2C0'];
const TOPS = [...ACCENTS, PALETTE.roofs.colors[3], '#F6EAD3', '#6AA75E', '#F2994A'];
const BOTTOMS = ['#3B4A6B', '#5B4636', '#2F3B33', '#A0784F', '#3F3A40', '#C9BCA0'];

const rb = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2));
function bake(parts) {
  return mergeGeometries(parts.map(([geo, color]) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  }));
}

// geometry, built facing +x. Hip at y 0.13, shoulders at y 0.27, head centre at y 0.41.
let GEO = null;
function geo() {
  if (GEO) return GEO;
  const W = '#FFFFFF';
  const cap = () => new THREE.SphereGeometry(0.113, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).rotateZ(0.25).translate(-0.008, 0.415, 0);
  GEO = {
    torso: bake([[rb(0.13, 0.17, 0.15, 0.05).translate(0, 0.215, 0), W]]),
    head: bake([
      [new THREE.SphereGeometry(0.105, 16, 12).translate(0, 0.41, 0), W],
      [new THREE.SphereGeometry(0.014, 6, 4).translate(0.097, 0.415, 0.038), '#262026'],
      [new THREE.SphereGeometry(0.014, 6, 4).translate(0.097, 0.415, -0.038), '#262026'],
      [new THREE.SphereGeometry(0.018, 6, 4).scale(0.4, 0.6, 1).translate(0.092, 0.385, 0.062), '#F4A0A8'],
      [new THREE.SphereGeometry(0.018, 6, 4).scale(0.4, 0.6, 1).translate(0.092, 0.385, -0.062), '#F4A0A8'],
    ]),
    hair: [
      bake([[cap(), W]]),
      bake([[new THREE.SphereGeometry(0.118, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62).translate(-0.01, 0.405, 0), W]]),
      bake([[cap(), W], [new THREE.SphereGeometry(0.05, 10, 8).translate(-0.06, 0.53, 0), W]]),
      bake([[cap(), W], [new THREE.CapsuleGeometry(0.03, 0.1, 4, 8).translate(-0.12, 0.35, 0), W]]),
      bake([[cap(), W], ...[-1, -0.5, 0, 0.5, 1].map((k) => [new THREE.ConeGeometry(0.03, 0.07, 6).rotateX(k * 0.5).translate(-0.01, 0.53, k * 0.045), W])]),
      bake([[cap(), W], [rb(0.06, 0.2, 0.2, 0.03).translate(-0.075, 0.33, 0), W]]),
    ],
    leg: bake([[rb(0.055, 0.12, 0.06, 0.02).translate(0, -0.06, 0), W], [rb(0.085, 0.035, 0.065, 0.015).translate(0.014, -0.118, 0), '#3A3540']]),
    arm: bake([[new THREE.CapsuleGeometry(0.026, 0.09, 4, 8).translate(0, -0.07, 0), W], [new THREE.SphereGeometry(0.028, 8, 6).translate(0, -0.135, 0), '#F2D2B8']]),
  };
  return GEO;
}
const vc = () => { const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toon('#fff').gradientMap }); m.userData.own = true; return m; };

/** Look for one person, deterministic from a seed string. */
export function folkLook(seed, overrides = {}) {
  const r = createRng(`folk:${seed}`);
  return { skin: r.pick(SKINS), hair: r.pick(HAIRS), style: r.int(0, 5), top: r.pick(TOPS), bottom: r.pick(BOTTOMS), ...overrides };
}
/** The walker for a builder: same skin and hair as their drawn portrait, top in their colour. */
export function builderLook(d) {
  const r = createRng(`avatar:${d.name}`);
  const skin = r.pick(SKINS), hair = r.pick(HAIRS), style = [0, 5, 2, 3][r.int(0, 3)];
  return { ...folkLook(d.name), skin, hair, style, top: d.color };
}

/**
 * A crowd. Each person: { look, x, z, yaw, act: 'walk'|'sit'|'wave'|'cheer'|'idle'|'pace', scale, ... }.
 * Walkers follow `walk` tiles (a Set of "x,z"); pacers go back and forth between a and b.
 * Returns { group, update(t, dt), people }.
 */
export function createFolk(people, { walk = new Set(), rng } = {}) {
  const G = geo();
  const group = new THREE.Group();
  group.name = 'people';
  const n = people.length;
  if (!n) return { group, update() {}, people };
  const mk = (g, count) => {
    const im = new THREE.InstancedMesh(g, vc(), Math.max(1, count));
    im.count = count;
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.userData.sharedGeo = true;
    group.add(im);
    return im;
  };
  const torso = mk(G.torso, n), head = mk(G.head, n), legL = mk(G.leg, n), legR = mk(G.leg, n), armL = mk(G.arm, n), armR = mk(G.arm, n);
  const hairCount = [0, 0, 0, 0, 0, 0];
  people.forEach((p) => { p.hairSlot = hairCount[p.look.style]++; });
  const hair = G.hair.map((g, s) => mk(g, hairCount[s]));
  const c = new THREE.Color();
  people.forEach((p, i) => {
    torso.setColorAt(i, c.set(p.look.top)); armL.setColorAt(i, c); armR.setColorAt(i, c);
    head.setColorAt(i, c.set(p.look.skin));
    legL.setColorAt(i, c.set(p.look.bottom)); legR.setColorAt(i, c);
    hair[p.look.style].setColorAt(p.hairSlot, c.set(p.look.hair));
    p.scale ??= 1;
    p.ph ??= (i * 0.618) % 1 * 6.28;
    p.pos = new THREE.Vector3(p.x, p.y || 0, p.z);
    if (p.act === 'walk') { p.p = 0; p.side = (rng ? rng.range(-0.28, 0.28) : 0); p.speed = (p.speed || 0.5) * (rng ? rng.range(0.8, 1.2) : 1); p.tx = Math.floor(p.x); p.tz = Math.floor(p.z); p.dx = 1; p.dz = 0; p.wait = 0; }
  });

  const key = (x, z) => `${x},${z}`;
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const nb = (x, z) => DIRS.filter(([a, b]) => walk.has(key(x + a, z + b)));
  people.filter((p) => p.act === 'walk').forEach((p) => { const o = nb(p.tx, p.tz); if (o.length) [p.dx, p.dz] = o[Math.floor(p.ph) % o.length]; else p.act = 'idle'; });

  const base = new THREE.Matrix4(), part = new THREE.Matrix4(), out = new THREE.Matrix4();
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const put = (im, i, px, py, pz, rx = 0, ry = 0, rz = 0) => {
    part.compose(v.set(px, py, pz), q.setFromEuler(e.set(rx, ry, rz)), s.set(1, 1, 1));
    out.multiplyMatrices(base, part);
    im.setMatrixAt(i, out);
  };

  function update(t, dt) {
    dt = Math.min(dt, 0.05);
    people.forEach((p, i) => {
      // arms: swing* rotates forward/back, raise* lifts out to the side and up
      let walkPh = 0, moving = false, lift = 0, seat = 0, swingA = 0, swingB = 0, raiseA = 0, raiseB = 0, legA = 0, legB = 0, tilt = 0;
      const tt = t + p.ph;
      if (p.act === 'walk') {
        if (p.wait > 0) p.wait -= dt;
        else {
          p.p += p.speed * dt;
          moving = true;
          if (p.p >= 1) {
            p.tx += p.dx; p.tz += p.dz; p.p -= 1;
            const o = nb(p.tx, p.tz).filter(([a, b]) => !(a === -p.dx && b === -p.dz));
            const pick = o.length ? o[Math.floor(Math.abs(Math.sin(p.tx * 12.9 + p.tz * 78.2 + Math.floor(t)) * 43758) % o.length)] : [-p.dx, -p.dz];
            [p.dx, p.dz] = pick;
            if (Math.sin(tt * 3.1) > 0.97) p.wait = 1.5;
          }
        }
        const fx = p.tx + 0.5 + p.dx * (p.p - 0.5) + -p.dz * p.side, fz = p.tz + 0.5 + p.dz * (p.p - 0.5) + p.dx * p.side;
        p.pos.lerp(v.set(fx, 0, fz), Math.min(1, dt * 8));
        const want = Math.atan2(-p.dz, p.dx);
        let d = want - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        p.yaw += d * Math.min(1, dt * 8);
      } else if (p.act === 'pace') {
        // back and forth between a and b, with a wave at each end
        const len = Math.hypot(p.b.x - p.a.x, p.b.z - p.a.z) || 1;
        const cyc = (2 * len) / 0.45 + 3;
        const k = ((tt % cyc) + cyc) % cyc;
        const leg1 = len / 0.45;
        let f, dir;
        if (k < leg1) { f = k / leg1; dir = 1; moving = true; } else if (k < leg1 + 1.5) { f = 1; dir = 1; raiseB = 2.6 + Math.sin(tt * 9) * 0.35; } else if (k < 2 * leg1 + 1.5) { f = 1 - (k - leg1 - 1.5) / leg1; dir = -1; moving = true; } else { f = 0; dir = -1; }
        p.pos.set(p.a.x + (p.b.x - p.a.x) * f, 0, p.a.z + (p.b.z - p.a.z) * f);
        p.yaw = Math.atan2(-(p.b.z - p.a.z) * dir, (p.b.x - p.a.x) * dir);
        if (!moving && dir === 1) p.yaw = p.faceYaw ?? p.yaw;
      } else if (p.act === 'sit') {
        seat = (p.seatY ?? 0.26) - 0.13;
        legA = legB = 1.45;
        swingA = swingB = 0.4;
        tilt = Math.sin(tt * 0.7) * 0.05;
      } else if (p.act === 'wave') {
        raiseB = 2.6 + Math.sin(tt * 8) * 0.35;
      } else if (p.act === 'cheer') {
        const j = Math.max(0, Math.sin(tt * 5));
        lift = j * 0.05;
        raiseA = raiseB = 2.75 + j * 0.2;
      } else if (p.act === 'ride') {
        // follow a path in world space: f is this rider's own phase, t keeps riders in sync with their ride
        const pt = p.path((((tt / (p.period || 5)) % 1) + 1) % 1, t);
        p.pos.set(pt.x, pt.y, pt.z); p.yaw = pt.yaw;
        if (pt.sit) { legA = legB = 1.45; swingA = swingB = pt.arms ?? 0.5; } else moving = true;
      } else if (p.act === 'slide') {
        // ride down a slide: p.path(f) gives the point, then walk back to the ladder
        const k = (tt * 0.3) % 1;
        const pt = p.path(k);
        p.pos.set(pt.x, pt.y, pt.z); p.yaw = pt.yaw;
        if (pt.sit) { legA = legB = 1.45; swingA = swingB = 1.2; } else moving = true;
      } else if (p.act === 'swing') {
        const a = Math.sin(tt * 2.2) * 0.6;
        p.pos.set(p.x + Math.sin(a) * 0.35 * Math.cos(p.yaw), p.y + 0.05 + (1 - Math.cos(a)) * 0.35, p.z - Math.sin(a) * 0.35 * Math.sin(p.yaw));
        legA = legB = 1.45 - a; raiseA = raiseB = 2.9;
      } else {
        tilt = Math.sin(tt * 0.9) * 0.04;
      }
      if (moving) {
        walkPh = tt * 11;
        legA = Math.sin(walkPh) * 0.6; legB = -legA;
        swingA = -legA * 0.8; swingB = legA * 0.8;
        lift = Math.abs(Math.sin(walkPh)) * 0.018;
      }
      base.compose(v.set(p.pos.x, p.pos.y + lift + seat, p.pos.z), q.setFromAxisAngle(up, p.yaw), s.setScalar(p.scale));
      const bodyBob = moving ? 0 : Math.sin(tt * 2) * 0.004;
      put(torso, i, 0, bodyBob, 0, 0, 0, tilt * 0.5);
      put(head, i, 0, bodyBob, 0, 0, 0, tilt);
      put(hair[p.look.style], p.hairSlot, 0, bodyBob, 0, 0, 0, tilt);
      put(legL, i, 0, 0.13, 0.038, 0, 0, legA);
      put(legR, i, 0, 0.13, -0.038, 0, 0, legB);
      put(armL, i, 0, 0.275 + bodyBob, 0.095, -raiseA, 0, swingA);
      put(armR, i, 0, 0.275 + bodyBob, -0.095, raiseB, 0, swingB);
    });
    for (const im of [torso, head, legL, legR, armL, armR, ...hair]) im.instanceMatrix.needsUpdate = true;
  }
  update(0, 0.016);
  return { group, update, people };
}
