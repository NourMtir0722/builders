// Ink style: hand-drawn look for any stage.
// - outlines from a depth + normal prepass (silhouettes and creases)
// - lines "boil" at 8 fps, like hand-drawn animation
// - pencil hatching in the shadows, paper grain everywhere
// - flat toon fills for every paper material
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const InkShader = {
  uniforms: {
    tDiffuse: { value: null },
    tNormal: { value: null },
    tDepth: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 100 },
    time: { value: 0 },
    inkColor: { value: new THREE.Color('#3A3040') },
    lineWidth: { value: 1 },
    boil: { value: 1.6 },
    hatch: { value: 0.22 },
    grain: { value: 0.07 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tDiffuse; uniform sampler2D tNormal; uniform sampler2D tDepth;
    uniform vec2 resolution; uniform float cameraNear; uniform float cameraFar; uniform float time;
    uniform vec3 inkColor; uniform float lineWidth; uniform float boil; uniform float hatch; uniform float grain;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    float viewZ(vec2 uv) { return perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
    vec3 nrm(vec2 uv) { return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }

    void main() {
      float tq = floor(time * 8.0);                       // boil on 8s, like hand animation
      vec2 cell = vUv * resolution / 34.0 + tq * 17.31;
      vec2 j = (vec2(vnoise(cell), vnoise(cell + 41.7)) - 0.5) * boil / resolution;
      vec2 uv = vUv + j;
      vec2 px = lineWidth / resolution;

      float z0 = viewZ(uv);
      float zs = viewZ(uv - vec2(px.x, 0.0)) + viewZ(uv + vec2(px.x, 0.0)) + viewZ(uv + vec2(0.0, px.y)) + viewZ(uv - vec2(0.0, px.y));
      float dz = abs(zs - 4.0 * z0) / max(abs(z0), 1.0);
      float depthEdge = smoothstep(0.0025, 0.009, dz);

      vec3 n0 = nrm(uv);
      float ne = 0.0;
      ne = max(ne, 1.0 - dot(n0, nrm(uv - vec2(px.x, 0.0))));
      ne = max(ne, 1.0 - dot(n0, nrm(uv + vec2(px.x, 0.0))));
      ne = max(ne, 1.0 - dot(n0, nrm(uv + vec2(0.0, px.y))));
      ne = max(ne, 1.0 - dot(n0, nrm(uv - vec2(0.0, px.y))));
      float normalEdge = smoothstep(0.18, 0.42, ne);

      // pencil pressure varies along the line
      float pressure = 0.65 + 0.35 * vnoise(gl_FragCoord.xy / 9.0 + tq * 5.0);
      float edge = clamp(max(depthEdge, normalEdge) * pressure, 0.0, 1.0);

      vec3 col = texture2D(tDiffuse, vUv).rgb;
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec2 fc = gl_FragCoord.xy;
      float wob = vnoise(fc / 26.0 + tq * 3.1) * 2.5;
      float d1 = abs(mod(fc.x + fc.y + wob, 6.0) - 3.0);
      float d2 = abs(mod(fc.x - fc.y + wob, 7.0) - 3.5);
      float l1 = 1.0 - smoothstep(0.35, 1.1, d1);
      float l2 = 1.0 - smoothstep(0.35, 1.1, d2);
      float h = l1 * (1.0 - smoothstep(0.06, 0.16, lum)) + l2 * (1.0 - smoothstep(0.02, 0.07, lum)) * 0.8;
      col *= 1.0 - hatch * clamp(h, 0.0, 1.0);

      float g = hash(floor(fc)) - 0.5;
      float fibre = vnoise(fc / 3.0) - 0.5;
      col *= 1.0 + grain * (g * 0.7 + fibre * 0.6);

      col = mix(col, inkColor, edge * 0.92);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

/**
 * Adds the ink pass to a stage. Returns { enabled, pass }.
 * Objects on layer 1 (glows, beams) are skipped by the outline prepass.
 */
export function addInk(stage) {
  const { renderer, scene, camera, composer } = stage;
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  target.depthTexture = new THREE.DepthTexture(1, 1);
  const normalMat = new THREE.MeshNormalMaterial();
  const pass = new ShaderPass(InkShader);
  pass.uniforms.tNormal.value = target.texture;
  pass.uniforms.tDepth.value = target.depthTexture;
  composer.insertPass(pass, 1);
  const state = { enabled: false, pass };
  camera.layers.enable(1);

  const sync = () => {
    const { w, h } = stage.size;
    target.setSize(w, h);
    pass.uniforms.resolution.value.set(w, h);
    pass.uniforms.lineWidth.value = Math.max(1, Math.round(h / 900));
  };
  stage.onResize(sync);
  sync();

  const clear = new THREE.Color(0.5, 0.5, 1);
  stage.beforeRender((t) => {
    pass.enabled = state.enabled;
    if (!state.enabled) return;
    const bg = scene.background, fog = scene.fog, prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
    scene.background = null;
    scene.fog = null;
    scene.overrideMaterial = normalMat;
    camera.layers.disable(1);
    renderer.setRenderTarget(target);
    renderer.setClearColor(clear, 1);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.setClearColor(prevClear, prevAlpha);
    camera.layers.enable(1);
    scene.overrideMaterial = null;
    scene.background = bg;
    scene.fog = fog;
    pass.uniforms.cameraNear.value = camera.near;
    pass.uniforms.cameraFar.value = camera.far;
    pass.uniforms.time.value = t;
  });
  return state;
}

// ── flat toon fills ──
let ramp = null;
function gradientMap() {
  if (!ramp) {
    ramp = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 200, 200, 200, 255, 255, 255, 255, 255]), 3, 1);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
  }
  return ramp;
}
const toonCache = new Map();
export function toon(color) {
  const key = typeof color === 'string' ? color : `#${color.getHexString()}`;
  if (!toonCache.has(key)) toonCache.set(key, new THREE.MeshToonMaterial({ color: key, gradientMap: gradientMap() }));
  return toonCache.get(key);
}

/** Swap plain paper materials for flat toon fills (keeps glows, logos and custom shaders). */
export function toonify(root, skip = new Set()) {
  root.traverse((o) => {
    if (!o.isMesh || skip.has(o.material)) return;
    const m = o.material;
    if (!m?.isMeshStandardMaterial || m.userData.own || m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return;
    if (m.emissive && m.emissive.getHex() !== 0) return;
    o.material = toon(m.color);
  });
}

/** Pale water with white hand-drawn ripples, tileable. */
export function scribbleWater(base = '#A8DBEA') {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineCap = 'round';
  for (let k = 0; k < 46; k++) {
    const x = Math.random() * S, y = Math.random() * S, w = 18 + Math.random() * 34;
    g.lineWidth = 2 + Math.random() * 1.5;
    for (const dx of [0, -S, S]) for (const dy of [0, -S, S]) {
      g.beginPath();
      g.moveTo(x + dx, y + dy);
      g.bezierCurveTo(x + dx + w * 0.25, y + dy - 6, x + dx + w * 0.5, y + dy + 6, x + dx + w * 0.75, y + dy - 2);
      g.lineTo(x + dx + w, y + dy + 1);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}
