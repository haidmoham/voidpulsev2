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
  const delta = clamp(deltaSeconds, 0, policy.maxDeltaSeconds);
  const cameraDepth = wrapFallDistance(fallState.distance);
  const intensityRise = Math.max(0, fallState.intensity - previous.previousIntensity);
  const onsetCooldown = Math.max(0, previousOnsetCooldown(previous) - delta);
  const onset = onsetCooldown === 0 && music.onset;
  const wakeEnergy = Math.min(1, previous.wakeEnergy * Math.exp(-delta * policy.wakeRecoveryRate) +
    (onset ? policy.onsetWakeImpulse : 0));
  const depthPhase = cameraDepth / FALL_LOOP_DEPTH * Math.PI * 2;
  const weather = 0.5 + 0.5 * Math.sin(depthPhase - timeSeconds * 0.035);
  const breath = 0.5 + 0.5 * Math.sin(timeSeconds * 0.16);
  const paletteDrift = 0.5 + 0.5 * Math.sin(timeSeconds * 0.025 + depthPhase * 0.35);
  const low = clamp(music.low, 0, 1);
  const mid = clamp(music.mid, 0, 1);
  const high = clamp(music.high, 0, 1);
  const balance = clamp(music.balance, -1, 1);
  const width = clamp(music.width, 0, 1);

  return {
    state: {
      previousIntensity: fallState.intensity,
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
    },
  };
}

function previousOnsetCooldown(previous: ReactivityState): number {
  return Number.isFinite(previous.onsetCooldown) ? previous.onsetCooldown ?? 0 : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
