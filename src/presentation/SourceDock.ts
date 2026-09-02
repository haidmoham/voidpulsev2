import type { DisplayAudioState } from "../audio/DisplayAudioSignal";
import type { SpotifyAuthStatus } from "../spotify/SpotifyAuth";

export interface SourceDockOptions {
  container: HTMLElement;
  onCaptureAction: () => void;
  onSpotifyAction: () => void;
}

/** The presentational controls and status readout for the selected music source. */
export class SourceDock {
  private readonly sourceDock = document.createElement("aside");
  private readonly sourceName = document.createElement("strong");
  private readonly sourceDetail = document.createElement("span");
  private readonly sourceMeter = document.createElement("span");
  private readonly captureButton = document.createElement("button");
  private readonly spotifyButton = document.createElement("button");
  private readonly onCaptureAction: () => void;
  private readonly onSpotifyAction: () => void;

  constructor({ container, onCaptureAction, onSpotifyAction }: SourceDockOptions) {
    this.onCaptureAction = onCaptureAction;
    this.onSpotifyAction = onSpotifyAction;

    this.sourceDock.className = "source-dock";
    this.sourceDock.setAttribute("aria-label", "Music source controls");

    const sourceReadout = document.createElement("div");
    sourceReadout.className = "source-readout";

    const sourceKicker = document.createElement("span");
    sourceKicker.className = "source-kicker";
    sourceKicker.textContent = "music current";

    this.sourceName.className = "source-name";
    this.sourceDetail.className = "source-detail";
    this.sourceDetail.setAttribute("aria-live", "polite");
    this.sourceMeter.className = "source-meter";
    this.sourceMeter.setAttribute("aria-hidden", "true");
    sourceReadout.append(sourceKicker, this.sourceName, this.sourceDetail, this.sourceMeter);

    const sourceActions = document.createElement("div");
    sourceActions.className = "source-actions";

    this.captureButton.className = "source-action capture-action";
    this.captureButton.type = "button";
    this.captureButton.addEventListener("click", this.onCaptureAction);

    this.spotifyButton.className = "source-action spotify-auth";
    this.spotifyButton.type = "button";
    this.spotifyButton.addEventListener("click", this.onSpotifyAction);

    sourceActions.append(this.captureButton, this.spotifyButton);
    this.sourceDock.append(sourceReadout, sourceActions);
    container.append(this.sourceDock);
  }

  renderCaptureStatus(status: DisplayAudioState, label: string): void {
    const isActive = status === "active";
    this.sourceDock.dataset.status = status;
    this.captureButton.dataset.status = status;
    this.captureButton.disabled = status === "starting";
    this.captureButton.textContent = isActive ? "release source" : "bind music source";

    if (status === "starting") {
      this.sourceName.textContent = "select a music surface";
      this.sourceDetail.textContent = "Choose the Spotify Web Player tab and enable Share audio.";
      return;
    }

    if (isActive) {
      this.sourceName.textContent = "live audio bound";
      this.sourceDetail.textContent = "Local analysis only. The captured sound is never replayed or uploaded.";
      return;
    }

    if (status === "error") {
      this.sourceName.textContent = "capture needs attention";
      this.sourceDetail.textContent = label;
      return;
    }

    this.sourceName.textContent = "synthetic current";
    this.sourceDetail.textContent = "Bind a music tab to let the descent listen.";
  }

  renderSpotifyStatus(status: SpotifyAuthStatus, message = ""): void {
    this.spotifyButton.dataset.status = status;
    this.spotifyButton.disabled = status === "connecting" || status === "unconfigured";
    this.spotifyButton.textContent = message || ({
      unconfigured: "spotify not configured",
      disconnected: "connect spotify",
      connecting: "connecting…",
      connected: "spotify connected",
    } satisfies Record<SpotifyAuthStatus, string>)[status];
  }

  renderSignalLevel(level: number, active: boolean): void {
    this.sourceMeter.style.setProperty("--signal-level", active ? level.toFixed(3) : "0");
  }

  dispose(): void {
    this.captureButton.removeEventListener("click", this.onCaptureAction);
    this.spotifyButton.removeEventListener("click", this.onSpotifyAction);
    this.sourceDock.remove();
  }
}
