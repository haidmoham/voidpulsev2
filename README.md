# Faltone

> The song is a space, and playback is descent through it.

Faltone is a Three.js experiment in falling through the temporal structure of a song. Locomotion is the primary visualization channel: audio features become control signals, control signals drive fall dynamics, and fall dynamics shape the rendered world.

The current prototype has an endless falling corridor and can switch between a synthetic music frame and live, local analysis of a shared browser tab.

```text
music source → perceptual feature frame → fall/reactivity models → rendered experience
```

## Run locally

```bash
npm install
npm run dev
```

Use `npm run build` for a production build.

## Listen to real music

Faltone can analyze audio from a surface you explicitly share through the browser's native picker.

1. Play music in the Spotify Web Player in a separate browser tab.
2. Select **bind music source** in Faltone.
3. Choose the Spotify tab and enable **Share audio**.
4. Use **release source** or the browser's sharing control to stop.

Tab audio is the most reliable option. Native application-window and system-audio choices vary by browser and operating system. The capture is analyzed locally with the Web Audio API; Faltone does not record, replay, spatialize, or upload it. When capture ends, the scene returns to its synthetic signal.

The analyser currently derives intensity, transient energy, discrete onsets, estimated tempo, low/mid/high energy, stereo balance, and stereo width. These features drive the visual soundstage while the listener continues hearing Spotify normally.

## First-pass audio to motion map

The invariant is intentionally narrow: **the listener falls through the temporal structure of the song.** The renderer does not inspect FFT data or retain audio envelopes. It only receives a complete, derived `WorldFrame`.

```text
local tab capture or synthetic source
  -> reusable Web Audio buffers
  -> pure MusicAnalyzer
  -> MusicFrame
  -> advanceFall + advanceReactivity
  -> WorldFrame
  -> FallWorld
```

| Musical meaning | Derived world response | Cap / perceptual reason |
|---|---|---|
| estimated BPM | terminal fall speed | 5–15 corridor units/s; tempo establishes pace while intensity and bass only change convergence |
| intensity + low | acceleration response rate | makes a bass-heavy passage feel heavier without changing its BPM-defined destination |
| low | gravity weight | `0..0.055`; large body weight stays local to the gravity well |
| mid | current presence | `0..0.04`; makes the existing current more readable without adding camera noise |
| high | dust presence | `0..0.045`; bright percussion thickens material rather than flashing the scene |
| balance + width | lateral pull | `-0.6..0.6`; a bounded spatial correspondence, not a camera sway system |
| width | soundstage scale | `1..1.12`; opens the familiar field without topology changes |
| discrete onset | wake ring opacity | `0..0.1`; one recovering impulse, with cooldown, rather than repeated beat effects |

The aperture pulse and landmark breathing remain independent environmental motion. Their locked equations are unchanged:

```ts
1 + Math.sin(timeSeconds * 0.13 + aperture.phase) * 0.055
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
| intensity / bass response gains | `1.35` / `1.1` | tuned; energy controls heaviness, never sustained terminal speed |
| soundstage / dust / current / gravity caps | `0.12` / `0.045` / `0.04` / `0.055` | retained checkpoint gains; keeps the structural core stable |
| balance pull | `0.35 + width * 0.25` | retained checkpoint mapping; bounded at `±0.6` |
| wake impulse / recovery / ring cap | `0.66` / `1.4` / `0.1` | tuned; a transition lands once and fades without turning into a new rhythm layer |

## Verification and QA boundary

Run the automated checks with:

```bash
npm test
npm run lint
npm run build
```

The suite contains deterministic analyzer coverage for both 44.1 and 48 kHz bands, historical releases, onset/recovery/BPM, stereo and mono behavior, and router reset isolation; it also covers fixed-sequence model determinism, zero-music baseline, 180-unit wrapping with cumulative distance, and semantic output caps.

Real-track capture QA remains manual because the native display picker requires a user gesture and user-selected surface. It has not been claimed as automated audio-capture proof. Before shipping, use a quiet ambient piece, bass-forward material, mid-forward vocals, bright percussion, hard pans, wide/narrow mixes, and a strong transition to confirm the bounded behaviors described above.

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

- `src/audio`: capture/demo adapters and active-source routing.
- `src/core`: pure fall, loop, and reactivity models plus renderer-independent frame types.
- `src/runtime`: frame timing and state ownership.
- `src/presentation`: DOM controls and source status.
- `src/spotify`: handles PKCE authorization, callback validation, refresh, and disconnect.
- `src/world`: Three.js resources and the visual mapping from complete world frames.
- `src/main.ts`: composition and lifecycle wiring only.

## Next experiment

Tune perceptual mappings against real tracks: lateral balance as camera pull, stereo width as field expansion, spectral bands as material/depth cues, and transients as wakes. Preserve the scene's slow pulse and breathing motion as its independent living baseline.
