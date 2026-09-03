import "./style.css";
import {
  DisplayAudioSignal,
  LicensedDemoAudioSignal,
  ProceduralCurrentSignal,
  ReactivityDemoSignal,
  readDemoAudioConfig,
  SignalRouter,
} from "./audio";
import { SourceDock } from "./presentation";
import { FaltoneController } from "./runtime";
import { SpotifyAuth } from "./spotify/SpotifyAuth";
import { FallWorld } from "./world";

const container = document.querySelector<HTMLElement>("#app");

if (!container) {
  throw new Error("Missing #app container");
}

const displaySignal = new DisplayAudioSignal();
const signalRouter = new SignalRouter(new ProceduralCurrentSignal());
const reactivityDemoSignal = new ReactivityDemoSignal();
const licensedDemoAudio = new LicensedDemoAudioSignal(readDemoAudioConfig(import.meta.env));
const spotify = new SpotifyAuth();
const world = new FallWorld(container);
let reactivityDemoActive = false;

function updateSignalRoute(): void {
  if (reactivityDemoActive) {
    signalRouter.select(reactivityDemoSignal);
    return;
  }

  if (licensedDemoAudio.status === "active") {
    signalRouter.select(licensedDemoAudio);
    return;
  }

  if (displaySignal.status === "active") signalRouter.select(displaySignal);
  else signalRouter.reset();
}

function handleCaptureAction(): void {
  if (displaySignal.status === "active") {
    displaySignal.stop();
    return;
  }

  reactivityDemoActive = false;
  licensedDemoAudio.stop();
  sourceDock.renderReactivityDemoStatus(reactivityDemoActive);
  void displaySignal.start().catch(() => {
    // DisplayAudioSignal owns the user-facing error state.
  });
}

function handleSpotifyAction(): void {
  if (spotify.status() === "connected") {
    spotify.disconnect();
    sourceDock.renderSpotifyStatus("disconnected");
    return;
  }

  sourceDock.renderSpotifyStatus("connecting");
  void spotify.connect().catch((error: Error) => {
    sourceDock.renderSpotifyStatus("disconnected", error.message);
  });
}

function handleReactivityDemoAction(): void {
  reactivityDemoActive = !reactivityDemoActive;
  if (reactivityDemoActive) {
    reactivityDemoSignal.reset();
    displaySignal.stop();
    licensedDemoAudio.stop();
  }
  updateSignalRoute();
  sourceDock.renderReactivityDemoStatus(reactivityDemoActive);
}

function handleLicensedDemoAudioAction(): void {
  if (licensedDemoAudio.status === "active") {
    licensedDemoAudio.stop();
    return;
  }

  reactivityDemoActive = false;
  displaySignal.stop();
  sourceDock.renderReactivityDemoStatus(reactivityDemoActive);
  void licensedDemoAudio.start().catch(() => {
    // LicensedDemoAudioSignal owns the user-facing error state.
  });
}

const sourceDock = new SourceDock({
  container,
  onCaptureAction: handleCaptureAction,
  onReactivityDemoAction: handleReactivityDemoAction,
  onLicensedDemoAudioAction: handleLicensedDemoAudioAction,
  onSpotifyAction: handleSpotifyAction,
});

const unsubscribeDisplaySignal = displaySignal.subscribe((source) => {
  updateSignalRoute();
  sourceDock.renderCaptureStatus(source.status, source.label);
});
const unsubscribeLicensedDemoAudio = licensedDemoAudio.subscribe((source) => {
  updateSignalRoute();
  sourceDock.renderLicensedDemoAudioStatus(source.status, source.label, source.config);
});

const controller = new FaltoneController({
  signal: signalRouter,
  renderer: world,
  onMusicFrame: (music) => {
    sourceDock.renderSignalLevel(
      music.intensity,
      reactivityDemoActive || licensedDemoAudio.status === "active" || displaySignal.status === "active",
    );
  },
});

sourceDock.renderCaptureStatus(displaySignal.status, displaySignal.label);
sourceDock.renderReactivityDemoStatus(reactivityDemoActive);
sourceDock.renderLicensedDemoAudioStatus(
  licensedDemoAudio.status,
  licensedDemoAudio.label,
  licensedDemoAudio.config,
);
sourceDock.renderSpotifyStatus(spotify.status());
void spotify.handleCallback()
  .then((handled) => {
    if (handled) sourceDock.renderSpotifyStatus("connected");
  })
  .catch((error: Error) => {
    sourceDock.renderSpotifyStatus("disconnected", error.message);
  });

function resize(): void {
  controller.resize();
}

function dispose(): void {
  window.removeEventListener("resize", resize);
  unsubscribeDisplaySignal();
  unsubscribeLicensedDemoAudio();
  displaySignal.stop();
  licensedDemoAudio.stop();
  sourceDock.dispose();
  controller.dispose();
}

window.addEventListener("resize", resize);
window.addEventListener("beforeunload", dispose, { once: true });
controller.start();
