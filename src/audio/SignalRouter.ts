import type { MusicFrame } from "../core";
import type { MusicSignal } from "./MusicSignal";

/**
 * Chooses the intensity source consumed by the simulation without coupling it
 * to any particular input mechanism.
 */
export class SignalRouter implements MusicSignal {
  private activeSignal: MusicSignal | null = null;

  constructor(private readonly fallbackSignal: MusicSignal) {}

  get currentSignal(): MusicSignal {
    return this.activeSignal ?? this.fallbackSignal;
  }

  get usingFallback(): boolean {
    return this.activeSignal === null;
  }

  select(signal: MusicSignal): void {
    this.activeSignal = signal;
  }

  reset(): void {
    this.activeSignal = null;
  }

  sample(timeSeconds: number): MusicFrame {
    return this.currentSignal.sample(timeSeconds);
  }
}
