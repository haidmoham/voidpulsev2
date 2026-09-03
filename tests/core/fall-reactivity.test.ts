import { describe, expect, it } from "vitest";
import {
  advanceFall,
  FALL_LOOP_DEPTH,
  INITIAL_FALL_STATE,
  wrapFallDistance,
} from "../../src/core/fall-model";
import {
  advanceReactivity,
  INITIAL_REACTIVITY_STATE,
} from "../../src/core/reactivity-model";
import type { FallState, MusicFrame, ReactivityState } from "../../src/core/types";

const SILENT: MusicFrame = {
  intensity: 0,
  transient: 0,
  onset: false,
  estimatedBpm: 0,
  low: 0,
  mid: 0,
  high: 0,
  balance: 0,
  width: 0,
};

function frame(overrides: Partial<MusicFrame> = {}): MusicFrame {
  return { ...SILENT, ...overrides };
}

function settleFall(control: MusicFrame & { estimatedBpm: number }): FallState {
  let state = INITIAL_FALL_STATE;
  for (let index = 0; index < 600; index += 1) state = advanceFall(state, control, 1 / 60);
  return state;
}

describe("fall policy", () => {
  it("uses estimated BPM as the sole audio control of terminal speed", () => {
    const slowLoud = settleFall({ ...frame({ intensity: 1, low: 1 }), estimatedBpm: 70 });
    const slowQuiet = settleFall({ ...SILENT, estimatedBpm: 70 });
    const fastQuiet = settleFall({ ...SILENT, estimatedBpm: 160 });
    const unknownTempo = settleFall({ ...SILENT, estimatedBpm: 0 });

    expect(slowLoud.velocity).toBeCloseTo(5.833_333, 2);
    expect(fastQuiet.velocity).toBeCloseTo(13.333_333, 2);
    expect(unknownTempo.velocity).toBeCloseTo(6, 2);
    expect(slowLoud.velocity).toBeCloseTo(slowQuiet.velocity, 12);
    expect(fastQuiet.velocity).toBeGreaterThan(slowLoud.velocity);
  });

  it("keeps velocity convergence identical across non-tempo audio features", () => {
    const loud = advanceFall(
      INITIAL_FALL_STATE,
      { intensity: 1, estimatedBpm: 100 },
      1 / 60,
    );
    const quiet = advanceFall(
      INITIAL_FALL_STATE,
      { intensity: 0, estimatedBpm: 100 },
      1 / 60,
    );

    expect(loud.velocity).toBe(quiet.velocity);
    expect(loud.distance).toBe(quiet.distance);
    expect(loud.intensity).not.toBe(quiet.intensity);
  });

  it("clamps frame delta and keeps total distance outside the looping corridor", () => {
    const start: FallState = { distance: 179.9, velocity: 8, intensity: 0 };
    const input = { ...SILENT, estimatedBpm: 120 };
    const clamped = advanceFall(start, input, 1);
    const oneFrame = advanceFall(start, input, 0.1);

    expect(clamped).toEqual(oneFrame);
    expect(clamped.distance).toBeGreaterThan(FALL_LOOP_DEPTH);
    expect(wrapFallDistance(FALL_LOOP_DEPTH)).toBe(0);
    expect(wrapFallDistance(clamped.distance)).toBeCloseTo(clamped.distance - FALL_LOOP_DEPTH, 8);
  });
});

describe("reactivity policy", () => {
  it("preserves the quiet baseline while retaining independent world life", () => {
    const fall: FallState = { distance: 32, velocity: 6, intensity: 0 };
    const step = advanceReactivity(INITIAL_REACTIVITY_STATE, fall, SILENT, 12, 1 / 60);

    expect(step.reactivity.soundstageScale).toBe(1);
    expect(step.reactivity.dustPresence).toBe(0);
    expect(step.reactivity.currentPresence).toBe(0);
    expect(step.reactivity.gravityWeight).toBe(0);
    expect(step.reactivity.lateralPull).toBe(0);
    expect(step.reactivity.wakeEnergy).toBe(0);
    expect(step.reactivity.weather).toBeGreaterThan(0);
    expect(step.reactivity.breath).toBeGreaterThan(0);
  });

  it("assigns each spectral meaning to its one capped semantic output", () => {
    const fall: FallState = { distance: 24, velocity: 8, intensity: 0.3 };
    const step = advanceReactivity(
      INITIAL_REACTIVITY_STATE,
      fall,
      frame({ low: 1, mid: 1, high: 1, balance: -1, width: 1 }),
      4,
      1 / 60,
    );

    expect(step.reactivity.gravityWeight).toBeCloseTo(0.55, 8);
    expect(step.reactivity.currentPresence).toBeCloseTo(0.4, 8);
    expect(step.reactivity.dustPresence).toBeCloseTo(0.45, 8);
    expect(step.reactivity.soundstageScale).toBeCloseTo(2.2, 8);
    expect(step.reactivity.lateralPull).toBeCloseTo(-6, 8);
    expect(step.reactivity.chromaBoost).toBe(1);
  });

  it("creates one bounded onset wake and recovers deterministically", () => {
    const fall: FallState = { distance: 24, velocity: 8, intensity: 0.3 };
    const onset = { ...frame({ transient: 1 }), onset: true };
    const first = advanceReactivity(INITIAL_REACTIVITY_STATE, fall, onset, 4, 1 / 60);
    const held = advanceReactivity(first.state, fall, onset, 4 + 1 / 60, 1 / 60);
    const recovered = advanceReactivity(held.state, fall, SILENT, 5, 0.1);

    expect(first.reactivity.wakeEnergy).toBe(1);
    expect(first.reactivity.wakeRingOpacity).toBe(1);
    expect(first.reactivity.transientPulse).toBe(1);
    expect(held.reactivity.wakeEnergy).toBeLessThan(first.reactivity.wakeEnergy);
    expect(held.reactivity.wakeEnergy).toBeLessThanOrEqual(1);
    expect(recovered.reactivity.wakeEnergy).toBeLessThan(held.reactivity.wakeEnergy);
  });

  it("is deterministic for a fixed music sequence", () => {
    const sequence: readonly MusicFrame[] = [
      frame(),
      frame({ low: 0.7 }),
      frame({ mid: 0.4 }),
      frame({ high: 0.5 }),
    ];
    const run = () => {
      let fall = INITIAL_FALL_STATE;
      let reactivity: ReactivityState = INITIAL_REACTIVITY_STATE;
      for (let index = 0; index < sequence.length; index += 1) {
        const music = sequence[index];
        fall = advanceFall(fall, music, 1 / 60);
        reactivity = advanceReactivity(reactivity, fall, music, index / 60, 1 / 60).state;
      }
      return { fall, reactivity };
    };

    expect(run()).toEqual(run());
  });

  it("clamps malformed music and state inputs to finite renderer-safe values", () => {
    const corruptedFall: FallState = { distance: Number.NaN, velocity: Infinity, intensity: -Infinity };
    const corruptedMusic = frame({
      intensity: Number.NaN,
      transient: Infinity,
      low: Number.NaN,
      mid: Infinity,
      high: -Infinity,
      balance: Infinity,
      width: Number.NaN,
    });
    const step = advanceReactivity(
      { previousIntensity: Infinity, wakeEnergy: Number.NaN, onsetCooldown: Infinity },
      corruptedFall,
      corruptedMusic,
      Number.NaN,
      Infinity,
    );

    for (const value of Object.values(step.reactivity)) expect(Number.isFinite(value)).toBe(true);
    expect(step.reactivity.cameraDepth).toBeGreaterThanOrEqual(0);
    expect(step.reactivity.cameraDepth).toBeLessThan(FALL_LOOP_DEPTH);
    expect(step.reactivity.intensityRise).toBeGreaterThanOrEqual(0);
    expect(step.reactivity.intensityRise).toBeLessThanOrEqual(1);
    expect(step.reactivity.chromaBoost).toBeGreaterThanOrEqual(0);
    expect(step.reactivity.chromaBoost).toBeLessThanOrEqual(1);
    expect(step.reactivity.lightGain).toBeGreaterThanOrEqual(0);
    expect(step.reactivity.lightGain).toBeLessThanOrEqual(1);
    expect(step.reactivity.transientPulse).toBeGreaterThanOrEqual(0);
    expect(step.reactivity.transientPulse).toBeLessThanOrEqual(1);
  });
});
