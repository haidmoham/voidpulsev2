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
  /** A single threshold-crossing event; false on all recovery frames. */
  readonly onset: boolean;
  /** Stable onset-interval estimate in beats per minute, or zero until established. */
  readonly estimatedBpm: number;
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
  /** Remaining recovery time so one onset cannot repeatedly fire a wake. */
  readonly onsetCooldown?: number;
  /** Low-pass state for spatial responses; optional for backwards-safe callers. */
  readonly soundstagePresence?: number;
  readonly dustPresence?: number;
  readonly currentPresence?: number;
  readonly gravityWeight?: number;
  readonly lateralPull?: number;
  readonly transientPulse?: number;
  /** Full-field material pressure is smoothed separately from a local onset. */
  readonly chromaBoost?: number;
  readonly lightGain?: number;
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
  /** Stereo width opens the field, without altering its topology. */
  readonly soundstageScale: number;
  /** High-frequency material presence, intentionally overshot but bounded. */
  readonly dustPresence: number;
  /** Mid-frequency current presence, kept separate from camera motion. */
  readonly currentPresence: number;
  /** Low-frequency gravity/body weight. */
  readonly gravityWeight: number;
  /** Stereo balance mapped to a restrained horizontal pull. */
  readonly lateralPull: number;
  /** The bounded visual remainder of a discrete onset. */
  readonly wakeRingOpacity: number;
  /** Spectral colour pressure for renderer materials, from 0 to 1. */
  readonly chromaBoost: number;
  /** Intensity-derived light pressure for renderer lights/materials, from 0 to 1. */
  readonly lightGain: number;
  /** Immediate transient/onset pressure for renderer pulses, from 0 to 1. */
  readonly transientPulse: number;
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
  readonly fall: FallState;
  readonly reactivity: ReactivityFrame;
}
