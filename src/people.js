// Designers: sample residents, drawn avatars, and the paper textures for their plots.
import * as THREE from 'three';
import { createRng } from './engine/rng.js';
import { FONT } from './engine/label.js';

export const ROLES = ['Product designer', 'Indie hacker', 'Illustrator', 'Solo founder', '3D artist', 'Developer', 'Motion designer', 'AI builder', 'Brand designer', 'Design engineer', 'Maker', 'Art director'];
export const COLORS = ['#E4572E', '#3B82F6', '#F2B705', '#7B61FF', '#17A398', '#FF6FB5', '#2F5D7C', '#F2994A', '#6AA75E', '#D9614C'];

// Fictional residents so the land feels alive on day one. Replace or extend freely.
const NAMES = ['Ines Laurent', 'Kofi Mensah', 'Yuna Sato', 'Mateo Ruiz', 'Amara Okafor', 'Lena Novak', 'Rafael Costa', 'Hana Kim', 'Elif Demir', 'Noah Fischer',
  'Zara Haddad', 'Theo Marchand', 'Priya Nair', 'Oskar Lind', 'Maya Cohen', 'Luca Bianchi', 'Sofia Petrova', 'Idris Benali', 'Aiko Tanaka', 'Leo Moreau',
  'Nadia Rahman', 'Felix Wagner', 'Clara Jensen', 'Omar Saleh'];

export function sampleDesigners() {
  return NAMES.map((name, i) => ({
    id: `sample-${i}`,
    name,
    role: ROLES[i % ROLES.length],
    color: COLORS[i % COLORS.length],
    links: [{ label: 'Portfolio', url: 'https://example.com' }],
    avatar: '',
    images: [],
    sample: true,
  }));
}

export function normalizeDesigner(d, i = 0) {
  return {
    id: d.id || `d-${i}-${(d.name || 'x').toLowerCase().replace(/\W+/g, '-')}`,
    name: String(d.name || 'Designer').slice(0, 40),
    role: String(d.role || 'Designer').slice(0, 40),
    color: /^#[0-9a-f]{6}$/i.test(d.color || '') ? d.color : COLORS[i % COLORS.length],
    links: (d.links || []).filter((l) => l && /^https?:\/\//.test(l.url)).slice(0, 4),
    avatar: d.avatar || '',
    images: (d.images || []).filter(Boolean).slice(0, 3),
    sample: !!d.sample,
  };
}

const loadImg = (src) => new Promise((res) => {
  if (!src) return res(null);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => res(img);
  img.onerror = () => res(null);
  img.src = src;
});

const INK = '#2B2530';
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

/** A cute drawn portrait, deterministic from the designer's name. */
export function drawAvatar(g, d, x, y, s) {
  const rng = createRng(`avatar:${d.name}`);
  const skin = rng.pick(['#F6D3B3', '#E9B48E', '#C98E62', '#8D5A3B', '#F2C7A5', '#5E3B28']);
  const hair = rng.pick(['#E4572E', '#2B2530', '#7A4A2A', '#E9C46A', '#B5651D', '#3B3054', '#D96C3E', '#F0E2C0']);
  const style = rng.int(0, 3);
  g.save();
  g.translate(x, y);
  g.lineWidth = s * 0.025;
  g.strokeStyle = INK;
  // shirt
  g.fillStyle = d.color;
  g.beginPath(); g.ellipse(s * 0.5, s * 1.02, s * 0.36, s * 0.26, 0, Math.PI, 0); g.fill(); g.stroke();
  // hair behind
  g.fillStyle = hair;
  if (style === 1 || style === 3) { rr(g, s * 0.24, s * 0.3, s * 0.52, s * (style === 3 ? 0.56 : 0.42), s * 0.2); g.fill(); g.stroke(); }
  // face
  g.fillStyle = skin;
  g.beginPath(); g.ellipse(s * 0.5, s * 0.5, s * 0.22, s * 0.25, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  // fringe / top
  g.fillStyle = hair;
  g.beginPath();
  if (style === 2) { g.ellipse(s * 0.5, s * 0.22, s * 0.13, s * 0.1, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.beginPath(); }
  g.ellipse(s * 0.5, s * 0.36, s * 0.24, s * 0.14, 0, Math.PI, 0);
  g.fill(); g.stroke();
  // face
  g.fillStyle = INK;
  for (const ex of [0.42, 0.58]) { g.beginPath(); g.arc(s * ex, s * 0.52, s * 0.022, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = 'rgba(240, 110, 120, 0.45)';
  for (const bx of [0.37, 0.63]) { g.beginPath(); g.ellipse(s * bx, s * 0.6, s * 0.04, s * 0.025, 0, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = INK; g.lineWidth = s * 0.016;
  g.beginPath(); g.arc(s * 0.5, s * 0.6, s * 0.04, 0.2, Math.PI - 0.2); g.stroke();
  g.restore();
}

function tex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Paper standee: the avatar (uploaded or drawn) as a white-bordered cut-out. Resolves when images load. */
export async function standeeTexture(d) {
  const W = 256, H = 320;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#FFFDF6'; rr(g, 6, 6, W - 12, H - 12, 34); g.fill();
  g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
  g.save(); rr(g, 22, 22, W - 44, H - 44, 24); g.clip();
  g.fillStyle = new THREE.Color(d.color).lerp(new THREE.Color('#FFF8EA'), 0.75).getStyle(); g.fillRect(0, 0, W, H);
  const img = await loadImg(d.avatar);
  if (img) {
    const k = Math.max((W - 44) / img.width, (H - 44) / img.height);
    g.drawImage(img, W / 2 - (img.width * k) / 2, H / 2 - (img.height * k) / 2, img.width * k, img.height * k);
  } else drawAvatar(g, d, 22, 44, W - 44);
  g.restore();
  return tex(c);
}

export function signTexture(d) {
  const W = 512, H = 160;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#E9D2A6'; rr(g, 4, 4, W - 8, H - 8, 18); g.fill();
  g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
  for (let k = 0; k < 6; k++) { g.strokeStyle = 'rgba(120, 80, 40, 0.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(14, 30 + k * 20); g.lineTo(W - 14, 26 + k * 21); g.stroke(); }
  let fs = 72;
  g.font = `600 ${fs}px ${FONT}`;
  while (g.measureText(d.name).width > W - 60 && fs > 24) g.font = `600 ${(fs -= 4)}px ${FONT}`;
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(d.name, W / 2, H / 2 + 4);
  return tex(c);
}

/** The first portfolio image on an easel canvas (or a little abstract placeholder in their colour). */
export async function easelTexture(d) {
  const W = 256, H = 200;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#FFFDF6'; g.fillRect(0, 0, W, H);
  const img = await loadImg(d.images[0]);
  if (img) {
    const k = Math.max(W / img.width, H / img.height);
    g.drawImage(img, W / 2 - (img.width * k) / 2, H / 2 - (img.height * k) / 2, img.width * k, img.height * k);
  } else {
    const rng = createRng(`art:${d.name}`);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? d.color : rng.pick(['#F2B705', '#3B82F6', '#FF6FB5', '#17A398', '#2B2530']);
      g.globalAlpha = 0.85;
      const kind = rng.int(0, 2), x = rng.range(30, W - 30), y = rng.range(30, H - 30), r = rng.range(18, 46);
      g.beginPath();
      if (kind === 0) g.arc(x, y, r, 0, Math.PI * 2);
      else if (kind === 1) g.rect(x - r, y - r * 0.6, r * 2, r * 1.2);
      else { g.moveTo(x, y - r); g.lineTo(x + r, y + r); g.lineTo(x - r, y + r); g.closePath(); }
      g.fill();
    }
    g.globalAlpha = 1;
  }
  g.lineWidth = 8; g.strokeStyle = INK; g.strokeRect(4, 4, W - 8, H - 8);
  return tex(c);
}

/** Avatar as a data URL for the HTML card (uploaded avatar or the drawn one). */
export function avatarDataURL(d, size = 160) {
  if (d.avatar) return d.avatar;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = new THREE.Color(d.color).lerp(new THREE.Color('#FFF8EA'), 0.75).getStyle(); g.fillRect(0, 0, size, size);
  drawAvatar(g, d, 0, size * 0.08, size);
  return c.toDataURL();
}
