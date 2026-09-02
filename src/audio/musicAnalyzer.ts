import type { MusicFrame } from "../core";

export interface FrequencyBand {
  readonly startHz: number;
  readonly endHz: number;
}

/**
 * Typed defaults retained from the last pre-topology Voidpulse audio engine.
 * The release weights are expressed at 60 Hz and transformed for each frame.
 */
export interface MusicAnalyzerConfig {
  readonly lowBand: FrequencyBand;
  readonly midBand: FrequencyBand;
  readonly highBand: FrequencyBand;
  readonly lowReleasePreviousWeightAt60: number;
  readonly midReleasePreviousWeightAt60: number;
  readonly highReleasePreviousWeightAt60: number;
  readonly onsetEnvelopePreviousWeightAt60: number;
  readonly onsetThresholdRatio: number;
  readonly onsetThreshold: number;
  readonly onsetCooldownSeconds: number;
  readonly onsetRecoveryPreviousWeightAt60: number;
  readonly bpmMinimum: number;
  readonly bpmMaximum: number;
  readonly bpmHistorySize: number;
  readonly maximumDeltaSeconds: number;
  readonly intensityNoiseFloor: number;
  readonly intensityGain: number;
  readonly intensityAttackSeconds: number;
  readonly intensityReleaseSeconds: number;
  readonly stereoSmoothingSeconds: number;
}

/** Browser-node settings kept beside the analyzer values they support. */
export const DISPLAY_ANALYZER_DEFAULTS = {
  latencyHint: "interactive" as const,
  fftSize: 1024,
  smoothingTimeConstant: 0.78,
  stereoFftSize: 1024,
} as const;

export const MUSIC_ANALYZER_DEFAULTS: MusicAnalyzerConfig = {
  lowBand: { startHz: 40, endHz: 260 },
  midBand: { startHz: 300, endHz: 2_000 },
  highBand: { startHz: 2_000, endHz: 11_000 },
  lowReleasePreviousWeightAt60: 0.88,
  midReleasePreviousWeightAt60: 0.82,
  highReleasePreviousWeightAt60: 0.78,
  onsetEnvelopePreviousWeightAt60: 0.88,
  onsetThresholdRatio: 1.25,
  onsetThreshold: 0.11,
  onsetCooldownSeconds: 0.24,
  onsetRecoveryPreviousWeightAt60: 0.82,
  bpmMinimum: 60,
  bpmMaximum: 200,
  bpmHistorySize: 8,
  maximumDeltaSeconds: 0.1,
  intensityNoiseFloor: 0.012,
  intensityGain: 5,
  intensityAttackSeconds: 0.045,
  intensityReleaseSeconds: 0.25,
  stereoSmoothingSeconds: 0.12,
};

export interface MusicAnalyzerInput {
  readonly spectrum: Uint8Array<ArrayBufferLike>;
  readonly timeDomain: Float32Array<ArrayBufferLike>;
  readonly leftChannel: Float32Array<ArrayBufferLike> | null;
  readonly rightChannel: Float32Array<ArrayBufferLike> | null;
  readonly sampleRate: number;
  readonly fftSize: number;
  readonly deltaSeconds: number;
  readonly hasStereo: boolean;
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

interface ReusableMusicAnalyzerInput {
  spectrum: Uint8Array<ArrayBufferLike>;
  timeDomain: Float32Array<ArrayBufferLike>;
  leftChannel: Float32Array<ArrayBufferLike> | null;
  rightChannel: Float32Array<ArrayBufferLike> | null;
  sampleRate: number;
  fftSize: number;
  deltaSeconds: number;
  hasStereo: boolean;
}

const EMPTY_SPECTRUM = new Uint8Array(0);
const EMPTY_TIME_DOMAIN = new Float32Array(0);

/**
 * Persistent analyzer state. The interval ring is allocated only when a
 * source starts, never while frames are sampled.
 */
export interface MusicAnalyzerState {
  intensity: number;
  low: number;
  mid: number;
  high: number;
  bassEnvelope: number;
  onsetRecovery: number;
  secondsSinceLastOnset: number;
  hasSeenOnset: boolean;
  bpm: number;
  bpmIntervals: Float64Array<ArrayBuffer>;
  bpmIntervalCount: number;
  bpmIntervalCursor: number;
  balance: number;
  width: number;
}

/** A reusable deterministic analyzer: it reads no browser state and allocates no frame data. */
export class MusicAnalyzer {
  private readonly state: MusicAnalyzerState;
  private readonly frame: MutableMusicFrame = {
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
  private readonly input: ReusableMusicAnalyzerInput = {
    spectrum: EMPTY_SPECTRUM,
    timeDomain: EMPTY_TIME_DOMAIN,
    leftChannel: null,
    rightChannel: null,
    sampleRate: 0,
    fftSize: 0,
    deltaSeconds: 0,
    hasStereo: false,
  };

  constructor(private readonly config: MusicAnalyzerConfig = MUSIC_ANALYZER_DEFAULTS) {
    this.state = createMusicAnalyzerState(config);
  }

  sample(input: MusicAnalyzerInput): MusicFrame {
    updateMusicAnalyzer(this.state, this.frame, input, this.config);
    return this.frame;
  }

  /** Adapter entrypoint that reuses the analyzer-owned input holder. */
  sampleBuffers(
    spectrum: Uint8Array<ArrayBufferLike>,
    timeDomain: Float32Array<ArrayBufferLike>,
    leftChannel: Float32Array<ArrayBufferLike> | null,
    rightChannel: Float32Array<ArrayBufferLike> | null,
    sampleRate: number,
    fftSize: number,
    deltaSeconds: number,
    hasStereo: boolean,
  ): MusicFrame {
    this.input.spectrum = spectrum;
    this.input.timeDomain = timeDomain;
    this.input.leftChannel = leftChannel;
    this.input.rightChannel = rightChannel;
    this.input.sampleRate = sampleRate;
    this.input.fftSize = fftSize;
    this.input.deltaSeconds = deltaSeconds;
    this.input.hasStereo = hasStereo;
    updateMusicAnalyzer(this.state, this.frame, this.input, this.config);
    return this.frame;
  }

  reset(): void {
    resetMusicAnalyzerState(this.state);
    resetMusicFrame(this.frame);
  }
}

export function createMusicAnalyzerState(
  config: MusicAnalyzerConfig = MUSIC_ANALYZER_DEFAULTS,
): MusicAnalyzerState {
  return {
    intensity: 0,
    low: 0,
    mid: 0,
    high: 0,
    bassEnvelope: 0,
    onsetRecovery: 0,
    secondsSinceLastOnset: 0,
    hasSeenOnset: false,
    bpm: 0,
    bpmIntervals: new Float64Array(config.bpmHistorySize),
    bpmIntervalCount: 0,
    bpmIntervalCursor: 0,
    balance: 0,
    width: 0,
  };
}

export function resetMusicAnalyzerState(state: MusicAnalyzerState): void {
  state.intensity = 0;
  state.low = 0;
  state.mid = 0;
  state.high = 0;
  state.bassEnvelope = 0;
  state.onsetRecovery = 0;
  state.secondsSinceLastOnset = 0;
  state.hasSeenOnset = false;
  state.bpm = 0;
  state.bpmIntervals.fill(0);
  state.bpmIntervalCount = 0;
  state.bpmIntervalCursor = 0;
  state.balance = 0;
  state.width = 0;
}

export const SILENT_MUSIC_FRAME: MusicFrame = Object.freeze({
  intensity: 0,
  transient: 0,
  onset: false,
  estimatedBpm: 0,
  low: 0,
  mid: 0,
  high: 0,
  balance: 0,
  width: 0,
});

/**
 * Updates supplied reusable state and frame from reusable Web Audio buffers.
 * It is deterministic for the input buffers, state, configuration, and delta.
 */
export function updateMusicAnalyzer(
  state: MusicAnalyzerState,
  frame: MutableMusicFrame,
  input: MusicAnalyzerInput,
  config: MusicAnalyzerConfig = MUSIC_ANALYZER_DEFAULTS,
): void {
  const deltaSeconds = clampDelta(input.deltaSeconds, config.maximumDeltaSeconds);
  const rawLow = frequencyBandEnergy(input.spectrum, config.lowBand, input.sampleRate, input.fftSize);
  const rawMid = frequencyBandEnergy(input.spectrum, config.midBand, input.sampleRate, input.fftSize);
  const rawHigh = frequencyBandEnergy(input.spectrum, config.highBand, input.sampleRate, input.fftSize);

  state.low = smoothBand(state.low, rawLow, config.lowReleasePreviousWeightAt60, deltaSeconds);
  state.mid = smoothBand(state.mid, rawMid, config.midReleasePreviousWeightAt60, deltaSeconds);
  state.high = smoothBand(state.high, rawHigh, config.highReleasePreviousWeightAt60, deltaSeconds);

  const intensityTarget = intensityTargetFromSamples(input.timeDomain, config);
  const previousIntensity = state.intensity;
  state.intensity = smoothTimeConstant(
    state.intensity,
    intensityTarget,
    intensityTarget > state.intensity ? config.intensityAttackSeconds : config.intensityReleaseSeconds,
    deltaSeconds,
  );

  state.bassEnvelope = smoothRelease(
    state.bassEnvelope,
    rawLow,
    config.onsetEnvelopePreviousWeightAt60,
    deltaSeconds,
  );
  state.secondsSinceLastOnset += deltaSeconds;
  state.onsetRecovery = smoothRelease(
    state.onsetRecovery,
    0,
    config.onsetRecoveryPreviousWeightAt60,
    deltaSeconds,
  );

  const onset = rawLow > state.bassEnvelope * config.onsetThresholdRatio
    && rawLow > config.onsetThreshold
    && (!state.hasSeenOnset || state.secondsSinceLastOnset >= config.onsetCooldownSeconds);
  if (onset) {
    const onsetStrength = clampUnit((rawLow - state.bassEnvelope) / Math.max(0.0001, 1 - state.bassEnvelope));
    state.onsetRecovery = Math.max(state.onsetRecovery, onsetStrength);
    recordOnset(state, config);
  }

  if (input.hasStereo && input.leftChannel !== null && input.rightChannel !== null) {
    updateStereo(state, input.leftChannel, input.rightChannel, config.stereoSmoothingSeconds, deltaSeconds);
  } else {
    state.balance = 0;
    state.width = 0;
  }

  frame.intensity = clampUnit(state.intensity);
  frame.transient = clampUnit(Math.max((intensityTarget - previousIntensity) * 2.5, state.onsetRecovery));
  frame.onset = onset;
  frame.estimatedBpm = finiteNonNegative(state.bpm);
  frame.low = clampUnit(state.low);
  frame.mid = clampUnit(state.mid);
  frame.high = clampUnit(state.high);
  frame.balance = clampSignedUnit(state.balance);
  frame.width = clampUnit(state.width);
}

export function frequencyBandEnergy(
  spectrum: Uint8Array<ArrayBufferLike>,
  band: FrequencyBand,
  sampleRate: number,
  fftSize: number,
): number {
  if (spectrum.length === 0 || !Number.isFinite(sampleRate) || !Number.isFinite(fftSize)
    || sampleRate <= 0 || fftSize <= 0) return 0;

  const hzPerBin = sampleRate / fftSize;
  const firstBin = Math.max(1, Math.ceil(band.startHz / hzPerBin));
  const lastBin = Math.min(spectrum.length - 1, Math.floor(band.endHz / hzPerBin));
  if (lastBin < firstBin) return 0;

  let total = 0;
  for (let index = firstBin; index <= lastBin; index += 1) total += spectrum[index] ?? 0;
  return clampUnit(total / ((lastBin - firstBin + 1) * 255));
}

function smoothBand(previous: number, target: number, releasePreviousWeightAt60: number, deltaSeconds: number): number {
  return target >= previous
    ? target
    : smoothRelease(previous, target, releasePreviousWeightAt60, deltaSeconds);
}

function smoothRelease(previous: number, target: number, previousWeightAt60: number, deltaSeconds: number): number {
  const previousWeight = Math.pow(previousWeightAt60, deltaSeconds * 60);
  return previous * previousWeight + target * (1 - previousWeight);
}

function smoothTimeConstant(previous: number, target: number, timeConstantSeconds: number, deltaSeconds: number): number {
  if (timeConstantSeconds <= 0) return target;
  const blend = 1 - Math.exp(-deltaSeconds / timeConstantSeconds);
  return previous + (target - previous) * blend;
}

function intensityTargetFromSamples(
  samples: Float32Array<ArrayBufferLike>,
  config: MusicAnalyzerConfig,
): number {
  const rms = rootMeanSquare(samples);
  const gained = Math.max(0, rms - config.intensityNoiseFloor) * config.intensityGain;
  return clampUnit(gained / (0.2 + gained));
}

function recordOnset(state: MusicAnalyzerState, config: MusicAnalyzerConfig): void {
  if (state.hasSeenOnset) {
    const interval = state.secondsSinceLastOnset;
    const fastestInterval = 60 / config.bpmMaximum;
    const slowestInterval = 60 / config.bpmMinimum;
    if (interval >= fastestInterval && interval <= slowestInterval) {
      state.bpmIntervals[state.bpmIntervalCursor] = interval;
      state.bpmIntervalCursor = (state.bpmIntervalCursor + 1) % state.bpmIntervals.length;
      state.bpmIntervalCount = Math.min(state.bpmIntervalCount + 1, state.bpmIntervals.length);
      let intervalTotal = 0;
      for (let index = 0; index < state.bpmIntervalCount; index += 1) intervalTotal += state.bpmIntervals[index] ?? 0;
      state.bpm = 60 / (intervalTotal / state.bpmIntervalCount);
    }
  }
  state.hasSeenOnset = true;
  state.secondsSinceLastOnset = 0;
}

function updateStereo(
  state: MusicAnalyzerState,
  left: Float32Array<ArrayBufferLike>,
  right: Float32Array<ArrayBufferLike>,
  smoothingSeconds: number,
  deltaSeconds: number,
): void {
  const sampleCount = Math.min(left.length, right.length);
  if (sampleCount === 0) {
    state.balance = 0;
    state.width = 0;
    return;
  }

  let leftSquares = 0;
  let rightSquares = 0;
  let sideSquares = 0;
  let midSquares = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const leftSample = finiteSample(left[index]);
    const rightSample = finiteSample(right[index]);
    const side = (leftSample - rightSample) * 0.5;
    const mid = (leftSample + rightSample) * 0.5;
    leftSquares += leftSample * leftSample;
    rightSquares += rightSample * rightSample;
    sideSquares += side * side;
    midSquares += mid * mid;
  }

  const leftLevel = Math.sqrt(leftSquares / sampleCount);
  const rightLevel = Math.sqrt(rightSquares / sampleCount);
  const balanceDenominator = leftLevel + rightLevel;
  const sideLevel = Math.sqrt(sideSquares / sampleCount);
  const midLevel = Math.sqrt(midSquares / sampleCount);
  const widthDenominator = sideLevel + midLevel;
  const balance = balanceDenominator > 0.0001
    ? clampSignedUnit((rightLevel - leftLevel) / balanceDenominator)
    : 0;
  const width = widthDenominator > 0.0001 ? clampUnit(sideLevel / widthDenominator) : 0;
  state.balance = smoothTimeConstant(state.balance, balance, smoothingSeconds, deltaSeconds);
  state.width = smoothTimeConstant(state.width, width, smoothingSeconds, deltaSeconds);
}

function rootMeanSquare(samples: Float32Array<ArrayBufferLike>): number {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = finiteSample(samples[index]);
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / samples.length);
}

function resetMusicFrame(frame: MutableMusicFrame): void {
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

function clampDelta(deltaSeconds: number, maximumDeltaSeconds: number): number {
  if (!Number.isFinite(deltaSeconds)) return 0;
  return Math.min(Math.max(0, deltaSeconds), maximumDeltaSeconds);
}

function finiteSample(sample: number | undefined): number {
  return Number.isFinite(sample) ? sample ?? 0 : 0;
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function clampUnit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function clampSignedUnit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(-1, value)) : 0;
}
