import type { MusicFrame } from "../core";
import type { MusicSignal } from "./MusicSignal";
import {
  DISPLAY_ANALYZER_DEFAULTS,
  MusicAnalyzer,
  SILENT_MUSIC_FRAME,
} from "./musicAnalyzer";

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
  private musicAnalyzer: MusicAnalyzer | null = null;
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
      this.setState(
        "error",
        "No audio track arrived. Choose a browser tab and enable Share tab audio; app windows may be video-only.",
      );
      throw new Error(this.label);
    }

    const audioTrack = audioTracks[0];
    if (!audioTrack || audioTrack.readyState !== "live") {
      stream.getTracks().forEach((track) => track.stop());
      this.setState("error", "The shared audio track ended before analysis could start. Choose the playing browser tab again.");
      throw new Error(this.label);
    }

    let context: AudioContext | null = null;
    try {
      // The video constraint exists only to open the browser's display picker.
      const displaySurface = stream.getVideoTracks()[0]?.getSettings().displaySurface;
      stream.getVideoTracks().forEach((track) => track.stop());
      context = new AudioContext({ latencyHint: DISPLAY_ANALYZER_DEFAULTS.latencyHint });
      const source = context.createMediaStreamSource(stream);
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
      this.musicAnalyzer = new MusicAnalyzer();
      this.lastSampleTime = null;
      stream.getTracks().forEach((track) => track.addEventListener("ended", () => {
        if (this.stream === stream) this.stop();
      }));
      if (context.state === "suspended") await context.resume();
      if (requestId !== this.requestId) {
        this.releaseCapture(stream, context);
        return;
      }
      const surface = displaySurface === "browser" ? "tab" : displaySurface ?? "source";
      this.setState("active", `Listening to shared ${surface} audio. Local analysis only; nothing is replayed or uploaded.`);
    } catch (error) {
      // A newer capture may own the instance while this resume promise settles.
      this.releaseCapture(stream, context);
      if (requestId !== this.requestId) return;
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
      || !this.musicAnalyzer
      || !this.leftAnalyser
      || !this.rightAnalyser
      || this.status !== "active"
    ) {
      return SILENT_MUSIC_FRAME;
    }

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
    const wasCapturing = this.stream !== null || this.context !== null;
    this.requestId += 1;
    this.release();
    if (wasCapturing || this.status === "starting" || this.status === "error") {
      this.setState("stopped", "Display-audio capture stopped.");
    }
  }

  reset(): void {
    this.musicAnalyzer?.reset();
    this.lastSampleTime = null;
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
    this.musicAnalyzer?.reset();
    this.musicAnalyzer = null;
    this.lastSampleTime = null;
    source?.disconnect();
    splitter?.disconnect();
    leftAnalyser?.disconnect();
    rightAnalyser?.disconnect();
    this.releaseCapture(stream, context);
  }

  private releaseCapture(stream: MediaStream | null, context: AudioContext | null): void {
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
