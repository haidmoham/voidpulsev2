import { describe, expect, it } from "vitest";
import {
  REDUCED_MOTION_SCALE,
  spatialFallDepth,
  spatialMotionScale,
} from "../../src/world/motion-preference";
import { FALL_LOOP_DEPTH } from "../../src/core";

describe("spatial motion preference", () => {
  it("keeps reduced motion perceptible without restoring full amplitude", () => {
    expect(spatialMotionScale(true)).toBe(REDUCED_MOTION_SCALE);
    expect(spatialMotionScale(true)).toBeGreaterThan(0);
    expect(spatialMotionScale(true)).toBeLessThan(1);
    expect(spatialMotionScale(false)).toBe(1);
  });

  it("slows total travel without resetting at the full-motion loop boundary", () => {
    expect(spatialFallDepth(FALL_LOOP_DEPTH, true)).toBeCloseTo(
      FALL_LOOP_DEPTH * REDUCED_MOTION_SCALE,
      10,
    );
    expect(spatialFallDepth(FALL_LOOP_DEPTH / REDUCED_MOTION_SCALE, true)).toBeCloseTo(0, 10);
  });
});
