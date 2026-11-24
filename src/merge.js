// Static merging (keeps the overview under ~1,500 draw calls).
// Merges every static mesh that shares a material into one mesh. Anything that moves is tagged
// `userData.live` (see bkit.live) and keeps its own merged children, so animation still works.
// Skipped: multi-material meshes (signs), textured, transparent or off-layer meshes, instanced
// meshes, and mirrored transforms (their winding would flip).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ownerOf = (o, root) => {
  for (let a = o.parent; a; a = a.parent) if (a === root || a.userData.live) return a;
  return null;
};
const mergeable = (o) => o.isMesh && !o.isInstancedMesh && !o.children.length && !o.userData.live && !o.userData.noMerge && !Array.isArray(o.material)
  && !o.material.map && !o.material.transparent && o.layers.mask === 1 && (o.material.isMeshToonMaterial || o.material.isMeshStandardMaterial);

/** Merges `root`'s static meshes in place. Returns how many meshes it removed. */
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  let removed = 0;
  const lives = [];
  const buckets = new Map();
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const m = new THREE.Matrix4();
  root.traverse((o) => {
    if (o === root) return;
    const owner = ownerOf(o, root);
    if (owner !== root) return;
    if (o.userData.live) { lives.push(o); return; }
    if (!mergeable(o)) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    if (m.determinant() <= 0) return;
    const key = o.material;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ o, m: m.clone() });
  });
  for (const [mat, list] of buckets) {
    if (list.length < 2) continue;
    const geos = list.map(({ o, m: mm }) => {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      if (!g.attributes.normal) g.computeVertexNormals();
      g.morphAttributes = {};
      return g.applyMatrix4(mm);
    });
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = list.some(({ o }) => o.castShadow);
    mesh.receiveShadow = true;
    mesh.name = 'merged';
    root.add(mesh);
    for (const { o } of list) {
      o.parent.remove(o);
      if (!o.userData.sharedGeo) o.geometry.dispose();
      removed++;
    }
  }
  // moving parts merge their own static children
  for (const l of lives) removed += mergeStatic(l);
  return removed;
}

let vcMat = null;
/**
 * One mesh from several coloured parts: [[geometry, colour, x, y, z]]. The colours are baked into
 * vertex colours, so a small multi-colour object (a gondola, a sign post) costs one draw call.
 */
export function bakedMesh(parts, toonMap) {
  const geos = parts.map(([geo, color, x = 0, y = 0, z = 0]) => {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).translate(x, y, z);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  });
  if (!vcMat) vcMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonMap });
  const mesh = new THREE.Mesh(mergeGeometries(geos), vcMat);
  geos.forEach((g) => g.dispose());
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/**
 * Splits every box with a per-face material array (signs, logo badges, window walls) into a plain
 * body in its most common material plus a thin panel for each face that differs. three.js draws
 * each material group as its own call, so a sign goes from up to 6 calls to 2, and its body merges.
 */
export function splitMultiMaterial(root) {
  const targets = [];
  root.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && Array.isArray(o.material) && o.material.length === 6 && o.geometry.groups.length === 6) targets.push(o); });
  const FACES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (const o of targets) {
    const mats = o.material;
    const count = new Map();
    for (const m of mats) count.set(m, (count.get(m) || 0) + 1);
    const body = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox, size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const g = new THREE.Group();
    g.name = o.name;
    g.position.copy(o.position); g.quaternion.copy(o.quaternion); g.scale.copy(o.scale);
    Object.assign(g.userData, o.userData);
    const geo = o.geometry.clone();
    geo.clearGroups();
    const b = new THREE.Mesh(geo, body);
    b.castShadow = o.castShadow; b.receiveShadow = o.receiveShadow;
    g.add(b);
    mats.forEach((m, i) => {
      if (m === body) return;
      const [nx, ny, nz] = FACES[i];
      const w = nx ? size.z : size.x, h = ny ? size.z : size.y;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.97, h * 0.97), m);
      p.position.set(c.x + nx * (size.x / 2 + 0.003), c.y + ny * (size.y / 2 + 0.003), c.z + nz * (size.z / 2 + 0.003));
      p.lookAt(p.position.clone().add(new THREE.Vector3(nx, ny, nz)));
      p.receiveShadow = true;
      g.add(p);
    });
    const parent = o.parent;
    parent.add(g);
    parent.remove(o);
    if (!o.userData.sharedGeo) o.geometry.dispose();
  }
}
