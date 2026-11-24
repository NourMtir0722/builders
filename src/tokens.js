// Builderland design tokens.
// One file for every colour, value band, saturation rule and light preset, so the land and the
// style board (style.html) read from the same source. Change a token here and both follow.
import * as THREE from 'three';

// ── palette ─────────────────────────────────────────────────────
// `share` is the 60 / 30 / 10 split: nature + paper, built neutrals, accents.
export const PAPER = '#F1EBDD';
export const INK = '#2B2530';

export const PALETTE = {
  paper:  { label: 'Paper',             share: 'nature', colors: [PAPER] },
  grass:  { label: 'Grass',             share: 'nature', colors: ['#8DB063', '#7EA457', '#86AC5E'] },
  water:  { label: 'Water',             share: 'nature', colors: ['#8CCBDA'] },
  path:   { label: 'Path / plaza',      share: 'built',  colors: ['#DCC9A2', '#E6D9BC'] },
  wood:   { label: 'Wood / stone',      share: 'built',  sat: [0, 45],  colors: ['#A0784F', '#C9BCA0', '#B9B2A0'] },
  walls:  { label: 'Walls',             share: 'built',  colors: ['#F6EAD3', '#F3E9D8', '#FBF5E8'] },
  roofs:  { label: 'Roofs',             share: 'built',  sat: [25, 70], colors: ['#D9614C', '#E59A3C', '#5C8FD6', '#2F5D7C'] },
  accent: { label: 'Accents (≤10%)',    share: 'accent', colors: ['#E4572E', '#F2B705', '#3B82F6', '#7B61FF', '#17A398', '#FF6FB5'] },
  ink:    { label: 'Ink',               share: 'dark',   colors: [INK] },
};
export const ACCENTS = PALETTE.accent.colors;
export const SHARE = { nature: 0.6, built: 0.3, accent: 0.1 };

/** Ground tile variations, derived from the path / plaza tokens. */
export const GROUND = {
  path: ['#DCC9A2', '#D5C096', '#E2D1AE', '#CFBA90'],
  plaza: ['#E6D9BC', '#DED0B0', '#EADFC6'],
  pond: '#4E6B5E',
  water: PALETTE.water.colors[0],
  waterWinter: '#CFE6EE',
  lipPath: '#BFAE8A',
  cliff: '#6E5240',
  cliffEdge: '#5C4433',
  steps: '#D8CCB2',
  road: ['#BDB5A6', '#B7AF9F', '#C2BAAC'],
  roadDash: '#F3E9D8',
  stone: '#C9BCA0',
  stoneWinter: '#E1E6E8',
};

/** Material colours used by buildings and props. Darks stay reserved for ink, trunks and windows. */
export const MAT = {
  wall: PALETTE.walls.colors[0],
  wallAlt: PALETTE.walls.colors[1],
  wallWhite: '#F7F4EE',
  glass: '#4F6475',
  glassAtrium: '#9CC6D8',
  door: '#8A5A3C',
  metal: '#5A524A',
  metalLight: '#8A8F94',
  terracotta: '#B5654A',
  plinth: ['#D8CDB8', '#C9BCA4'],
  forecourt: '#E6DCC6',
  awning: '#FFF8EA',
  trunk: '#5B4636',
  woodPost: '#8A6A50',
  woodBoard: '#C9A878',
  woodSign: '#E9D2A6',
  lantern: '#3B3A36',
  plotBorder: PALETTE.wood.colors[2],
  plotBorderWinter: '#D9DEE0',
  base: PALETTE.wood.colors[0],
  rock: '#A8A296',
  monolith: '#A9A79A',
  mushStem: '#F4EAD8',
  mushCap: ['#D9483B', '#E4572E', '#F2994A'],
  windowLit: '#FFD58A',
};

// ── rules ───────────────────────────────────────────────────────
/**
 * Saturation budget and value bands, in HSL percent.
 * Roles can narrow or widen the band with `sat`: stone greys may sit low, and roofs are mid colours
 * that may go up to the accent line but never past it.
 * Near-white (L > 88) and near-black (L < 18) colours are exempt from the saturation rule:
 * HSL saturation is inflated there and means nothing to the eye.
 */
export const RULES = {
  baseSat: [25, 45],     // nature + built bases
  accentSat: 70,         // only accents go above this
  satExempt: [18, 88],   // lightness range the saturation rule applies to
  ground: [72, 85],      // ground is light. Grass sits below on purpose (it is the mid-value field).
};

export function hsl(hex) {
  const c = new THREE.Color(hex);
  const o = {};
  c.getHSL(o, THREE.SRGBColorSpace);
  return { h: Math.round(o.h * 360), s: Math.round(o.s * 100), l: Math.round(o.l * 100) };
}
const fromHsl = (h, s, l) => `#${new THREE.Color().setHSL(h / 360, s / 100, l / 100, THREE.SRGBColorSpace).getHexString()}`;

/** Checks one token against the budget. Returns { ok, note, fix } where fix is the nearest passing hex. */
export function audit(hex, roleKey) {
  const role = PALETTE[roleKey];
  const { h, s, l } = hsl(hex);
  const exempt = l < RULES.satExempt[0] || l > RULES.satExempt[1];
  if (role.share === 'dark') return { h, s, l, ok: l < 25, note: l < 25 ? 'reserved dark' : 'ink must stay dark' };
  if (role.share === 'accent') {
    const ok = s >= RULES.accentSat;
    return { h, s, l, ok, note: ok ? 'accent pops' : `accent under ${RULES.accentSat}%`, fix: ok ? null : fromHsl(h, RULES.accentSat, l) };
  }
  if (exempt) return { h, s, l, ok: true, note: 'near-white, exempt' };
  const [lo, hi] = role.sat || RULES.baseSat;
  // a fix that rounds back to the same hex is 8-bit rounding, not drift
  const off = (fix, note) => (fix.toUpperCase() === hex.toUpperCase() ? { h, s, l, ok: true, note: 'in budget (rounding)' } : { h, s, l, ok: false, note, fix });
  if (s > hi) return off(fromHsl(h, hi, l), `over ${hi}%`);
  if (s < lo) return off(fromHsl(h, lo, l), `under ${lo}%`);
  return { h, s, l, ok: true, note: 'in budget' };
}

// ── light (golden hour is the content default, night the second hero) ──
// hs/hg = hemisphere sky/ground. Ground colours are lilac or teal, so shade looks drawn, never grey.
// sc/si = sun colour/intensity, el = sun elevation in degrees, bg = paper behind the land, glow = lamps.
export const LIGHT_KEYS = [
  { at: 0,    hs: '#FFE6D2', hg: '#9C8FA8', hi: 1.4,  sc: '#FFC9A0', si: 1.6, el: 10, bg: '#F3E8DC', glow: 0.25 },
  { at: 0.35, hs: '#FFF6E6', hg: '#8AAFB0', hi: 1.8,  sc: '#FFF0D8', si: 2.4, el: 52, bg: PAPER,     glow: 0 },
  { at: 0.6,  hs: '#FFE2BE', hg: '#A897A8', hi: 1.5,  sc: '#FFB980', si: 2.6, el: 18, bg: '#F3E6D4', glow: 0.25 },
  { at: 0.8,  hs: '#B7A6CF', hg: '#3E3B5C', hi: 1.05, sc: '#FF9A6A', si: 1.3, el: 8,  bg: '#E8E0DC', glow: 0.8 },
  { at: 1,    hs: '#8A93C9', hg: '#262B44', hi: 0.75, sc: '#A9B8FF', si: 0.6, el: 40, bg: '#DCD9E2', glow: 1 },
];
export const LIGHT_PRESETS = { dawn: 0.05, day: 0.35, golden: 0.6, dusk: 0.8, night: 1 };
export const DEFAULT_TIME = LIGHT_PRESETS.golden;
export const LANTERN_GLOW = '#FFC86B';

export function lightName(t) {
  return t < 0.15 ? 'dawn' : t < 0.5 ? 'day' : t < 0.7 ? 'golden' : t < 0.9 ? 'dusk' : 'night';
}

/** Interpolated light at time t (0 dawn → 1 night). */
export function sampleLight(t) {
  const K = LIGHT_KEYS;
  let a = K[0], b = K[K.length - 1];
  for (let i = 0; i < K.length - 1; i++) if (t >= K[i].at && t <= K[i + 1].at) { a = K[i]; b = K[i + 1]; }
  const k = b.at === a.at ? 0 : (t - a.at) / (b.at - a.at);
  const c = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), k);
  const n = (x, y) => x + (y - x) * k;
  return { hs: c(a.hs, b.hs), hg: c(a.hg, b.hg), hi: n(a.hi, b.hi), sc: c(a.sc, b.sc), si: n(a.si, b.si), el: n(a.el, b.el), bg: c(a.bg, b.bg), glow: n(a.glow, b.glow) };
}

/**
 * Applies the light at time t to a stage's hemisphere, sun and background, aims the sun at `center`
 * and fits the shadow camera to a sphere of `radius` around it. Returns the lamp glow (0–1).
 */
export function applyLight({ hemi, sun, scene }, t, azimuthDeg = 326, { center = new THREE.Vector3(), radius = 20 } = {}) {
  const L = sampleLight(t);
  hemi.color.copy(L.hs); hemi.groundColor.copy(L.hg); hemi.intensity = L.hi;
  sun.color.copy(L.sc); sun.intensity = L.si;
  if (scene.background?.isColor) scene.background.copy(L.bg); else scene.background = L.bg.clone();
  const el = THREE.MathUtils.degToRad(L.el), az = THREE.MathUtils.degToRad(azimuthDeg);
  const d = radius * 3;
  sun.position.set(Math.cos(el) * Math.cos(az) * d, Math.sin(el) * d, Math.cos(el) * Math.sin(az) * d).add(center);
  sun.target.position.copy(center);
  sun.target.updateMatrixWorld();
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -radius * 1.1;
  sc.right = sc.top = radius * 1.1;
  sc.near = 0.5;
  sc.far = d + radius * 2;
  sc.updateProjectionMatrix();
  return L.glow;
}
