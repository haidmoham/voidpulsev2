import type { MusicFrame } from "../core";
import type { MusicSignal } from "./MusicSignal";

/** The original in-browser ambient current used while no audio source is bound. */
export class ProceduralCurrentSignal implements MusicSignal {
  sample(timeSeconds: number): MusicFrame {
    const breath = 0.5 + 0.5 * Math.sin(timeSeconds * 0.55);
    const pulse = Math.max(0, Math.sin(timeSeconds * 2.1)) ** 10;
    const onset = Math.sin(timeSeconds * 2.1) > 0.996;
    const intensity = Math.min(1, 0.08 + breath * 0.42 + pulse * 0.5);

    return {
      intensity,
      transient: pulse,
      onset,
      estimatedBpm: 120,
      low: intensity * 0.78,
      mid: intensity * 0.58,
      high: intensity * 0.42,
      balance: Math.sin(timeSeconds * 0.19) * 0.18,
      width: 0.48 + breath * 0.2,
    };
  }
}
