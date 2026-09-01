import type { FallState } from "./types";

export const FALL_LOOP_DEPTH = 180;

export const INITIAL_FALL_STATE: FallState = Object.freeze({
  distance: 0,
  velocity: 0,
  intensity: 0,
});

/** Maps total descent distance onto the endlessly repeating world corridor. */
export function wrapFallDistance(distance: number): number {
  return ((distance % FALL_LOOP_DEPTH) + FALL_LOOP_DEPTH) % FALL_LOOP_DEPTH;
}

/**
 * Advances the descent using the same smoothing and inertia equations as the
 * original FallDynamics instance, without mutating the previous state.
 */
export function advanceFall(
  previous: FallState,
  rawIntensity: number,
  deltaSeconds: number,
): FallState {
  const intensity = Math.min(1, Math.max(0, rawIntensity));
  const smoothing = 1 - Math.exp(-deltaSeconds * 2.4);
  const smoothedIntensity = previous.intensity + (intensity - previous.intensity) * smoothing;

  const targetVelocity = 1.2 + smoothedIntensity * 12;
  const inertia = 1 - Math.exp(-deltaSeconds * 1.35);
  const velocity = previous.velocity + (targetVelocity - previous.velocity) * inertia;

  return {
    distance: previous.distance + velocity * deltaSeconds,
    velocity,
    intensity: smoothedIntensity,
  };
}
