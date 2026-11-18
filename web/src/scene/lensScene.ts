import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export type LensSceneOptions = {
  canvas: HTMLCanvasElement;
  /** Element the lens docks into once the scan is finished. */
  getDock: () => HTMLElement | null;
  reducedMotion: boolean;
  /** Fired when the lens starts shrinking towards the dock. */
  onDocking: () => void;
  /** Fired when the lens has settled as the icon. */
  onDocked: () => void;
};

export type LensScene = {
  skip: () => void;
  dispose: () => void;
};

type Phase = 'appear' | 'scan' | 'dock' | 'idle';

// Pure black clear: non-zero clear colours get lifted by the output pass.
const BG = 0x000000;
const ICE = new THREE.Color('#a8e1ff');
const CAMERA_Z = 16;
const FOV = 30;

// Normalised screen coordinates (-1..1, y up) the lens visits.
const START: [number, number] = [-0.08, 0.06];
const SCAN_POINTS: [number, number][] = [
  [-0.56, 0.4],
  [0.54, 0.3],
  [0.38, -0.46],
  [-0.44, -0.3],
];

const APPEAR = 0.55;
const MOVE = 0.44;
const HOLD = 0.12;
const DOCK = 0.95;
const DOCK_SKIP = 0.6;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* ------------------------------------------------------------------ */
/* Soft additive points (particles + ambient dust)                     */
/* ------------------------------------------------------------------ */

function pointsMaterial(pixelRatio: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: ICE.clone().multiplyScalar(1.35) },
      uPixelRatio: { value: pixelRatio },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      attribute float aSize;
      attribute float aTwinkle;
      uniform float uPixelRatio;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio * (${CAMERA_Z.toFixed(1)} / -mv.z);
        float tw = aTwinkle > 0.0 ? 0.55 + 0.45 * sin(uTime * (0.6 + aTwinkle) + aTwinkle * 40.0) : 1.0;
        vAlpha = aAlpha * tw;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor, a * a * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

class Particles {
  readonly points: THREE.Points;
  private readonly max: number;
  private readonly pos: Float32Array;
  private readonly alpha: Float32Array;
  private readonly size: Float32Array;
  private readonly baseSize: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly age: Float32Array;
  private cursor = 0;

  constructor(max: number, material: THREE.ShaderMaterial) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.size = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aTwinkle', new THREE.BufferAttribute(new Float32Array(max), 1));
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.life[i] = life;
    this.age[i] = 0;
    this.baseSize[i] = size;
  }

  update(dt: number) {
    const drag = Math.exp(-dt * 1.6);
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.age[i] += dt;
      const k = this.age[i] / this.life[i];
      if (k >= 1) {
        this.life[i] = 0;
        this.alpha[i] = 0;
        continue;
      }
      const j = i * 3;
      this.vel[j] *= drag;
      this.vel[j + 1] = this.vel[j + 1] * drag - dt * 0.06;
      this.vel[j + 2] *= drag;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      this.alpha[i] = Math.min(1, k * 10) * Math.pow(1 - k, 1.6);
      this.size[i] = this.baseSize[i] * (1 - k * 0.4);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ */
/* Thin light trail that follows the lens focus                        */
/* ------------------------------------------------------------------ */

class Trail {
  readonly line: THREE.Line;
  private readonly max = 220;
  private readonly lifeTime = 1.05;
  private readonly pts: { x: number; y: number; t: number }[] = [];
  private readonly pos: Float32Array;
  private readonly col: Float32Array;

  constructor() {
    this.pos = new Float32Array(this.max * 3);
    this.col = new Float32Array(this.max * 4);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.line = new THREE.Line(geometry, material);
    this.line.frustumCulled = false;
  }

  push(x: number, y: number, t: number) {
    const last = this.pts[this.pts.length - 1];
    if (last && Math.hypot(last.x - x, last.y - y) < 0.012) return;
    this.pts.push({ x, y, t });
    if (this.pts.length > this.max) this.pts.shift();
  }

  update(t: number) {
    while (this.pts.length && t - this.pts[0].t > this.lifeTime) this.pts.shift();
    const n = this.pts.length;
    for (let i = 0; i < n; i++) {
      const p = this.pts[i];
      const k = 1 - (t - p.t) / this.lifeTime;
      const a = Math.pow(clamp(k, 0, 1), 1.8);
      this.pos[i * 3] = p.x;
      this.pos[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = -0.25;
      this.col[i * 4] = ICE.r * 1.6;
      this.col[i * 4 + 1] = ICE.g * 1.6;
      this.col[i * 4 + 2] = ICE.b * 1.6;
      this.col[i * 4 + 3] = a;
    }
    const g = this.line.geometry;
    g.setDrawRange(0, n);
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ */
/* Crystal magnifier                                                   */
/* ------------------------------------------------------------------ */

function buildLens() {
  const group = new THREE.Group();

  const glass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#c4e6ff'),
    emissive: new THREE.Color('#0c2a52'),
    emissiveIntensity: 0.55,
    metalness: 0,
    roughness: 0.06,
    transmission: 1,
    thickness: 0.9,
    ior: 1.6,
    specularIntensity: 1,
    specularColor: new THREE.Color('#ffffff'),
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    attenuationColor: new THREE.Color('#3f9bff'),
    attenuationDistance: 0.7,
    envMapIntensity: 1.8,
    flatShading: true,
  });

  const lensMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f2faff'),
    metalness: 0,
    roughness: 0.015,
    transmission: 1,
    thickness: 0.45,
    ior: 1.5,
    specularIntensity: 0.55,
    clearcoat: 0.25,
    clearcoatRoughness: 0.08,
    attenuationColor: new THREE.Color('#9ad6ff'),
    attenuationDistance: 3.5,
    envMapIntensity: 0.45,
  });

  // Fresnel edge light that makes the lens read as ice glass on black.
  const fresnelMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: ICE.clone().multiplyScalar(1.25) } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        gl_FragColor = vec4(uColor, f * 0.55 + 0.012);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const edgeMat = new THREE.LineBasicMaterial({
    color: ICE.clone().multiplyScalar(0.9),
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const glowMat = new THREE.MeshBasicMaterial({ color: ICE.clone().multiplyScalar(2.2), transparent: true, opacity: 0.9 });

  const withEdges = (geometry: THREE.BufferGeometry, material: THREE.Material, threshold = 20) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, threshold), edgeMat));
    return mesh;
  };

  // Faceted crystal rim (hexagonal tube section).
  group.add(withEdges(new THREE.TorusGeometry(1, 0.08, 6, 72), glass, 25));

  // Thin inner light ring.
  group.add(new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.0065, 4, 160), glowMat));

  // Convex glass lens.
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.92, 64, 32), lensMat);
  lens.scale.set(1, 1, 0.1);
  group.add(lens);
  const sheen = new THREE.Mesh(lens.geometry, fresnelMat);
  sheen.scale.set(1.002, 1.002, 0.104);
  group.add(sheen);

  // Handle: hexagonal crystal rod pointing bottom-right.
  const handle = new THREE.Group();
  handle.rotation.z = -Math.PI * 0.75;
  const collar = withEdges(new THREE.CylinderGeometry(0.125, 0.145, 0.28, 6), glass);
  collar.position.y = 1.2;
  const rod = withEdges(new THREE.CylinderGeometry(0.115, 0.09, 1.25, 6), glass);
  rod.position.y = 1.34 + 0.625;
  const tip = withEdges(new THREE.ConeGeometry(0.09, 0.24, 6), glass);
  tip.position.y = 1.34 + 1.25 + 0.12;
  const filament = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1.18, 6), glowMat);
  filament.position.y = rod.position.y;
  handle.add(collar, rod, tip, filament);
  group.add(handle);

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  return { group, glowMat, center, extent: Math.max(size.x, size.y) };
}

/* ------------------------------------------------------------------ */

export function createLensScene(opts: LensSceneOptions): LensScene | null {
  const { canvas } = opts;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(BG, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAMERA_Z);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  const envMap = pmrem.fromScene(envScene, 0.04).texture;
  scene.environment = envMap;
  envScene.dispose?.();

  const keyLight = new THREE.PointLight(new THREE.Color('#5aa8ff'), 40, 0, 2);
  keyLight.position.set(-4, 3, 5);
  const rimLight = new THREE.PointLight(new THREE.Color('#d8f1ff'), 22, 0, 2);
  rimLight.position.set(4, -2, 4);
  scene.add(keyLight, rimLight);

  // Ambient dust.
  const dustMat = pointsMaterial(pixelRatio);
  const dustCount = 240;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  const dustAlpha = new Float32Array(dustCount);
  const dustSize = new Float32Array(dustCount);
  const dustTw = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 30;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 16;
    dustPos[i * 3 + 2] = -Math.random() * 10 - 0.5;
    dustAlpha[i] = 0.08 + Math.random() * 0.26;
    dustSize[i] = 1 + Math.random() * 1.6;
    dustTw[i] = 0.2 + Math.random() * 1.4;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aAlpha', new THREE.BufferAttribute(dustAlpha, 1));
  dustGeo.setAttribute('aSize', new THREE.BufferAttribute(dustSize, 1));
  dustGeo.setAttribute('aTwinkle', new THREE.BufferAttribute(dustTw, 1));
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  const sparkMat = pointsMaterial(pixelRatio);
  const sparks = new Particles(900, sparkMat);
  scene.add(sparks.points);

  const trail = new Trail();
  scene.add(trail.line);

  // Expanding scan rings.
  const circle: THREE.Vector3[] = [];
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2;
    circle.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
  }
  const ringGeo = new THREE.BufferGeometry().setFromPoints(circle);
  const rings = Array.from({ length: 6 }, () => {
    const material = new THREE.LineBasicMaterial({
      color: ICE.clone().multiplyScalar(1.6),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const loop = new THREE.LineLoop(ringGeo, material);
    loop.visible = false;
    scene.add(loop);
    return { loop, material, start: -1, from: 1, to: 2, delay: 0 };
  });
  let ringCursor = 0;

  const lens = buildLens();
  scene.add(lens.group);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.12, 0.72);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---- Layout ------------------------------------------------------
  let width = 1;
  let height = 1;
  let pxPerUnit = 1;
  let scanScale = 1;

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    renderer.setSize(width, height, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    pxPerUnit = height / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * CAMERA_Z);
    const radiusPx = clamp(Math.min(width, height) * 0.13, 72, 122);
    scanScale = radiusPx / pxPerUnit;
  };
  resize();
  window.addEventListener('resize', resize);

  const toWorld = (nx: number, ny: number) =>
    new THREE.Vector3((nx * width) / 2 / pxPerUnit, (ny * height) / 2 / pxPerUnit, 0);

  // Scan points stay fully inside the viewport, even on narrow screens.
  const scanPoint = (nx: number, ny: number) => {
    const p = toWorld(nx, ny);
    const limX = Math.max(0, width / 2 / pxPerUnit - scanScale * 1.25);
    const limY = Math.max(0, height / 2 / pxPerUnit - scanScale * 1.25);
    p.x = clamp(p.x, -limX, limX);
    p.y = clamp(p.y, -limY, limY);
    return p;
  };

  const dockTarget = () => {
    const el = opts.getDock();
    if (!el) return { pos: new THREE.Vector3(0, (height / 2 - 80) / pxPerUnit, 0), scale: scanScale * 0.25 };
    const r = el.getBoundingClientRect();
    const scale = Math.min(r.width, r.height) / (lens.extent * pxPerUnit);
    const cx = (r.left + r.width / 2 - width / 2) / pxPerUnit;
    const cy = -(r.top + r.height / 2 - height / 2) / pxPerUnit;
    return { pos: new THREE.Vector3(cx - lens.center.x * scale, cy - lens.center.y * scale, 0), scale };
  };

  // ---- Timeline ------------------------------------------------------
  let phase: Phase = opts.reducedMotion ? 'idle' : 'appear';
  let phaseStart = 0;
  let seg = 0;
  let pinged = false;
  let dockDuration = DOCK;
  const pos = toWorld(...START);
  const segFrom = pos.clone();
  const dockFrom = { pos: pos.clone(), scale: 0, spin: 0 };
  let scale = opts.reducedMotion ? dockTarget().scale : 0;
  let spin = 0;
  const prev = pos.clone();
  const vel = new THREE.Vector3();
  let docked = false;

  if (opts.reducedMotion) {
    pos.copy(dockTarget().pos);
    queueMicrotask(() => {
      opts.onDocking();
      opts.onDocked();
    });
    docked = true;
  }

  const ping = (center: THREE.Vector3, t: number) => {
    for (let k = 0; k < 2; k++) {
      const r = rings[ringCursor];
      ringCursor = (ringCursor + 1) % rings.length;
      r.start = t;
      r.delay = k * 0.12;
      r.from = scale * 1.02;
      r.to = scale * (2.4 + k * 0.5);
      r.loop.position.copy(center).setZ(-0.2);
      r.loop.visible = true;
    }
    for (let i = 0; i < 54; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = scale * (0.95 + Math.random() * 0.12);
      const sp = 0.5 + Math.random() * 1.3;
      sparks.emit(
        center.x + Math.cos(a) * rr,
        center.y + Math.sin(a) * rr,
        -0.15 + (Math.random() - 0.5) * 0.4,
        Math.cos(a) * sp,
        Math.sin(a) * sp,
        (Math.random() - 0.5) * 0.4,
        0.8 + Math.random() * 0.7,
        1.6 + Math.random() * 3,
      );
    }
  };

  const startDock = (t: number, duration: number) => {
    phase = 'dock';
    phaseStart = t;
    dockDuration = duration;
    dockFrom.pos.copy(pos);
    dockFrom.scale = scale;
    dockFrom.spin = spin;
    opts.onDocking();
  };

  const startTime = performance.now();
  let lastTime = startTime;
  let raf = 0;

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const t = (now - startTime) / 1000;
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (phase === 'appear') {
      const k = clamp((t - phaseStart) / APPEAR, 0, 1);
      const e = easeOut(k);
      scale = scanScale * (0.3 + 0.7 * e);
      lens.group.position.z = -6 * (1 - e);
      spin = -1.4 * (1 - e);
      if (k >= 1) {
        phase = 'scan';
        phaseStart = t;
        seg = 0;
        pinged = false;
        segFrom.copy(pos);
      }
    } else if (phase === 'scan') {
      scale = scanScale;
      const local = t - phaseStart;
      const to = scanPoint(...SCAN_POINTS[seg]);
      if (local < MOVE) {
        const e = easeInOut(local / MOVE);
        const dir = to.clone().sub(segFrom);
        const perp = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
        pos.lerpVectors(segFrom, to, e).addScaledVector(perp, Math.sin(Math.PI * e) * dir.length() * 0.14 * (seg % 2 ? -1 : 1));
      } else {
        pos.copy(to);
        if (!pinged) {
          pinged = true;
          ping(to, t);
        }
      }
      if (local >= MOVE + HOLD) {
        seg += 1;
        phaseStart = t;
        pinged = false;
        segFrom.copy(pos);
        if (seg >= SCAN_POINTS.length) startDock(t, DOCK);
      }
    } else if (phase === 'dock') {
      const k = clamp((t - phaseStart) / dockDuration, 0, 1);
      const e = easeInOut(k);
      const target = dockTarget();
      pos.lerpVectors(dockFrom.pos, target.pos, e);
      pos.x += Math.sin(Math.PI * e) * scanScale * 0.6;
      scale = THREE.MathUtils.lerp(dockFrom.scale, target.scale, easeInOut(clamp(k * 1.1, 0, 1)));
      spin = dockFrom.spin + Math.PI * 2 * e;
      lens.group.position.z = Math.sin(Math.PI * e) * 1.2;
      if (k >= 1) {
        phase = 'idle';
        spin = 0;
        lens.group.position.z = 0;
        if (!docked) {
          docked = true;
          opts.onDocked();
        }
      }
    } else {
      const target = dockTarget();
      scale = target.scale;
      pos.copy(target.pos);
      pos.y += Math.sin(t * 1.3) * 0.035 * scale;
    }

    // Motion-derived tilt.
    const instVel = pos.clone().sub(prev).divideScalar(Math.max(dt, 1e-3));
    vel.lerp(instVel, 1 - Math.exp(-dt * 10));
    prev.copy(pos);

    const sway = phase === 'idle' ? Math.sin(t * 0.7) * 0.42 : Math.sin(t * 1.6) * 0.18;
    lens.group.position.x = pos.x;
    lens.group.position.y = pos.y;
    lens.group.scale.setScalar(Math.max(scale, 1e-4));
    lens.group.rotation.set(
      0.14 - clamp(vel.y * 0.035, -0.45, 0.45),
      -0.28 + sway + spin + clamp(vel.x * 0.035, -0.5, 0.5),
      clamp(-vel.x * 0.012, -0.2, 0.2),
    );

    // Trail + particles while moving.
    const speed = vel.length();
    if (phase === 'scan' || phase === 'appear' || (phase === 'dock' && t - phaseStart < dockDuration * 0.55)) {
      trail.push(pos.x, pos.y, t);
      const count = Math.min(14, Math.floor(speed * dt * 9 + Math.random()));
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = scale * (0.98 + Math.random() * 0.06);
        sparks.emit(
          pos.x + Math.cos(a) * rr,
          pos.y + Math.sin(a) * rr,
          -0.1 + (Math.random() - 0.5) * 0.3,
          -vel.x * 0.06 + (Math.random() - 0.5) * 0.25,
          -vel.y * 0.06 + (Math.random() - 0.5) * 0.25,
          (Math.random() - 0.5) * 0.2,
          0.7 + Math.random() * 0.9,
          1.2 + Math.random() * 2.6,
        );
      }
    }
    trail.update(t);
    sparks.update(dt);

    for (const r of rings) {
      if (r.start < 0) continue;
      const k = (t - r.start - r.delay) / 0.95;
      if (k < 0) {
        r.material.opacity = 0;
        continue;
      }
      if (k >= 1) {
        r.start = -1;
        r.loop.visible = false;
        continue;
      }
      const e = easeOut(k);
      r.loop.scale.setScalar(THREE.MathUtils.lerp(r.from, r.to, e));
      r.material.opacity = 0.75 * Math.pow(1 - k, 1.5);
    }

    dust.rotation.y = Math.sin(t * 0.05) * 0.04;
    dust.position.y = Math.sin(t * 0.1) * 0.08;
    dustMat.uniforms.uTime.value = t;
    lens.glowMat.opacity = 0.75 + Math.sin(t * 2.2) * 0.15;

    composer.render();
  };
  raf = requestAnimationFrame(frame);

  return {
    skip() {
      if (phase === 'appear' || phase === 'scan') {
        if (phase === 'appear') {
          lens.group.position.z = 0;
          scale = Math.max(scale, scanScale * 0.6);
        }
        startDock((performance.now() - startTime) / 1000, DOCK_SKIP);
      }
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
      envMap.dispose();
      pmrem.dispose();
      composer.dispose();
      renderer.dispose();
    },
  };
}
