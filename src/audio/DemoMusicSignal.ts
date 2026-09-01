import type { MusicFrame } from "../core";
import type { MusicSignal } from "./MusicSignal";

/** A synthetic current used until the listener binds a live music source. */
export class DemoMusicSignal implements MusicSignal {
  sample(timeSeconds: number): MusicFrame {
    const breath = 0.5 + 0.5 * Math.sin(timeSeconds * 0.55);
    const pulse = Math.max(0, Math.sin(timeSeconds * 2.1)) ** 10;
    const intensity = Math.min(1, 0.08 + breath * 0.42 + pulse * 0.5);

    return {
      intensity,
      transient: pulse,
      low: intensity * 0.78,
      mid: intensity * 0.58,
      high: intensity * 0.42,
      balance: Math.sin(timeSeconds * 0.19) * 0.18,
      width: 0.48 + breath * 0.2,
    };
  }
}
