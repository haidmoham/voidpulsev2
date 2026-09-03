import { describe, expect, it } from "vitest";
import { ReactivityDemoSignal } from "../../src/audio/ReactivityDemoSignal";

describe("reactivity demo signal", () => {
  it("alternates the full capped music envelope with a quiet comparison window", () => {
    const signal = new ReactivityDemoSignal();

    const first = { ...signal.sample(10) };
    const sustained = { ...signal.sample(10.2) };
    const quiet = { ...signal.sample(12.75) };

    expect(first).toMatchObject({
      intensity: 1,
      transient: 1,
      onset: true,
      estimatedBpm: 180,
      low: 1,
      mid: 1,
      high: 1,
      width: 1,
    });
    expect(Math.abs(first.balance)).toBeLessThanOrEqual(1);
    expect(sustained.onset).toBe(false);
    expect(quiet).toEqual({
      intensity: 0,
      transient: 0,
      onset: false,
      estimatedBpm: 0,
      low: 0,
      mid: 0,
      high: 0,
      balance: 0,
      width: 0,
    });
  });

  it("restarts its comparison cycle when reset", () => {
    const signal = new ReactivityDemoSignal();

    signal.sample(4);
    signal.sample(6.8);
    signal.reset();

    expect(signal.sample(20).onset).toBe(true);
    expect(signal.sample(20).estimatedBpm).toBe(180);
  });
});
