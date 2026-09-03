import * as THREE from "three";
import { FALL_LOOP_DEPTH, type WorldFrame } from "../core";
import { spatialFallDepth, spatialMotionScale } from "./motion-preference";
import { WORLD_VISUAL_PALETTE } from "./visualPalette";
import { pigmentCoverage } from "./pigment-projection";
import {
  APERTURE_COUNT,
  createCurrentGeometry,
  createDustGeometry,
  createGlowTexture,
  createShardGeometry,
  LANDMARK_COUNT,
  SHARD_COUNT,
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

interface ShardSeed extends LandmarkSeed {
  readonly pigmentOffset: number;
}

interface PigmentField {
  readonly sprite: THREE.Sprite;
  readonly material: THREE.SpriteMaterial;
  readonly depth: number;
  readonly phase: number;
  readonly x: number;
  readonly z: number;
  readonly scale: number;
  readonly pigmentOffset: number;
  readonly baseOpacity: number;
}

export class FallWorld {
  private readonly camera = new THREE.PerspectiveCamera(68, 1, 0.1, 220);
  private cameraFov = 68;
  private readonly reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  private readonly scene = new THREE.Scene();
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  private readonly landmarkMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
  });
  private readonly landmarks = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.15, 0),
    this.landmarkMaterial,
    LANDMARK_COUNT,
  );
  private readonly landmarkSeeds: LandmarkSeed[] = [];
  private readonly shardMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  private readonly shards = new THREE.InstancedMesh(
    createShardGeometry(),
    this.shardMaterial,
    SHARD_COUNT,
  );
  private readonly shardSeeds: ShardSeed[] = [];
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
  private readonly pigmentFields: PigmentField[] = [];
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
  private readonly shardColor = new THREE.Color();
  private readonly apertureColor = new THREE.Color(WORLD_VISUAL_PALETTE.aperture);
  private readonly coolColor = new THREE.Color(WORLD_VISUAL_PALETTE.cool);
  private readonly wakeColor = new THREE.Color(WORLD_VISUAL_PALETTE.wake);
  private readonly voidColor = new THREE.Color(WORLD_VISUAL_PALETTE.void);
  private readonly backgroundColor = new THREE.Color(WORLD_VISUAL_PALETTE.void);
  private readonly ivoryColor = new THREE.Color(WORLD_VISUAL_PALETTE.ivory);
  private readonly fruitColor = new THREE.Color(WORLD_VISUAL_PALETTE.fruit);
  private readonly goldColor = new THREE.Color(WORLD_VISUAL_PALETTE.gold);
  private readonly violetColor = new THREE.Color(WORLD_VISUAL_PALETTE.violet);
  private readonly plumColor = new THREE.Color(WORLD_VISUAL_PALETTE.plum);
  private readonly sageColor = new THREE.Color(WORLD_VISUAL_PALETTE.sage);
  private readonly eventPigmentColors = [
    WORLD_VISUAL_PALETTE.fruit,
    WORLD_VISUAL_PALETTE.violet,
    WORLD_VISUAL_PALETTE.pink,
    WORLD_VISUAL_PALETTE.gold,
    WORLD_VISUAL_PALETTE.sage,
    WORLD_VISUAL_PALETTE.clay,
    WORLD_VISUAL_PALETTE.ivory,
    WORLD_VISUAL_PALETTE.shell,
  ].map((pigment) => new THREE.Color(pigment));

  constructor(container: HTMLElement) {
    this.scene.background = this.backgroundColor;
    this.scene.fog = new THREE.FogExp2(this.backgroundColor.clone(), 0.018);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.camera.rotation.x = -Math.PI / 2;
    this.gravityOuter.scale.set(28, 28, 1);
    this.gravityInner.scale.set(10, 10, 1);
    this.gravityRing.rotation.x = Math.PI / 2;
    this.gravityFunnel.rotation.x = Math.PI;
    this.shards.rotation.x = Math.PI / 2;
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
      this.shards,
    );

    const fieldBlueprints = [
      [0, 0.052, 12, -5.4, 1.8],
      [1, 0.048, 11, 4.6, -2.3],
      [2, 0.044, 7, -4.2, -4.2],
      [3, 0.04, 8, 3.4, 4.8],
      [4, 0.038, 6.5, 5.8, 1.4],
      [5, 0.034, 7.5, -1.3, 5.2],
      [6, 0.028, 5.5, 1.1, -4.8],
      [0, 0.03, 6, -5.4, 4.1],
      [1, 0.028, 7, 5.1, -4.5],
    ] as const;
    for (let index = 0; index < fieldBlueprints.length; index += 1) {
      const blueprint = fieldBlueprints[index];
      if (!blueprint) continue;
      const [pigmentOffset, baseOpacity, scale, x, z] = blueprint;
      const material = new THREE.SpriteMaterial({
        map: this.gravityTexture,
        color: this.eventPigmentColors[pigmentOffset],
        transparent: true,
        opacity: baseOpacity,
        depthTest: false,
        depthWrite: false,
        fog: false,
        blending: THREE.NormalBlending,
      });
      const sprite = new THREE.Sprite(material);
      const field = {
        sprite,
        material,
        depth: 12 + Math.floor(index / 3) * 58 + index % 3 * 3.5,
        phase: index * 1.47,
        x,
        z,
        scale,
        pigmentOffset,
        baseOpacity,
      };
      sprite.renderOrder = -9 + index;
      this.pigmentFields.push(field);
      this.scene.add(sprite);
    }

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

    for (let index = 0; index < SHARD_COUNT; index += 1) {
      const angle = index * 2.399963229728653;
      const depth = (index * 31.7) % FALL_LOOP_DEPTH;
      const scale = 1.4 + (index % 7) * 0.52;
      const seed = {
        x: Math.cos(angle) * (4.6 + index % 5 * 2.65),
        depth,
        z: Math.sin(angle) * (4.6 + index % 5 * 2.65),
        scale,
        phase: index * 0.61,
        wakeWeight: 0.72,
        pigmentOffset: (index * 3 + 1) % this.eventPigmentColors.length,
      };
      this.shardSeeds.push(seed);
      this.matrix.makeScale(scale, scale, scale);
      this.matrix.setPosition(seed.x, -depth, seed.z);
      this.shards.setMatrixAt(index, this.matrix);
      this.shards.setColorAt(index, this.eventPigmentColors[seed.pigmentOffset] ?? this.wakeColor);
    }

    this.landmarks.instanceMatrix.needsUpdate = true;
    if (this.landmarks.instanceColor) this.landmarks.instanceColor.needsUpdate = true;
    this.shards.instanceMatrix.needsUpdate = true;
    if (this.shards.instanceColor) this.shards.instanceColor.needsUpdate = true;
    container.append(this.renderer.domElement);
    this.resize();
  }

  resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(width, height);
  }

  render(frame: WorldFrame): void {
    const { reactivity, timeSeconds } = frame;
    const {
      breath,
      chromaBoost,
      currentPresence,
      dustPresence,
      gravityWeight,
      lateralPull,
      lightGain,
      paletteDrift,
      soundstageScale,
      transientPulse,
      wakeEnergy,
      wakeRingOpacity,
      weather,
    } = reactivity;
    const reducedMotion = this.reducedMotionQuery.matches;
    const motionScale = spatialMotionScale(reducedMotion);
    const spatialDepth = spatialFallDepth(frame.fall.distance, reducedMotion);
    const spatialTime = timeSeconds * motionScale;
    const spatialLateralPull = lateralPull * motionScale;
    const spatialSoundstageScale = 1 + (soundstageScale - 1) * motionScale;

    this.backgroundColor.lerpColors(this.voidColor, this.plumColor, 0.28 + weather * 0.42);
    this.backgroundColor.lerp(this.fruitColor, chromaBoost * 0.1);
    this.backgroundColor.lerp(this.violetColor, chromaBoost * 0.14 + transientPulse * 0.05);
    const fog = this.scene.fog;
    if (fog instanceof THREE.FogExp2) {
      fog.color.copy(this.backgroundColor);
      fog.density = 0.0125 + weather * 0.004 + breath * 0.0015 - chromaBoost * 0.0035;
    }

    for (const field of this.pigmentFields) {
      const relativeDepth = (field.depth - spatialDepth + FALL_LOOP_DEPTH) % FALL_LOOP_DEPTH;
      const coverage = pigmentCoverage(relativeDepth);
      const wakeDistance = (relativeDepth - 24) / 12;
      const localWake = Math.exp(-0.5 * wakeDistance * wakeDistance) * wakeEnergy;
      const drift = (paletteDrift + field.phase * 0.11) % 1;
      this.setEventPigmentColor(field.material.color, field.pigmentOffset, drift);
      field.material.color.lerp(
        field.pigmentOffset % 2 === 0 ? this.fruitColor : this.wakeColor,
        Math.min(0.48, localWake * 0.48),
      );
      field.material.opacity = Math.min(1, (field.baseOpacity + chromaBoost * 0.36 +
        lightGain * 0.05 + transientPulse * 0.08 + localWake * 0.25) * coverage);
      const expansion = 1 + (
        breath * 0.08 + chromaBoost * 0.48 + transientPulse * 0.2 + localWake * 1.1
      ) * motionScale;
      field.sprite.position.set(
        field.x + spatialLateralPull * (0.14 + Math.abs(Math.sin(field.phase)) * 0.22),
        -spatialDepth - relativeDepth,
        field.z,
      );
      field.sprite.scale.set(
        field.scale * expansion * (1.05 + spatialSoundstageScale * 0.28),
        field.scale * expansion,
        1,
      );
    }

    this.dust.rotation.y = spatialTime * 0.007;
    this.dustReplica.rotation.y = this.dust.rotation.y;
    this.dust.scale.set(spatialSoundstageScale, 1, spatialSoundstageScale);
    this.dustReplica.scale.copy(this.dust.scale);
    this.dustMaterial.opacity = 0.17 + weather * 0.1 + dustPresence * 0.72 + transientPulse * 0.13;
    this.dustMaterial.size = 0.052 + (dustPresence * 0.075 + transientPulse * 0.034) * motionScale;
    this.dustMaterial.color.lerpColors(this.coolColor, this.ivoryColor, 0.22 + chromaBoost * 0.3);
    this.dustMaterial.color.lerp(this.fruitColor, transientPulse * 0.22);
    this.shardMaterial.opacity = 0.18 + chromaBoost * 0.62 + transientPulse * 0.18;
    this.currentLine.rotation.y = spatialTime * 0.009;
    this.currentLineReplica.rotation.y = this.currentLine.rotation.y;
    this.currentInnerLine.rotation.y = spatialTime * 0.011 + 1.9;
    this.currentInnerLineReplica.rotation.y = this.currentInnerLine.rotation.y;
    this.currentOuterLine.rotation.y = spatialTime * 0.007 - 1.25;
    this.currentOuterLineReplica.rotation.y = this.currentOuterLine.rotation.y;
    this.currentLine.scale.set(spatialSoundstageScale, 1, spatialSoundstageScale);
    this.currentLineReplica.scale.copy(this.currentLine.scale);
    this.currentInnerLine.scale.set(0.72 * spatialSoundstageScale, 1, 0.72 * spatialSoundstageScale);
    this.currentInnerLineReplica.scale.copy(this.currentInnerLine.scale);
    this.currentOuterLine.scale.set(1.34 * spatialSoundstageScale, 1, 1.34 * spatialSoundstageScale);
    this.currentOuterLineReplica.scale.copy(this.currentOuterLine.scale);
    this.currentMaterial.opacity = 0.044 + weather * 0.042 + currentPresence * 0.78 + transientPulse * 0.16;
    this.currentMaterial.color.lerpColors(this.violetColor, this.goldColor, 0.16 + paletteDrift * 0.44);
    this.currentMaterial.color.lerp(this.fruitColor, Math.min(0.54, chromaBoost * 0.34 + transientPulse * 0.24));

    for (const aperture of this.apertures) {
      const relativeDepth = (
        aperture.depth - spatialDepth + FALL_LOOP_DEPTH
      ) % FALL_LOOP_DEPTH;
      aperture.mesh.position.y = -spatialDepth - relativeDepth;
      const wakeDistance = (relativeDepth - 14) / 11;
      const localWake = Math.exp(-0.5 * wakeDistance * wakeDistance) * wakeEnergy;
      const slowPulse = 1 + Math.sin(spatialTime * 0.13 + aperture.phase) * 0.075 * motionScale;
      const wakeScale = 1 + (localWake * 0.82 + transientPulse * 0.12) * motionScale;
      aperture.mesh.scale.set(
        aperture.xScale * slowPulse * wakeScale,
        aperture.zScale * slowPulse * wakeScale,
        1,
      );
      aperture.mesh.rotation.y = aperture.phase + spatialTime * 0.008 * (aperture.phase % 2 > 1 ? -1 : 1);
      aperture.mesh.material.opacity = 0.048 + weather * 0.062 + currentPresence * 0.1 + localWake * 0.44;
      aperture.mesh.material.color.lerpColors(this.apertureColor, this.goldColor, 0.22 + paletteDrift * 0.32);
      aperture.mesh.material.color.lerp(this.wakeColor, localWake * 0.78 + transientPulse * 0.1);
    }

    for (let index = 0; index < this.landmarkSeeds.length; index += 1) {
      const seed = this.landmarkSeeds[index];
      if (!seed) continue;
      const relativeDepth = (seed.depth - spatialDepth + FALL_LOOP_DEPTH) % FALL_LOOP_DEPTH;
      const wakeDistance = (relativeDepth - 18) / 9;
      const localWake = Math.exp(-0.5 * wakeDistance * wakeDistance) * wakeEnergy;
      const peripheralBreath = Math.sin(spatialTime * 0.18 + seed.phase) *
        0.018 * weather * motionScale;
      const scale = seed.scale * (1 + peripheralBreath + localWake * seed.wakeWeight * motionScale);

      this.matrix.makeScale(scale, scale, scale);
      this.matrix.setPosition(seed.x, -spatialDepth - relativeDepth, seed.z);
      this.landmarks.setMatrixAt(index, this.matrix);

      this.setEventPigmentColor(this.landmarkColor, index + 1, paletteDrift);
      this.landmarkColor.lerp(this.coolColor, (1 - chromaBoost) * 0.76);
      this.landmarkColor.lerp(this.ivoryColor, 0.12 + lightGain * 0.22);
      this.landmarkColor.lerp(this.wakeColor, Math.min(0.84, localWake * 0.84 + transientPulse * seed.wakeWeight * 0.18));
      this.landmarks.setColorAt(index, this.landmarkColor);
    }

    for (let index = 0; index < this.shardSeeds.length; index += 1) {
      const seed = this.shardSeeds[index];
      if (!seed) continue;
      const relativeDepth = (seed.depth - spatialDepth + FALL_LOOP_DEPTH) % FALL_LOOP_DEPTH;
      const wakeDistance = (relativeDepth - 16) / 7.4;
      const localWake = Math.exp(-0.5 * wakeDistance * wakeDistance) * wakeEnergy;
      const asymmetricPulse = Math.sin(spatialTime * 0.24 + seed.phase) * 0.045 * motionScale;
      const scale = seed.scale * (
        1 + asymmetricPulse + (chromaBoost * 0.14 + localWake * 1.34) * motionScale
      );
      this.matrix.makeScale(scale, scale, scale);
      this.matrix.setPosition(
        seed.x + Math.sin(spatialTime * 0.08 + seed.phase) *
          (0.2 + chromaBoost * 0.9) * motionScale,
        -spatialDepth - relativeDepth,
        seed.z,
      );
      this.shards.setMatrixAt(index, this.matrix);
      this.setEventPigmentColor(this.shardColor, seed.pigmentOffset, paletteDrift + 0.18);
      this.shardColor.lerp(this.ivoryColor, lightGain * 0.14);
      this.shardColor.lerp(this.fruitColor, Math.min(0.68, chromaBoost * 0.16 + localWake * 0.82));
      this.shards.setColorAt(index, this.shardColor);
    }

    this.landmarks.instanceMatrix.needsUpdate = true;
    if (this.landmarks.instanceColor) this.landmarks.instanceColor.needsUpdate = true;
    this.shards.instanceMatrix.needsUpdate = true;
    if (this.shards.instanceColor) this.shards.instanceColor.needsUpdate = true;

    const currentPhase = spatialTime * 0.038;
    const cameraLateralPull = THREE.MathUtils.clamp(spatialLateralPull, -6, 6) * 0.45;
    const cameraTransient = THREE.MathUtils.clamp(transientPulse, 0, 1) * motionScale;
    const currentStrength = (0.48 + currentPresence * 0.86 + cameraTransient * 0.34) * motionScale;
    this.camera.position.y = -spatialDepth;
    this.camera.position.x = Math.sin(currentPhase) * currentStrength
      + Math.sin(spatialTime * 0.11) * (0.1 + chromaBoost * 0.34) * motionScale
      + cameraLateralPull;
    this.camera.position.z = Math.cos(currentPhase * 0.73 + 0.8) * currentStrength
      + Math.sin(spatialTime * 0.18) * currentPresence * 0.54 * motionScale;
    this.camera.rotation.z = Math.sin(spatialTime * 0.16) * 0.028 * motionScale
      + cameraLateralPull * 0.007 + cameraTransient * 0.024;
    const nextFov = 68 - (gravityWeight * 3.5 + cameraTransient * 1.25) * motionScale;
    if (Math.abs(nextFov - this.cameraFov) > 0.01) {
      this.camera.fov = nextFov;
      this.cameraFov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    this.gravityWell.position.set(cameraLateralPull * -0.18, -spatialDepth - 78, 0);
    this.gravityWell.rotation.y = spatialTime * 0.03 + chromaBoost * 0.3 * motionScale;
    this.gravityWell.scale.setScalar(
      0.94 + (gravityWeight * 0.92 + cameraTransient * 0.24) * motionScale,
    );
    this.gravityOuterMaterial.opacity = 0.18 + weather * 0.13 + chromaBoost * 0.1 + wakeEnergy * 0.18;
    this.gravityOuterMaterial.color.lerpColors(this.plumColor, this.fruitColor, 0.34 + chromaBoost * 0.54);
    this.gravityInnerMaterial.opacity = 0.46 + lightGain * 0.22 + transientPulse * 0.2;
    this.gravityInnerMaterial.color.lerpColors(this.violetColor, this.ivoryColor, 0.22 + gravityWeight * 0.52);
    this.gravityCoreMaterial.color.lerpColors(this.voidColor, this.plumColor, 0.3 + gravityWeight * 0.38);
    this.gravityRingMaterial.opacity = 0.21 + wakeRingOpacity * 0.7 + transientPulse * 0.14;
    this.gravityRingMaterial.color.lerpColors(this.goldColor, this.wakeColor, wakeEnergy * 0.72 + chromaBoost * 0.12);
    this.gravityFunnelMaterial.opacity = 0.016 + weather * 0.025 + gravityWeight * 0.035 + chromaBoost * 0.025;
    this.gravityFunnelMaterial.color.lerpColors(this.sageColor, this.violetColor, 0.36 + chromaBoost * 0.42);
    this.renderer.render(this.scene, this.camera);
  }

  private setEventPigmentColor(target: THREE.Color, index: number, drift: number): void {
    const pigmentCount = this.eventPigmentColors.length;
    const base = ((index % pigmentCount) + pigmentCount) % pigmentCount;
    const next = (base + 1) % pigmentCount;
    target.copy(this.eventPigmentColors[base] ?? this.wakeColor);
    target.lerp(this.eventPigmentColors[next] ?? this.wakeColor, drift - Math.floor(drift));
  }

  dispose(): void {
    this.landmarks.geometry.dispose();
    this.landmarkMaterial.dispose();
    this.shards.geometry.dispose();
    this.shardMaterial.dispose();
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
    for (const field of this.pigmentFields) field.material.dispose();
    this.gravityTexture.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
