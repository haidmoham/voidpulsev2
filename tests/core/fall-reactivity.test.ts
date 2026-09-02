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
  it("uses estimated BPM for sustained terminal speed, not intensity", () => {
    const slowLoud = settleFall({ ...frame({ intensity: 1, low: 1 }), estimatedBpm: 70 });
    const fastQuiet = settleFall({ ...SILENT, estimatedBpm: 160 });
    const unknownTempo = settleFall({ ...SILENT, estimatedBpm: 0 });

    expect(slowLoud.velocity).toBeCloseTo(5.833_333, 2);
    expect(fastQuiet.velocity).toBeCloseTo(13.333_333, 2);
    expect(unknownTempo.velocity).toBeCloseTo(6, 2);
    expect(fastQuiet.velocity).toBeGreaterThan(slowLoud.velocity);
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

    expect(step.reactivity.gravityWeight).toBeCloseTo(0.055, 8);
    expect(step.reactivity.currentPresence).toBeCloseTo(0.04, 8);
    expect(step.reactivity.dustPresence).toBeCloseTo(0.045, 8);
    expect(step.reactivity.soundstageScale).toBeCloseTo(1.12, 8);
    expect(step.reactivity.lateralPull).toBeCloseTo(-0.6, 8);
  });

  it("creates one bounded onset wake and recovers deterministically", () => {
    const fall: FallState = { distance: 24, velocity: 8, intensity: 0.3 };
    const onset = { ...frame({ transient: 1 }), onset: true };
    const first = advanceReactivity(INITIAL_REACTIVITY_STATE, fall, onset, 4, 1 / 60);
    const held = advanceReactivity(first.state, fall, onset, 4 + 1 / 60, 1 / 60);
    const recovered = advanceReactivity(held.state, fall, SILENT, 5, 0.1);

    expect(first.reactivity.wakeEnergy).toBeCloseTo(0.66, 8);
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
});
