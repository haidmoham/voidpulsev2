import type { FallState } from "./types";
import { FALL_DEFAULTS, type FallDefaults } from "./fall-defaults";

export const FALL_LOOP_DEPTH = 180;

export const INITIAL_FALL_STATE: FallState = Object.freeze({
  distance: 0,
  velocity: 0,
  intensity: 0,
});

/** The analyser-owned inputs needed by the descent policy. */
export interface FallControl {
  readonly intensity: number;
  /** Stable analyser estimate; zero means tempo is not established yet. */
  readonly estimatedBpm?: number;
}

/** Maps total descent distance onto the endlessly repeating world corridor. */
export function wrapFallDistance(distance: number): number {
  return ((distance % FALL_LOOP_DEPTH) + FALL_LOOP_DEPTH) % FALL_LOOP_DEPTH;
}

/**
 * Advances descent without mutating the previous state. Estimated BPM sets the
 * sustained terminal velocity. Other audio features are intentionally absent
 * from this policy so they cannot alter fall speed or convergence.
 */
export function advanceFall(
  previous: FallState,
  input: FallControl,
  deltaSeconds: number,
  defaults: Readonly<FallDefaults> = FALL_DEFAULTS,
): FallState {
  const delta = clampFinite(deltaSeconds, 0, defaults.maxDeltaSeconds);
  const intensity = clampFinite(input.intensity, 0, 1);
  const bpm = sanitizeTempo(input.estimatedBpm, defaults);
  const smoothing = 1 - Math.exp(-delta * defaults.intensitySmoothingRate);
  const previousIntensity = clampFinite(previous.intensity, 0, 1);
  const smoothedIntensity = previousIntensity + (intensity - previousIntensity) * smoothing;

  const tempoProgress = (bpm - defaults.minimumTempoBpm) /
    (defaults.maximumTempoBpm - defaults.minimumTempoBpm);
  const targetVelocity = defaults.minimumTerminalVelocity + tempoProgress *
    (defaults.maximumTerminalVelocity - defaults.minimumTerminalVelocity);
  const inertia = 1 - Math.exp(-delta * defaults.responseRate);
  const previousVelocity = clampFinite(previous.velocity, 0, defaults.maximumTerminalVelocity);
  const velocity = clampFinite(
    previousVelocity + (targetVelocity - previousVelocity) * inertia,
    0,
    defaults.maximumTerminalVelocity,
  );
  const distance = finiteOr(previous.distance, 0) + velocity * delta;

  return {
    distance: finiteOr(distance, 0),
    velocity,
    intensity: smoothedIntensity,
  };
}

function sanitizeTempo(value: number | undefined, defaults: Readonly<FallDefaults>): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? clampFinite(value, defaults.minimumTempoBpm, defaults.maximumTempoBpm)
    : defaults.fallbackTempoBpm;
}

function clampFinite(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}
