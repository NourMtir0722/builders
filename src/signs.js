// Builderland signs: the sponsor surfaces that read from the one Signs list.
// The screen billboard loops through every sign, the blimp carries the first one (the premium slot),
// and bunting strings sign colours across the streets.
import * as THREE from 'three';
import { toon } from './engine/ink.js';
import { INK, MAT } from './tokens.js';
import { M, rbox, at, logoMaterial, live } from './bkit.js';
import { signAt } from './props.js';

/** A big roadside screen that shows each sign in turn, every 3 seconds. Glows at night. */
export function screenBillboard(place, signs = []) {
  const g = new THREE.Group();
  const list = signs.length ? signs : [place];
  for (const x of [-0.75, 0.75]) g.add(at(M(new THREE.BoxGeometry(0.1, 1.5, 0.1), MAT.metal), x, 0.75, 0));
  g.add(at(M(rbox(2.3, 1.35, 0.16, 0.05), INK), 0, 2.05, 0));
  const mats = list.map((s) => {
    const m = logoMaterial(s, 2.1 / 1.18, { pad: 0.12 });
    m.emissive = new THREE.Color('#FFFFFF');
    m.emissiveMap = m.map;
    m.emissiveIntensity = 0.25;
    m.userData.glow = true;
    return m;
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.18), mats[0]);
  screen.position.set(0, 2.05, 0.085);
  screen.userData.live = true;
  g.add(screen);
  // a little "LIVE" lamp on top
  const lamp = new THREE.MeshStandardMaterial({ color: '#E4572E', emissive: '#FF3B2E', emissiveIntensity: 1 });
  lamp.userData.own = true;
  g.add(at(M(new THREE.SphereGeometry(0.06, 8, 6), lamp), 1.0, 2.8, 0.05));
  let shown = 0;
  g.userData.update = (t) => {
    const k = Math.floor(t / 3) % mats.length;
    if (k !== shown) { shown = k; screen.material = mats[k]; }
    lamp.emissiveIntensity = (t % 1) < 0.5 ? 1.6 : 0.3;
  };
  g.userData.screenMats = mats;
  g.rotation.y = Math.PI / 4;
  g.userData.height = 3.0;
  return g;
}

/** The blimp: the premium sponsor slot. Flies a loop over the land trailing the first sign. */
export function blimp(sign, { center = new THREE.Vector3(), radius = 20, height = 10 } = {}) {
  const g = live(new THREE.Group());
  g.name = 'blimp';
  const body = new THREE.Group();
  const hull = M(new THREE.SphereGeometry(1, 32, 18), MAT.wallWhite);
  hull.scale.set(2.4, 0.85, 0.85);
  body.add(hull);
  for (const s of [-1, 1]) {
    const band = M(new THREE.TorusGeometry(0.86, 0.06, 6, 32).rotateY(Math.PI / 2), sign.color);
    band.position.x = s * 0.9; band.scale.set(1, 0.97 - Math.abs(s) * 0.2, 0.97 - Math.abs(s) * 0.2);
    body.add(band);
  }
  // logo on both flanks
  const lm = logoMaterial(sign, 2.2 / 0.7, { pad: 0.1 });
  for (const s of [-1, 1]) {
    const flank = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.6), lm);
    flank.position.set(0, 0.05, s * 0.86);
    flank.rotation.y = s > 0 ? 0 : Math.PI;
    body.add(flank);
  }
  for (const [ry, rz] of [[0, 0], [Math.PI / 2, 0], [Math.PI, 0], [-Math.PI / 2, 0]]) {
    const fin = M(new THREE.BoxGeometry(0.55, 0.04, 0.5), sign.color);
    fin.position.set(-2.15, 0, 0);
    const pivot = new THREE.Group(); pivot.rotation.x = ry; pivot.add(fin); fin.position.z = 0.35;
    body.add(pivot);
  }
  body.add(at(M(rbox(0.7, 0.28, 0.32, 0.1), MAT.wall), 0.2, -0.92, 0));
  body.add(at(M(new THREE.BoxGeometry(0.5, 0.08, 0.33), MAT.glass), 0.25, -0.9, 0));
  const prop = live(new THREE.Group());
  prop.position.set(-2.55, 0, 0);
  for (let k = 0; k < 3; k++) { const b = M(new THREE.BoxGeometry(0.03, 0.5, 0.08), MAT.metal); b.rotation.x = (k * Math.PI * 2) / 3; prop.add(b); }
  body.add(prop);
  g.add(body);
  // trailing banner on a rope
  const banner = live(new THREE.Group());
  // two panels back to back, so the name reads the right way round from both sides
  const bm = logoMaterial(sign, 2.6 / 0.62, { pad: 0.1 });
  const cloth = live(new THREE.Group());
  cloth.position.set(-1.3, 0, 0);
  for (const ry of [0, Math.PI]) { const side = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.62), bm); side.rotation.y = ry; side.position.z = ry ? -0.004 : 0.004; cloth.add(side); }
  banner.add(cloth);
  banner.add(at(M(new THREE.CylinderGeometry(0.008, 0.008, 1.3, 4).rotateZ(Math.PI / 2), INK), 0.65, 0.2, 0));
  banner.position.set(-3.2, -0.9, 0);
  g.add(banner);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  g.userData.sign = sign;
  const pos = new THREE.Vector3(), next = new THREE.Vector3();
  const path = (t, out) => {
    const a = t * 0.045;
    return out.set(center.x + Math.cos(a) * radius, height + Math.sin(t * 0.3) * 0.4, center.z + Math.sin(a) * radius * 0.75);
  };
  g.userData.update = (t) => {
    path(t, pos); path(t + 0.5, next);
    g.position.copy(pos);
    g.rotation.y = Math.atan2(-(next.z - pos.z), next.x - pos.x);
    prop.rotation.x = t * 12;
    banner.rotation.y = Math.sin(t * 1.3) * 0.12;
    cloth.rotation.x = Math.sin(t * 2.1) * 0.15;
  };
  g.userData.update(0);
  return g;
}

/**
 * Bunting strung across straight road tiles, in sign colours. `spans` are [{ x, z, axis }] where
 * axis 'x' means the road runs along x (so the string crosses along z). Instanced: 2 draw calls.
 */
export function bunting(spans, signs = []) {
  const g = new THREE.Group();
  g.name = 'bunting';
  if (!spans.length) return g;
  const N = 9;
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.05, 0, 0, 0.05, 0, 0, 0, -0.12, 0, 0.05, 0, 0, -0.05, 0, 0, 0, -0.12, 0], 3));
  tri.computeVertexNormals();
  const flagMat = new THREE.MeshToonMaterial({ gradientMap: toon('#fff').gradientMap, side: THREE.DoubleSide });
  flagMat.userData.own = true;
  const flags = new THREE.InstancedMesh(tri, flagMat, spans.length * N);
  const poleGeo = new THREE.CylinderGeometry(0.02, 0.025, 1.35, 5).translate(0, 0.675, 0);
  const poles = new THREE.InstancedMesh(poleGeo, toon(MAT.metal), spans.length * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
  spans.forEach((sp, n) => {
    const ax = sp.axis === 'x' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const a = new THREE.Vector3(sp.x, 0, sp.z).addScaledVector(ax, -0.52), b = new THREE.Vector3(sp.x, 0, sp.z).addScaledVector(ax, 0.52);
    poles.setMatrixAt(n * 2, m4.makeTranslation(a.x, 0, a.z));
    poles.setMatrixAt(n * 2 + 1, m4.makeTranslation(b.x, 0, b.z));
    q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), ax);
    for (let k = 0; k < N; k++) {
      const f = (k + 0.5) / N;
      v.copy(a).lerp(b, f).setY(1.3 - Math.sin(f * Math.PI) * 0.16);
      m4.compose(v, q, one);
      flags.setMatrixAt(n * N + k, m4);
      flags.setColorAt(n * N + k, c.set(signAt(signs, n + k).color));
    }
  });
  for (const im of [flags, poles]) { im.castShadow = true; im.receiveShadow = true; im.userData.sharedGeo = false; g.add(im); }
  return g;
}
