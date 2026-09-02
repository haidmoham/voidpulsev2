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
  readonly low?: number;
  /** Stable analyser estimate; zero means tempo is not established yet. */
  readonly estimatedBpm?: number;
}

/** Maps total descent distance onto the endlessly repeating world corridor. */
export function wrapFallDistance(distance: number): number {
  return ((distance % FALL_LOOP_DEPTH) + FALL_LOOP_DEPTH) % FALL_LOOP_DEPTH;
}

/**
 * Advances descent without mutating the previous state. Estimated BPM sets the
 * sustained terminal velocity; intensity and bass only shape convergence.
 */
export function advanceFall(
  previous: FallState,
  input: FallControl,
  deltaSeconds: number,
  defaults: Readonly<FallDefaults> = FALL_DEFAULTS,
): FallState {
  const delta = clamp(deltaSeconds, 0, defaults.maxDeltaSeconds);
  const intensity = clamp(input.intensity, 0, 1);
  const low = clamp(input.low ?? 0, 0, 1);
  const bpm = sanitizeTempo(input.estimatedBpm, defaults);
  const smoothing = 1 - Math.exp(-delta * defaults.intensitySmoothingRate);
  const smoothedIntensity = previous.intensity + (intensity - previous.intensity) * smoothing;

  const tempoProgress = (bpm - defaults.minimumTempoBpm) /
    (defaults.maximumTempoBpm - defaults.minimumTempoBpm);
  const targetVelocity = defaults.minimumTerminalVelocity + tempoProgress *
    (defaults.maximumTerminalVelocity - defaults.minimumTerminalVelocity);
  const responseRate = defaults.responseRate + smoothedIntensity * defaults.intensityAccelerationGain +
    low * defaults.bassAccelerationGain;
  const inertia = 1 - Math.exp(-delta * responseRate);
  const velocity = previous.velocity + (targetVelocity - previous.velocity) * inertia;

  return {
    distance: previous.distance + velocity * delta,
    velocity,
    intensity: smoothedIntensity,
  };
}

function sanitizeTempo(value: number | undefined, defaults: Readonly<FallDefaults>): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? clamp(value, defaults.minimumTempoBpm, defaults.maximumTempoBpm)
    : defaults.fallbackTempoBpm;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
