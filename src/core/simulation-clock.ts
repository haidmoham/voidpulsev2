import { FALL_DEFAULTS } from "./fall-defaults";

export interface SimulationTimeStep {
  readonly timeSeconds: number;
  readonly deltaSeconds: number;
}

/**
 * Keeps visual evolution on the same bounded timebase as fall and reactivity.
 * The wall clock can hitch; the simulation must not jump its visual phases.
 */
export function advanceSimulationTime(
  previousTimeSeconds: number,
  rawDeltaSeconds: number,
  maximumDeltaSeconds = FALL_DEFAULTS.maxDeltaSeconds,
): SimulationTimeStep {
  const maximum = finiteNonNegative(maximumDeltaSeconds, FALL_DEFAULTS.maxDeltaSeconds);
  const deltaSeconds = Math.min(maximum, finiteNonNegative(rawDeltaSeconds, 0));
  const timeSeconds = finiteNonNegative(previousTimeSeconds, 0) + deltaSeconds;
  return { timeSeconds, deltaSeconds };
}

function finiteNonNegative(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
