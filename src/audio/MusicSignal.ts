import type { MusicFrame } from "../core";

export interface MusicSignal {
  sample(timeSeconds: number): MusicFrame;
}
