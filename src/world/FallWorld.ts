import * as THREE from "three";
import type { FallState } from "../dynamics/FallDynamics";

const LANDMARK_COUNT = 160;
const DUST_COUNT = 440;
const APERTURE_COUNT = 9;
const LOOP_DEPTH = 180;

interface LandmarkSeed {
  readonly x: number;
  readonly depth: number;
  readonly z: number;
  readonly scale: number;
  readonly phase: number;
}

interface Aperture {
  readonly mesh: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  readonly depth: number;
  readonly phase: number;
  readonly xScale: number;
  readonly zScale: number;
}

export class FallWorld {
  private readonly camera = new THREE.PerspectiveCamera(72, 1, 0.1, 220);
  private readonly scene = new THREE.Scene();
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  private readonly landmarkMaterial = new THREE.MeshBasicMaterial({ color: 0xb9b6ff });
  private readonly landmarks = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.15, 0),
    this.landmarkMaterial,
    LANDMARK_COUNT,
  );
  private readonly landmarkSeeds: LandmarkSeed[] = [];
  private readonly apertures: Aperture[] = [];
  private readonly currentMaterial = new THREE.LineBasicMaterial({
    color: 0x899aab,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private readonly currentLine = new THREE.Line(createCurrentGeometry(), this.currentMaterial);
  private readonly dustMaterial = new THREE.PointsMaterial({
    color: 0x88a28e,
    size: 0.065,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    sizeAttenuation: true,
  });
  private readonly dust = new THREE.Points(createDustGeometry(), this.dustMaterial);
  private readonly gravityTexture = createGlowTexture();
  private readonly gravityOuterMaterial = new THREE.SpriteMaterial({
    map: this.gravityTexture,
    color: 0xc06a59,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private readonly gravityInnerMaterial = new THREE.SpriteMaterial({
    map: this.gravityTexture,
    color: 0xd1a15d,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private readonly gravityCoreMaterial = new THREE.MeshBasicMaterial({ color: 0x090609 });
  private readonly gravityRingMaterial = new THREE.MeshBasicMaterial({
    color: 0xf2e5d4,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private readonly gravityFunnelMaterial = new THREE.MeshBasicMaterial({
    color: 0xc06a59,
    transparent: true,
    opacity: 0.035,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  private readonly gravityWell = new THREE.Group();
  private readonly gravityOuter = new THREE.Sprite(this.gravityOuterMaterial);
  private readonly gravityInner = new THREE.Sprite(this.gravityInnerMaterial);
  private readonly gravityCore = new THREE.Mesh(
    new THREE.SphereGeometry(1.25, 24, 16),
    this.gravityCoreMaterial,
  );
  private readonly gravityRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.7, 0.045, 6, 96),
    this.gravityRingMaterial,
  );
  private readonly gravityFunnel = new THREE.Mesh(
    new THREE.ConeGeometry(8, 42, 64, 1, true),
    this.gravityFunnelMaterial,
  );
  private readonly matrix = new THREE.Matrix4();
  private readonly landmarkColor = new THREE.Color();
  private readonly apertureColor = new THREE.Color(0xb486a1);
  private readonly coolColor = new THREE.Color(0x899aab);
  private readonly warmColor = new THREE.Color(0xc06a59);
  private readonly wakeColor = new THREE.Color(0xf2e5d4);
  private readonly voidColor = new THREE.Color(0x160f18);
  private readonly weatherColor = new THREE.Color(0x352333);
  private readonly backgroundColor = new THREE.Color(0x160f18);
  private previousIntensity = 0;
  private previousTime = 0;
  private wakeEnergy = 0;

  constructor(container: HTMLElement) {
    this.scene.background = this.backgroundColor;
    this.scene.fog = new THREE.FogExp2(this.backgroundColor.clone(), 0.018);
    this.camera.rotation.x = -Math.PI / 2;
    this.gravityOuter.scale.set(28, 28, 1);
    this.gravityInner.scale.set(10, 10, 1);
    this.gravityRing.rotation.x = Math.PI / 2;
    this.gravityFunnel.rotation.x = Math.PI;
    this.gravityFunnel.position.y = 21;
    this.gravityWell.add(
      this.gravityFunnel,
      this.gravityOuter,
      this.gravityInner,
      this.gravityRing,
      this.gravityCore,
    );
    this.scene.add(this.gravityWell, this.dust, this.currentLine, this.landmarks);

    for (let index = 0; index < APERTURE_COUNT; index += 1) {
      const depth = 10 + index * (LOOP_DEPTH / APERTURE_COUNT);
      const material = new THREE.MeshBasicMaterial({
        color: 0xb486a1,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(6.2 + index % 3 * 0.7, 0.035, 5, 96),
        material,
      );
      const aperture = {
        mesh,
        depth,
        phase: index * 0.83,
        xScale: 0.9 + index % 2 * 0.24,
        zScale: 0.62 + index % 3 * 0.1,
      };
      mesh.position.set(
        Math.sin(index * 1.7) * 1.7,
        -depth,
        Math.cos(index * 1.3) * 1.35,
      );
      mesh.rotation.x = Math.PI / 2;
      mesh.rotation.y = aperture.phase;
      this.apertures.push(aperture);
      this.scene.add(mesh);
    }

    for (let index = 0; index < LANDMARK_COUNT; index += 1) {
      const radius = 2 + Math.random() * 20;
      const angle = Math.random() * Math.PI * 2;
      const depth = Math.random() * LOOP_DEPTH;
      const scale = 0.5 + Math.random() * 3;
      const seed = {
        x: Math.cos(angle) * radius,
        depth,
        z: Math.sin(angle) * radius,
        scale,
        phase: Math.random() * Math.PI * 2,
      };
      this.landmarkSeeds.push(seed);
      this.matrix.makeScale(scale, scale, scale);
      this.matrix.setPosition(seed.x, -depth, seed.z);
      this.landmarks.setMatrixAt(index, this.matrix);
      this.landmarks.setColorAt(index, this.coolColor);
    }

    this.landmarks.instanceMatrix.needsUpdate = true;
    if (this.landmarks.instanceColor) this.landmarks.instanceColor.needsUpdate = true;
    container.append(this.renderer.domElement);
    this.resize();
  }

  resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
  }

  render(state: FallState, timeSeconds: number): void {
    const deltaSeconds = this.previousTime === 0
      ? 1 / 60
      : Math.min(0.1, Math.max(0, timeSeconds - this.previousTime));
    const cameraDepth = state.distance % LOOP_DEPTH;
    const intensityRise = Math.max(0, state.intensity - this.previousIntensity);
    this.wakeEnergy = Math.min(
      1,
      this.wakeEnergy * Math.exp(-deltaSeconds * 1.4) + intensityRise * 5,
    );

    const depthPhase = cameraDepth / LOOP_DEPTH * Math.PI * 2;
    const weather = 0.5 + 0.5 * Math.sin(depthPhase - timeSeconds * 0.035);
    const breath = 0.5 + 0.5 * Math.sin(timeSeconds * 0.16);
    const paletteDrift = 0.5 + 0.5 * Math.sin(timeSeconds * 0.025 + depthPhase * 0.35);

    this.backgroundColor.lerpColors(this.voidColor, this.weatherColor, 0.28 + weather * 0.5);
    const fog = this.scene.fog;
    if (fog instanceof THREE.FogExp2) {
      fog.color.copy(this.backgroundColor);
      fog.density = 0.015 + weather * 0.0045 + breath * 0.0015;
    }
    this.dust.rotation.y = timeSeconds * 0.007;
    this.dustMaterial.opacity = 0.2 + weather * 0.11 + state.intensity * 0.04;
    this.currentLine.rotation.y = timeSeconds * 0.009;
    this.currentMaterial.opacity = 0.12 + weather * 0.1 + state.intensity * 0.08;
    this.currentMaterial.color.lerpColors(this.coolColor, this.warmColor, paletteDrift * 0.42);

    for (const aperture of this.apertures) {
      const relativeDepth = (aperture.depth - cameraDepth + LOOP_DEPTH) % LOOP_DEPTH;
      const wakeDistance = (relativeDepth - 14) / 11;
      const localWake = Math.exp(-0.5 * wakeDistance * wakeDistance) * this.wakeEnergy;
      const slowPulse = 1 + Math.sin(timeSeconds * 0.13 + aperture.phase) * 0.055;
      const wakeScale = 1 + localWake * 0.2;
      aperture.mesh.scale.set(
        aperture.xScale * slowPulse * wakeScale,
        aperture.zScale * slowPulse * wakeScale,
        1,
      );
      aperture.mesh.rotation.y = aperture.phase + timeSeconds * 0.008 * (aperture.phase % 2 > 1 ? -1 : 1);
      aperture.mesh.material.opacity = 0.075 + weather * 0.07 + localWake * 0.2;
      aperture.mesh.material.color.lerpColors(this.apertureColor, this.wakeColor, localWake * 0.55);
    }

    for (let index = 0; index < this.landmarkSeeds.length; index += 1) {
      const seed = this.landmarkSeeds[index];
      if (!seed) continue;
      const relativeDepth = (seed.depth - cameraDepth + LOOP_DEPTH) % LOOP_DEPTH;
      const wakeDistance = (relativeDepth - 18) / 9;
      const localWake = Math.exp(-0.5 * wakeDistance * wakeDistance) * this.wakeEnergy;
      const peripheralBreath = Math.sin(timeSeconds * 0.18 + seed.phase) * 0.018 * weather;
      const scale = seed.scale * (1 + peripheralBreath + localWake * 0.3);

      this.matrix.makeScale(scale, scale, scale);
      this.matrix.setPosition(seed.x, -seed.depth, seed.z);
      this.landmarks.setMatrixAt(index, this.matrix);

      this.landmarkColor.lerpColors(this.coolColor, this.warmColor, paletteDrift * 0.55);
      this.landmarkColor.lerp(this.wakeColor, Math.min(0.72, localWake * 0.72));
      this.landmarks.setColorAt(index, this.landmarkColor);
    }

    this.landmarks.instanceMatrix.needsUpdate = true;
    if (this.landmarks.instanceColor) this.landmarks.instanceColor.needsUpdate = true;

    const currentPhase = timeSeconds * 0.038;
    const currentStrength = 0.55 + state.intensity * 0.45;
    this.camera.position.y = -cameraDepth;
    this.camera.position.x = Math.sin(currentPhase) * currentStrength
      + Math.sin(timeSeconds * 0.11) * 0.1;
    this.camera.position.z = Math.cos(currentPhase * 0.73 + 0.8) * currentStrength;
    this.camera.fov = 68 + state.intensity * 18;
    this.camera.updateProjectionMatrix();

    this.gravityWell.position.set(0, -cameraDepth - 78, 0);
    this.gravityWell.scale.setScalar(0.94 + state.intensity * 0.1);
    this.gravityOuterMaterial.opacity = 0.3 + weather * 0.14 + state.intensity * 0.08;
    this.gravityInnerMaterial.opacity = 0.62 + state.intensity * 0.18;
    this.gravityRingMaterial.opacity = 0.32 + state.intensity * 0.2;
    this.gravityFunnelMaterial.opacity = 0.022 + weather * 0.02 + state.intensity * 0.018;
    this.renderer.render(this.scene, this.camera);

    this.previousIntensity = state.intensity;
    this.previousTime = timeSeconds;
  }
}

function createDustGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array(DUST_COUNT * 3);
  for (let index = 0; index < DUST_COUNT; index += 1) {
    const radius = 1.5 + Math.random() * 27;
    const angle = Math.random() * Math.PI * 2;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = -Math.random() * LOOP_DEPTH;
    positions[index * 3 + 2] = Math.sin(angle) * radius;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function createCurrentGeometry(): THREE.BufferGeometry {
  const pointCount = 240;
  const positions = new Float32Array(pointCount * 3);
  for (let index = 0; index < pointCount; index += 1) {
    const progress = index / (pointCount - 1);
    const depth = progress * LOOP_DEPTH;
    const angle = progress * Math.PI * 2 * 1.35 + Math.sin(progress * Math.PI * 6) * 0.18;
    const radius = 3.2 + Math.sin(progress * Math.PI * 5) * 0.8;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = -depth;
    positions[index * 3 + 2] = Math.sin(angle) * radius;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);

  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgb(255 255 255 / 0.96)");
  gradient.addColorStop(0.12, "rgb(255 255 255 / 0.62)");
  gradient.addColorStop(0.36, "rgb(255 255 255 / 0.16)");
  gradient.addColorStop(1, "rgb(255 255 255 / 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}
