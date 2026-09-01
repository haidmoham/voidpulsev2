import "./style.css";
import { DemoIntensitySignal } from "./audio/IntensitySignal";
import { FallDynamics } from "./dynamics/FallDynamics";
import { SpotifyAuth, type SpotifyAuthStatus } from "./spotify/SpotifyAuth";
import { FallWorld } from "./world/FallWorld";

const container = document.querySelector<HTMLElement>("#app");

if (!container) {
  throw new Error("Missing #app container");
}

const signal = new DemoIntensitySignal();
const dynamics = new FallDynamics();
const world = new FallWorld(container);
const spotify = new SpotifyAuth();
let previousTime = performance.now();

const spotifyButton = document.createElement("button");
spotifyButton.className = "spotify-auth";
spotifyButton.type = "button";
container.append(spotifyButton);

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

function frame(now: number): void {
  const deltaSeconds = Math.min((now - previousTime) / 1000, 0.1);
  const timeSeconds = now / 1000;
  previousTime = now;

  const state = dynamics.update(signal.sample(timeSeconds), deltaSeconds);
  world.render(state, timeSeconds);
  requestAnimationFrame(frame);
}

window.addEventListener("resize", () => world.resize());
requestAnimationFrame(frame);
