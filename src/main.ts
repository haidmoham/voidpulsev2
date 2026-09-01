import "./style.css";
import { DisplayAudioSignal } from "./audio/DisplayAudioSignal";
import { DemoIntensitySignal, type IntensitySignal } from "./audio/IntensitySignal";
import { FallDynamics } from "./dynamics/FallDynamics";
import { SpotifyAuth, type SpotifyAuthStatus } from "./spotify/SpotifyAuth";
import { FallWorld } from "./world/FallWorld";

const container = document.querySelector<HTMLElement>("#app");

if (!container) {
  throw new Error("Missing #app container");
}

const demoSignal = new DemoIntensitySignal();
const displaySignal = new DisplayAudioSignal();
let signal: IntensitySignal = demoSignal;
const dynamics = new FallDynamics();
const world = new FallWorld(container);
const spotify = new SpotifyAuth();
let previousTime = performance.now();

const sourceDock = document.createElement("aside");
sourceDock.className = "source-dock";
sourceDock.setAttribute("aria-label", "Music source controls");

const sourceReadout = document.createElement("div");
sourceReadout.className = "source-readout";

const sourceKicker = document.createElement("span");
sourceKicker.className = "source-kicker";
sourceKicker.textContent = "music current";

const sourceName = document.createElement("strong");
sourceName.className = "source-name";

const sourceDetail = document.createElement("span");
sourceDetail.className = "source-detail";
sourceDetail.setAttribute("aria-live", "polite");

const sourceMeter = document.createElement("span");
sourceMeter.className = "source-meter";
sourceMeter.setAttribute("aria-hidden", "true");

sourceReadout.append(sourceKicker, sourceName, sourceDetail, sourceMeter);

const sourceActions = document.createElement("div");
sourceActions.className = "source-actions";

const captureButton = document.createElement("button");
captureButton.className = "source-action capture-action";
captureButton.type = "button";

const spotifyButton = document.createElement("button");
spotifyButton.className = "source-action spotify-auth";
spotifyButton.type = "button";

sourceActions.append(captureButton, spotifyButton);
sourceDock.append(sourceReadout, sourceActions);
container.append(sourceDock);

function renderCaptureStatus(): void {
  const isActive = displaySignal.status === "active";
  signal = isActive ? displaySignal : demoSignal;
  sourceDock.dataset.status = displaySignal.status;
  captureButton.dataset.status = displaySignal.status;
  captureButton.disabled = displaySignal.status === "starting";
  captureButton.textContent = isActive ? "release source" : "bind music source";

  if (displaySignal.status === "starting") {
    sourceName.textContent = "select a music surface";
    sourceDetail.textContent = "Choose the Spotify Web Player tab and enable Share audio.";
    return;
  }

  if (isActive) {
    sourceName.textContent = "live audio bound";
    sourceDetail.textContent = "Local analysis only. The captured sound is never replayed or uploaded.";
    return;
  }

  if (displaySignal.status === "error") {
    sourceName.textContent = "capture needs attention";
    sourceDetail.textContent = displaySignal.label;
    return;
  }

  sourceName.textContent = "synthetic current";
  sourceDetail.textContent = "Bind a music tab to let the descent listen.";
}

displaySignal.subscribe(renderCaptureStatus);
captureButton.addEventListener("click", () => {
  if (displaySignal.status === "active") {
    displaySignal.stop();
    return;
  }

  void displaySignal.start().catch(() => {
    // DisplayAudioSignal owns the user-facing error state.
  });
});

function renderSpotifyStatus(status: SpotifyAuthStatus, message = ""): void {
  spotifyButton.dataset.status = status;
  spotifyButton.disabled = status === "connecting" || status === "unconfigured";
  spotifyButton.textContent = message || ({
    unconfigured: "spotify not configured",
    disconnected: "connect spotify",
    connecting: "connecting…",
    connected: "spotify connected",
  } satisfies Record<SpotifyAuthStatus, string>)[status];
}

spotifyButton.addEventListener("click", () => {
  if (spotify.status() === "connected") {
    spotify.disconnect();
    renderSpotifyStatus("disconnected");
    return;
  }
  renderSpotifyStatus("connecting");
  void spotify.connect().catch((error: Error) => renderSpotifyStatus("disconnected", error.message));
});

renderSpotifyStatus(spotify.status());
void spotify.handleCallback()
  .then((handled) => {
    if (handled) renderSpotifyStatus("connected");
  })
  .catch((error: Error) => renderSpotifyStatus("disconnected", error.message));

renderCaptureStatus();

function frame(now: number): void {
  const deltaSeconds = Math.min((now - previousTime) / 1000, 0.1);
  const timeSeconds = now / 1000;
  previousTime = now;

  const rawIntensity = signal.sample(timeSeconds);
  sourceMeter.style.setProperty(
    "--signal-level",
    displaySignal.status === "active" ? rawIntensity.toFixed(3) : "0",
  );
  const state = dynamics.update(rawIntensity, deltaSeconds);
  world.render(state, timeSeconds);
  requestAnimationFrame(frame);
}

window.addEventListener("resize", () => world.resize());
window.addEventListener("beforeunload", () => displaySignal.stop());
requestAnimationFrame(frame);
