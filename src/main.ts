import "./style.css";
import {
  DisplayAudioSignal, LicensedDemoAudioSignal, LocalAudioSignal,
  ProceduralCurrentSignal, ReactivityDemoSignal, readDemoAudioConfig, SignalRouter,
} from "./audio";
import { SourceDock } from "./presentation";
import { FaltoneController, type WorldRenderer } from "./runtime";
import { SpotifyAuth } from "./spotify/SpotifyAuth";
import { FallWorld } from "./world";

const container = document.querySelector<HTMLElement>("#app");
if (!container) throw new Error("missing #app container");

const displaySignal = new DisplayAudioSignal();
const localAudio = new LocalAudioSignal();
const signalRouter = new SignalRouter(new ProceduralCurrentSignal());
const demo = new ReactivityDemoSignal();
const sample = new LicensedDemoAudioSignal(readDemoAudioConfig(import.meta.env));
const spotify = new SpotifyAuth();
const events = new AbortController();
const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = "audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac";
fileInput.hidden = true;
container.append(fileInput);

let world: FallWorld | null = null;
let renderer: WorldRenderer;
try {
  world = new FallWorld(container);
  renderer = world;
} catch {
  const message = document.createElement("p");
  message.className = "graphics-notice";
  message.setAttribute("role", "status");
  message.textContent = "the visual space needs WebGL. try a browser with hardware acceleration. audio controls remain available.";
  container.append(message);
  renderer = { render: () => {}, resize: () => {}, dispose: () => message.remove() };
}

let demoActive = false;
let paused = false;
let focused = false;
let still = matchMedia("(prefers-reduced-motion: reduce)").matches;
let lastReadout = 0;

function hasAudio(): boolean {
  return demoActive || localAudio.status === "active" || sample.status === "active" || displaySignal.status === "active";
}

function updateRoute(): void {
  if (localAudio.status === "active") signalRouter.select(localAudio);
  else if (sample.status === "active") signalRouter.select(sample);
  else if (displaySignal.status === "active") signalRouter.select(displaySignal);
  else if (demoActive) signalRouter.select(demo);
  else signalRouter.reset();
}

function resume(): void {
  paused = false;
  sourceDock.renderPaused(false);
  if (!document.hidden) controller.start();
}

function clearSources(): void {
  demoActive = false;
  displaySignal.stop();
  sample.stop();
  localAudio.stop();
  sourceDock.renderReactivityDemoStatus(false);
}

function capture(): void {
  if (displaySignal.status === "active" || displaySignal.status === "starting") {
    displaySignal.stop();
    return;
  }
  clearSources();
  resume();
  void displaySignal.start().catch(() => { /* The adapter publishes the error in the dock. */ });
}

function toggleDemo(): void {
  const start = !demoActive;
  clearSources();
  demoActive = start;
  demo.reset();
  resume();
  updateRoute();
  sourceDock.renderReactivityDemoStatus(demoActive);
}

function playSample(): void {
  if (sample.status === "active") { sample.stop(); return; }
  clearSources();
  resume();
  void sample.start().catch(() => { /* The adapter publishes the error in the dock. */ });
}

function playFile(file: File): void {
  clearSources();
  resume();
  void localAudio.start(file).catch(() => { /* The adapter publishes the error in the dock. */ });
}

function togglePause(): void {
  paused = !paused;
  localAudio.setPaused(paused);
  sample.setPaused(paused);
  sourceDock.renderPaused(paused);
  if (paused) controller.stop();
  else if (!document.hidden) controller.start();
}

function toggleFocus(): void {
  focused = !focused;
  sourceDock.renderFocus(focused);
}

function toggleMotion(): void {
  still = !still;
  world?.setStill(still);
  sourceDock.renderMotion(still);
}

function fullscreen(): void {
  const operation = document.fullscreenElement
    ? document.exitFullscreen()
    : document.documentElement.requestFullscreen?.();
  void operation?.catch(() => {
    sourceDock.renderFullscreen(false);
  });
}

function spotifyAction(): void {
  if (spotify.status() === "connected") {
    spotify.disconnect();
    sourceDock.renderSpotifyStatus("disconnected");
    return;
  }
  sourceDock.renderSpotifyStatus("connecting");
  void spotify.connect().catch((error: Error) => sourceDock.renderSpotifyStatus("disconnected", error.message));
}

const sourceDock = new SourceDock({
  container, onCaptureAction: capture, onReactivityDemoAction: toggleDemo,
  onLicensedDemoAudioAction: playSample, onSpotifyAction: spotifyAction,
  onFileAction: () => fileInput.click(), onPauseAction: togglePause,
  onFocusAction: toggleFocus, onFullscreenAction: fullscreen,
  onMotionAction: toggleMotion, onSeek: (fraction) => localAudio.seek(fraction),
  onAmbientAction: () => { clearSources(); resume(); updateRoute(); },
});

const unsubscribe = [
  displaySignal.subscribe((source) => {
    updateRoute();
    sourceDock.renderCaptureStatus(source.status, source.label);
  }),
  sample.subscribe((source) => {
    updateRoute();
    sourceDock.renderLicensedDemoAudioStatus(source.status, source.label, source.config);
  }),
  localAudio.subscribe((source) => {
    updateRoute();
    sourceDock.renderLocalAudioStatus(source.status, source.label);
    if (source.status === "idle" || source.status === "error") sourceDock.renderProgress(0, 0);
  }),
];

const controller = new FaltoneController({
  signal: signalRouter, renderer,
  onMusicFrame: (music) => {
    sourceDock.renderSignalLevel(music.intensity, hasAudio());
    const now = performance.now();
    if (now - lastReadout < 120) return;
    lastReadout = now;
    sourceDock.renderMusic(music, hasAudio());
    const progress = localAudio.progress;
    sourceDock.renderProgress(progress.currentTime, progress.duration);
  },
});

sourceDock.renderCaptureStatus(displaySignal.status, displaySignal.label);
sourceDock.renderReactivityDemoStatus(false);
sourceDock.renderLocalAudioStatus(localAudio.status, localAudio.label);
sourceDock.renderLicensedDemoAudioStatus(sample.status, sample.label, sample.config);
sourceDock.renderSpotifyStatus(spotify.status());
sourceDock.renderMotion(still);
world?.setStill(still);
void spotify.handleCallback()
  .then((handled) => { if (handled) sourceDock.renderSpotifyStatus("connected"); })
  .catch((error: Error) => sourceDock.renderSpotifyStatus("disconnected", error.message));

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) playFile(file);
  fileInput.value = "";
}, { signal: events.signal });

window.addEventListener("dragover", (event) => {
  if (event.dataTransfer?.types.includes("Files")) {
    event.preventDefault();
    container.classList.add("is-dragging");
  }
}, { signal: events.signal });
window.addEventListener("dragleave", (event) => {
  if (!event.relatedTarget) container.classList.remove("is-dragging");
}, { signal: events.signal });
window.addEventListener("drop", (event) => {
  event.preventDefault();
  container.classList.remove("is-dragging");
  const file = event.dataTransfer?.files[0];
  if (file) playFile(file);
}, { signal: events.signal });

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && focused) { toggleFocus(); return; }
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input,textarea,select,dialog[open]"))) return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
  if (event.code === "Space" && !(target instanceof HTMLElement && target.closest("button,summary"))) { event.preventDefault(); togglePause(); }
  if (event.key.toLowerCase() === "h") toggleFocus();
  if (event.key.toLowerCase() === "f") fullscreen();
  if (event.key.toLowerCase() === "m") toggleMotion();
  if (event.key.toLowerCase() === "o") fileInput.click();
}, { signal: events.signal });
window.addEventListener("resize", () => controller.resize(), { signal: events.signal });
document.addEventListener("fullscreenchange", () => sourceDock.renderFullscreen(Boolean(document.fullscreenElement)), { signal: events.signal });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) controller.stop();
  else if (!paused) controller.start();
}, { signal: events.signal });

function dispose(): void {
  events.abort();
  unsubscribe.forEach((remove) => remove());
  displaySignal.stop(); sample.stop(); localAudio.stop();
  sourceDock.dispose(); controller.dispose(); fileInput.remove();
}
window.addEventListener("beforeunload", dispose, { once: true, signal: events.signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);
controller.start();
