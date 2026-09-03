# Faltone

> The song is a space, and playback is descent through it.

Faltone is a Three.js experiment in falling through the temporal structure of a song. Locomotion is the primary visualization channel: audio features become control signals, control signals drive fall dynamics, and fall dynamics shape the rendered world.

The current prototype has an endless falling corridor. It starts with an original ambient procedural current, can run a deterministic Demo mode, and can analyze either a shared browser tab or an explicitly configured rights-cleared sample.

```text
music source → perceptual feature frame → fall/reactivity models → rendered experience
```

## Run locally

```bash
npm install
npm run dev
```

Use `npm run build` for a production build.

## Audio sources

The default ambient procedural current is generated in the browser; it is not a recording and does not play a song. **Demo mode** is a deterministic full-response/silence comparison, also not music. The dock says which source is currently active.

### Optional licensed sample

The repository ships without external audio. A site owner may opt in to one sample by setting `VITE_DEMO_AUDIO_URL` in `.env.local` to a direct, rights-cleared `http(s)` audio URL. The source must permit cross-origin Web Audio analysis with CORS headers. Add the following only when they are factual and provided by the rights holder or source page:

- `VITE_DEMO_AUDIO_TITLE`
- `VITE_DEMO_AUDIO_ATTRIBUTION`
- `VITE_DEMO_AUDIO_LICENSE`
- `VITE_DEMO_AUDIO_LICENSE_URL`

When configured, the dock identifies the sample with exactly that supplied metadata, and the browser loops it only after the listener presses **play sample**. Do not use Spotify, Apple Music, or other service previews; do not use audio you do not have permission to play and analyze.

### Live browser-tab audio

Faltone can analyze audio from a surface you explicitly share through the browser's native picker.

1. Play audio in a separate browser tab.
2. Select **choose tab** in Faltone.
3. Choose the playing tab and enable **Share audio**.
4. Use **release tab** or the browser's sharing control to stop.

Tab audio is the most reliable option. Native application-window and system-audio choices vary by browser and operating system. The capture is analyzed locally with the Web Audio API; Faltone does not record, replay, spatialize, or upload it. When capture ends, the scene returns to its original ambient procedural current.

The analyser currently derives intensity, transient energy, discrete onsets, estimated tempo, low/mid/high energy, stereo balance, and stereo width. These features drive the visual soundstage while the listener continues hearing Spotify normally.

## First-pass audio to motion map

The invariant is intentionally narrow: **the listener falls through the temporal structure of the song.** The renderer does not inspect FFT data or retain audio envelopes. It only receives a complete, derived `WorldFrame`.

```text
local tab capture, configured licensed sample, or ambient procedural current
  -> reusable Web Audio buffers
  -> pure MusicAnalyzer
  -> MusicFrame
  -> advanceFall + advanceReactivity
  -> WorldFrame
  -> FallWorld
```

| Musical meaning | Derived world response | Cap / perceptual reason |
|---|---|---|
| estimated BPM | terminal fall speed | 5–15 corridor units/s; tempo is the sole audio input to descent velocity and convergence |
| intensity + spectrum | smoothed material and light pressure | changes the field without giving non-tempo features any authority over descent |
| low | gravity weight | `0..0.55`; large body weight stays local to the gravity well |
| mid | current presence | `0..0.4`; makes the existing current more readable without adding camera noise |
| high | dust presence | `0..0.45`; bright percussion thickens material rather than flashing the scene |
| balance + width | lateral pull | `-6..6`, then reduced before it reaches the camera; a bounded spatial correspondence, not a sway system |
| width | soundstage scale | `1..2.2`; opens the familiar field without topology changes |
| discrete onset | local wake and ring | `0..1`; one recovering impulse, with cooldown, rather than repeated beat effects |

The aperture pulse and landmark breathing remain independent environmental motion. Their locked equations are unchanged:

```ts
1 + Math.sin(timeSeconds * 0.13 + aperture.phase) * 0.075
Math.sin(timeSeconds * 0.18 + seed.phase) * 0.018 * weather
```

## Defaults and tuning record

The analyzer retains the pre-topology Voidpulse starting values below. Release weights are converted by delta time so a `1/60`-second frame reproduces the listed historical ratio exactly.

| Constant | Value | Status and perceptual reason |
|---|---:|---|
| display latency hint | `interactive` | retained; minimizes perceptual lag without routing audio to speakers |
| FFT size / node smoothing | `1024` / `0.78` | retained; enough musical resolution while preserving a stable feature surface |
| low / mid / high bands | `40–260` / `300–2,000` / `2,000–11,000 Hz` | retained in Hz, so meanings survive 44.1 and 48 kHz contexts |
| low / mid / high release | `0.88` / `0.82` / `0.78` at 60 Hz | retained; low hangs longest, high clears soonest |
| onset envelope / threshold | `0.88`, `1.25×`, `0.11` | retained; separates a real low transient from sustained bass |
| onset recovery / cooldown | `0.82` at 60 Hz / `0.24 s` | tuned for a visible but single recoverable impulse |
| BPM interval range/history | `60–200 BPM` / `8` intervals | tuned; rejects implausible gaps while smoothing imperfect onset timing |
| intensity floor / gain / attack / release | `0.012` / `5` / `0.045 s` / `0.25 s` | retained; quiet material stays nearly weightless and rises without frame jitter |
| stereo smoothing | `0.12 s` | tuned; pans correspond without inducing nausea |
| fall tempo range / fallback | `60–180 BPM` / `72 BPM` | tuned; gives an audible-but-calm default descent while preserving a practical tempo span |
| terminal speed range | `5–15 units/s` | tuned for the fixed 180-unit corridor to feel continuous rather than hurried |
| fall velocity response | `4.2 s⁻¹` | establishes the BPM-owned descent in the first second without making other features velocity inputs |
| soundstage / dust / current / gravity caps | `1.2` / `0.45` / `0.4` / `0.55` | capped and low-pass filtered before they reach the world |
| balance pull | `3.5 + width * 2.5` | capped at `±6`, then reduced before it reaches the camera |
| wake impulse / recovery / ring cap | `1` / `4.8 s⁻¹` / `1` | localized wake geometry may land promptly while full-field pressure stays low-pass filtered |

## Verification and QA boundary

Run the automated checks with:

```bash
npm test
npm run lint
npm run build
```

The suite contains deterministic analyzer coverage for both 44.1 and 48 kHz bands, historical releases, onset/recovery/BPM, stereo and mono behavior, and router reset isolation; it also covers fixed-sequence model determinism, zero-music baseline, 180-unit wrapping with cumulative distance, and semantic output caps.

### Real-track QA, 2026-09-02

The acceptance pass split the two browser responsibilities deliberately. The production bind control reached the native capture-permission boundary in the VS Code integrated preview; canceling it shared no source and returned the dock to its explicit `capture needs attention` state. A temporary, unlinked local QA page then fed open-licensed audio through the production `MusicAnalyzer -> FaltoneController -> FallWorld` path so the visual response could be inspected without granting access to an unknown screen or personal audio source. The page and audio were not shipped.

- [Moonlight Sonata](https://commons.wikimedia.org/wiki/File:Moonlight_Sonata.ogg) provided quiet, narrow material: no tempo lock, the calm `72 BPM` fallback held descent at `6.00 units/s`, and width stayed within `0.000..0.085`.
- [Chill Beat](https://commons.wikimedia.org/wiki/File:Chill_Beat.ogg) covered bass/mids and a wider mix: tempo settled at `69 BPM`, descent at `5.77 units/s`, balance at `-0.303..0.167`, and width at `0.000..0.490`; gravity/current motion stayed legible without turning the camera noisy.
- [Techno@120BPM](https://commons.wikimedia.org/wiki/File:Techno@120BPM.ogg) verified tempo ownership directly: the estimator held `116..119 BPM` and descent converged to `9.89 units/s`, clearly faster than the `60 BPM` channel test at `5.00 units/s`.
- [Military drumbeat](https://commons.wikimedia.org/wiki/File:Militarydrumbeat.ogg) covered bright percussion and strong transitions: a 30-second pass produced at least seven discrete onsets, each using the single bounded wake and recovery while the fine atmosphere remained free of flashes.
- [Left and right test](https://commons.wikimedia.org/wiki/File:Left_and_right_test.ogg) covered hard pans: smoothed balance traversed the complete `-1.000..1.000` range and width remained bounded at `0.000..0.500`, producing correspondence without a camera cut or topology change.

The retained/tuned constants in the table above were kept after this pass. The observed tempo/speed separation, bounded stereo motion, single-wake onset behavior, and quiet fallback support their stated perceptual reasons; no additional knob tuning was warranted before landing reactivity itself.

## Issue #1 jellyfish audit evidence

The jellyfish remains a separate artwork in `haidmoham/voidpulse-jellyfish`, not a Faltone implementation. The recorded audit against fresh remote `main` at `5cd450f` found a clean standalone identity; `npm install` and `npm run build` passed, and both development and production HTTP probes returned `200`. No in-app-browser visual session was available for that audit. Deployment ownership is still unresolved: that repository has no Vercel configuration or deployment documentation, while `voidpulse.shin86.dev` and `voidpulse.mhaider.dev` currently serve Faltone. This is audit evidence, not a claim that either domain is owned by the jellyfish project.

## Spotify OAuth

Faltone uses Spotify Authorization Code with PKCE. It requires a client ID but no client secret.

1. Create or reuse an app in the Spotify developer dashboard.
2. Add `http://127.0.0.1:5173/callback` as a redirect URI for local development.
3. Copy `.env.example` to `.env.local` and set `VITE_SPOTIFY_CLIENT_ID`.
4. Add the production `${origin}/callback` URI before deploying.

The initial scope is `user-read-playback-state`, matching v1's listening-along pattern. Tokens remain in browser storage. The OAuth layer does not yet poll playback or drive fall intensity.

## Structure

- `src/audio`: capture, ambient-current/Demo-mode, optional licensed-sample adapters, and active-source routing.
- `src/core`: pure fall, loop, and reactivity models plus renderer-independent frame types.
- `src/runtime`: frame timing and state ownership.
- `src/presentation`: DOM controls and source status.
- `src/spotify`: handles PKCE authorization, callback validation, refresh, and disconnect.
- `src/world`: Three.js resources and the visual mapping from complete world frames.
- `src/main.ts`: composition and lifecycle wiring only.

## Next experiment

Tune perceptual mappings against real tracks: lateral balance as camera pull, stereo width as field expansion, spectral bands as material/depth cues, and transients as wakes. Preserve the scene's slow pulse and breathing motion as its independent living baseline.
