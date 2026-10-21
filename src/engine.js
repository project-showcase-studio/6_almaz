// Renderer, camera, HDRI lighting with a matching shadow-casting sun, post-processing (AO, bloom of lamps, SMAA).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { N8AOPass } from 'n8ao';
import { BASE } from './materials.js';

const _hall = new THREE.Vector3(0, 1.2, -2.7);

export class Engine {
  constructor(container) {
    this.container = container;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false }));
    // supersampling: eased MDF edges and seals are thinner than a pixel; on standard-density screens the scene
    // is rendered at twice the resolution and filtered down, so their highlights stay continuous lines
    const dpr = window.devicePixelRatio || 1;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    r.setPixelRatio(coarse ? Math.min(dpr, 2) : Math.min(2, Math.max(dpr, 2)));
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#cfd8de');
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.03, 900);
    this.camera.position.set(1.6, 1.4, 3.6);

    const c = (this.controls = new OrbitControls(this.camera, r.domElement));
    c.target.set(0, 1.05, 0);
    c.enableDamping = true;
    c.dampingFactor = 0.07;
    c.minDistance = 0.35;
    c.maxDistance = 9;
    c.maxPolarAngle = Math.PI * 0.62;
    c.zoomSpeed = 0.8;
    c.rotateSpeed = 0.7;
    c.addEventListener('change', () => this.invalidate());

    // sun
    const sun = (this.sun = new THREE.DirectionalLight('#fff4e5', 3));
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -6.5;
    sc.right = sc.top = 6.5;
    sc.near = 1;
    sc.far = 120;
    sun.shadow.bias = -0.0001;
    sun.shadow.normalBias = 0.012;
    sun.shadow.radius = 2.5;
    this.scene.add(sun, sun.target);
    this.hemi = new THREE.HemisphereLight('#dfe8f0', '#59604a', 0.0);
    this.scene.add(this.hemi);

    // post
    const comp = (this.composer = new EffectComposer(r));
    const ao = (this.ao = new N8AOPass(this.scene, this.camera, 1, 1));
    ao.configuration.aoRadius = 0.35;
    ao.configuration.distanceFalloff = 0.6;
    ao.configuration.intensity = 2.2;
    ao.configuration.gammaCorrection = false;
    ao.configuration.transparencyAware = true;
    ao.setQualityMode('Medium');
    comp.addPass(ao);
    // bloom only picks up HDR emitters (lamps in the evening); off during the day
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.3, 2.4);
    this.bloom.enabled = false;
    comp.addPass(this.bloom);
    comp.addPass(new OutputPass());
    this.smaa = new SMAAPass(1, 1);
    comp.addPass(this.smaa);

    this.frames = 2;
    this.clock = new THREE.Clock();
    this.onFrame = [];
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    r.setAnimationLoop(() => this.tick());
  }

  invalidate(n = 2) {
    this.frames = Math.max(this.frames, n);
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    const pr = this.renderer.getPixelRatio();
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.ao.configuration.halfRes = pr > 1.25;
    this.invalidate();
  }

  tick() {
    const dt = this.clock.getDelta();
    const moving = this.controls.update();
    if (this.clamp) this.clamp(this.camera, this.controls);
    if (this.camera.position.y < 0.12) this.camera.position.y = 0.12;
    let anim = false;
    for (const f of this.onFrame) anim = f(dt) || anim;
    if (moving || anim) this.invalidate(1);
    if (this.frames <= 0) return;
    this.frames--;
    this.fitShadow();
    this.composer.render(dt);
  }

  /**
   * Keeps the sun's shadow map on what is being looked at: close to the door it covers ~1.5 m, so the
   * 2–3 mm gaps between leaf, frame and seals cast clean shadow lines instead of stair-stepped dashes.
   */
  fitShadow() {
    if (!this.sunDir) return;
    let t = this.controls.target, d = this.camera.position.distanceTo(t);
    let ext = THREE.MathUtils.clamp(d * 0.75 + 0.4, 1.2, 6.5);
    if (this.camera.position.z < -0.45) {
      // inside: the whole hallway must stay in shadow (mirrors show what is behind the camera)
      t = _hall;
      ext = 3.6;
    }
    const sc = this.sun.shadow.camera;
    if (Math.abs(sc.right - ext) > 1e-3 || !this.sun.target.position.equals(t)) {
      sc.left = sc.bottom = -ext;
      sc.right = sc.top = ext;
      sc.updateProjectionMatrix();
      this.sun.target.position.copy(t);
      this.sun.position.copy(this.sunDir).multiplyScalar(40).add(t);
      this.sun.shadow.normalBias = 0.004 + ext * 0.0016;
    }
  }

  // ---------------------------------------------------------------- environment
  async setEnvironment(key, sunFrom = this.sunFrom || [0.6, 0.8]) {
    this.sunFrom = sunFrom;
    this.envCache = this.envCache || new Map();
    if (!this.envCache.has(key)) this.envCache.set(key, loadEnvironment(this.renderer, key));
    const E = await this.envCache.get(key);
    const s = this.scene;
    // Rotate the sky so the sun stands front-left of the default view.
    const want = Math.atan2(sunFrom[1], sunFrom[0]) + (key === 'evening' ? 0.35 : 0);
    const have = Math.atan2(E.sunDir.z, E.sunDir.x);
    const rot = have - want;
    s.environment = E.env;
    s.background = E.bg;
    s.environmentRotation.set(0, rot, 0);
    s.backgroundRotation.set(0, rot, 0);
    s.backgroundIntensity = key === 'evening' ? 0.9 : 1;
    s.environmentIntensity = key === 'evening' ? 0.6 : 0.72;
    const d = E.sunDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    if (key === 'evening') d.y = Math.max(d.y, 0.16);
    d.normalize();
    this.sunDir = d;
    this.sun.color.copy(E.sunColor);
    this.sun.intensity = key === 'evening' ? 2.3 : 4.3;
    this.sun.target.position.set(0, 1, -1.2);
    this.sun.position.copy(d).multiplyScalar(40).add(this.sun.target.position);
    this.renderer.toneMappingExposure = key === 'evening' ? 0.95 : 1.0;
    this.bloom.enabled = key === 'evening';
    s.fog = new THREE.Fog(E.fogColor, 90, 420);
    this.envKey = key;
    this.invalidate();
    return E;
  }

  /** Renders a high-resolution still through the same pipeline and returns a PNG data URL. */
  capture(width = 2560, height = 1440, ss = 1.5) {
    const out = width, outH = height;
    width = Math.round(width * ss);
    height = Math.round(height * ss);
    const r = this.renderer, comp = this.composer;
    const prevSize = r.getSize(new THREE.Vector2());
    const prevPr = r.getPixelRatio();
    const prevAspect = this.camera.aspect;
    r.setPixelRatio(1);
    r.setSize(width, height, false);
    comp.setPixelRatio(1);
    comp.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.ao.configuration.halfRes = false;
    comp.render(0);
    // supersampled frame filtered down to the requested size
    const c = document.createElement('canvas');
    c.width = out;
    c.height = outH;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(r.domElement, 0, 0, width, height, 0, 0, out, outH);
    const url = c.toDataURL('image/png');
    r.setPixelRatio(prevPr);
    comp.setPixelRatio(prevPr);
    r.setSize(prevSize.x, prevSize.y, false);
    comp.setSize(prevSize.x, prevSize.y);
    this.camera.aspect = prevAspect;
    this.camera.updateProjectionMatrix();
    this.resize();
    return url;
  }

  /** Smooth camera move to a position / target. */
  flyTo(pos, target, dur = 1.1) {
    const p0 = this.camera.position.clone(), t0 = this.controls.target.clone();
    const p1 = new THREE.Vector3(...pos), t1 = new THREE.Vector3(...target);
    let t = 0;
    const f = (dt) => {
      t = Math.min(1, t + dt / dur);
      const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.camera.position.lerpVectors(p0, p1, k);
      this.controls.target.lerpVectors(t0, t1, k);
      if (t >= 1) this.onFrame.splice(this.onFrame.indexOf(f), 1);
      return true;
    };
    this.onFrame.push(f);
  }
}

// ---------------------------------------------------------------- HDRI
async function loadEnvironment(renderer, key) {
  const loader = new RGBELoader().setDataType(THREE.FloatType);
  const [hdr, bg] = await Promise.all([
    loader.loadAsync(`${BASE}hdri/${key}.hdr`),
    new THREE.TextureLoader().loadAsync(`${BASE}hdri/${key}_bg.jpg`),
  ]);
  const { width: W, height: H, data } = hdr.image;
  // sun = luminance-weighted centroid of the brightest pixels
  let max = 0;
  for (let i = 0; i < W * H; i++) {
    const l = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
    if (l > max) max = l;
  }
  const thr = max * 0.5;
  const dir = new THREE.Vector3();
  const col = [0, 0, 0];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      if (l < thr) continue;
      const u = (x + 0.5) / W, v = 1 - (y + 0.5) / H;
      const phi = (u - 0.5) * 2 * Math.PI, th = (v - 0.5) * Math.PI;
      dir.x += Math.cos(th) * Math.cos(phi) * l;
      dir.y += Math.sin(th) * l;
      dir.z += Math.cos(th) * Math.sin(phi) * l;
      col[0] += data[i] * l;
      col[1] += data[i + 1] * l;
      col[2] += data[i + 2] * l;
    }
  dir.normalize();
  const m = Math.max(...col) || 1;
  const sunColor = new THREE.Color().setRGB(col[0] / m, col[1] / m, col[2] / m, THREE.LinearSRGBColorSpace);
  // clamp the sun out of the IBL: the directional light carries it (with shadows)
  const cap = 6.0;
  for (let i = 0; i < W * H; i++) {
    const l = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
    if (l > cap) {
      const s = cap / l;
      data[i * 4] *= s;
      data[i * 4 + 1] *= s;
      data[i * 4 + 2] *= s;
    }
  }
  // partly desaturate the lighting (not the visible sky): dark glossy finishes keep a neutral, studio-like
  // read instead of mirroring a saturated blue sky
  for (let i = 0; i < W * H; i++) {
    const l = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
    for (let k = 0; k < 3; k++) data[i * 4 + k] += (l - data[i * 4 + k]) * 0.6;
  }
  hdr.needsUpdate = true;
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromEquirectangular(hdr).texture;
  pm.dispose();
  hdr.dispose();
  bg.mapping = THREE.EquirectangularReflectionMapping;
  bg.colorSpace = THREE.SRGBColorSpace;
  bg.anisotropy = 8;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bg.image, 0, 0, 256, 128);
  const row = ctx.getImageData(0, 61, 256, 3).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < row.length; i += 4) {
    r += row[i];
    g += row[i + 1];
    b += row[i + 2];
  }
  const n = row.length / 4;
  const fogColor = new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
  return { env, bg, sunDir: dir, sunColor, fogColor };
}
