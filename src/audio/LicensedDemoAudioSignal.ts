import type { MusicFrame } from "../core";
import type { MusicSignal } from "./MusicSignal";
import type { DemoAudioConfig } from "./DemoAudioConfig";
import {
  DISPLAY_ANALYZER_DEFAULTS,
  MusicAnalyzer,
  SILENT_MUSIC_FRAME,
} from "./musicAnalyzer";

export type LicensedDemoAudioState = "unavailable" | "idle" | "starting" | "active" | "error";

/**
 * Optional, externally hosted audio for a configuration supplied by the site
 * owner. The source must be licensed for this use and permit CORS analysis.
 */
export class LicensedDemoAudioSignal implements MusicSignal {
  status: LicensedDemoAudioState;
  label: string;

  private audio: HTMLAudioElement | null = null;
  private context: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private splitter: ChannelSplitterNode | null = null;
  private leftAnalyser: AnalyserNode | null = null;
  private rightAnalyser: AnalyserNode | null = null;
  private timeSamples: Float32Array<ArrayBuffer> | null = null;
  private spectrumSamples: Uint8Array<ArrayBuffer> | null = null;
  private leftSamples: Float32Array<ArrayBuffer> | null = null;
  private rightSamples: Float32Array<ArrayBuffer> | null = null;
  private hasStereo = false;
  private musicAnalyzer: MusicAnalyzer | null = null;
  private lastSampleTime: number | null = null;
  private requestId = 0;
  private listeners = new Set<(signal: LicensedDemoAudioSignal) => void>();

  constructor(readonly config: DemoAudioConfig) {
    this.status = config.available ? "idle" : "unavailable";
    this.label = config.available
      ? "Licensed sample is ready to play."
      : config.reason;
  }

  subscribe(listener: (signal: LicensedDemoAudioSignal) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Call directly from a user gesture so playback stays explicit. */
  async start(): Promise<void> {
    if (!this.config.available) return;

    const requestId = ++this.requestId;
    this.release();
    this.setState("starting", "Starting the configured licensed sample…");
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.src = this.config.url;
    audio.loop = true;
    audio.preload = "auto";
    audio.addEventListener("error", () => {
      if (requestId === this.requestId && this.audio === audio) {
        this.release();
        this.setState("error", "The configured sample could not play or allow local analysis. Check its URL, license, and CORS headers.");
      }
    });
    audio.addEventListener("ended", () => {
      if (this.audio === audio) this.stop();
    });

    try {
      const context = new AudioContext({ latencyHint: DISPLAY_ANALYZER_DEFAULTS.latencyHint });
      const source = context.createMediaElementSource(audio);
      const analyser = context.createAnalyser();
      const splitter = context.createChannelSplitter(2);
      const leftAnalyser = context.createAnalyser();
      const rightAnalyser = context.createAnalyser();
      analyser.fftSize = DISPLAY_ANALYZER_DEFAULTS.fftSize;
      analyser.smoothingTimeConstant = DISPLAY_ANALYZER_DEFAULTS.smoothingTimeConstant;
      leftAnalyser.fftSize = DISPLAY_ANALYZER_DEFAULTS.stereoFftSize;
      rightAnalyser.fftSize = DISPLAY_ANALYZER_DEFAULTS.stereoFftSize;
      source.connect(analyser);
      source.connect(splitter);
      source.connect(context.destination);
      splitter.connect(leftAnalyser, 0);
      splitter.connect(rightAnalyser, 1);

      this.audio = audio;
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
      this.hasStereo = source.channelCount > 1;
      this.musicAnalyzer = new MusicAnalyzer();
      this.lastSampleTime = null;
      if (context.state === "suspended") await context.resume();
      if (requestId !== this.requestId) return;
      await audio.play();
      if (requestId !== this.requestId) return;
      this.setState("active", samplePlaybackLabel(this.config));
    } catch (error) {
      if (requestId !== this.requestId) return;
      this.release();
      this.setState("error", "The configured sample could not play or allow local analysis. Check its URL, license, and CORS headers.");
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
      !analyser || !timeSamples || !spectrumSamples || !leftSamples || !rightSamples
      || !this.musicAnalyzer || !this.leftAnalyser || !this.rightAnalyser || this.status !== "active"
    ) return SILENT_MUSIC_FRAME;

    analyser.getFloatTimeDomainData(timeSamples);
    analyser.getByteFrequencyData(spectrumSamples);
    this.leftAnalyser.getFloatTimeDomainData(leftSamples);
    this.rightAnalyser.getFloatTimeDomainData(rightSamples);
    const elapsed = this.lastSampleTime === null ? 1 / 60 : timeSeconds - this.lastSampleTime;
    this.lastSampleTime = timeSeconds;
    return this.musicAnalyzer.sampleBuffers(
      spectrumSamples,
      timeSamples,
      leftSamples,
      rightSamples,
      analyser.context.sampleRate,
      analyser.fftSize,
      elapsed,
      this.hasStereo,
    );
  }

  stop(): void {
    this.requestId += 1;
    const wasPlaying = this.audio !== null || this.context !== null;
    this.release();
    if (wasPlaying && this.config.available) this.setState("idle", "Licensed sample stopped. The ambient procedural current is active again.");
  }

  reset(): void {
    this.musicAnalyzer?.reset();
    this.lastSampleTime = null;
  }

  private release(): void {
    const audio = this.audio;
    const context = this.context;
    const source = this.source;
    const splitter = this.splitter;
    const leftAnalyser = this.leftAnalyser;
    const rightAnalyser = this.rightAnalyser;
    this.audio = null;
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
    this.musicAnalyzer?.reset();
    this.musicAnalyzer = null;
    this.lastSampleTime = null;
    audio?.pause();
    audio?.removeAttribute("src");
    audio?.load();
    source?.disconnect();
    splitter?.disconnect();
    leftAnalyser?.disconnect();
    rightAnalyser?.disconnect();
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
  }

  private setState(status: LicensedDemoAudioState, label: string): void {
    this.status = status;
    this.label = label;
    this.listeners.forEach((listener) => listener(this));
  }
}

function samplePlaybackLabel(config: Extract<DemoAudioConfig, { available: true }>): string {
  const title = config.title ? `“${config.title}”` : "the configured licensed sample";
  const creator = config.attribution ? ` by ${config.attribution}` : "";
  const rights = config.license ? ` License: ${config.license}.` : "";
  const licenseDetails = config.licenseUrl ? ` License details: ${config.licenseUrl}` : "";
  return `Playing ${title}${creator}. It loops locally for this demo.${rights}${licenseDetails}`;
}
