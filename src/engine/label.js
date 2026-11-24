// Paper tags drawn on canvas: milestone labels, player names, node numbers.
import * as THREE from 'three';

export const FONT = '"Fredoka", "Nunito", ui-rounded, system-ui, sans-serif';

/** A paper tag that always faces the camera and keeps the same size on screen. */
export function tagSprite({ title, subtitle = '', dot = null, ink = '#2D2A26', bg = '#FFFBF3', width = 0.07, tail = true }) {
  const W = 512;
  const bh = subtitle ? 190 : 130;
  const H = bh + (tail ? 64 : 34);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');

  const titleFont = `600 ${subtitle ? 84 : 76}px ${FONT}`;
  g.font = titleFont;
  const tw = g.measureText(title).width + (dot ? 56 : 0);
  g.font = `500 42px ${FONT}`;
  const sw = subtitle ? g.measureText(subtitle).width : 0;
  const bw = Math.min(W - 40, Math.max(180, Math.max(tw, sw) + 84));
  const bx = tail ? (W - bw) / 2 : 20, by = 16;
  const cx = bx + bw / 2;

  g.shadowColor = 'rgba(70, 45, 20, 0.25)';
  g.shadowBlur = 16;
  g.shadowOffsetY = 7;
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(bx, by, bw, bh, tail ? 40 : bh / 2);
  if (tail) {
    g.moveTo(W / 2 - 20, by + bh - 2);
    g.lineTo(W / 2, by + bh + 26);
    g.lineTo(W / 2 + 20, by + bh - 2);
    g.closePath();
  }
  g.fill();
  g.shadowColor = 'transparent';

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const ty = by + (subtitle ? bh * 0.4 : bh / 2) + 4;
  const tx = cx + (dot ? 26 : 0);
  if (dot) {
    g.font = titleFont;
    const realW = g.measureText(title).width;
    g.fillStyle = dot;
    g.beginPath();
    g.arc(tx - realW / 2 - 36, ty - 2, 17, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = ink;
  g.font = titleFont;
  g.fillText(title, tx, ty);
  if (subtitle) {
    g.fillStyle = '#8C8173';
    g.font = `500 42px ${FONT}`;
    g.fillText(subtitle, cx, by + bh * 0.76);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true, toneMapped: false, sizeAttenuation: false, fog: false });
  mat.userData.own = true;
  const s = new THREE.Sprite(mat);
  s.center.set(0.5, 0);
  s.scale.set(width, (width * H) / W, 1);
  s.renderOrder = 10;
  return s;
}

/** Level number printed on top of a node. */
export function numberTexture(text, ink = '#2D2A26') {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(45, 42, 38, 0.16)';
  g.lineWidth = 8;
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 18, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = ink;
  g.font = `600 ${text.length > 2 ? 96 : 128}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, S / 2, S / 2 + 8);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
