import type { IntensitySignal } from "./IntensitySignal";

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
export class DisplayAudioSignal implements IntensitySignal {
  status: DisplayAudioState = "idle";
  label = "Choose a tab with audio";
  onStateChange: ((signal: DisplayAudioSignal) => void) | null = null;

  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private samples: Float32Array<ArrayBuffer> | null = null;
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
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);

      this.stream = stream;
      this.context = context;
      this.source = source;
      this.analyser = analyser;
      this.samples = new Float32Array(analyser.fftSize);
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

  sample(timeSeconds: number): number {
    if (!this.analyser || !this.samples || this.status !== "active") return 0;

    this.analyser.getFloatTimeDomainData(this.samples);
    let sumSquares = 0;
    for (const sample of this.samples) sumSquares += sample * sample;
    const rms = Math.sqrt(sumSquares / this.samples.length);

    const noiseFloor = 0.012;
    const gained = Math.max(0, rms - noiseFloor) * 5;
    const target = gained / (0.2 + gained); // soft compression: musical, not jumpy
    const elapsed = this.lastSampleTime === null ? 1 / 60 : Math.max(0, timeSeconds - this.lastSampleTime);
    const timeConstant = target > this.value ? 0.045 : 0.25;
    const blend = 1 - Math.exp(-elapsed / timeConstant);
    this.value += (target - this.value) * blend;
    this.lastSampleTime = timeSeconds;
    return Math.min(1, Math.max(0, this.value));
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
    this.stream = null;
    this.context = null;
    this.source = null;
    this.analyser = null;
    this.samples = null;
    this.value = 0;
    this.lastSampleTime = null;
    source?.disconnect();
    stream?.getTracks().forEach((track) => track.stop());
    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }

  private setState(status: DisplayAudioState, label: string): void {
    this.status = status;
    this.label = label;
    this.onStateChange?.(this);
    this.listeners.forEach((listener) => listener(this));
  }
}
