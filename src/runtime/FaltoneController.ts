import type { MusicSignal } from "../audio/MusicSignal";
import {
  advanceFall,
  advanceReactivity,
  INITIAL_FALL_STATE,
  INITIAL_REACTIVITY_STATE,
  type FallState,
  type MusicFrame,
  type ReactivityState,
  type WorldFrame,
} from "../core";

export interface WorldRenderer {
  render(frame: WorldFrame): void;
  resize(): void;
  dispose(): void;
}

export interface FrameScheduler {
  request(callback: (timeMilliseconds: number) => void): number;
  cancel(handle: number): void;
}

export interface FaltoneControllerOptions {
  signal: MusicSignal;
  renderer: WorldRenderer;
  onMusicFrame?: (music: MusicFrame) => void;
  scheduler?: FrameScheduler;
}

const BROWSER_FRAME_SCHEDULER: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

/** Owns time and simulation state while delegating input and rendering. */
export class FaltoneController {
  private readonly signal: MusicSignal;
  private readonly renderer: WorldRenderer;
  private readonly onMusicFrame: ((music: MusicFrame) => void) | undefined;
  private readonly scheduler: FrameScheduler;
  private fallState: FallState = INITIAL_FALL_STATE;
  private reactivityState: ReactivityState = INITIAL_REACTIVITY_STATE;
  private previousTime: number | null = null;
  private frameHandle: number | null = null;

  constructor(options: FaltoneControllerOptions) {
    this.signal = options.signal;
    this.renderer = options.renderer;
    this.onMusicFrame = options.onMusicFrame;
    this.scheduler = options.scheduler ?? BROWSER_FRAME_SCHEDULER;
  }

  start(): void {
    if (this.frameHandle !== null) return;
    this.frameHandle = this.scheduler.request(this.frame);
  }

  stop(): void {
    if (this.frameHandle !== null) this.scheduler.cancel(this.frameHandle);
    this.frameHandle = null;
    this.previousTime = null;
  }

  resize(): void {
    this.renderer.resize();
  }

  dispose(): void {
    this.stop();
    this.renderer.dispose();
  }

  private readonly frame = (timeMilliseconds: number): void => {
    const timeSeconds = timeMilliseconds / 1000;
    const deltaSeconds = this.previousTime === null
      ? 1 / 60
      : Math.min(0.1, Math.max(0, timeSeconds - this.previousTime));
    const music = this.signal.sample(timeSeconds);
    const fall = advanceFall(this.fallState, music, deltaSeconds);
    const step = advanceReactivity(
      this.reactivityState,
      fall,
      music,
      timeSeconds,
      deltaSeconds,
    );
    const frame: WorldFrame = {
      timeSeconds,
      deltaSeconds,
      fall,
      reactivity: step.reactivity,
    };

    this.fallState = fall;
    this.reactivityState = step.state;
    this.previousTime = timeSeconds;
    this.onMusicFrame?.(music);
    this.renderer.render(frame);
    this.frameHandle = this.scheduler.request(this.frame);
  };
}
