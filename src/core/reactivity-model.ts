import type { FallState, MusicFrame, ReactivityState, ReactivityStep } from "./types";
import { FALL_LOOP_DEPTH, wrapFallDistance } from "./fall-model";
import { REACTIVITY_DEFAULTS, type ReactivityDefaults } from "./reactivity-defaults";

export const INITIAL_REACTIVITY_STATE: ReactivityState = Object.freeze({
  previousIntensity: 0,
  wakeEnergy: 0,
  onsetCooldown: 0,
});

/**
 * The sole policy boundary from a music frame to renderer-ready world values.
 */
export function advanceReactivity(
  previous: ReactivityState,
  fallState: FallState,
  music: MusicFrame,
  timeSeconds: number,
  deltaSeconds: number,
  defaults?: Readonly<ReactivityDefaults>,
): ReactivityStep {
  const policy = defaults ?? REACTIVITY_DEFAULTS;
  const delta = clampFinite(deltaSeconds, 0, policy.maxDeltaSeconds);
  const cameraDepth = wrapFallDistance(finiteOr(fallState.distance, 0));
  const intensity = clampFinite(fallState.intensity, 0, 1);
  const previousIntensity = clampFinite(previous.previousIntensity, 0, 1);
  const intensityRise = clampFinite(intensity - previousIntensity, 0, policy.intensityRiseMax);
  const onsetCooldown = clampFinite(previousOnsetCooldown(previous) - delta, 0, policy.onsetCooldownSeconds);
  const onset = onsetCooldown === 0 && music.onset;
  const wakeEnergy = clampFinite(
    clampFinite(previous.wakeEnergy, 0, 1) * Math.exp(-delta * policy.wakeRecoveryRate) +
      (onset ? policy.onsetWakeImpulse : 0),
    0,
    1,
  );
  const depthPhase = cameraDepth / FALL_LOOP_DEPTH * Math.PI * 2;
  const time = finiteOr(timeSeconds, 0);
  const weather = 0.5 + 0.5 * Math.sin(depthPhase - time * 0.035);
  const breath = 0.5 + 0.5 * Math.sin(time * 0.16);
  const paletteDrift = 0.5 + 0.5 * Math.sin(time * 0.025 + depthPhase * 0.35);
  const low = clampFinite(music.low, 0, 1);
  const mid = clampFinite(music.mid, 0, 1);
  const high = clampFinite(music.high, 0, 1);
  const transient = clampFinite(music.transient, 0, 1);
  const balance = clampFinite(music.balance, -1, 1);
  const width = clampFinite(music.width, 0, 1);
  const chromaBoost = clampFinite(
    (low * 0.2 + mid * 0.65 + high) * policy.chromaBoostMax,
    0,
    policy.chromaBoostMax,
  );
  const lightGain = clampFinite(
    (intensity * 0.72 + intensityRise * 0.8 + high * 0.24) * policy.lightGainMax,
    0,
    policy.lightGainMax,
  );
  const transientPulse = clampFinite(
    Math.max(transient, wakeEnergy) * policy.transientPulseMax,
    0,
    policy.transientPulseMax,
  );

  return {
    state: {
      previousIntensity: intensity,
      wakeEnergy,
      onsetCooldown: onset ? policy.onsetCooldownSeconds : onsetCooldown,
    },
    reactivity: {
      cameraDepth,
      intensityRise,
      wakeEnergy,
      depthPhase,
      weather,
      breath,
      paletteDrift,
      soundstageScale: 1 + width * policy.widthExpansionMax,
      dustPresence: high * policy.highDustPresenceMax,
      currentPresence: mid * policy.midCurrentPresenceMax,
      gravityWeight: low * policy.lowGravityWeightMax,
      lateralPull: balance * (policy.balanceBasePull + width * policy.balanceWidthPull),
      wakeRingOpacity: wakeEnergy * policy.transientRingOpacityMax,
      chromaBoost,
      lightGain,
      transientPulse,
    },
  };
}

function previousOnsetCooldown(previous: ReactivityState): number {
  return Number.isFinite(previous.onsetCooldown) ? previous.onsetCooldown ?? 0 : 0;
}

function clampFinite(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}
