# Voidpulse v2

> The song is a space, and playback is descent through it.

Voidpulse is a Three.js experiment in falling through the temporal structure of a song. Locomotion is the primary visualization channel: audio features become control signals, control signals drive fall dynamics, and fall dynamics shape the rendered world.

The current scaffold proves the runtime architecture and the sensation of continuous descent. It uses a synthetic intensity signal until audio analysis is connected.

```text
audio features → normalized control signals → fall dynamics → rendered experience
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

Tab audio is the most reliable option. Native application-window and system-audio choices vary by browser and operating system. The capture is analyzed locally with the Web Audio API; Voidpulse does not record, replay, or upload it. When capture ends, the scene returns to its synthetic signal.

## Spotify OAuth

Voidpulse uses Spotify Authorization Code with PKCE. It requires a client ID but no client secret.

1. Create or reuse an app in the Spotify developer dashboard.
2. Add `http://127.0.0.1:5173/callback` as a redirect URI for local development.
3. Copy `.env.example` to `.env.local` and set `VITE_SPOTIFY_CLIENT_ID`.
4. Add the production `${origin}/callback` URI before deploying.

The initial scope is `user-read-playback-state`, matching v1's listening-along pattern. Tokens remain in browser storage. The OAuth layer does not yet poll playback or drive fall intensity.

## Structure

- `src/audio`: sources normalized control signals.
- `src/dynamics`: integrates intensity into velocity and distance with inertia.
- `src/spotify`: handles PKCE authorization, callback validation, refresh, and disconnect.
- `src/world`: maps the fall state into a Three.js scene.

## Next experiment

Replace `DemoIntensitySignal` with an analyser-backed RMS/intensity signal while preserving the `IntensitySignal` interface.
