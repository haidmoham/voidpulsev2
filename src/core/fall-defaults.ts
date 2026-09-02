/** Tunable, renderer-independent policy for sustained descent. */
export interface FallDefaults {
  readonly maxDeltaSeconds: number;
  readonly intensitySmoothingRate: number;
  readonly responseRate: number;
  readonly intensityAccelerationGain: number;
  readonly bassAccelerationGain: number;
  readonly minimumTempoBpm: number;
  readonly maximumTempoBpm: number;
  readonly fallbackTempoBpm: number;
  readonly minimumTerminalVelocity: number;
  readonly maximumTerminalVelocity: number;
}

/**
 * Tempo owns sustained speed. Intensity and bass only make convergence feel
 * heavier or lighter, so a loud passage cannot silently replace the BPM pace.
 */
export const FALL_DEFAULTS: Readonly<FallDefaults> = Object.freeze({
  maxDeltaSeconds: 0.1,
  intensitySmoothingRate: 2.4,
  responseRate: 1.05,
  intensityAccelerationGain: 1.35,
  bassAccelerationGain: 1.1,
  minimumTempoBpm: 60,
  maximumTempoBpm: 180,
  fallbackTempoBpm: 72,
  minimumTerminalVelocity: 5,
  maximumTerminalVelocity: 15,
});
