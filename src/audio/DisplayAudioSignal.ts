import type { MusicFrame } from "../core";
import type { MusicSignal } from "./MusicSignal";

export type DisplayAudioState = "idle" | "starting" | "active" | "stopped" | "error";

type DisplayCaptureOptions = DisplayMediaStreamOptions & {
  video: MediaTrackConstraints & { displaySurface?: "browser" };
  selfBrowserSurface?: "exclude";
  systemAudio?: "include";
  windowAudio?: "system";
};

/**
 * A local-only signal from audio the user elects to share in the browser picker.
 * It never records, stores, uploads, or plays the captured stream.
 */
export class DisplayAudioSignal implements MusicSignal {
  status: DisplayAudioState = "idle";
  label = "Choose a tab with audio";

  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private splitter: ChannelSplitterNode | null = null;
  private leftAnalyser: AnalyserNode | null = null;
  private rightAnalyser: AnalyserNode | null = null;
  private timeSamples: Float32Array<ArrayBuffer> | null = null;
  private spectrumSamples: Uint8Array<ArrayBuffer> | null = null;
  private leftSamples: Float32Array<ArrayBuffer> | null = null;
  private rightSamples: Float32Array<ArrayBuffer> | null = null;
  private hasStereo = false;
  private value = 0;
  private lastSampleTime: number | null = null;
  private requestId = 0;
  private listeners = new Set<(signal: DisplayAudioSignal) => void>();

  subscribe(listener: (signal: DisplayAudioSignal) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Call directly from a user gesture so the browser can show its picker. */
  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      this.setState("error", "Display-audio capture is not supported in this browser.");
      throw new Error(this.label);
    }

    const requestId = ++this.requestId;
    this.release();
    this.setState("starting", "Choose a browser tab and enable Share audio.");

    const constraints: DisplayCaptureOptions = {
      audio: true,
      video: { displaySurface: "browser" },
      selfBrowserSurface: "exclude",
      systemAudio: "include",
      windowAudio: "system",
    };

    let stream: MediaStream;
    try {
      // This invocation intentionally happens before the first await in start().
      stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    } catch (error) {
      const cancelled = error instanceof DOMException &&
        (error.name === "AbortError" || error.name === "NotAllowedError");
      if (requestId === this.requestId) {
        this.setState(
          "error",
          cancelled ? "Screen sharing was cancelled." : "Could not start display-audio capture.",
        );
      }
      throw new Error(this.label, { cause: error });
    }

    if (requestId !== this.requestId) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      stream.getTracks().forEach((track) => track.stop());
      this.setState("error", "No audio was shared. Choose a tab and enable Share audio.");
      throw new Error(this.label);
    }

    try {
      // The video constraint exists only to open the browser's display picker.
      stream.getVideoTracks().forEach((track) => track.stop());
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      const splitter = context.createChannelSplitter(2);
      const leftAnalyser = context.createAnalyser();
      const rightAnalyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      leftAnalyser.fftSize = 1024;
      rightAnalyser.fftSize = 1024;
      source.connect(analyser);
      source.connect(splitter);
      splitter.connect(leftAnalyser, 0);
      splitter.connect(rightAnalyser, 1);

      this.stream = stream;
      this.context = context;
      this.source = source;
      this.analyser = analyser;
      this.splitter = splitter;
      this.leftAnalyser = leftAnalyser;
      this.rightAnalyser = rightAnalyser;
      this.timeSamples = new Float32Array(analyser.fftSize);
      this.spectrumSamples = new Uint8Array(analyser.frequencyBinCount);
      this.leftSamples = new Float32Array(leftAnalyser.fftSize);
      this.rightSamples = new Float32Array(rightAnalyser.fftSize);
      this.hasStereo = (audioTracks[0]?.getSettings().channelCount ?? source.channelCount) > 1;
      this.value = 0;
      this.lastSampleTime = null;
      stream.getTracks().forEach((track) => track.addEventListener("ended", () => {
        if (this.stream === stream) this.stop();
      }));
      if (context.state === "suspended") await context.resume();
      this.setState("active", "Listening to shared tab audio");
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      this.release();
      this.setState("error", "Could not analyze the shared audio.");
      throw new Error(this.label, { cause: error });
    }
  }

  sample(timeSeconds: number): MusicFrame {
    const analyser = this.analyser;
    const timeSamples = this.timeSamples;
    const spectrumSamples = this.spectrumSamples;
    const leftSamples = this.leftSamples;
    const rightSamples = this.rightSamples;
    if (
      !analyser
      || !timeSamples
      || !spectrumSamples
      || !leftSamples
      || !rightSamples
      || !this.leftAnalyser
      || !this.rightAnalyser
      || this.status !== "active"
    ) {
      return silentMusicFrame();
    }

    analyser.getFloatTimeDomainData(timeSamples);
    analyser.getByteFrequencyData(spectrumSamples);
    this.leftAnalyser.getFloatTimeDomainData(leftSamples);
    this.rightAnalyser.getFloatTimeDomainData(rightSamples);
    const rms = rootMeanSquare(timeSamples);

    const noiseFloor = 0.012;
    const gained = Math.max(0, rms - noiseFloor) * 5;
    const target = gained / (0.2 + gained); // soft compression: musical, not jumpy
    const transient = Math.max(0, target - this.value);
    const elapsed = this.lastSampleTime === null ? 1 / 60 : Math.max(0, timeSeconds - this.lastSampleTime);
    const timeConstant = target > this.value ? 0.045 : 0.25;
    const blend = 1 - Math.exp(-elapsed / timeConstant);
    this.value += (target - this.value) * blend;
    this.lastSampleTime = timeSeconds;

    const intensity = clampUnit(this.value);
    const leftLevel = rootMeanSquare(leftSamples);
    const rightLevel = rootMeanSquare(rightSamples);
    const balanceDenominator = leftLevel + rightLevel;

    return {
      intensity,
      transient: clampUnit(transient * 2.5),
      low: frequencyBandEnergy(spectrumSamples, 30, 250, analyser.context.sampleRate, analyser.fftSize),
      mid: frequencyBandEnergy(spectrumSamples, 250, 2_500, analyser.context.sampleRate, analyser.fftSize),
      high: frequencyBandEnergy(spectrumSamples, 2_500, 12_000, analyser.context.sampleRate, analyser.fftSize),
      balance: this.hasStereo && balanceDenominator > 0.0001
        ? Math.max(-1, Math.min(1, (rightLevel - leftLevel) / balanceDenominator))
        : 0,
      width: this.hasStereo ? stereoWidth(leftSamples, rightSamples) : 0,
    };
  }

  stop(): void {
    const wasCapturing = this.stream !== null || this.context !== null;
    this.requestId += 1;
    this.release();
    if (wasCapturing || this.status === "starting") {
      this.setState("stopped", "Display-audio capture stopped.");
    }
  }

  private release(): void {
    const stream = this.stream;
    const context = this.context;
    const source = this.source;
    const splitter = this.splitter;
    const leftAnalyser = this.leftAnalyser;
    const rightAnalyser = this.rightAnalyser;
    this.stream = null;
    this.context = null;
    this.source = null;
    this.analyser = null;
    this.splitter = null;
    this.leftAnalyser = null;
    this.rightAnalyser = null;
    this.timeSamples = null;
    this.spectrumSamples = null;
    this.leftSamples = null;
    this.rightSamples = null;
    this.hasStereo = false;
    this.value = 0;
    this.lastSampleTime = null;
    source?.disconnect();
    splitter?.disconnect();
    leftAnalyser?.disconnect();
    rightAnalyser?.disconnect();
    stream?.getTracks().forEach((track) => track.stop());
    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }

  private setState(status: DisplayAudioState, label: string): void {
    this.status = status;
    this.label = label;
    this.listeners.forEach((listener) => listener(this));
  }
}

function silentMusicFrame(): MusicFrame {
  return {
    intensity: 0,
    transient: 0,
    low: 0,
    mid: 0,
    high: 0,
    balance: 0,
    width: 0,
  };
}

function rootMeanSquare(samples: Float32Array<ArrayBuffer>): number {
  let sumSquares = 0;
  for (const sample of samples) sumSquares += sample * sample;
  return Math.sqrt(sumSquares / samples.length);
}

function frequencyBandEnergy(
  spectrum: Uint8Array<ArrayBuffer>,
  startFrequency: number,
  endFrequency: number,
  sampleRate: number,
  fftSize: number,
): number {
  const frequencyPerBin = sampleRate / fftSize;
  const firstBin = Math.max(0, Math.floor(startFrequency / frequencyPerBin));
  const lastBin = Math.min(spectrum.length - 1, Math.ceil(endFrequency / frequencyPerBin));
  let total = 0;
  let count = 0;

  for (let index = firstBin; index <= lastBin; index += 1) {
    total += spectrum[index] ?? 0;
    count += 1;
  }

  return count === 0 ? 0 : clampUnit(total / count / 255 * 2.4);
}

function stereoWidth(
  left: Float32Array<ArrayBuffer>,
  right: Float32Array<ArrayBuffer>,
): number {
  let sideEnergy = 0;
  let midEnergy = 0;
  const sampleCount = Math.min(left.length, right.length);

  for (let index = 0; index < sampleCount; index += 1) {
    const leftSample = left[index] ?? 0;
    const rightSample = right[index] ?? 0;
    const side = (leftSample - rightSample) * 0.5;
    const mid = (leftSample + rightSample) * 0.5;
    sideEnergy += side * side;
    midEnergy += mid * mid;
  }

  const sideLevel = Math.sqrt(sideEnergy / sampleCount);
  const midLevel = Math.sqrt(midEnergy / sampleCount);
  const total = sideLevel + midLevel;
  return total < 0.0001 ? 0 : clampUnit(sideLevel / total);
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
