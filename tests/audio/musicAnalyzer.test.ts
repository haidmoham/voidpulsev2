import { describe, expect, it } from "vitest";
import { SignalRouter } from "../../src/audio/SignalRouter";
import {
  frequencyBandEnergy,
  MusicAnalyzer,
  MUSIC_ANALYZER_DEFAULTS,
  type FrequencyBand,
} from "../../src/audio/musicAnalyzer";
import type { MusicFrame } from "../../src/core/types";

const FFT_SIZE = 1_024;
const FRAME = 1 / 60;
const SILENCE = new Uint8Array(FFT_SIZE / 2);
const QUIET_SAMPLES = new Float32Array(FFT_SIZE);
const BAND_CASES = [
  { name: "low", band: MUSIC_ANALYZER_DEFAULTS.lowBand },
  { name: "mid", band: MUSIC_ANALYZER_DEFAULTS.midBand },
  { name: "high", band: MUSIC_ANALYZER_DEFAULTS.highBand },
] satisfies readonly {
  readonly name: "low" | "mid" | "high";
  readonly band: FrequencyBand;
}[];

function spectrumForBand(band: FrequencyBand, sampleRate: number): Uint8Array {
  const spectrum = new Uint8Array(FFT_SIZE / 2);
  const hzPerBin = sampleRate / FFT_SIZE;
  for (
    let index = Math.max(1, Math.ceil(band.startHz / hzPerBin));
    index <= Math.floor(band.endHz / hzPerBin);
    index += 1
  ) spectrum[index] = 255;
  return spectrum;
}

function sample(
  analyzer: MusicAnalyzer,
  spectrum: Uint8Array,
  options: {
    sampleRate?: number;
    deltaSeconds?: number;
    left?: Float32Array | null;
    right?: Float32Array | null;
    hasStereo?: boolean;
  } = {},
) {
  return analyzer.sampleBuffers(
    spectrum,
    QUIET_SAMPLES,
    options.left ?? null,
    options.right ?? null,
    options.sampleRate ?? 44_100,
    FFT_SIZE,
    options.deltaSeconds ?? FRAME,
    options.hasStereo ?? false,
  );
}

function expectDocumentedRanges(frame: MusicFrame): void {
  const unitValues = [
    frame.intensity,
    frame.transient,
    frame.low,
    frame.mid,
    frame.high,
    frame.width,
  ];
  expect(unitValues.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
  expect(Number.isFinite(frame.balance) && frame.balance >= -1 && frame.balance <= 1).toBe(true);
  expect(Number.isFinite(frame.estimatedBpm) && frame.estimatedBpm >= 0 && frame.estimatedBpm <= 200).toBe(true);
}

describe("music analyzer bands", () => {
  it.each([44_100, 48_000])("uses Hz bands without semantic-band leakage at %d Hz", (sampleRate) => {
    for (const { name, band } of BAND_CASES) {
      const analyzer = new MusicAnalyzer();
      const frame = sample(analyzer, spectrumForBand(band, sampleRate), { sampleRate });
      for (const { name: candidate } of BAND_CASES) {
        expect(frame[candidate]).toBe(candidate === name ? 1 : 0);
      }
      expectDocumentedRanges(frame);
    }
  });

  it("selects only bins whose center frequencies fall inside a band", () => {
    const spectrum = new Uint8Array(FFT_SIZE / 2);
    spectrum[1] = 255;
    expect(frequencyBandEnergy(spectrum, MUSIC_ANALYZER_DEFAULTS.lowBand, 44_100, FFT_SIZE)).toBe(1 / 6);
  });

  it.each([
    ["low", MUSIC_ANALYZER_DEFAULTS.lowBand, 0.88],
    ["mid", MUSIC_ANALYZER_DEFAULTS.midBand, 0.82],
    ["high", MUSIC_ANALYZER_DEFAULTS.highBand, 0.78],
  ] as const)("snaps %s on attack and reproduces its 60 Hz release", (name, band, releaseWeight) => {
    const analyzer = new MusicAnalyzer();
    expect(sample(analyzer, spectrumForBand(band, 44_100))[name]).toBe(1);
    expect(sample(analyzer, SILENCE)[name]).toBeCloseTo(releaseWeight, 12);
  });
});

describe("music analyzer onset and tempo", () => {
  it("honors threshold and cooldown boundaries, then recovers without re-triggering sustained bass", () => {
    const low = spectrumForBand(MUSIC_ANALYZER_DEFAULTS.lowBand, 44_100);
    const atThreshold = new MusicAnalyzer({
      ...MUSIC_ANALYZER_DEFAULTS,
      onsetThreshold: 1,
    });
    expect(sample(atThreshold, low).onset).toBe(false);

    const aboveThreshold = new MusicAnalyzer({
      ...MUSIC_ANALYZER_DEFAULTS,
      onsetThreshold: 0.99,
    });
    expect(sample(aboveThreshold, low).onset).toBe(true);

    const cooldownStep = 0.1;
    const cooldown = cooldownStep * 2;
    const cooldownAnalyzer = new MusicAnalyzer({
      ...MUSIC_ANALYZER_DEFAULTS,
      onsetCooldownSeconds: cooldown,
    });
    expect(sample(cooldownAnalyzer, low, { deltaSeconds: 0 }).onset).toBe(true);
    sample(cooldownAnalyzer, SILENCE, { deltaSeconds: cooldownStep });
    expect(sample(cooldownAnalyzer, low, { deltaSeconds: 0 }).onset).toBe(false);
    sample(cooldownAnalyzer, SILENCE, { deltaSeconds: cooldownStep });
    expect(sample(cooldownAnalyzer, low, { deltaSeconds: 0 }).onset).toBe(true);

    const analyzer = new MusicAnalyzer();
    const first = { ...sample(analyzer, low) };
    expect(first.onset).toBe(true);
    expect(first.transient).toBeGreaterThan(0);

    for (let index = 0; index < 30; index += 1) {
      const held = sample(analyzer, low);
      expect(held.onset).toBe(false);
    }
    const recovery = sample(analyzer, SILENCE);
    expect(recovery.onset).toBe(false);
    expect(recovery.transient).toBeGreaterThan(0);
  });

  it("estimates a stable BPM from accepted onset intervals", () => {
    const analyzer = new MusicAnalyzer();
    const low = spectrumForBand(MUSIC_ANALYZER_DEFAULTS.lowBand, 44_100);
    sample(analyzer, low);
    for (let index = 0; index < 29; index += 1) sample(analyzer, SILENCE);
    const second = sample(analyzer, low);
    expect(second.onset).toBe(true);
    expect(second.estimatedBpm).toBeCloseTo(120, 8);
    for (let index = 0; index < 29; index += 1) sample(analyzer, SILENCE);
    const third = sample(analyzer, low);
    expect(third.estimatedBpm).toBeCloseTo(120, 8);
  });
});

describe("music analyzer soundstage", () => {
  it("maps hard pans and identical, separated, and silent stereo to bounded balance and width", () => {
    const left = new Float32Array(FFT_SIZE).fill(0.2);
    const right = new Float32Array(FFT_SIZE).fill(-0.2);
    const identical = new Float32Array(FFT_SIZE).fill(0.2);
    const silent = new Float32Array(FFT_SIZE);
    const settleStereo = (leftChannel: Float32Array, rightChannel: Float32Array): MusicFrame => {
      const analyzer = new MusicAnalyzer();
      for (let index = 0; index < 60; index += 1) {
        sample(analyzer, SILENCE, { left: leftChannel, right: rightChannel, hasStereo: true });
      }
      return sample(analyzer, SILENCE, { left: leftChannel, right: rightChannel, hasStereo: true });
    };

    const hardLeft = settleStereo(left, silent);
    expect(hardLeft.balance).toBeLessThan(-0.99);
    expectDocumentedRanges(hardLeft);

    const hardRight = settleStereo(silent, left);
    expect(hardRight.balance).toBeGreaterThan(0.99);
    expectDocumentedRanges(hardRight);

    const identicalStereo = settleStereo(identical, identical);
    expect(identicalStereo.balance).toBeCloseTo(0, 6);
    expect(identicalStereo.width).toBeCloseTo(0, 6);
    expectDocumentedRanges(identicalStereo);

    const separatedStereo = settleStereo(left, right);
    expect(separatedStereo.balance).toBeCloseTo(0, 6);
    expect(separatedStereo.width).toBeGreaterThan(0.99);
    expectDocumentedRanges(separatedStereo);

    const silentStereo = settleStereo(silent, silent);
    expect(silentStereo.balance).toBe(0);
    expect(silentStereo.width).toBe(0);
    expectDocumentedRanges(silentStereo);

    const analyzer = new MusicAnalyzer();
    for (let index = 0; index < 60; index += 1) {
      sample(analyzer, SILENCE, { left, right, hasStereo: true });
    }
    const stereo = sample(analyzer, SILENCE, { left, right, hasStereo: true });
    expect(stereo.balance).toBeCloseTo(0, 6);
    expect(stereo.width).toBeGreaterThan(0.99);

    const mono = sample(analyzer, SILENCE);
    expect(mono.balance).toBe(0);
    expect(mono.width).toBe(0);
    expect(mono.onset).toBe(false);
    expectDocumentedRanges(mono);
  });

  it("resets a deselected analyzer so its onset and BPM cannot return with a later source", () => {
    const low = spectrumForBand(MUSIC_ANALYZER_DEFAULTS.lowBand, 44_100);
    const analyzer = new MusicAnalyzer();
    const fresh = new MusicAnalyzer();
    const source = {
      sample: () => sample(analyzer, low),
      reset: () => analyzer.reset(),
    };
    const replacement = { sample: () => sample(fresh, SILENCE) };
    const router = new SignalRouter(replacement);

    router.select(source);
    sample(analyzer, low);
    for (let index = 0; index < 29; index += 1) sample(analyzer, SILENCE);
    expect(sample(analyzer, low).estimatedBpm).toBeCloseTo(120, 8);

    router.select(replacement);
    expect(router.sample(FRAME).low).toBe(0);
    const restarted = analyzer.sampleBuffers(
      SILENCE,
      QUIET_SAMPLES,
      null,
      null,
      44_100,
      FFT_SIZE,
      FRAME,
      false,
    );
    expect(restarted.onset).toBe(false);
    expect(restarted.estimatedBpm).toBe(0);
    expect(restarted.low).toBe(0);
  });
});
