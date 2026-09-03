import { describe, expect, it } from "vitest";
import {
  polygonDanceScale,
  polygonVoice,
  type PolygonDanceFrame,
  type PolygonDanceSeed,
} from "../../src/world/polygon-motion";

const SEED: PolygonDanceSeed = {
  x: -14,
  z: 8,
  phase: 0.4,
  voice: 0,
  beatPolarity: 1,
  playfulness: 1,
};

const MUSIC: PolygonDanceFrame = {
  timeSeconds: 0,
  motionScale: 1,
  low: 1,
  mid: 0.72,
  high: 0.45,
  transient: 0,
  width: 1,
  pan: 0,
};

describe("polygon music motion", () => {
  it("cycles deterministic low, mid, and high voices", () => {
    expect([0, 1, 2, 3, 4].map(polygonVoice)).toEqual([0, 1, 2, 0, 1]);
  });

  it("rests at the authored scale in silence", () => {
    expect(polygonDanceScale(SEED, { ...MUSIC, low: 0, mid: 0, high: 0 })).toBe(1);
  });

  it("crosses above and below the authored scale while music is active", () => {
    const scales = Array.from({ length: 360 }, (_, index) =>
      polygonDanceScale(SEED, { ...MUSIC, timeSeconds: index / 60 }));

    expect(Math.min(...scales)).toBeLessThan(0.85);
    expect(Math.max(...scales)).toBeGreaterThan(1.35);
  });

  it("spatializes stereo energy toward the matching side", () => {
    const left = polygonDanceScale(SEED, { ...MUSIC, timeSeconds: 0.5, pan: -1 });
    const right = polygonDanceScale({ ...SEED, x: 14 }, {
      ...MUSIC,
      timeSeconds: 0.5,
      pan: -1,
    });

    expect(Math.abs(left - 1)).toBeGreaterThan(Math.abs(right - 1) * 1.7);
  });

  it("gives low, mid, and high polygons distinct spectral personalities", () => {
    const bassFrame = { ...MUSIC, mid: 0, high: 0, width: 0 };
    const bass = polygonDanceScale(SEED, bassFrame);
    const treble = polygonDanceScale({ ...SEED, voice: 2 }, bassFrame);

    expect(Math.abs(bass - 1)).toBeGreaterThan(Math.abs(treble - 1));
  });

  it("keeps reduced motion musical but gentler", () => {
    const full = polygonDanceScale(SEED, { ...MUSIC, timeSeconds: 0.5, transient: 1 });
    const reduced = polygonDanceScale(SEED, {
      ...MUSIC,
      timeSeconds: 0.5,
      transient: 1,
      motionScale: 0.28,
    });

    expect(reduced).not.toBe(1);
    expect(Math.abs(reduced - 1)).toBeLessThan(Math.abs(full - 1));
  });

  it("smoothly approaches but never pins to safety caps for valid music", () => {
    const scales = [-1, 0, 1].flatMap((pan) =>
      [-1, 1].flatMap((beatPolarity) =>
        Array.from({ length: 360 }, (_, index) => polygonDanceScale(
          { ...SEED, beatPolarity, playfulness: 1.18 },
          {
            ...MUSIC,
            timeSeconds: index / 60,
            low: 1,
            mid: 1,
            high: 1,
            transient: 1,
            pan,
          },
          1,
        ))),
    );

    expect(Math.min(...scales)).toBeGreaterThan(0.52);
    expect(Math.max(...scales)).toBeLessThan(2.65);
  });

  it("stays finite and bounded for malformed input", () => {
    const scale = polygonDanceScale(
      { ...SEED, x: Number.NaN, playfulness: Infinity },
      { ...MUSIC, high: Infinity, pan: Number.NaN, timeSeconds: Infinity },
      Infinity,
    );

    expect(Number.isFinite(scale)).toBe(true);
    expect(scale).toBeGreaterThanOrEqual(0.52);
    expect(scale).toBeLessThanOrEqual(2.65);
  });
});
