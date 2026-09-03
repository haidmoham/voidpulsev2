import { wrapFallDistance } from "../core";

/** Reduced motion stays perceptible because locomotion is Faltone's meaning. */
export const REDUCED_MOTION_SCALE = 0.28;

export function spatialMotionScale(reducedMotion: boolean): number {
  return reducedMotion ? REDUCED_MOTION_SCALE : 1;
}

export function spatialFallDepth(totalDistance: number, reducedMotion: boolean): number {
  return wrapFallDistance(totalDistance * spatialMotionScale(reducedMotion));
}
