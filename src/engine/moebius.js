// Moebius-style post-processing, after Maxime Heckel's breakdown:
// https://blog.maximeheckel.com/posts/moebius-style-post-processing/
//
// 1. A custom normal buffer: RGB = view-space normals (pure white on Blinn-Phong highlights), A = diffuse light.
// 2. Sobel edge detection on depth (×25) + normals → ink outlines, including inner edges and highlight rims.
// 3. Hand-drawn wobble: every sample is displaced by hash × sin/cos(frag × frequency).
// 4. Crosshatching by tone: horizontal ≤ 0.35, vertical ≤ 0.55, diagonal ≤ 0.80 (8 px apart, 1 px lines).
// Lines boil at 8 fps so recordings feel hand-animated.
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const NormalShader = {
  uniforms: { lightDir: { value: new THREE.Vector3(0, 1, 0) }, shininess: { value: 600 }, diffuseness: { value: 0.5 } },
  vertexShader: /* glsl */ `
    #include <common>
    varying vec3 vNormalV;
    varying vec3 vViewPos;
    void main() {
      #include <beginnormal_vertex>
      #include <defaultnormal_vertex>
      #include <begin_vertex>
      #include <project_vertex>
      vNormalV = normalize(transformedNormal);
      vViewPos = -mvPosition.xyz;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 lightDir; uniform float shininess; uniform float diffuseness;
    varying vec3 vNormalV;
    varying vec3 vViewPos;
    void main() {
      vec3 n = normalize(vNormalV);
      if (!gl_FrontFacing) n = -n;
      float diffuse = max(0.0, dot(n, lightDir)) * diffuseness;
      vec3 h = normalize(normalize(vViewPos) + lightDir);
      float spec = pow(max(dot(n, h), 0.0), shininess);
      vec3 col = n * 0.5 + 0.5;
      if (spec >= 0.25) col = vec3(1.0);
      gl_FragColor = vec4(col, diffuse);
    }`,
};

const MoebiusShader = {
  uniforms: {
    tDiffuse: { value: null },
    tNormal: { value: null },
    tDepth: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 100 },
    time: { value: 0 },
    px: { value: 1 },
    thickness: { value: 1.3 },
    depthWeight: { value: 25 },
    normalWeight: { value: 1 },
    amplitude: { value: 1.3 },
    frequency: { value: 0.08 },
    hatchSpacing: { value: 8 },
    hatchStrength: { value: 0.85 },
    hatchLevels: { value: new THREE.Vector3(0.3, 0.45, 0.62) },
    inkColor: { value: new THREE.Color('#25202B') },
    grain: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tDiffuse; uniform sampler2D tNormal; uniform sampler2D tDepth;
    uniform vec2 resolution; uniform float cameraNear; uniform float cameraFar; uniform float time; uniform float px;
    uniform float thickness; uniform float depthWeight; uniform float normalWeight; uniform float amplitude; uniform float frequency;
    uniform float hatchSpacing; uniform float hatchStrength; uniform vec3 hatchLevels; uniform vec3 inkColor; uniform float grain;
    varying vec2 vUv;

    float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float luma(vec3 c) { return dot(c, vec3(0.2125, 0.7154, 0.0721)); }
    float readDepth(vec2 uv) {
      float viewZ = perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar);
      return viewZToOrthographicDepth(viewZ, cameraNear, cameraFar);
    }
    float nLuma(vec2 uv) { return luma(texture2D(tNormal, uv).rgb); }
    float sobel(float tl, float t, float tr, float l, float r, float bl, float b, float br) {
      float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
      float gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;
      return sqrt(gx * gx + gy * gy);
    }

    void main() {
      vec2 texel = 1.0 / resolution;
      vec2 fc = gl_FragCoord.xy;
      float tq = floor(time * 8.0);                                   // boil on 8s
      vec2 disp = vec2(hash(fc + tq) * sin(fc.y * frequency / px + tq), hash(fc + tq + 7.3) * cos(fc.x * frequency / px + tq)) * amplitude * px * texel;
      vec2 o = thickness * px * texel;
      vec2 uv = vUv + disp;

      #define D(x, y) readDepth(uv + vec2(x, y) * o)
      #define N(x, y) nLuma(uv + vec2(x, y) * o)
      float gD = sobel(D(-1., 1.), D(0., 1.), D(1., 1.), D(-1., 0.), D(1., 0.), D(-1., -1.), D(0., -1.), D(1., -1.));
      float gN = sobel(N(-1., 1.), N(0., 1.), N(1., 1.), N(-1., 0.), N(1., 0.), N(-1., -1.), N(0., -1.), N(1., -1.));
      float outline = clamp(gD * depthWeight + gN * normalWeight, 0.0, 1.0);

      vec4 col = texture2D(tDiffuse, vUv);
      float diffuse = texture2D(tNormal, vUv).a;
      float depth = readDepth(vUv);
      // perceptual luminance (the scene buffer is linear)
      float l = pow(clamp(luma(col.rgb + diffuse * 0.65), 0.0, 1.0), 1.0 / 2.2);

      float hatch = 0.0;
      if (depth <= 0.99) {
        vec2 hc = fc + disp * resolution * 0.5;
        float s = hatchSpacing * px, w = px;
        if (l <= hatchLevels.x && mod(hc.y, s) <= w) hatch = 1.0;
        if (l <= hatchLevels.y && mod(hc.x, s) <= w) hatch = 1.0;
        if (l <= hatchLevels.z && mod(hc.x + hc.y, s * 1.4142) <= w) hatch = 1.0;
      }
      vec3 c = mix(col.rgb, inkColor, hatch * hatchStrength * 0.55);
      // coloured-pencil paper tooth: fine grain + short diagonal fibres
      float g = hash(floor(fc / px)) - 0.5;
      float fibre = hash(floor(vec2(fc.x + fc.y, fc.x - fc.y) / (3.0 * px))) - 0.5;
      c *= 1.0 + grain * (g * 0.8 + fibre * 0.6);
      c = mix(c, inkColor, outline);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

/**
 * Adds the Moebius pass to a stage. `light` is the DirectionalLight whose direction drives
 * the highlights and the diffuse term. Objects on layer 1 are skipped by the prepass.
 */
export function addMoebius(stage, { light } = {}) {
  const { renderer, scene, camera, composer } = stage;
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  target.depthTexture = new THREE.DepthTexture(1, 1);
  const normalMat = new THREE.ShaderMaterial({ ...NormalShader, uniforms: THREE.UniformsUtils.clone(NormalShader.uniforms), side: THREE.DoubleSide });
  const pass = new ShaderPass(MoebiusShader);
  pass.uniforms.tNormal.value = target.texture;
  pass.uniforms.tDepth.value = target.depthTexture;
  composer.insertPass(pass, 1);
  const state = { enabled: false, pass, uniforms: pass.uniforms };
  camera.layers.enable(1);

  const sync = () => {
    const { w, h } = stage.size;
    target.setSize(w, h);
    pass.uniforms.resolution.value.set(w, h);
    pass.uniforms.px.value = renderer.getPixelRatio() * Math.max(1, h / renderer.getPixelRatio() / 900);
  };
  stage.onResize(sync);
  sync();

  const dir = new THREE.Vector3();
  const clear = new THREE.Color(0.5, 0.5, 1);
  stage.beforeRender((t) => {
    pass.enabled = state.enabled;
    if (!state.enabled) return;
    if (light) {
      dir.copy(light.position).sub(light.target.position).normalize().transformDirection(camera.matrixWorldInverse);
      normalMat.uniforms.lightDir.value.copy(dir);
    }
    const bg = scene.background, fog = scene.fog, prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
    scene.background = null;
    scene.fog = null;
    scene.overrideMaterial = normalMat;
    camera.layers.disable(1);
    renderer.setRenderTarget(target);
    renderer.setClearColor(clear, 0);
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
