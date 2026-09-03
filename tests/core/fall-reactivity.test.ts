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
import { advanceSimulationTime } from "../../src/core/simulation-clock";
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

function advanceFallForOneSecond(refreshRate: number, estimatedBpm: number): FallState {
  let state = INITIAL_FALL_STATE;
  for (let index = 0; index < refreshRate; index += 1) {
    state = advanceFall(state, { ...SILENT, estimatedBpm }, 1 / refreshRate);
  }
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

  it("establishes a BPM-owned descent during the first second", () => {
    const fast = advanceFallForOneSecond(60, 180);
    const slow = advanceFallForOneSecond(60, 60);

    expect(fast.distance).toBeGreaterThan(8);
    expect(fast.velocity).toBeGreaterThan(14.5);
    expect(slow.distance).toBeLessThan(fast.distance);
    expect(slow.velocity).toBeLessThan(fast.velocity);
  });

  it("keeps first-second descent stable across 30, 60, and 120 Hz", () => {
    const samples = [30, 60, 120].map((refreshRate) =>
      advanceFallForOneSecond(refreshRate, 180));
    const distances = samples.map(({ distance }) => distance);
    const velocities = samples.map(({ velocity }) => velocity);

    expect(Math.max(...distances) - Math.min(...distances)).toBeLessThan(0.2);
    expect(Math.max(...velocities) - Math.min(...velocities)).toBeLessThan(0.000_001);
  });
});

describe("simulation time", () => {
  it("advances visual time only by the clamped simulation delta through a hitch", () => {
    const hitch = advanceSimulationTime(2, 1);

    expect(hitch.deltaSeconds).toBe(0.1);
    expect(hitch.timeSeconds).toBe(2.1);
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

    expect(step.reactivity.gravityWeight).toBeGreaterThan(0);
    expect(step.reactivity.gravityWeight).toBeLessThan(0.55);
    expect(step.reactivity.currentPresence).toBeGreaterThan(0);
    expect(step.reactivity.currentPresence).toBeLessThan(0.4);
    expect(step.reactivity.dustPresence).toBeGreaterThan(0);
    expect(step.reactivity.dustPresence).toBeLessThan(0.45);
    expect(step.reactivity.soundstageScale).toBeGreaterThan(1);
    expect(step.reactivity.soundstageScale).toBeLessThan(2.2);
    expect(step.reactivity.lateralPull).toBeGreaterThan(-6);
    expect(step.reactivity.lateralPull).toBeLessThan(0);
    expect(step.reactivity.chromaBoost).toBeGreaterThan(0);
    expect(step.reactivity.chromaBoost).toBeLessThan(0.1);
    expect(step.reactivity.lightGain).toBeGreaterThan(0);
    expect(step.reactivity.lightGain).toBeLessThan(0.1);
  });

  it("settles bounded motion responses without allowing one frame to snap the world", () => {
    const fall: FallState = { distance: 24, velocity: 8, intensity: 0.3 };
    const music = frame({ low: 1, mid: 1, high: 1, transient: 1, balance: -1, width: 1 });
    let reactivity = INITIAL_REACTIVITY_STATE;
    let step = advanceReactivity(reactivity, fall, { ...music, onset: true }, 4, 1 / 60);
    reactivity = step.state;

    expect(step.reactivity.transientPulse).toBeGreaterThan(0);
    expect(step.reactivity.transientPulse).toBeLessThan(0.1);

    for (let index = 1; index <= 240; index += 1) {
      step = advanceReactivity(reactivity, fall, { ...music, onset: false, transient: 0 }, 4 + index / 60, 1 / 60);
      reactivity = step.state;
    }

    expect(step.reactivity.gravityWeight).toBeCloseTo(0.55, 3);
    expect(step.reactivity.currentPresence).toBeCloseTo(0.4, 3);
    expect(step.reactivity.dustPresence).toBeCloseTo(0.45, 3);
    expect(step.reactivity.soundstageScale).toBeCloseTo(2.2, 3);
    expect(step.reactivity.lateralPull).toBeCloseTo(-6, 3);
    expect(step.reactivity.chromaBoost).toBeCloseTo(1, 3);
    expect(step.reactivity.lightGain).toBeCloseTo(0.456, 3);
    expect(step.reactivity.transientPulse).toBeLessThan(0.01);
  });

  it("settles spatial and full-field responses consistently across refresh rates", () => {
    const music = frame({ intensity: 1, low: 1, mid: 1, high: 1, balance: 1, width: 1 });
    const fall: FallState = { distance: 24, velocity: 8, intensity: 1 };
    const samples = [30, 60, 120].map((refreshRate) => {
      let state = INITIAL_REACTIVITY_STATE;
      let result = advanceReactivity(state, fall, music, 0, 1 / refreshRate);
      state = result.state;
      for (let index = 1; index < refreshRate; index += 1) {
        result = advanceReactivity(state, fall, music, index / refreshRate, 1 / refreshRate);
        state = result.state;
      }
      return result.reactivity;
    });

    for (const sample of samples.slice(1)) {
      expect(sample.soundstageScale).toBeCloseTo(samples[0]?.soundstageScale ?? 0, 10);
      expect(sample.lateralPull).toBeCloseTo(samples[0]?.lateralPull ?? 0, 10);
      expect(sample.chromaBoost).toBeCloseTo(samples[0]?.chromaBoost ?? 0, 10);
      // The first-frame intensity-rise impulse is sampled once per cadence;
      // its one-second remainder stays visually negligible.
      expect(sample.lightGain).toBeCloseTo(samples[0]?.lightGain ?? 0, 3);
    }
  });

  it("creates one bounded onset wake and recovers deterministically", () => {
    const fall: FallState = { distance: 24, velocity: 8, intensity: 0.3 };
    const onset = { ...frame({ transient: 1 }), onset: true };
    const first = advanceReactivity(INITIAL_REACTIVITY_STATE, fall, onset, 4, 1 / 60);
    const held = advanceReactivity(first.state, fall, onset, 4 + 1 / 60, 1 / 60);
    const recovered = advanceReactivity(held.state, fall, SILENT, 5, 0.1);

    expect(first.reactivity.wakeEnergy).toBe(1);
    expect(first.reactivity.wakeRingOpacity).toBeGreaterThan(0);
    expect(first.reactivity.wakeRingOpacity).toBeLessThan(0.1);
    expect(first.reactivity.transientPulse).toBeGreaterThan(0);
    expect(first.reactivity.transientPulse).toBeLessThan(1);
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
