import type { MusicFrame } from "../core";
import type { MusicSignal } from "./MusicSignal";
import { DISPLAY_ANALYZER_DEFAULTS, MusicAnalyzer, SILENT_MUSIC_FRAME } from "./musicAnalyzer";

export type LocalAudioState = "idle" | "starting" | "active" | "error";

export interface LocalAudioProgress {
  currentTime: number;
  duration: number;
}

class LocalPlayback {
  readonly audio = new Audio();
  readonly context: AudioContext;
  readonly nodes: AudioNode[] = [];
  readonly analyzer = new MusicAnalyzer();
  readonly url: string;
  analyser: AnalyserNode | null = null;
  leftAnalyser: AnalyserNode | null = null;
  rightAnalyser: AnalyserNode | null = null;
  timeSamples = new Float32Array(0);
  spectrumSamples = new Uint8Array(0);
  leftSamples = new Float32Array(0);
  rightSamples = new Float32Array(0);
  lastSampleTime: number | null = null;
  paused = false;
  pauseRequestId = 0;

  constructor(file: File) {
    this.url = URL.createObjectURL(file);
    try {
      this.context = new AudioContext({ latencyHint: DISPLAY_ANALYZER_DEFAULTS.latencyHint });
    } catch (error) {
      URL.revokeObjectURL(this.url);
      throw error;
    }
  }

  connect(): void {
    const source = this.context.createMediaElementSource(this.audio);
    this.nodes.push(source);
    const stereo = this.context.createGain();
    this.nodes.push(stereo);
    const analyser = this.context.createAnalyser();
    this.nodes.push(analyser);
    const splitter = this.context.createChannelSplitter(2);
    this.nodes.push(splitter);
    const leftAnalyser = this.context.createAnalyser();
    this.nodes.push(leftAnalyser);
    const rightAnalyser = this.context.createAnalyser();
    this.nodes.push(rightAnalyser);

    // Upmix mono before splitting so a mono file stays centered.
    stereo.channelCount = 2;
    stereo.channelCountMode = "explicit";
    stereo.channelInterpretation = "speakers";
    analyser.fftSize = DISPLAY_ANALYZER_DEFAULTS.fftSize;
    analyser.smoothingTimeConstant = DISPLAY_ANALYZER_DEFAULTS.smoothingTimeConstant;
    leftAnalyser.fftSize = DISPLAY_ANALYZER_DEFAULTS.stereoFftSize;
    rightAnalyser.fftSize = DISPLAY_ANALYZER_DEFAULTS.stereoFftSize;
    source.connect(stereo);
    stereo.connect(analyser);
    stereo.connect(splitter);
    stereo.connect(this.context.destination);
    splitter.connect(leftAnalyser, 0);
    splitter.connect(rightAnalyser, 1);
    this.analyser = analyser;
    this.leftAnalyser = leftAnalyser;
    this.rightAnalyser = rightAnalyser;
    this.timeSamples = new Float32Array(analyser.fftSize);
    this.spectrumSamples = new Uint8Array(analyser.frequencyBinCount);
    this.leftSamples = new Float32Array(leftAnalyser.fftSize);
    this.rightSamples = new Float32Array(rightAnalyser.fftSize);
    this.audio.preload = "auto";
    this.audio.src = this.url;
  }

  release(): void {
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    for (const node of this.nodes) node.disconnect();
    URL.revokeObjectURL(this.url);
    if (this.context.state !== "closed") void this.context.close().catch(() => undefined);
  }
}

/** Plays one selected file. Its object URL and analysis stay in this browser. */
export class LocalAudioSignal implements MusicSignal {
  status: LocalAudioState = "idle";
  label = "open an audio file";
  private playback: LocalPlayback | null = null;
  private requestId = 0;
  private readonly listeners = new Set<(signal: LocalAudioSignal) => void>();

  get paused(): boolean {
    return this.playback?.paused ?? false;
  }

  get progress(): LocalAudioProgress {
    const audio = this.playback?.audio;
    return {
      currentTime: audio?.currentTime ?? 0,
      duration: audio && Number.isFinite(audio.duration) ? audio.duration : 0,
    };
  }

  subscribe(listener: (signal: LocalAudioSignal) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Call from the file input's change event to preserve the playback gesture. */
  async start(file: File): Promise<void> {
    const requestId = ++this.requestId;
    this.release();
    this.setState("starting", file.name);
    try {
      const playback = new LocalPlayback(file);
      this.playback = playback;
      playback.connect();
      playback.audio.addEventListener("error", () => {
        if (this.playback === playback) this.fail();
      });
      playback.audio.addEventListener("ended", () => {
        if (this.playback === playback) this.stop();
      });
      // Begin both operations before yielding so autoplay can use this gesture.
      await Promise.all([playback.context.resume(), playback.audio.play()]);
      if (requestId !== this.requestId) return;
      if (playback.paused) playback.audio.pause();
      this.setState("active", file.name);
    } catch (error) {
      if (requestId !== this.requestId) return;
      if (this.playback && this.playback.pauseRequestId > 0 && error instanceof DOMException && error.name === "AbortError") {
        this.setState("active", file.name);
        return;
      }
      this.fail();
      throw new Error(this.label, { cause: error });
    }
  }

  stop(): void {
    this.requestId += 1;
    this.release();
    this.setState("idle", "open an audio file");
  }

  seek(fraction: number): void {
    const playback = this.playback;
    const duration = this.progress.duration;
    if (!playback || duration <= 0 || !Number.isFinite(fraction)) return;
    playback.audio.currentTime = Math.min(1, Math.max(0, fraction)) * duration;
    this.reset();
  }

  setPaused(paused: boolean): void {
    const playback = this.playback;
    if (!playback || playback.paused === paused) return;
    playback.paused = paused;
    const pauseRequestId = ++playback.pauseRequestId;
    this.reset();
    if (paused) playback.audio.pause();
    else {
      void Promise.all([playback.context.resume(), playback.audio.play()]).catch(() => {
        if (this.playback === playback && pauseRequestId === playback.pauseRequestId) this.fail();
      });
    }
    this.notify();
  }

  sample(timeSeconds: number): MusicFrame {
    const playback = this.playback;
    if (!playback || this.status !== "active" || playback.paused) return SILENT_MUSIC_FRAME;
    const { analyser, leftAnalyser, rightAnalyser } = playback;
    if (!analyser || !leftAnalyser || !rightAnalyser) return SILENT_MUSIC_FRAME;
    analyser.getFloatTimeDomainData(playback.timeSamples);
    analyser.getByteFrequencyData(playback.spectrumSamples);
    leftAnalyser.getFloatTimeDomainData(playback.leftSamples);
    rightAnalyser.getFloatTimeDomainData(playback.rightSamples);
    const elapsed = playback.lastSampleTime === null ? 1 / 60 : timeSeconds - playback.lastSampleTime;
    playback.lastSampleTime = timeSeconds;
    return playback.analyzer.sampleBuffers(
      playback.spectrumSamples, playback.timeSamples, playback.leftSamples, playback.rightSamples,
      playback.context.sampleRate, analyser.fftSize, elapsed, true,
    );
  }

  reset(): void {
    if (!this.playback) return;
    this.playback.analyzer.reset();
    this.playback.lastSampleTime = null;
  }

  private fail(): void {
    this.requestId += 1;
    this.release();
    this.setState("error", "this file could not play. try another audio file.");
  }

  private release(): void {
    const playback = this.playback;
    this.playback = null;
    playback?.release();
  }

  private setState(status: LocalAudioState, label: string): void {
    this.status = status;
    this.label = label;
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this);
  }
}
