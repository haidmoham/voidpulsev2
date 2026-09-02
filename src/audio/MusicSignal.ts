import type { MusicFrame } from "../core";

export interface MusicSignal {
  sample(timeSeconds: number): MusicFrame;
  /** Clears source-local analysis state when the router no longer uses it. */
  reset?(): void;
}
