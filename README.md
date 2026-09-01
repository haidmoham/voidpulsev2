# Voidpulse v2

> The song is a space, and playback is descent through it.

Voidpulse is a Three.js experiment in falling through the temporal structure of a song. Locomotion is the primary visualization channel: audio features become control signals, control signals drive fall dynamics, and fall dynamics shape the rendered world.

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

Voidpulse can analyze audio from a surface you explicitly share through the browser's native picker.

1. Play music in the Spotify Web Player in a separate browser tab.
2. Select **bind music source** in Voidpulse.
3. Choose the Spotify tab and enable **Share audio**.
4. Use **release source** or the browser's sharing control to stop.

Tab audio is the most reliable option. Native application-window and system-audio choices vary by browser and operating system. The capture is analyzed locally with the Web Audio API; Voidpulse does not record, replay, spatialize, or upload it. When capture ends, the scene returns to its synthetic signal.

The analyser currently derives intensity, transient energy, low/mid/high energy, stereo balance, and stereo width. These features drive the visual soundstage while the listener continues hearing Spotify normally.

## Spotify OAuth

Voidpulse uses Spotify Authorization Code with PKCE. It requires a client ID but no client secret.

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
