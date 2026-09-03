import * as THREE from "three";
import { FALL_LOOP_DEPTH } from "../core";

export const LANDMARK_COUNT = 176;
export const DUST_COUNT = 520;
export const APERTURE_COUNT = 12;
export const CURRENT_POINT_COUNT = 300;
export const SHARD_COUNT = 42;

export function createDustGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array(DUST_COUNT * 3);
  for (let index = 0; index < DUST_COUNT; index += 1) {
    const radius = 1.5 + Math.random() * 27;
    const angle = Math.random() * Math.PI * 2;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = -Math.random() * FALL_LOOP_DEPTH;
    positions[index * 3 + 2] = Math.sin(angle) * radius;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

export function createCurrentGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array(CURRENT_POINT_COUNT * 3);
  for (let index = 0; index < CURRENT_POINT_COUNT; index += 1) {
    const progress = index / (CURRENT_POINT_COUNT - 1);
    const depth = progress * FALL_LOOP_DEPTH;
    const angle = progress * Math.PI * 2 * 1.62 + Math.sin(progress * Math.PI * 7) * 0.27;
    const radius = 3.2 + Math.sin(progress * Math.PI * 5) * 0.9 + Math.cos(progress * Math.PI * 13) * 0.24;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = -depth;
    positions[index * 3 + 2] = Math.sin(angle) * radius;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

/** A single hard-edged, unbalanced cutout reused by the instanced shard field. */
export function createShardGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array([
    -0.72, -0.08, 0.04, 0.74, 0.02, -0.02, 0.1, 0.18, -0.15,
    -0.72, -0.08, 0.04, 0.1, 0.18, -0.15, -0.18, 0.36, 0.08,
    -0.18, 0.36, 0.08, 0.1, 0.18, -0.15, 0.52, 0.54, 0.03,
    -0.72, -0.08, 0.04, -0.18, 0.36, 0.08, -0.52, 0.68, -0.04,
    -0.52, 0.68, -0.04, 0.52, 0.54, 0.03, 0.06, 0.82, 0.1,
    -0.18, 0.36, 0.08, 0.52, 0.54, 0.03, -0.08, 0.98, -0.12,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

export function createGlowTexture(): THREE.CanvasTexture {
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
