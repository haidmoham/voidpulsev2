import { afterEach, describe, expect, it, vi } from "vitest";
import { DisplayAudioSignal } from "../../src/audio/DisplayAudioSignal";

class PendingAudioContext {
  state = "suspended";
  readonly close = vi.fn(async () => { this.state = "closed"; });
  resolveResume = () => {};
  rejectResume = (_error: Error) => {};
  private readonly resumed = new Promise<void>((resolve, reject) => {
    this.resolveResume = resolve;
    this.rejectResume = reject;
  });

  constructor() { contexts.push(this); }
  resume() { return this.resumed; }
  createMediaStreamSource() {
    return { channelCount: 2, connect: () => {}, disconnect: () => {} };
  }
  createChannelSplitter() { return { connect: () => {}, disconnect: () => {} }; }
  createAnalyser() {
    return { fftSize: 1024, frequencyBinCount: 512, disconnect: () => {} };
  }
}

const contexts: PendingAudioContext[] = [];

function createStream() {
  const track = {
    readyState: "live",
    stop: vi.fn(),
    getSettings: () => ({ channelCount: 2 }),
    addEventListener: () => {},
  };
  return {
    track,
    getTracks: () => [track],
    getAudioTracks: () => [track],
    getVideoTracks: () => [],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  contexts.length = 0;
});

describe("display capture ownership", () => {
  it.each(["resolve", "reject"])("ignores an obsolete resume that later %ss", async (outcome) => {
    const oldStream = createStream();
    const newStream = createStream();
    const getDisplayMedia = vi.fn()
      .mockResolvedValueOnce(oldStream)
      .mockResolvedValueOnce(newStream);
    vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia } });
    vi.stubGlobal("AudioContext", PendingAudioContext);
    const signal = new DisplayAudioSignal();
    const firstStart = signal.start();
    await Promise.resolve();
    const secondStart = signal.start();
    await Promise.resolve();
    const oldContext = contexts[0];
    const newContext = contexts[1];
    newContext.resolveResume();
    await secondStart;
    expect(signal.status).toBe("active");

    if (outcome === "resolve") oldContext.resolveResume();
    else oldContext.rejectResume(new Error("old capture was closed"));
    await firstStart;

    expect(signal.status).toBe("active");
    expect(oldStream.track.stop).toHaveBeenCalled();
    expect(oldContext.close).toHaveBeenCalled();
    expect(newStream.track.stop).not.toHaveBeenCalled();
    expect(newContext.close).not.toHaveBeenCalled();
    signal.stop();
  });

  it("does not reactivate a stopped capture after resume resolves", async () => {
    const stream = createStream();
    vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia: async () => stream } });
    vi.stubGlobal("AudioContext", PendingAudioContext);
    const signal = new DisplayAudioSignal();
    const started = signal.start();
    await Promise.resolve();
    signal.stop();
    contexts[0].resolveResume();
    await started;
    expect(signal.status).toBe("stopped");
  });
});
