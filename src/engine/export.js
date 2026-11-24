// Exports for game engines and 3D sites: .glb (whole world or one island) and route JSON.
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

/**
 * Deep-clone for export. glTF has no "flat shading" flag, so faceted paper
 * geometry gets real per-face normals baked in.
 */
// glTF has no toon material: export toon fills as plain matte PBR with the same colour, map and glow.
const pbrCache = new WeakMap();
function toPBR(m) {
  if (!m || !(m.isMeshToonMaterial || m.isMeshLambertMaterial)) return m;
  if (!pbrCache.has(m)) {
    pbrCache.set(m, new THREE.MeshStandardMaterial({
      color: m.color, map: m.map || null, emissive: m.emissive || new THREE.Color(0), emissiveMap: m.emissiveMap || null,
      emissiveIntensity: m.emissiveIntensity ?? 0, roughness: 0.95, metalness: 0, side: m.side, transparent: m.transparent, name: m.name,
    }));
  }
  return pbrCache.get(m);
}

function exportable(obj) {
  const c = obj.clone(true);
  c.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(toPBR) : toPBR(o.material);
    if (o.material?.flatShading) {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.deleteAttribute('normal');
      g.computeVertexNormals();
      o.geometry = g;
    }
  });
  return c;
}

export function toGLB(objects) {
  const exporter = new GLTFExporter();
  const list = objects.filter(Boolean).map(exportable);
  return new Promise((resolve, reject) => {
    exporter.parse(list, (buf) => resolve(new Blob([buf], { type: 'model/gltf-binary' })), reject, {
      binary: true, onlyVisible: true, maxTextureSize: 1024,
    });
  });
}

const r3 = (v) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
