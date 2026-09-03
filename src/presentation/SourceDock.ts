import type { DisplayAudioState } from "../audio/DisplayAudioSignal";
import type { SpotifyAuthStatus } from "../spotify/SpotifyAuth";

export interface SourceDockOptions {
  container: HTMLElement;
  onCaptureAction: () => void;
  onTestAction: () => void;
  onSpotifyAction: () => void;
}

/** The presentational controls and status readout for the selected music source. */
export class SourceDock {
  private readonly sourceDock = document.createElement("aside");
  private readonly sourceName = document.createElement("strong");
  private readonly sourceDetail = document.createElement("span");
  private readonly sourceMeter = document.createElement("span");
  private readonly captureButton = document.createElement("button");
  private readonly testButton = document.createElement("button");
  private readonly spotifyButton = document.createElement("button");
  private readonly captureOption = document.createElement("section");
  private readonly testOption = document.createElement("section");
  private readonly spotifyOption = document.createElement("section");
  private readonly onCaptureAction: () => void;
  private readonly onTestAction: () => void;
  private readonly onSpotifyAction: () => void;
  private captureStatus: DisplayAudioState = "idle";
  private captureLabel = "Choose a tab with audio";
  private testActive = false;

  constructor({ container, onCaptureAction, onTestAction, onSpotifyAction }: SourceDockOptions) {
    this.onCaptureAction = onCaptureAction;
    this.onTestAction = onTestAction;
    this.onSpotifyAction = onSpotifyAction;

    this.sourceDock.className = "source-dock";
    this.sourceDock.setAttribute("aria-label", "Music source controls");

    const sourceReadout = document.createElement("div");
    sourceReadout.className = "source-readout";

    const sourceKicker = document.createElement("span");
    sourceKicker.className = "source-kicker";
    sourceKicker.textContent = "visual input";

    this.sourceName.className = "source-name";
    this.sourceDetail.className = "source-detail";
    this.sourceDetail.setAttribute("aria-live", "polite");
    this.sourceMeter.className = "source-meter";
    this.sourceMeter.setAttribute("aria-hidden", "true");
    sourceReadout.append(sourceKicker, this.sourceName, this.sourceDetail, this.sourceMeter);

    const sourceActions = document.createElement("div");
    sourceActions.className = "source-actions";

    this.captureOption.className = "source-option capture-option";
    this.captureOption.append(
      this.createOptionCopy(
        "Live browser-tab audio",
      ),
    );
    this.captureButton.className = "source-action capture-action";
    this.captureButton.type = "button";
    this.captureButton.setAttribute("aria-label", "Choose a browser tab with audio");
    this.captureButton.addEventListener("click", this.onCaptureAction);
    this.captureOption.append(this.captureButton);

    this.testOption.className = "source-option test-option";
    this.testOption.append(
      this.createOptionCopy(
        "Visual test: 4 s full/silence",
      ),
    );
    this.testButton.className = "source-action test-action";
    this.testButton.type = "button";
    this.testButton.textContent = "run test";
    this.testButton.setAttribute("aria-label", "Run the deterministic visual-budget test");
    this.testButton.addEventListener("click", this.onTestAction);
    this.testOption.append(this.testButton);

    this.spotifyOption.className = "source-option spotify-option";
    this.spotifyOption.append(
      this.createOptionCopy(
        "Spotify: account authorization",
      ),
    );
    this.spotifyButton.className = "source-action spotify-auth";
    this.spotifyButton.type = "button";
    this.spotifyButton.setAttribute("aria-label", "Authorize a Spotify account");
    this.spotifyButton.addEventListener("click", this.onSpotifyAction);
    this.spotifyOption.append(this.spotifyButton);

    sourceActions.append(this.captureOption, this.testOption, this.spotifyOption);

    const sourceNotes = document.createElement("details");
    sourceNotes.className = "source-notes";
    const sourceNotesSummary = document.createElement("summary");
    sourceNotesSummary.textContent = "What each source does";
    const sourceNoteList = document.createElement("div");
    sourceNoteList.className = "source-note-list";
    sourceNoteList.append(
      this.createSourceNote(
        "Live browser-tab audio",
        "Choose a playing tab and enable Share audio. Analysis stays local and is never replayed or uploaded.",
      ),
      this.createSourceNote(
        "Visual-budget test",
        "A deterministic full capped response and silence alternate every 4 seconds.",
      ),
      this.createSourceNote(
        "Spotify authorization",
        "Connects an account only. It does not supply, play, or capture audio.",
      ),
    );
    sourceNotes.append(sourceNotesSummary, sourceNoteList);

    this.sourceDock.append(sourceReadout, sourceActions, sourceNotes);
    container.append(this.sourceDock);
  }

  renderCaptureStatus(status: DisplayAudioState, label: string): void {
    this.captureStatus = status;
    this.captureLabel = label;
    this.renderSourceStatus();
  }

  renderTestStatus(active: boolean): void {
    this.testActive = active;
    this.testOption.dataset.active = String(active);
    this.testButton.dataset.status = active ? "active" : "idle";
    this.testButton.textContent = active ? "stop test" : "run test";
    this.testButton.setAttribute(
      "aria-label",
      active
        ? "Stop the deterministic visual-budget test"
        : "Run the deterministic visual-budget test",
    );
    this.renderSourceStatus();
  }

  private renderSourceStatus(): void {
    const status = this.captureStatus;
    const isActive = status === "active";
    this.sourceDock.dataset.status = this.testActive ? "testing" : status;
    this.captureOption.dataset.active = String(isActive);
    this.captureButton.dataset.status = status;
    this.captureButton.disabled = status === "starting";
    this.captureButton.textContent = isActive ? "release tab" : "choose tab";

    if (this.testActive) {
      this.sourceName.textContent = "reactivity test";
      this.sourceDetail.textContent = "Full capped response, then silence. The contrast repeats every four seconds.";
      return;
    }

    if (status === "starting") {
      this.sourceName.textContent = "choose a browser tab";
      this.sourceDetail.textContent = "Select the playing tab in the browser picker and enable Share audio.";
      return;
    }

    if (isActive) {
      this.sourceName.textContent = "live audio bound";
      this.sourceDetail.textContent = this.captureLabel;
      return;
    }

    if (status === "error") {
      this.sourceName.textContent = "capture needs attention";
      this.sourceDetail.textContent = this.captureLabel;
      return;
    }

    this.sourceName.textContent = "synthetic current";
    this.sourceDetail.textContent = "No live audio is bound; the scene is using its quiet fallback.";
  }

  renderSpotifyStatus(status: SpotifyAuthStatus, message = ""): void {
    this.spotifyOption.dataset.status = status;
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
    this.testButton.removeEventListener("click", this.onTestAction);
    this.spotifyButton.removeEventListener("click", this.onSpotifyAction);
    this.sourceDock.remove();
  }

  private createOptionCopy(title: string): HTMLDivElement {
    const copy = document.createElement("div");
    copy.className = "source-option-copy";
    const name = document.createElement("strong");
    name.className = "source-option-name";
    name.textContent = title;
    copy.append(name);
    return copy;
  }

  private createSourceNote(title: string, detail: string): HTMLDivElement {
    const note = document.createElement("div");
    note.className = "source-note";
    const name = document.createElement("strong");
    name.textContent = title;
    const description = document.createElement("span");
    description.textContent = detail;
    note.append(name, description);
    return note;
  }
}
