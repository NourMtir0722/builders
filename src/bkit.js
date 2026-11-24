// Builderland building kit: the small helpers every building is made from.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toon } from './engine/ink.js';
import { FONT } from './engine/label.js';
import { INK, MAT } from './tokens.js';

export const ramp = () => toon('#fff').gradientMap;
export const own = (m) => ((m.userData.own = true), m);
export const M = (geo, mat) => {
  const m = new THREE.Mesh(geo, typeof mat === 'string' ? toon(mat) : mat);
  m.castShadow = m.receiveShadow = true;
  return m;
};
export const rbox = (w, h, d, r = 0.08) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2));
export const at = (o, x, y, z) => (o.position.set(x, y, z), o);
/** Marks an object that moves, so static merging leaves it (and merges its children separately). */
export const live = (o) => ((o.userData.live = true), o);
export const shade = (hex, l) => `#${new THREE.Color(hex).offsetHSL(0, 0, l).getHexString()}`;

// ── logo surfaces ────────────────────────────────────────────────────────────
export function loadImg(src) {
  return new Promise((res) => {
    if (!src) return res(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

/** A paper sign with the place's logo (image or SVG) or its name, on its brand colour. */
export function logoMaterial(place, aspect = 1, { bg = place.color, pad = 0.14 } = {}) {
  const H = 256, W = Math.round(H * aspect);
  const c = document.createElement('canvas'); c.width = Math.min(2048, W); c.height = H;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const draw = (img) => {
    g.fillStyle = bg; g.fillRect(0, 0, c.width, H);
    g.lineWidth = 10; g.strokeStyle = INK; g.strokeRect(5, 5, c.width - 10, H - 10);
    const bw = c.width * (1 - pad * 2 / aspect), bh = H * (1 - pad * 2);
    if (img) {
      const k = Math.min(bw / img.width, bh / img.height);
      g.drawImage(img, (c.width - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k);
    } else {
      let fs = H * 0.46;
      g.font = `600 ${fs}px ${FONT}`;
      while (g.measureText(place.name).width > bw && fs > 14) g.font = `600 ${(fs *= 0.92)}px ${FONT}`;
      // text in the place's ink, else whichever of ink or paper reads on this background
      const light = (() => { const c = new THREE.Color(bg); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b > 0.62; })();
      g.fillStyle = place.ink && !(light && /^#f/i.test(place.ink)) ? place.ink : light ? INK : '#FFFDF6';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(place.name, c.width / 2, H / 2 + 6);
    }
    tex.needsUpdate = true;
  };
  draw(null);
  loadImg(place.logo).then((img) => img && draw(img));
  return own(new THREE.MeshToonMaterial({ map: tex, gradientMap: ramp() }));
}

export function stripes(a, b, n = 8) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 32;
  const g = c.getContext('2d');
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect((i * 128) / n, 0, 128 / n + 1, 32); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return own(new THREE.MeshToonMaterial({ map: t, gradientMap: ramp() }));
}

export function windows(wall, cols, rows, glass = MAT.glass) {
  const c = document.createElement('canvas'); c.width = cols * 32; c.height = rows * 32;
  const g = c.getContext('2d');
  g.fillStyle = wall; g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    g.fillStyle = glass; g.fillRect(x * 32 + 7, y * 32 + 7, 18, 18);
    g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(x * 32 + 7, y * 32 + 7, 18, 18);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const e = document.createElement('canvas'); e.width = c.width; e.height = c.height;
  const ge = e.getContext('2d');
  // lit windows come from a hash, not Math.random, so the same land always lights the same way
  const lit = (x, y) => Math.abs(Math.sin((x + 1) * 12.9898 + (y + 1) * 78.233 + cols * 3.7 + rows * 1.3) * 43758.5453) % 1 < 0.6;
  ge.fillStyle = '#000'; ge.fillRect(0, 0, e.width, e.height);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (lit(x, y)) { ge.fillStyle = MAT.windowLit; ge.fillRect(x * 32 + 7, y * 32 + 7, 18, 18); }
  const te = new THREE.CanvasTexture(e);
  const m = own(new THREE.MeshToonMaterial({ map: t, emissiveMap: te, emissive: '#ffffff', emissiveIntensity: 0, gradientMap: ramp() }));
  m.userData.glow = true;
  return m;
}

export function planter(color = '#6A9A4C') {
  const g = new THREE.Group();
  g.add(at(M(new THREE.CylinderGeometry(0.13, 0.11, 0.18, 10), MAT.terracotta), 0, 0.09, 0));
  g.add(at(M(new THREE.IcosahedronGeometry(0.16, 1), color), 0, 0.28, 0));
  return g;
}
