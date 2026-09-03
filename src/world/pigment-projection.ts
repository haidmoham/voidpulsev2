import { FALL_LOOP_DEPTH } from "../core";

export const PIGMENT_PROJECTION_ANCHOR_DEPTH = 12;
export const PIGMENT_NEAR_FADE_START = 4;
export const PIGMENT_NEAR_FADE_END = 14;

/** Fades a just-wrapped, depth-test-free sprite before it can fill the view. */
export function pigmentCoverage(relativeDepth: number): number {
  const depth = clampFinite(relativeDepth, 0, FALL_LOOP_DEPTH);
  return smoothstep(PIGMENT_NEAR_FADE_START, PIGMENT_NEAR_FADE_END, depth);
}

/**
 * Testable perspective invariant for a fixed world-space sprite: apparent
 * size decreases with depth instead of being cancelled by world scaling.
 */
export function projectedPigmentScale(relativeDepth: number): number {
  const depth = clampFinite(relativeDepth, 0, FALL_LOOP_DEPTH);
  return PIGMENT_PROJECTION_ANCHOR_DEPTH / Math.max(depth, PIGMENT_NEAR_FADE_END);
}

function smoothstep(start: number, end: number, value: number): number {
  const progress = clampFinite((value - start) / (end - start), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function clampFinite(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}
