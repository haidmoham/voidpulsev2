/** The persistent kinematic state of the descent. */
export interface FallState {
  readonly distance: number;
  readonly velocity: number;
  readonly intensity: number;
}

/** Perceptual music features sampled without altering or replaying the audio. */
export interface MusicFrame {
  readonly intensity: number;
  readonly transient: number;
  readonly low: number;
  readonly mid: number;
  readonly high: number;
  readonly balance: number;
  readonly width: number;
}

/** The persistent values needed to calculate the next world-reactivity frame. */
export interface ReactivityState {
  readonly previousIntensity: number;
  readonly wakeEnergy: number;
}

/** Deterministic world values derived for one rendered frame. */
export interface ReactivityFrame {
  readonly cameraDepth: number;
  readonly intensityRise: number;
  readonly wakeEnergy: number;
  readonly depthPhase: number;
  readonly weather: number;
  readonly breath: number;
  readonly paletteDrift: number;
}

/** The next persistent reactivity state and its derived frame values. */
export interface ReactivityStep {
  readonly state: ReactivityState;
  readonly reactivity: ReactivityFrame;
}

/** Complete renderer-independent simulation values for one frame. */
export interface WorldFrame {
  readonly timeSeconds: number;
  readonly deltaSeconds: number;
  readonly music: MusicFrame;
  readonly fall: FallState;
  readonly reactivity: ReactivityFrame;
}
