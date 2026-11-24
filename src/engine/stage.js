// Shared stage: renderer, paper-friendly tone mapping, tilt-shift, crisp tag overlay, recording.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';

export const FORMATS = {
  '16:9': { w: 1920, h: 1080 },
  '1:1': { w: 1080, h: 1080 },
  '4:5': { w: 1080, h: 1350 },
  '9:16': { w: 1080, h: 1920 },
};

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function createStage(container, { tilt = 2.4, fov = 30 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;object-fit:contain;touch-action:none;';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#F4ECDF');
  scene.fog = new THREE.Fog('#F4ECDF', 80, 200);
  const overlay = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 800);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = 1.32;
  controls.minDistance = 3;

  const hemi = new THREE.HemisphereLight('#FFF7EA', '#9CCBD5', 1.7);
  const sun = new THREE.DirectionalLight('#FFF0DA', 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun, sun.target);

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const hPass = new ShaderPass(HorizontalTiltShiftShader);
  const vPass = new ShaderPass(VerticalTiltShiftShader);
  hPass.uniforms.r.value = vPass.uniforms.r.value = 0.45;
  composer.addPass(hPass);
  composer.addPass(vPass);
  const tagPass = new RenderPass(overlay, camera);
  tagPass.clear = false;
  composer.addPass(tagPass);
  composer.addPass(new OutputPass());

  let tiltAmount = tilt;
  let fixedSize = null;
  let inset = 0;
  const resizeFns = new Set();
  function resize() {
    const w = fixedSize?.w ?? Math.max(1, container.clientWidth);
    const h = fixedSize?.h ?? Math.max(1, container.clientHeight);
    const pr = fixedSize ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    const ins = fixedSize ? 0 : Math.min(inset, w * 0.5);
    camera.aspect = (w + ins) / h;
    if (ins > 0) camera.setViewOffset(w + ins, h, 0, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    hPass.uniforms.h.value = tiltAmount / (w * pr);
    vPass.uniforms.v.value = tiltAmount / (h * pr);
    hPass.enabled = vPass.enabled = tiltAmount > 0;
    for (const fn of resizeFns) fn();
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(container);

  const frameFns = new Set();
  const beforeRenderFns = new Set();
  const clock = new THREE.Clock();
  let raf = 0;
  let paused = false;
  let manual = false;
  function loop() {
    raf = requestAnimationFrame(loop);
    if (paused || manual) return;
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    for (const fn of frameFns) fn(t, dt);
    if (controls.enabled) controls.update();
    for (const fn of beforeRenderFns) fn(t);
    composer.render();
  }

  async function record(film, format = '16:9', name = 'builderland') {
    const size = FORMATS[format] || FORMATS['16:9'];
    fixedSize = size;
    resize();
    const stream = renderer.domElement.captureStream(60);
    const mime = ['video/mp4;codecs=avc1.640028', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((m) => window.MediaRecorder?.isTypeSupported(m));
    if (!mime) {
      fixedSize = null;
      resize();
      throw new Error('This browser cannot record canvas video');
    }
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 18_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise((r) => (rec.onstop = r));
    rec.start();
    try {
      await film();
    } finally {
      rec.stop();
      await stopped;
      fixedSize = null;
      resize();
    }
    const blob = new Blob(chunks, { type: mime.split(';')[0] });
    download(blob, `${name}-${format.replace(':', 'x')}.${mime.includes('mp4') ? 'mp4' : 'webm'}`);
    return blob;
  }

  /**
   * Frame-perfect offline export: renders every frame itself at a fixed size and time step and
   * encodes it with WebCodecs into an .mp4, so the video never drops a frame however slow the
   * machine is. `step(t, dt)` moves the camera for time t before the scene updates and renders.
   */
  async function renderVideo({ duration, fps = 30, format = '16:9', name = 'builderland', step, onProgress } = {}) {
    if (!('VideoEncoder' in window) || !('VideoFrame' in window)) throw new Error('Frame-by-frame export needs WebCodecs (Chrome, Edge or Safari 17+). Use Record instead.');
    const { Muxer, ArrayBufferTarget } = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/+esm');
    const size = typeof format === 'object' ? format : FORMATS[format] || FORMATS['16:9'];
    const tag = typeof format === 'object' ? `${format.w}x${format.h}` : format.replace(':', 'x');
    let config = null;
    for (const codec of ['avc1.640033', 'avc1.4d0033', 'avc1.42003e', 'avc1.42001f']) {
      const c = { codec, width: size.w, height: size.h, bitrate: 16_000_000, framerate: fps };
      if ((await VideoEncoder.isConfigSupported(c)).supported) { config = c; break; }
    }
    if (!config) throw new Error(`This browser cannot encode ${size.w}×${size.h} H.264 video`);
    const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: size.w, height: size.h, frameRate: fps }, fastStart: 'in-memory' });
    let failure = null;
    const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (failure = e) });
    enc.configure(config);
    fixedSize = size;
    resize();
    paused = true;
    const total = Math.round(duration * fps), dt = 1 / fps;
    try {
      for (let n = 0; n < total; n++) {
        if (failure) throw failure;
        const t = n * dt;
        step?.(t, dt);
        for (const fn of frameFns) fn(t, dt);
        for (const fn of beforeRenderFns) fn(t);
        composer.render();
        const frame = new VideoFrame(renderer.domElement, { timestamp: Math.round(t * 1e6), duration: Math.round(dt * 1e6) });
        enc.encode(frame, { keyFrame: n % (fps * 2) === 0 });
        frame.close();
        while (enc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4));
        if (n % 10 === 0) { onProgress?.(n / total); await new Promise((r) => setTimeout(r, 0)); }
      }
      await enc.flush();
      muxer.finalize();
    } finally {
      enc.close?.();
      paused = false;
      clock.getDelta();
      fixedSize = null;
      resize();
    }
    onProgress?.(1);
    const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
    download(blob, `${name}-${tag}.mp4`);
    return blob;
  }

  /** Renders one frame at w×h and returns a copy of it as a canvas (for share cards). */
  function snapshot(w, h) {
    fixedSize = { w, h };
    resize();
    for (const fn of beforeRenderFns) fn(clock.elapsedTime);
    composer.render();
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(renderer.domElement, 0, 0, w, h);
    fixedSize = null;
    resize();
    return c;
  }

  function savePNG(name = 'builderland') {
    for (const fn of beforeRenderFns) fn(clock.elapsedTime);
    composer.render();
    renderer.domElement.toBlob((b) => b && download(b, `${name}.png`), 'image/png');
  }

  resize();
  loop();

  return {
    renderer, scene, overlay, camera, controls, hemi, sun, composer, passes: { hPass, vPass, tagPass },
    /** Runs after the camera settles, right before the frame renders (for prepasses). */
    beforeRender: (fn) => (beforeRenderFns.add(fn), () => beforeRenderFns.delete(fn)),
    get size() { return { w: renderer.domElement.width, h: renderer.domElement.height }; },
    onFrame: (fn) => (frameFns.add(fn), () => frameFns.delete(fn)),
    onResize: (fn) => (resizeFns.add(fn), () => resizeFns.delete(fn)),
    setTilt(a) { tiltAmount = a; resize(); },
    setInset(px) { inset = px; resize(); },
    resize, record, savePNG, renderVideo, snapshot,
    /** Manual mode stops the live loop; renderAt(t, dt) then draws exactly one frame (for scripted recordings). */
    setManual(on) { manual = on; if (!on) clock.getDelta(); },
    renderAt(t, dt) {
      for (const fn of frameFns) fn(t, dt);
      for (const fn of beforeRenderFns) fn(t);
      composer.render();
    },
    get time() { return clock.elapsedTime; },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
