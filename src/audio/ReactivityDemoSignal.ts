import type { MusicFrame } from "../core";
import type { MusicSignal } from "./MusicSignal";

const ACTIVE_SECONDS = 2.4;
const CYCLE_SECONDS = 4;
const BEAT_SECONDS = 60 / 180;

/** A deliberate A/B demo that alternates a capped response with silence. */
export class ReactivityDemoSignal implements MusicSignal {
  private startedAt: number | null = null;
  private previousBeat = -1;
  private readonly frame: MutableMusicFrame = createEmptyFrame();

  sample(timeSeconds: number): MusicFrame {
    const safeTime = Number.isFinite(timeSeconds) ? timeSeconds : 0;
    this.startedAt ??= safeTime;
    const elapsed = Math.max(0, safeTime - this.startedAt);
    const cycleTime = elapsed % CYCLE_SECONDS;

    if (cycleTime >= ACTIVE_SECONDS) {
      this.previousBeat = -1;
      resetFrame(this.frame);
      return this.frame;
    }

    const beat = Math.floor(cycleTime / BEAT_SECONDS);
    const onset = beat !== this.previousBeat;
    this.frame.intensity = 1;
    this.frame.transient = onset ? 1 : 0;
    this.frame.onset = onset;
    this.frame.estimatedBpm = 180;
    this.frame.low = 1;
    this.frame.mid = 1;
    this.frame.high = 1;
    this.frame.balance = Math.sin(elapsed * Math.PI * 0.7);
    this.frame.width = 1;
    this.previousBeat = beat;
    return this.frame;
  }

  reset(): void {
    this.startedAt = null;
    this.previousBeat = -1;
    resetFrame(this.frame);
  }
}

interface MutableMusicFrame {
  intensity: number;
  transient: number;
  onset: boolean;
  estimatedBpm: number;
  low: number;
  mid: number;
  high: number;
  balance: number;
  width: number;
}

function createEmptyFrame(): MutableMusicFrame {
  return {
    intensity: 0,
    transient: 0,
    onset: false,
    estimatedBpm: 0,
    low: 0,
    mid: 0,
    high: 0,
    balance: 0,
    width: 0,
  };
}

function resetFrame(frame: MutableMusicFrame): void {
  frame.intensity = 0;
  frame.transient = 0;
  frame.onset = false;
  frame.estimatedBpm = 0;
  frame.low = 0;
  frame.mid = 0;
  frame.high = 0;
  frame.balance = 0;
  frame.width = 0;
}
