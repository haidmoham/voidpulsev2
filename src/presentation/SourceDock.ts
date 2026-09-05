import type { DemoAudioConfig } from "../audio/DemoAudioConfig";
import type { DisplayAudioState } from "../audio/DisplayAudioSignal";
import type { LicensedDemoAudioState } from "../audio/LicensedDemoAudioSignal";
import type { MusicFrame } from "../core";
import type { SpotifyAuthStatus } from "../spotify/SpotifyAuth";

export interface SourceDockOptions {
  container: HTMLElement;
  onCaptureAction: () => void;
  onReactivityDemoAction: () => void;
  onLicensedDemoAudioAction: () => void;
  onSpotifyAction: () => void;
  onFileAction: () => void;
  onAmbientAction: () => void;
  onPauseAction: () => void;
  onMotionAction: () => void;
  onFocusAction: () => void;
  onFullscreenAction: () => void;
  onSeek: (fraction: number) => void;
}

const ICONS = {
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>',
  focus: '<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6"/>',
  file: '<path d="M12 16V4m-4 4 4-4 4 4M5 14v6h14v-6"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--ink)"/><circle cx="15" cy="17" r="3" fill="var(--ink)"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
} as const;

function icon(path: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

/** Owns presentation state; callbacks delegate audio and renderer changes to main. */
export class SourceDock {
  private readonly shell = document.createElement("div");
  private readonly sourceName: HTMLElement;
  private readonly sourceDetail: HTMLElement;
  private readonly sourceDock: HTMLElement;
  private readonly chooser: HTMLElement;
  private readonly chooserButton: HTMLButtonElement;
  private readonly pauseButton: HTMLButtonElement;
  private readonly focusButton: HTMLButtonElement;
  private readonly fullscreenButton: HTMLButtonElement;
  private readonly captureButton: HTMLButtonElement;
  private readonly demoButton: HTMLButtonElement;
  private readonly sampleButton: HTMLButtonElement;
  private readonly spotifyButton: HTMLButtonElement;
  private readonly spotifyDisclosure: HTMLElement;
  private readonly progress: HTMLInputElement;
  private readonly progressTime: HTMLElement;
  private readonly progressEnd: HTMLElement;
  private readonly progressRow: HTMLElement;
  private readonly about: HTMLDialogElement;
  private readonly meter: HTMLElement;
  private readonly events = new AbortController();
  private captureStatus: DisplayAudioState = "idle";
  private captureLabel = "";
  private demoActive = false;
  private sampleStatus: LicensedDemoAudioState = "unavailable";
  private sampleLabel = "";
  private sampleConfig: DemoAudioConfig | null = null;
  private localStatus: "idle" | "starting" | "active" | "error" = "idle";
  private localLabel = "";
  private lastProgressSecond = -1;
  private lastSignalLevel = -1;
  private progressDuration = 0;

  constructor(options: SourceDockOptions) {
    this.shell.className = "experience-ui";
    // This template contains authored copy only. Source metadata uses textContent below.
    this.shell.innerHTML = `
      <header class="site-header">
        <span class="brand-mark" role="img" aria-label="faltone"><i></i><i></i><i></i></span>
        <nav aria-label="experience"><button class="icon-button about-trigger" type="button" aria-label="settings" title="settings">${icon(ICONS.settings)}</button><button class="icon-button fullscreen-action" type="button" aria-label="enter fullscreen" title="fullscreen (f)">${icon(ICONS.expand)}</button></nav>
      </header>
      <aside class="source-dock" aria-label="music source controls">
        <section class="source-chooser" id="source-chooser" aria-label="choose a source" hidden>
          <button class="icon-button chooser-close" type="button" aria-label="close source chooser">${icon(ICONS.close)}</button>
          <button class="source-option local-option" type="button"><strong>open file</strong><span aria-hidden="true">↗</span></button>
          <button class="source-option capture-option" type="button"><strong>tab audio</strong><span aria-hidden="true">↗</span></button>
          <button class="source-option demo-option" type="button"><strong>visual demo</strong><span aria-hidden="true">↗</span></button>
          <button class="source-option sample-option" type="button" hidden><strong>sample</strong><span aria-hidden="true">↗</span></button>
          <button class="source-option release-action" type="button" hidden><strong>release source</strong><span aria-hidden="true">↙</span></button>
          <details class="spotify-disclosure" hidden><summary>spotify account</summary><button class="text-button spotify-action" type="button">connect account</button></details>
        </section>
        <div class="dock-main">
          <span class="signal-meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
          <button class="source-select" type="button" aria-expanded="false" aria-controls="source-chooser" aria-label="choose music source"><strong class="source-name">ambient</strong><span class="source-chevron" aria-hidden="true">⌃</span></button>
          <button class="icon-button file-action" type="button" aria-label="open audio file" title="open file (o)">${icon(ICONS.file)}</button>
          <button class="icon-button pause-action" type="button" aria-label="pause" title="pause (space)">${icon(ICONS.pause)}</button>
          <button class="icon-button focus-action" type="button" aria-label="enter focus mode" title="focus (h)">${icon(ICONS.focus)}</button>
        </div>
        <div class="track-progress" hidden><span class="progress-time">0:00</span><input class="progress-input" type="range" min="0" max="1000" value="0" aria-label="seek in track"><span class="progress-end">0:00</span></div>
        <p class="source-detail" role="status" aria-live="polite" hidden></p>
      </aside>
      <button class="focus-exit icon-button" type="button" aria-label="leave focus mode" title="leave focus (h)">${icon(ICONS.focus)}</button>
      <dialog class="about-dialog" aria-label="settings">
        <button class="icon-button about-close" type="button" aria-label="close settings">${icon(ICONS.close)}</button>
        <button class="text-button motion-action" type="button" aria-pressed="false">motion on</button>
        <div class="keyboard-help"><span><kbd>space</kbd>pause</span><span><kbd>o</kbd>open</span><span><kbd>h</kbd>focus</span><span><kbd>f</kbd>fullscreen</span><span><kbd>m</kbd>motion</span></div>
      </dialog>`;
    options.container.append(this.shell);
    this.sourceDock = this.find(".source-dock");
    this.sourceName = this.find(".source-name");
    this.sourceDetail = this.find(".source-detail");
    this.chooser = this.find(".source-chooser");
    this.chooserButton = this.find<HTMLButtonElement>(".source-select");
    this.pauseButton = this.find<HTMLButtonElement>(".pause-action");
    this.focusButton = this.find<HTMLButtonElement>(".focus-action");
    this.fullscreenButton = this.find<HTMLButtonElement>(".fullscreen-action");
    this.captureButton = this.find<HTMLButtonElement>(".capture-option");
    this.demoButton = this.find<HTMLButtonElement>(".demo-option");
    this.sampleButton = this.find<HTMLButtonElement>(".sample-option");
    this.spotifyButton = this.find<HTMLButtonElement>(".spotify-action");
    this.spotifyDisclosure = this.find(".spotify-disclosure");
    this.progress = this.find<HTMLInputElement>(".progress-input");
    this.progressTime = this.find(".progress-time");
    this.progressEnd = this.find(".progress-end");
    this.progressRow = this.find(".track-progress");
    this.about = this.find<HTMLDialogElement>(".about-dialog");
    this.meter = this.find(".signal-meter");
    const eventOptions = { signal: this.events.signal };
    const on = (selector: string, action: () => void): void => {
      this.find(selector).addEventListener("click", action, eventOptions);
    };
    on(".file-action", options.onFileAction);
    on(".release-action", options.onAmbientAction);
    on(".local-option", options.onFileAction);
    on(".capture-option", options.onCaptureAction);
    on(".demo-option", options.onReactivityDemoAction);
    on(".sample-option", options.onLicensedDemoAudioAction);
    on(".spotify-action", options.onSpotifyAction);
    on(".pause-action", options.onPauseAction);
    on(".motion-action", options.onMotionAction);
    on(".focus-action", options.onFocusAction);
    on(".focus-exit", options.onFocusAction);
    on(".fullscreen-action", options.onFullscreenAction);
    on(".source-select", () => this.setChooser(this.chooser.hidden));
    on(".chooser-close", () => this.setChooser(false));
    on(".about-trigger", () => this.about.showModal());
    on(".about-close", () => this.about.close());
    this.progress.addEventListener("input", () => {
      const fraction = Number(this.progress.value) / 1000;
      options.onSeek(fraction);
      this.renderProgress(fraction * this.progressDuration, this.progressDuration);
    }, eventOptions);
    document.addEventListener("pointerdown", (event) => {
      if (event.target instanceof Node && !this.sourceDock.contains(event.target)) this.setChooser(false, false);
    }, eventOptions);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !this.chooser.hidden) this.setChooser(false);
    }, eventOptions);
    this.about.addEventListener("click", (event) => {
      if (event.target === this.about) {
        const bounds = this.about.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) this.about.close();
      }
    }, eventOptions);
  }

  dismissIntro(): void {
    this.setChooser(false, false);
  }

  showIntro(): void {
    this.setChooser(true);
  }

  renderCaptureStatus(status: DisplayAudioState, label: string): void {
    this.captureStatus = status;
    this.captureLabel = label;
    this.captureButton.disabled = status === "starting";
    this.optionTitle(this.captureButton, status === "active" ? "release tab audio" : status === "starting" ? "connecting…" : "tab audio");
    this.activateSource(status === "active");
    this.renderSourceStatus();
  }

  renderReactivityDemoStatus(active: boolean): void {
    this.demoActive = active;
    this.optionTitle(this.demoButton, active ? "stop demo" : "visual demo");
    this.activateSource(active);
    this.renderSourceStatus();
  }

  renderLocalAudioStatus(status: "idle" | "starting" | "active" | "error", label: string): void {
    this.localStatus = status;
    this.localLabel = label;
    this.activateSource(status === "active");
    this.renderSourceStatus();
  }

  renderLicensedDemoAudioStatus(status: LicensedDemoAudioState, label: string, config: DemoAudioConfig): void {
    this.sampleStatus = status;
    this.sampleLabel = label;
    this.sampleConfig = config;
    this.sampleButton.hidden = !config.available;
    this.sampleButton.disabled = status === "starting";
    this.optionTitle(this.sampleButton, status === "active" ? "stop sample" : status === "starting" ? "opening sample…" : "sample");
    this.activateSource(status === "active");
    this.renderSourceStatus();
  }

  renderSpotifyStatus(status: SpotifyAuthStatus, message = ""): void {
    this.spotifyDisclosure.hidden = status === "unconfigured";
    this.spotifyButton.disabled = status === "connecting";
    this.spotifyButton.textContent = message || ({
      unconfigured: "connect account",
      disconnected: "connect account",
      connecting: "connecting…",
      connected: "disconnect account",
    } satisfies Record<SpotifyAuthStatus, string>)[status];
  }

  renderPaused(paused: boolean): void {
    this.pauseButton.innerHTML = icon(paused ? ICONS.play : ICONS.pause);
    this.pauseButton.setAttribute("aria-label", paused ? "resume" : "pause");
    this.pauseButton.setAttribute("aria-pressed", String(paused));
    this.pauseButton.title = `${paused ? "resume" : "pause"} (space)`;
    this.sourceDock.dataset.paused = String(paused);
  }

  /** CSS owns visibility; inert also removes hidden controls from keyboard navigation. */
  renderFocus(focused: boolean): void {
    document.body.classList.toggle("is-focused", focused);
    this.focusButton.setAttribute("aria-pressed", String(focused));
    this.find(".site-header").inert = focused;
    this.sourceDock.inert = focused;
    this.find(".focus-exit").inert = !focused;
    this.setChooser(false, false);
    if (focused) {
      this.about.close();
      this.find(".focus-exit").focus();
    } else {
      this.focusButton.focus();
    }
  }

  renderMotion(still: boolean): void {
    const button = this.find<HTMLButtonElement>(".motion-action");
    button.textContent = still ? "motion off" : "motion on";
    button.setAttribute("aria-pressed", String(still));
  }

  renderFullscreen(active: boolean): void {
    this.fullscreenButton.setAttribute("aria-label", active ? "leave fullscreen" : "enter fullscreen");
    this.fullscreenButton.setAttribute("aria-pressed", String(active));
  }

  renderSignalLevel(level: number, active: boolean): void {
    const bounded = active && Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
    const quantized = Math.round(bounded * 20) / 20;
    if (quantized === this.lastSignalLevel) return;
    this.lastSignalLevel = quantized;
    this.meter.style.setProperty("--level", String(quantized));
    this.meter.dataset.active = String(active);
  }

  renderMusic(music: MusicFrame, active: boolean): void {
    this.renderSignalLevel(music.intensity, active);
  }

  renderProgress(currentTime: number, duration: number): void {
    const available = Number.isFinite(duration) && duration > 0;
    this.progressRow.hidden = !available;
    if (!available) {
      this.lastProgressSecond = -1;
      return;
    }
    const second = Math.floor(Math.max(0, currentTime));
    if (second === this.lastProgressSecond && duration === this.progressDuration) return;
    this.lastProgressSecond = second;
    this.progressDuration = duration;
    this.progress.value = String(Math.round(Math.min(1, currentTime / duration) * 1000));
    this.progressTime.textContent = this.formatTime(currentTime);
    this.progressEnd.textContent = this.formatTime(duration);
    this.progress.setAttribute("aria-valuetext", `${this.formatTime(currentTime)} of ${this.formatTime(duration)}`);
  }

  dispose(): void {
    this.events.abort();
    this.about.close();
    this.shell.remove();
    document.body.classList.remove("is-focused");
  }

  private activateSource(active: boolean): void {
    if (!active) return;
    this.setChooser(false, false);
  }

  private renderSourceStatus(): void {
    let name = "ambient";
    let detail = "";
    let status = "idle";
    if (this.localStatus === "active") {
      name = this.localLabel;
      status = "active";
    } else if (this.demoActive) {
      name = "demo";
      status = "demo";
    } else if (this.sampleStatus === "active") {
      name = this.sampleConfig?.available && this.sampleConfig.title ? this.sampleConfig.title : "sample";
      detail = this.sampleConfig?.available
        ? [this.sampleConfig.attribution, this.sampleConfig.license, this.sampleConfig.licenseUrl].filter(Boolean).join(" · ")
        : "";
      status = "active";
    } else if (this.captureStatus === "active") {
      name = "tab audio";
      status = "active";
    } else if (this.localStatus === "error" || this.sampleStatus === "error" || this.captureStatus === "error") {
      name = "source error";
      detail = this.localStatus === "error" ? this.localLabel : this.sampleStatus === "error" ? this.sampleLabel : this.captureLabel;
      status = "error";
    } else if (this.localStatus === "starting" || this.sampleStatus === "starting" || this.captureStatus === "starting") {
      name = this.captureStatus === "starting" ? "choose tab" : "loading…";
      detail = this.captureStatus === "starting" ? "enable share audio in the browser picker" : "";
      status = "starting";
    }
    this.sourceName.textContent = name;
    this.find(".release-action").hidden = status === "idle";
    this.sourceName.title = name;
    this.sourceDetail.textContent = detail;
    this.sourceDetail.hidden = !detail;
    this.sourceDock.dataset.status = status;
    if (status === "error") this.setChooser(false);
  }

  private setChooser(open: boolean, restoreFocus = true): void {
    const wasOpen = !this.chooser.hidden;
    this.chooser.hidden = !open;
    this.chooserButton.setAttribute("aria-expanded", String(open));
    if (open) this.find(".local-option").focus();
    else if (wasOpen && restoreFocus) this.chooserButton.focus();
  }

  private optionTitle(button: HTMLButtonElement, title: string): void {
    const heading = button.querySelector("strong");
    if (heading) heading.textContent = title;
  }

  private find<T extends HTMLElement>(selector: string): T {
    const element = this.shell.querySelector<T>(selector);
    if (!element) throw new Error(`Missing interface element: ${selector}`);
    return element;
  }

  private formatTime(seconds: number): string {
    const whole = Math.max(0, Math.floor(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  }
}
