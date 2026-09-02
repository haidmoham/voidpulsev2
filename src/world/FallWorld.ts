import * as THREE from "three";
import { FALL_LOOP_DEPTH, type WorldFrame } from "../core";
import { WORLD_VISUAL_PALETTE } from "./visualPalette";
import {
  APERTURE_COUNT,
  createCurrentGeometry,
  createDustGeometry,
  createGlowTexture,
  LANDMARK_COUNT,
} from "./worldGeometry";

interface LandmarkSeed {
  readonly x: number;
  readonly depth: number;
  readonly z: number;
  readonly scale: number;
  readonly phase: number;
  /** Keeps the large, structural anchors quieter than the low-mass field. */
  readonly wakeWeight: number;
}

interface Aperture {
  readonly mesh: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  readonly depth: number;
  readonly phase: number;
  readonly xScale: number;
  readonly zScale: number;
}

export class FallWorld {
  private readonly camera = new THREE.PerspectiveCamera(68, 1, 0.1, 220);
  private readonly scene = new THREE.Scene();
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  private readonly landmarkMaterial = new THREE.MeshBasicMaterial({
    color: WORLD_VISUAL_PALETTE.landmark,
  });
  private readonly landmarks = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.15, 0),
    this.landmarkMaterial,
    LANDMARK_COUNT,
  );
  private readonly landmarkSeeds: LandmarkSeed[] = [];
  private readonly apertures: Aperture[] = [];
  private readonly currentMaterial = new THREE.LineBasicMaterial({
    color: WORLD_VISUAL_PALETTE.current,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private readonly currentLine = new THREE.Line(createCurrentGeometry(), this.currentMaterial);
  private readonly currentLineReplica = new THREE.Line(
    this.currentLine.geometry,
    this.currentMaterial,
  );
  private readonly currentInnerLine = new THREE.Line(
    this.currentLine.geometry,
    this.currentMaterial,
  );
  private readonly currentInnerLineReplica = new THREE.Line(
    this.currentLine.geometry,
    this.currentMaterial,
  );
  private readonly currentOuterLine = new THREE.Line(
    this.currentLine.geometry,
    this.currentMaterial,
  );
  private readonly currentOuterLineReplica = new THREE.Line(
    this.currentLine.geometry,
    this.currentMaterial,
  );
  private readonly dustMaterial = new THREE.PointsMaterial({
    color: WORLD_VISUAL_PALETTE.dust,
    size: 0.065,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    sizeAttenuation: true,
  });
  private readonly dust = new THREE.Points(createDustGeometry(), this.dustMaterial);
  private readonly dustReplica = new THREE.Points(this.dust.geometry, this.dustMaterial);
  private readonly gravityTexture = createGlowTexture();
  private readonly gravityOuterMaterial = new THREE.SpriteMaterial({
    map: this.gravityTexture,
    color: WORLD_VISUAL_PALETTE.gravityOuter,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private readonly gravityInnerMaterial = new THREE.SpriteMaterial({
    map: this.gravityTexture,
    color: WORLD_VISUAL_PALETTE.gravityInner,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private readonly gravityCoreMaterial = new THREE.MeshBasicMaterial({
    color: WORLD_VISUAL_PALETTE.gravityCore,
  });
  private readonly gravityRingMaterial = new THREE.MeshBasicMaterial({
    color: WORLD_VISUAL_PALETTE.gravityRing,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private readonly gravityFunnelMaterial = new THREE.MeshBasicMaterial({
    color: WORLD_VISUAL_PALETTE.gravityFunnel,
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
  private readonly apertureColor = new THREE.Color(WORLD_VISUAL_PALETTE.aperture);
  private readonly coolColor = new THREE.Color(WORLD_VISUAL_PALETTE.cool);
  private readonly warmColor = new THREE.Color(WORLD_VISUAL_PALETTE.warm);
  private readonly wakeColor = new THREE.Color(WORLD_VISUAL_PALETTE.wake);
  private readonly voidColor = new THREE.Color(WORLD_VISUAL_PALETTE.void);
  private readonly weatherColor = new THREE.Color(WORLD_VISUAL_PALETTE.weather);
  private readonly backgroundColor = new THREE.Color(WORLD_VISUAL_PALETTE.void);

  constructor(container: HTMLElement) {
    this.scene.background = this.backgroundColor;
    this.scene.fog = new THREE.FogExp2(this.backgroundColor.clone(), 0.018);
    this.camera.rotation.x = -Math.PI / 2;
    this.gravityOuter.scale.set(28, 28, 1);
    this.gravityInner.scale.set(10, 10, 1);
    this.gravityRing.rotation.x = Math.PI / 2;
    this.gravityFunnel.rotation.x = Math.PI;
    this.gravityFunnel.position.y = 21;
    this.currentLineReplica.position.y = -FALL_LOOP_DEPTH;
    this.currentInnerLine.position.set(-0.65, 0, 0.35);
    this.currentInnerLine.rotation.z = -0.32;
    this.currentInnerLine.scale.set(0.72, 1, 0.72);
    this.currentInnerLineReplica.position.set(-0.65, -FALL_LOOP_DEPTH, 0.35);
    this.currentInnerLineReplica.rotation.z = -0.32;
    this.currentInnerLineReplica.scale.set(0.72, 1, 0.72);
    this.currentOuterLine.position.set(0.85, 0, -0.55);
    this.currentOuterLine.rotation.z = 0.24;
    this.currentOuterLine.scale.set(1.34, 1, 1.34);
    this.currentOuterLineReplica.position.set(0.85, -FALL_LOOP_DEPTH, -0.55);
    this.currentOuterLineReplica.rotation.z = 0.24;
    this.currentOuterLineReplica.scale.set(1.34, 1, 1.34);
    this.dustReplica.position.y = -FALL_LOOP_DEPTH;
    this.gravityWell.add(
      this.gravityFunnel,
      this.gravityOuter,
      this.gravityInner,
      this.gravityRing,
      this.gravityCore,
    );
    this.scene.add(
      this.gravityWell,
      this.dust,
      this.dustReplica,
      this.currentLine,
      this.currentLineReplica,
      this.currentInnerLine,
      this.currentInnerLineReplica,
      this.currentOuterLine,
      this.currentOuterLineReplica,
      this.landmarks,
    );

    for (let index = 0; index < APERTURE_COUNT; index += 1) {
      const depth = 10 + index * (FALL_LOOP_DEPTH / APERTURE_COUNT);
      const material = new THREE.MeshBasicMaterial({
        color: WORLD_VISUAL_PALETTE.aperture,
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
      const structuralAnchor = index < 24;
      const radius = structuralAnchor
        ? 7 + Math.random() * 15
        : 2 + Math.random() * 20;
      const angle = Math.random() * Math.PI * 2;
      const depth = Math.random() * FALL_LOOP_DEPTH;
      const scale = structuralAnchor
        ? 3.8 + Math.random() * 3.2
        : 0.5 + Math.random() * 3;
      const seed = {
        x: Math.cos(angle) * radius,
        depth,
        z: Math.sin(angle) * radius,
        scale,
        phase: Math.random() * Math.PI * 2,
        wakeWeight: structuralAnchor ? 0.12 : 0.34,
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

  render(frame: WorldFrame): void {
    const { reactivity, timeSeconds } = frame;
    const {
      breath,
      cameraDepth,
      currentPresence,
      dustPresence,
      gravityWeight,
      lateralPull,
      paletteDrift,
      soundstageScale,
      wakeEnergy,
      wakeRingOpacity,
      weather,
    } = reactivity;

    this.backgroundColor.lerpColors(this.voidColor, this.weatherColor, 0.28 + weather * 0.5);
    const fog = this.scene.fog;
    if (fog instanceof THREE.FogExp2) {
      fog.color.copy(this.backgroundColor);
      fog.density = 0.015 + weather * 0.0045 + breath * 0.0015;
    }
    this.dust.rotation.y = timeSeconds * 0.007;
    this.dustReplica.rotation.y = this.dust.rotation.y;
    this.dust.scale.set(soundstageScale, 1, soundstageScale);
    this.dustReplica.scale.copy(this.dust.scale);
    this.dustMaterial.opacity = 0.2 + weather * 0.11 + dustPresence;
    this.currentLine.rotation.y = timeSeconds * 0.009;
    this.currentLineReplica.rotation.y = this.currentLine.rotation.y;
    this.currentInnerLine.rotation.y = timeSeconds * 0.011 + 1.9;
    this.currentInnerLineReplica.rotation.y = this.currentInnerLine.rotation.y;
    this.currentOuterLine.rotation.y = timeSeconds * 0.007 - 1.25;
    this.currentOuterLineReplica.rotation.y = this.currentOuterLine.rotation.y;
    this.currentLine.scale.set(soundstageScale, 1, soundstageScale);
    this.currentLineReplica.scale.copy(this.currentLine.scale);
    this.currentInnerLine.scale.set(0.72 * soundstageScale, 1, 0.72 * soundstageScale);
    this.currentInnerLineReplica.scale.copy(this.currentInnerLine.scale);
    this.currentOuterLine.scale.set(1.34 * soundstageScale, 1, 1.34 * soundstageScale);
    this.currentOuterLineReplica.scale.copy(this.currentOuterLine.scale);
    this.currentMaterial.opacity = 0.052 + weather * 0.035 + currentPresence;
    this.currentMaterial.color.lerpColors(this.coolColor, this.warmColor, paletteDrift * 0.42);

    for (const aperture of this.apertures) {
      const relativeDepth = (
        aperture.depth - cameraDepth + FALL_LOOP_DEPTH
      ) % FALL_LOOP_DEPTH;
      aperture.mesh.position.y = -cameraDepth - relativeDepth;
      const wakeDistance = (relativeDepth - 14) / 11;
      const localWake = Math.exp(-0.5 * wakeDistance * wakeDistance) * wakeEnergy;
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
      const relativeDepth = (seed.depth - cameraDepth + FALL_LOOP_DEPTH) % FALL_LOOP_DEPTH;
      const wakeDistance = (relativeDepth - 18) / 9;
      const localWake = Math.exp(-0.5 * wakeDistance * wakeDistance) * wakeEnergy;
      const peripheralBreath = Math.sin(timeSeconds * 0.18 + seed.phase) * 0.018 * weather;
      const scale = seed.scale * (1 + peripheralBreath + localWake * seed.wakeWeight);

      this.matrix.makeScale(scale, scale, scale);
      this.matrix.setPosition(seed.x, -cameraDepth - relativeDepth, seed.z);
      this.landmarks.setMatrixAt(index, this.matrix);

      this.landmarkColor.lerpColors(this.coolColor, this.warmColor, paletteDrift * 0.55);
      this.landmarkColor.lerp(this.wakeColor, Math.min(0.72, localWake * 0.72));
      this.landmarks.setColorAt(index, this.landmarkColor);
    }

    this.landmarks.instanceMatrix.needsUpdate = true;
    if (this.landmarks.instanceColor) this.landmarks.instanceColor.needsUpdate = true;

    const currentPhase = timeSeconds * 0.038;
    const currentStrength = 0.55;
    this.camera.position.y = -cameraDepth;
    this.camera.position.x = Math.sin(currentPhase) * currentStrength
      + Math.sin(timeSeconds * 0.11) * 0.1
      + lateralPull;
    this.camera.position.z = Math.cos(currentPhase * 0.73 + 0.8) * currentStrength;

    this.gravityWell.position.set(0, -cameraDepth - 78, 0);
    this.gravityWell.scale.setScalar(0.94 + gravityWeight);
    this.gravityOuterMaterial.opacity = 0.3 + weather * 0.14;
    this.gravityInnerMaterial.opacity = 0.62;
    this.gravityRingMaterial.opacity = 0.32 + wakeRingOpacity;
    this.gravityFunnelMaterial.opacity = 0.022 + weather * 0.02;
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.landmarks.geometry.dispose();
    this.landmarkMaterial.dispose();
    this.dust.geometry.dispose();
    this.dustMaterial.dispose();
    this.currentLine.geometry.dispose();
    this.currentMaterial.dispose();

    for (const aperture of this.apertures) {
      aperture.mesh.geometry.dispose();
      aperture.mesh.material.dispose();
    }

    this.gravityOuterMaterial.dispose();
    this.gravityInnerMaterial.dispose();
    this.gravityCore.geometry.dispose();
    this.gravityCoreMaterial.dispose();
    this.gravityRing.geometry.dispose();
    this.gravityRingMaterial.dispose();
    this.gravityFunnel.geometry.dispose();
    this.gravityFunnelMaterial.dispose();
    this.gravityTexture.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
