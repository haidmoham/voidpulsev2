import type { DemoAudioConfig } from "../audio/DemoAudioConfig";
import type { DisplayAudioState } from "../audio/DisplayAudioSignal";
import type { LicensedDemoAudioState } from "../audio/LicensedDemoAudioSignal";
import type { SpotifyAuthStatus } from "../spotify/SpotifyAuth";

export interface SourceDockOptions {
  container: HTMLElement;
  onCaptureAction: () => void;
  onReactivityDemoAction: () => void;
  onLicensedDemoAudioAction: () => void;
  onSpotifyAction: () => void;
}

/** The presentational controls and status readout for the selected music source. */
export class SourceDock {
  private readonly sourceDock = document.createElement("aside");
  private readonly sourceName = document.createElement("strong");
  private readonly sourceDetail = document.createElement("span");
  private readonly sourceMeter = document.createElement("span");
  private readonly sourceMeterFill = document.createElement("span");
  private readonly captureButton = document.createElement("button");
  private readonly reactivityDemoButton = document.createElement("button");
  private readonly licensedDemoAudioButton = document.createElement("button");
  private readonly spotifyButton = document.createElement("button");
  private readonly captureOption = document.createElement("section");
  private readonly reactivityDemoOption = document.createElement("section");
  private readonly licensedDemoAudioOption = document.createElement("section");
  private readonly spotifyOption = document.createElement("section");
  private readonly onCaptureAction: () => void;
  private readonly onReactivityDemoAction: () => void;
  private readonly onLicensedDemoAudioAction: () => void;
  private readonly onSpotifyAction: () => void;
  private captureStatus: DisplayAudioState = "idle";
  private captureLabel = "Choose a tab with audio";
  private reactivityDemoActive = false;
  private licensedDemoAudioStatus: LicensedDemoAudioState = "unavailable";
  private licensedDemoAudioLabel = "";
  private licensedDemoAudioConfig: DemoAudioConfig | null = null;

  constructor({
    container,
    onCaptureAction,
    onReactivityDemoAction,
    onLicensedDemoAudioAction,
    onSpotifyAction,
  }: SourceDockOptions) {
    this.onCaptureAction = onCaptureAction;
    this.onReactivityDemoAction = onReactivityDemoAction;
    this.onLicensedDemoAudioAction = onLicensedDemoAudioAction;
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
    this.sourceMeterFill.className = "source-meter-fill";
    this.sourceMeter.append(this.sourceMeterFill);
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

    this.reactivityDemoOption.className = "source-option demo-option";
    this.reactivityDemoOption.append(
      this.createOptionCopy(
        "Demo mode: 4 s full/silence",
      ),
    );
    this.reactivityDemoButton.className = "source-action demo-action";
    this.reactivityDemoButton.type = "button";
    this.reactivityDemoButton.textContent = "start demo";
    this.reactivityDemoButton.setAttribute("aria-label", "Start the deterministic reactivity demo");
    this.reactivityDemoButton.addEventListener("click", this.onReactivityDemoAction);
    this.reactivityDemoOption.append(this.reactivityDemoButton);

    this.licensedDemoAudioOption.className = "source-option licensed-demo-option";
    this.licensedDemoAudioOption.append(this.createOptionCopy("Optional licensed audio sample"));
    this.licensedDemoAudioButton.className = "source-action licensed-demo-action";
    this.licensedDemoAudioButton.type = "button";
    this.licensedDemoAudioButton.addEventListener("click", this.onLicensedDemoAudioAction);
    this.licensedDemoAudioOption.append(this.licensedDemoAudioButton);

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

    sourceActions.append(
      this.captureOption,
      this.reactivityDemoOption,
      this.licensedDemoAudioOption,
      this.spotifyOption,
    );

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
        "Demo mode",
        "A deterministic full capped response and silence alternate every 4 seconds. It is not a song.",
      ),
      this.createSourceNote(
        "Optional licensed sample",
        "Set VITE_DEMO_AUDIO_URL to a rights-cleared, CORS-enabled audio URL. Add its title, credit, and license metadata only when known; the sample is never labeled as an artist or track by default.",
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

  renderReactivityDemoStatus(active: boolean): void {
    this.reactivityDemoActive = active;
    this.reactivityDemoOption.dataset.active = String(active);
    this.reactivityDemoButton.dataset.status = active ? "active" : "idle";
    this.reactivityDemoButton.textContent = active ? "stop demo" : "start demo";
    this.reactivityDemoButton.setAttribute(
      "aria-label",
      active
        ? "Stop the deterministic reactivity demo"
        : "Start the deterministic reactivity demo",
    );
    this.renderSourceStatus();
  }

  renderLicensedDemoAudioStatus(
    status: LicensedDemoAudioState,
    label: string,
    config: DemoAudioConfig,
  ): void {
    this.licensedDemoAudioStatus = status;
    this.licensedDemoAudioLabel = label;
    this.licensedDemoAudioConfig = config;
    this.licensedDemoAudioOption.dataset.status = status;
    this.licensedDemoAudioOption.dataset.active = String(status === "active");
    this.licensedDemoAudioButton.dataset.status = status;
    this.licensedDemoAudioButton.disabled = status === "unavailable" || status === "starting";
    this.licensedDemoAudioButton.textContent = ({
      unavailable: "sample unavailable",
      idle: "play sample",
      starting: "starting…",
      active: "stop sample",
      error: "retry sample",
    } satisfies Record<LicensedDemoAudioState, string>)[status];
    this.licensedDemoAudioButton.setAttribute(
      "aria-label",
      status === "unavailable"
        ? "Licensed sample unavailable: configure VITE_DEMO_AUDIO_URL"
        : status === "active"
          ? "Stop the configured licensed sample"
          : "Play the configured licensed sample",
    );
    this.renderSourceStatus();
  }

  private renderSourceStatus(): void {
    const status = this.captureStatus;
    const isActive = status === "active";
    this.sourceDock.dataset.status = this.reactivityDemoActive
      ? "demo"
      : this.licensedDemoAudioStatus === "active"
        ? "licensed-demo"
        : status;
    this.captureOption.dataset.active = String(isActive);
    this.captureButton.dataset.status = status;
    this.captureButton.disabled = status === "starting";
    this.captureButton.textContent = isActive ? "release tab" : "choose tab";

    if (this.reactivityDemoActive) {
      this.sourceName.textContent = "demo mode";
      this.sourceDetail.textContent = "Full capped response, then silence. This procedural comparison repeats every four seconds; no song is playing.";
      return;
    }

    if (this.licensedDemoAudioStatus === "active") {
      this.sourceName.textContent = this.licensedDemoAudioConfig?.available && this.licensedDemoAudioConfig.title
        ? `licensed sample: ${this.licensedDemoAudioConfig.title}`
        : "licensed demo sample";
      this.sourceDetail.textContent = this.licensedDemoAudioLabel;
      return;
    }

    if (this.licensedDemoAudioStatus === "error") {
      this.sourceName.textContent = "licensed sample needs attention";
      this.sourceDetail.textContent = this.licensedDemoAudioLabel;
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

    this.sourceName.textContent = "ambient procedural current";
    this.sourceDetail.textContent = "No live or licensed sample is playing; the scene is using its original in-browser procedural current.";
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
    const signalLevel = active && Number.isFinite(level)
      ? Math.min(1, Math.max(0, level))
      : 0;
    this.sourceMeterFill.style.transform = `scaleX(${signalLevel.toFixed(3)})`;
  }

  dispose(): void {
    this.captureButton.removeEventListener("click", this.onCaptureAction);
    this.reactivityDemoButton.removeEventListener("click", this.onReactivityDemoAction);
    this.licensedDemoAudioButton.removeEventListener("click", this.onLicensedDemoAudioAction);
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
