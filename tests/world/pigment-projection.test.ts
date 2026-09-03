import { describe, expect, it } from "vitest";
import { FALL_LOOP_DEPTH } from "../../src/core";
import {
  PIGMENT_NEAR_FADE_END,
  PIGMENT_NEAR_FADE_START,
  PIGMENT_PROJECTION_ANCHOR_DEPTH,
  pigmentCoverage,
  projectedPigmentScale,
} from "../../src/world/pigment-projection";

describe("pigment projection", () => {
  it("fully fades a just-wrapped sprite before it can cover the viewport", () => {
    expect(pigmentCoverage(0)).toBe(0);
    expect(pigmentCoverage(PIGMENT_NEAR_FADE_START)).toBe(0);
    expect(pigmentCoverage(PIGMENT_NEAR_FADE_END)).toBe(1);
  });

  it("preserves perspective-driven optic flow with constant world-space sprites", () => {
    const near = projectedPigmentScale(PIGMENT_NEAR_FADE_END + 2);
    const distant = projectedPigmentScale(FALL_LOOP_DEPTH);

    expect(near).toBeGreaterThan(distant);
    expect(distant).toBe(PIGMENT_PROJECTION_ANCHOR_DEPTH / FALL_LOOP_DEPTH);
    expect(pigmentCoverage(FALL_LOOP_DEPTH)).toBe(1);
  });

  it("keeps malformed depth inputs renderer-safe", () => {
    expect(pigmentCoverage(Number.NaN)).toBe(0);
    expect(pigmentCoverage(Infinity)).toBe(0);
  });
});
