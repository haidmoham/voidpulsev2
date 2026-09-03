import "./style.css";
import {
  DemoMusicSignal,
  DisplayAudioSignal,
  ReactivityTestSignal,
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
const signalRouter = new SignalRouter(new DemoMusicSignal());
const testSignal = new ReactivityTestSignal();
const spotify = new SpotifyAuth();
const world = new FallWorld(container);
let testActive = false;

function updateSignalRoute(): void {
  if (testActive) {
    signalRouter.select(testSignal);
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

function handleTestAction(): void {
  testActive = !testActive;
  updateSignalRoute();
  sourceDock.renderTestStatus(testActive);
}

const sourceDock = new SourceDock({
  container,
  onCaptureAction: handleCaptureAction,
  onTestAction: handleTestAction,
  onSpotifyAction: handleSpotifyAction,
});

const unsubscribeDisplaySignal = displaySignal.subscribe((source) => {
  updateSignalRoute();
  sourceDock.renderCaptureStatus(source.status, source.label);
});

const controller = new FaltoneController({
  signal: signalRouter,
  renderer: world,
  onMusicFrame: (music) => {
    sourceDock.renderSignalLevel(music.intensity, testActive || displaySignal.status === "active");
  },
});

sourceDock.renderCaptureStatus(displaySignal.status, displaySignal.label);
sourceDock.renderTestStatus(testActive);
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
  displaySignal.stop();
  sourceDock.dispose();
  controller.dispose();
}

window.addEventListener("resize", resize);
window.addEventListener("beforeunload", dispose, { once: true });
controller.start();
