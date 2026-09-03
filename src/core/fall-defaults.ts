/** Tunable, renderer-independent policy for sustained descent. */
export interface FallDefaults {
  readonly maxDeltaSeconds: number;
  readonly intensitySmoothingRate: number;
  readonly responseRate: number;
  readonly minimumTempoBpm: number;
  readonly maximumTempoBpm: number;
  readonly fallbackTempoBpm: number;
  readonly minimumTerminalVelocity: number;
  readonly maximumTerminalVelocity: number;
}

/**
 * Tempo is the only audio control of fall velocity. Intensity is retained as
 * renderer input, never as a descent-control input.
 */
export const FALL_DEFAULTS: Readonly<FallDefaults> = Object.freeze({
  maxDeltaSeconds: 0.1,
  intensitySmoothingRate: 2.4,
  responseRate: 1.05,
  minimumTempoBpm: 60,
  maximumTempoBpm: 180,
  fallbackTempoBpm: 72,
  minimumTerminalVelocity: 5,
  maximumTerminalVelocity: 15,
});
