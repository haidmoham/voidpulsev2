import { describe, expect, it } from "vitest";
import { SILENT_MUSIC_FRAME } from "../../src/audio/musicAnalyzer";
import type { WorldFrame } from "../../src/core";
import { FaltoneController, type FrameScheduler } from "../../src/runtime/FaltoneController";

class ManualFrameScheduler implements FrameScheduler {
  private nextHandle = 0;
  private readonly callbacks = new Map<number, (timeMilliseconds: number) => void>();

  request(callback: (timeMilliseconds: number) => void): number {
    const handle = ++this.nextHandle;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  advance(timeMilliseconds: number): void {
    const pending = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of pending) callback(timeMilliseconds);
  }
}

describe("controller pause", () => {
  it("preserves the descent and visual clock without counting paused wall time", () => {
    const scheduler = new ManualFrameScheduler();
    const frames: WorldFrame[] = [];
    const sampleTimes: number[] = [];
    const controller = new FaltoneController({
      scheduler,
      signal: {
        sample: (timeSeconds) => {
          sampleTimes.push(timeSeconds);
          return SILENT_MUSIC_FRAME;
        },
      },
      renderer: {
        render: (frame) => { frames.push(frame); },
        resize: () => {},
        dispose: () => {},
      },
    });

    controller.start();
    controller.start();
    scheduler.advance(1000);
    scheduler.advance(1050);
    controller.stop();
    scheduler.advance(60_000);
    expect(frames).toHaveLength(2);

    controller.start();
    scheduler.advance(120_000);
    expect(frames).toHaveLength(3);
    const beforePause = frames[1];
    const afterPause = frames[2];
    expect(afterPause.timeSeconds).toBeCloseTo(beforePause.timeSeconds + 1 / 60, 10);
    expect(afterPause.deltaSeconds).toBeCloseTo(1 / 60, 10);
    expect(afterPause.fall.distance).toBeGreaterThan(beforePause.fall.distance);
    expect(afterPause.fall.distance - beforePause.fall.distance).toBeLessThan(0.25);
    expect(afterPause.reactivity.breath).toBeCloseTo(beforePause.reactivity.breath, 2);
    expect(sampleTimes).toEqual([1, 1.05, 120]);
    controller.dispose();
    scheduler.advance(121_000);
    expect(frames).toHaveLength(3);
  });
});
