export type PolygonVoice = 0 | 1 | 2;

export interface PolygonDanceSeed {
  readonly x: number;
  readonly z: number;
  readonly phase: number;
  readonly voice: PolygonVoice;
  /** Alternates beat hits between expansion and compression across the field. */
  readonly beatPolarity: 1 | -1;
  readonly playfulness: number;
}

export interface PolygonDanceFrame {
  readonly timeSeconds: number;
  readonly motionScale: number;
  readonly low: number;
  readonly mid: number;
  readonly high: number;
  readonly transient: number;
  readonly width: number;
  readonly pan: number;
}

const MIN_SCALE = 0.52;
const MAX_SCALE = 2.65;

export function polygonVoice(index: number): PolygonVoice {
  const voice = Math.abs(Math.trunc(finiteOr(index, 0))) % 3;
  if (voice === 0) return 0;
  if (voice === 1) return 1;
  return 2;
}

/**
 * Turns spectral energy into a spatial, bipolar scale envelope. Quiet returns
 * exactly to the authored size; music makes every voice cross above and below it.
 */
export function polygonDanceScale(
  seed: Readonly<PolygonDanceSeed>,
  frame: Readonly<PolygonDanceFrame>,
  localWake = 0,
): number {
  const low = clamp01(frame.low);
  const mid = clamp01(frame.mid);
  const high = clamp01(frame.high);
  const transient = clamp01(frame.transient);
  const wake = clamp01(localWake);
  const width = clamp01(frame.width);
  const pan = clamp(finiteOr(frame.pan, 0), -1, 1);
  const motionScale = clamp01(frame.motionScale);
  const playfulness = clamp(finiteOr(seed.playfulness, 1), 0, 1.5);
  const time = finiteOr(frame.timeSeconds, 0);
  const phase = finiteOr(seed.phase, 0);
  const x = finiteOr(seed.x, 0);
  const z = finiteOr(seed.z, 0);
  const primary = primaryBand(seed.voice, low, mid, high);
  const support = (low + mid + high - primary) * 0.5;
  const musicPresence = Math.max(low, mid, high, transient, wake);

  if (musicPresence === 0 || motionScale === 0 || playfulness === 0) return 1;

  const side = clamp(x / 18, -1, 1);
  const radius = clamp(Math.hypot(x, z) / 22, 0, 1);
  const panGain = clamp(1 + pan * side * 0.42, 0.58, 1.42);
  const widthGain = clamp(1 + width * (radius * 0.48 - 0.08), 0.92, 1.4);
  const spatialGain = panGain * widthGain;
  const rate = 1.72 + seed.voice * 0.58;
  const travellingPhase = phase + z * 0.13 + width * radius * Math.PI * 0.7;
  const primaryDrive = primary * 0.78 + support * 0.22;
  const breath = Math.sin(time * rate + travellingPhase) * 0.32;
  const counterBreath = Math.sin(time * rate * 0.47 - phase * 0.73 + radius * 4.2) * 0.12;
  const breathing = (breath + counterBreath) * musicPresence * (0.38 + primaryDrive * 0.92);
  const beatDirection = seed.beatPolarity === 1 ? 1 : -0.68;
  const beat = transient * beatDirection * (0.34 + primaryDrive * 0.36);
  const wakeSurge = wake * (0.22 + Math.max(0, breath) * 0.48);
  const pressure = (breathing + beat + wakeSurge) * spatialGain * playfulness * motionScale;
  const delta = Math.tanh(pressure * 0.72) * (pressure >= 0 ? 1.25 : 0.46);

  return clamp(1 + delta, MIN_SCALE, MAX_SCALE);
}

function primaryBand(voice: PolygonVoice, low: number, mid: number, high: number): number {
  if (voice === 0) return low;
  if (voice === 1) return mid;
  return high;
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
  return clamp(finiteOr(value, 0), 0, 1);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
