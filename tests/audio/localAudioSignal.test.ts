import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalAudioSignal } from "../../src/audio/LocalAudioSignal";
import { LicensedDemoAudioSignal } from "../../src/audio/LicensedDemoAudioSignal";
import { readDemoAudioConfig } from "../../src/audio/DemoAudioConfig";
import { SILENT_MUSIC_FRAME } from "../../src/audio/musicAnalyzer";

class TestAudio extends EventTarget {
  static instances: TestAudio[] = [];
  src = "";
  preload = "";
  currentTime = 0;
  duration = 120;
  pause = vi.fn();
  load = vi.fn();
  removeAttribute = vi.fn();
  play = vi.fn(() => Promise.resolve());

  constructor() {
    super();
    TestAudio.instances.push(this);
  }
}

class TestNode {
  fftSize = 1024;
  frequencyBinCount = 512;
  connect = vi.fn();
  disconnect = vi.fn();
}

class TestContext {
  static instances: TestContext[] = [];
  state = "running";
  sampleRate = 48000;
  destination = new TestNode();
  nodes: TestNode[] = [];
  resume = vi.fn(() => Promise.resolve());
  close = vi.fn(() => Promise.resolve());

  constructor() {
    TestContext.instances.push(this);
  }

  createMediaElementSource() { return this.node(); }
  createAnalyser() { return this.node(); }
  createChannelSplitter() { return this.node(); }
  createGain() { return this.node(); }

  private node() {
    const node = new TestNode();
    this.nodes.push(node);
    return node;
  }
}

beforeEach(() => {
  TestAudio.instances = [];
  TestContext.instances = [];
  vi.stubGlobal("Audio", TestAudio);
  vi.stubGlobal("AudioContext", TestContext);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local-test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

describe("licensed sample pause", () => {
  it("keeps the source active and silent while paused", async () => {
    const signal = new LicensedDemoAudioSignal(readDemoAudioConfig({ VITE_DEMO_AUDIO_URL: "https://audio.example/song.ogg" }));
    await signal.start();
    signal.setPaused(true);
    expect(signal.status).toBe("active");
    expect(signal.paused).toBe(true);
    expect(signal.sample(1)).toBe(SILENT_MUSIC_FRAME);
    expect(TestAudio.instances[0].pause).toHaveBeenCalledOnce();
    expect(TestContext.instances[0].close).not.toHaveBeenCalled();
    signal.setPaused(false);
    expect(TestAudio.instances[0].play).toHaveBeenCalledTimes(2);
    signal.stop();
  });

  it("ignores a cancelled resume after a newer resume", async () => {
    const signal = new LicensedDemoAudioSignal(readDemoAudioConfig({ VITE_DEMO_AUDIO_URL: "https://audio.example/song.ogg" }));
    await signal.start();
    let rejectOld: (error: DOMException) => void = () => undefined;
    const oldPlay = new Promise<void>((_resolve, reject) => { rejectOld = reject; });
    TestAudio.instances[0].play.mockReturnValueOnce(oldPlay);
    signal.setPaused(true);
    signal.setPaused(false);
    signal.setPaused(true);
    signal.setPaused(false);
    rejectOld(new DOMException("interrupted by pause", "AbortError"));
    await Promise.allSettled([oldPlay]);
    await Promise.resolve();
    expect(signal.status).toBe("active");
    expect(signal.paused).toBe(false);
    expect(TestContext.instances[0].close).not.toHaveBeenCalled();
    signal.stop();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("local audio lifecycle", () => {
  it("keeps the newer resume when a previous play is cancelled by a rapid pause", async () => {
    const signal = new LocalAudioSignal();
    await signal.start(new File(["audio"], "song.wav"));
    let rejectOld: (error: DOMException) => void = () => undefined;
    const oldPlay = new Promise<void>((_resolve, reject) => { rejectOld = reject; });
    TestAudio.instances[0].play.mockReturnValueOnce(oldPlay);
    signal.setPaused(true);
    signal.setPaused(false);
    signal.setPaused(true);
    signal.setPaused(false);
    rejectOld(new DOMException("interrupted by pause", "AbortError"));
    await Promise.allSettled([oldPlay]);
    await Promise.resolve();
    expect(signal.status).toBe("active");
    expect(signal.paused).toBe(false);
    expect(TestContext.instances[0].close).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    signal.stop();
  });

  it("does not reactivate a stopped source when playback starts late", async () => {
    const signal = new LocalAudioSignal();
    const start = signal.start(new File(["audio"], "first.wav"));
    signal.stop();
    await start;

    expect(signal.status).toBe("idle");
    expect(signal.sample(0)).toBe(SILENT_MUSIC_FRAME);
    expect(TestAudio.instances[0].pause).toHaveBeenCalledOnce();
    expect(TestContext.instances[0].close).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    for (const node of TestContext.instances[0].nodes) {
      expect(node.disconnect).toHaveBeenCalledOnce();
    }
  });

  it("ignores stale media events after replacement and releases a failed source", async () => {
    const signal = new LocalAudioSignal();
    await signal.start(new File(["audio"], "first.wav"));
    await signal.start(new File(["audio"], "second.wav"));
    TestAudio.instances[0].dispatchEvent(new Event("error"));
    TestAudio.instances[0].dispatchEvent(new Event("ended"));
    expect(signal.status).toBe("active");
    expect(signal.label).toBe("second.wav");

    TestAudio.instances[1].dispatchEvent(new Event("error"));
    expect(signal.status).toBe("error");
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(TestContext.instances[1].close).toHaveBeenCalledOnce();
  });

  it("clamps seeking and samples silence during pause without releasing the file", async () => {
    const signal = new LocalAudioSignal();
    await signal.start(new File(["audio"], "song.wav"));
    signal.seek(0.25);
    expect(signal.progress).toEqual({ currentTime: 30, duration: 120 });
    signal.seek(2);
    expect(signal.progress.currentTime).toBe(120);
    signal.seek(Number.NaN);
    expect(signal.progress.currentTime).toBe(120);
    signal.setPaused(true);
    expect(signal.paused).toBe(true);
    expect(signal.status).toBe("active");
    expect(signal.sample(20)).toBe(SILENT_MUSIC_FRAME);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    signal.setPaused(false);
    expect(TestAudio.instances[0].play).toHaveBeenCalledTimes(2);
    signal.stop();
  });
});
