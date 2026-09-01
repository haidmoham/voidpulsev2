import type { FallState, ReactivityState, ReactivityStep } from "./types";
import { FALL_LOOP_DEPTH, wrapFallDistance } from "./fall-model";

export const INITIAL_REACTIVITY_STATE: ReactivityState = Object.freeze({
  previousIntensity: 0,
  wakeEnergy: 0,
});

/**
 * Derives the frame-level world response from the current fall state without
 * retaining renderer or clock state.
 */
export function advanceReactivity(
  previous: ReactivityState,
  fallState: FallState,
  timeSeconds: number,
  deltaSeconds: number,
): ReactivityStep {
  const cameraDepth = wrapFallDistance(fallState.distance);
  const intensityRise = Math.max(0, fallState.intensity - previous.previousIntensity);
  const wakeEnergy = Math.min(
    1,
    previous.wakeEnergy * Math.exp(-deltaSeconds * 1.4) + intensityRise * 5,
  );
  const depthPhase = cameraDepth / FALL_LOOP_DEPTH * Math.PI * 2;
  const weather = 0.5 + 0.5 * Math.sin(depthPhase - timeSeconds * 0.035);
  const breath = 0.5 + 0.5 * Math.sin(timeSeconds * 0.16);
  const paletteDrift = 0.5 + 0.5 * Math.sin(timeSeconds * 0.025 + depthPhase * 0.35);

  return {
    state: {
      previousIntensity: fallState.intensity,
      wakeEnergy,
    },
    reactivity: {
      cameraDepth,
      intensityRise,
      wakeEnergy,
      depthPhase,
      weather,
      breath,
      paletteDrift,
    },
  };
}
