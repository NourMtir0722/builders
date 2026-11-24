// Builderland props: shared flora geometry, street furniture and the builder plot.
// Used by the land (world.js) and the style board (style.js), so both show the same assets.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toon } from './engine/ink.js';
import { standeeTexture, signTexture, easelTexture } from './people.js';
import { INK, MAT } from './tokens.js';

const ownToon = (opts = {}) => {
  const m = new THREE.MeshToonMaterial({ gradientMap: toon('#fff').gradientMap, ...opts });
  m.userData.own = true;
  return m;
};

// ── shared geometry templates (instanced across the land) ──
let TPL = null;
export function templates() {
  if (TPL) return TPL;
  const ico = (r, x, y, z) => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z);
  const canopy = mergeGeometries([ico(0.62, 0, 1.45, 0), ico(0.46, 0.4, 1.6, 0.15), ico(0.48, -0.35, 1.55, -0.2), ico(0.42, 0.05, 1.95, -0.05), ico(0.4, -0.1, 1.3, 0.38)]);
  const trunk = new THREE.CylinderGeometry(0.09, 0.14, 1.3, 7).translate(0, 0.65, 0);
  const pine = mergeGeometries([0, 1, 2].map((k) => new THREE.ConeGeometry(0.55 - k * 0.13, 0.7, 8).translate(0, 0.65 + k * 0.42, 0)));
  const pineSnow = mergeGeometries([0, 1, 2].map((k) => new THREE.ConeGeometry(0.3 - k * 0.07, 0.3, 8).translate(0, 0.86 + k * 0.42, 0)));
  const pineTrunk = new THREE.CylinderGeometry(0.06, 0.09, 0.5, 6).translate(0, 0.25, 0);
  const bush = mergeGeometries([ico(0.26, 0, 0.2, 0), ico(0.2, 0.2, 0.15, 0.08), ico(0.2, -0.18, 0.14, -0.06)]);
  const flower = new THREE.IcosahedronGeometry(0.055, 0).translate(0, 0.2, 0);
  const stem = new THREE.BoxGeometry(0.014, 0.2, 0.014).translate(0, 0.1, 0);
  const tuft = mergeGeometries([-0.35, 0, 0.35].map((a) => new THREE.ConeGeometry(0.03, 0.22, 4).translate(0, 0.11, 0).rotateZ(a)));
  const rock = new THREE.DodecahedronGeometry(0.16, 0).scale(1, 0.6, 0.85).translate(0, 0.06, 0);
  const mushStem = new THREE.CylinderGeometry(0.035, 0.045, 0.12, 8).translate(0, 0.06, 0);
  const mushCap = new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.11, 0);
  const stone = new THREE.CylinderGeometry(0.15, 0.17, 0.03, 8).translate(0, 0.015, 0);
  const monolith = new RoundedBoxGeometry(0.34, 0.75, 0.16, 2, 0.05).translate(0, 0.37, 0);
  const dash = new THREE.BoxGeometry(0.34, 0.006, 0.05);
  TPL = { dash, canopy, trunk, pine, pineSnow, pineTrunk, bush, flower, stem, tuft, rock, mushStem, mushCap, stone, monolith };
  return TPL;
}

/** A park bench facing +z, with its two seats as spots for sitters. */
export function bench() {
  const g = new THREE.Group();
  const wood = toon(MAT.woodBoard), metal = toon(MAT.metal);
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.06, 0.3, 2, 0.02), wood); seat.position.y = 0.26;
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.24, 0.05, 2, 0.02), wood); back.position.set(0, 0.42, -0.14);
  g.add(seat, back);
  for (const x of [-0.38, 0.38]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.26), metal); l.position.set(x, 0.13, 0); g.add(l); }
  g.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
  g.userData.spots = { sit: [-0.22, 0.22].map((x) => ({ x, z: 0.02, y: 0.29, yaw: -Math.PI / 2 })) };
  return g;
}

export function lantern(mat) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.0, 6), toon(MAT.lantern));
  pole.position.y = 0.5;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14), mat);
  head.position.y = 1.08;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.1, 4), toon(MAT.lantern));
  cap.rotation.y = Math.PI / 4;
  cap.position.y = 1.22;
  g.add(pole, head, cap);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

export function welcomeSign(title, count) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = MAT.woodSign; g.beginPath(); g.roundRect(6, 6, 500, 244, 26); g.fill();
  g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
  g.fillStyle = INK; g.textAlign = 'center';
  let fs = 74;
  g.font = `600 ${fs}px "Fredoka", system-ui`;
  while (g.measureText(title).width > 460 && fs > 30) g.font = `600 ${(fs -= 4)}px "Fredoka", system-ui`;
  g.fillText(title, 256, 118);
  g.font = '500 34px "Fredoka", system-ui'; g.fillText(`${count} builders`, 256, 182);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = ownToon({ map: t });
  const g2 = new THREE.Group();
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 0.1), toon(MAT.woodPost)); p.position.set(s * 0.8, 0.65, 0); g2.add(p); }
  const wood = toon(MAT.woodBoard);
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.95, 0.08), [wood, wood, wood, wood, m, wood]);
  b.position.y = 1.15;
  b.castShadow = true;
  g2.add(b);
  g2.rotation.y = 0.6;
  return g2;
}

/**
 * A builder's 2×2 garden plot: border, paper standee, signpost, flag and easel.
 * Origin at the centre of the plot. Returns { group, standee, flag }.
 */
export function builderPlot(d, { winter = false } = {}) {
  const g = new THREE.Group();
  g.name = `plot_${d.name.replace(/\W+/g, '_')}`;
  const border = [];
  for (const [w, dd, x, z] of [[2, 0.12, 0, -0.97], [2, 0.12, 0, 0.97], [0.12, 1.82, -0.97, 0], [0.12, 1.82, 0.97, 0]]) border.push(new THREE.BoxGeometry(w, 0.14, dd).translate(x, 0.07, z));
  const bm = new THREE.Mesh(mergeGeometries(border), toon(winter ? MAT.plotBorderWinter : MAT.plotBorder));
  bm.castShadow = bm.receiveShadow = true;
  g.add(bm);
  const standee = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.08, 16), toon(MAT.base));
  base.position.y = 0.04;
  const mat = ownToon({ transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), mat);
  card.position.y = 0.58;
  card.castShadow = true;
  standee.add(base, card);
  standee.position.set(0.1, 0, 0.1);
  standee.userData.live = true;
  g.add(standee);
  standeeTexture(d).then((t) => { mat.map = t; mat.needsUpdate = true; });
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.75, 0.07), toon(MAT.woodPost));
  post.position.set(-0.55, 0.37, 0.72);
  const signMat = ownToon({ map: signTexture(d) });
  const wood = toon(MAT.woodBoard);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.26, 0.05), [wood, wood, wood, wood, signMat, signMat]);
  board.position.set(-0.55, 0.72, 0.72);
  board.rotation.y = 0.35;
  board.castShadow = true;
  g.add(post, board);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), toon('#6B5B4B'));
  pole.position.set(0.72, 0.75, -0.72);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.28).translate(0.225, 0, 0), toon(d.color));
  flag.position.set(0.72, 1.36, -0.72);
  flag.castShadow = true;
  flag.userData.live = true;
  g.add(pole, flag);
  const easel = new THREE.Group();
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.8, 0.04), toon(MAT.woodPost)); leg.position.set(s * 0.2, 0.4, 0); leg.rotation.z = s * 0.12; easel.add(leg); }
  const eMat = ownToon();
  const paperM = toon('#FFFDF6');
  const canvasM = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.44, 0.03), [paperM, paperM, paperM, paperM, eMat, paperM]);
  canvasM.position.set(0, 0.62, 0.04);
  canvasM.rotation.x = -0.12;
  canvasM.castShadow = true;
  easel.add(canvasM);
  easel.position.set(-0.6, 0, -0.55);
  easel.rotation.y = Math.PI / 4;
  g.add(easel);
  easelTexture(d).then((t) => { eMat.map = t; eMat.needsUpdate = true; });
  return { group: g, standee, flag };
}

// ── hand-placed props (the editor) ──
import { carMesh, CAR_MODELS } from './traffic.js';
import { capybara, cat } from './park.js';
import { logoMaterial } from './bkit.js';
import { ACCENTS } from './tokens.js';

const FLOWERS = ['#F4A6B8', '#F7D35C', '#FFFFFF', '#B69CF0', '#E4572E'];
const atPos = (o, x, y, z) => (o.position.set(x, y, z), o);

/** A sign from the land's Signs list (or a placeholder in an accent colour). */
export const signAt = (signs = [], n = 0) => signs.length ? signs[((n % signs.length) + signs.length) % signs.length] : { name: 'Your brand', color: ACCENTS[n % ACCENTS.length] };

/**
 * Builds one editor prop: { type, x, z, rot, model?, sign? }. People are not built here:
 * they join the crowd so they animate with everyone else.
 */
export function buildProp(pr, { lampMat, signs = [] } = {}) {
  const T = templates();
  const g = new THREE.Group();
  const mesh = (geo, color, s = 1) => { const m = new THREE.Mesh(geo, toon(color)); m.castShadow = m.receiveShadow = true; m.userData.sharedGeo = true; m.scale.setScalar(s); return m; };
  switch (pr.type) {
    case 'tree': g.add(mesh(T.trunk, MAT.trunk), mesh(T.canopy, '#5C8B45')); break;
    case 'pine': g.add(mesh(T.pineTrunk, MAT.trunk), mesh(T.pine, '#3F6E3A')); break;
    case 'bush': g.add(mesh(T.bush, '#6A9A4C', 1.3)); break;
    case 'flowers':
      for (let k = 0; k < 7; k++) {
        const a = k * 2.4, r = 0.12 + (k % 3) * 0.1;
        const f = new THREE.Group(); f.add(mesh(T.stem, '#5E8A45'), mesh(T.flower, FLOWERS[k % FLOWERS.length]));
        f.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); g.add(f);
      }
      break;
    case 'bench': g.add(bench()); break;
    case 'lamp': g.add(lantern(lampMat || toon('#FFF3D6'))); break;
    case 'banner': {
      const s = signAt(signs, pr.sign ?? 0);
      g.add(atPos(mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.7, 6), MAT.metal), 0, 0.85, 0));
      const lm = logoMaterial(s, 0.4 / 0.9);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.02), [toon(s.color), toon(s.color), toon(s.color), toon(s.color), lm, lm]);
      flag.position.set(0.22, 1.2, 0); flag.castShadow = true; flag.userData.live = true;
      g.add(flag, atPos(mesh(new THREE.BoxGeometry(0.46, 0.03, 0.03), MAT.metal), 0.22, 1.66, 0));
      g.userData.update = (t) => (flag.rotation.y = Math.sin(t * 1.7 + pr.x) * 0.15);
      break;
    }
    case 'billboard': {
      const s = signAt(signs, pr.sign ?? 0);
      for (const x of [-0.6, 0.6]) g.add(atPos(mesh(new THREE.BoxGeometry(0.09, 1.2, 0.09), MAT.metal), x, 0.6, 0));
      const lm = logoMaterial(s, 1.8);
      const face = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 0.08), [toon(INK), toon(INK), toon(INK), toon(INK), lm, lm]);
      face.position.y = 1.65; face.castShadow = true;
      g.add(face);
      break;
    }
    case 'car': g.add(carMesh(CAR_MODELS.includes(pr.model) ? pr.model : 'hatchback', pr.model === 'taxi' ? undefined : ACCENTS[Math.abs(Math.round(pr.x * 7 + pr.z * 3)) % ACCENTS.length])); break;
    case 'capybara': { const c = capybara({ orange: true }); c.scale.setScalar(1.3); g.add(c); break; }
    case 'cat': { const c = cat('#F2994A', { sleeping: false }); c.scale.setScalar(1.6); g.add(c); g.userData.update = (t) => c.userData.update(t); break; }
    default: g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8), '#E4572E'));
  }
  return g;
}
