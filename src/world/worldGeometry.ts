import * as THREE from "three";
import { FALL_LOOP_DEPTH } from "../core";

export const LANDMARK_COUNT = 160;
export const DUST_COUNT = 440;
export const APERTURE_COUNT = 9;
export const CURRENT_POINT_COUNT = 240;

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
