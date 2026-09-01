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

## Structure

- `src/audio`: sources normalized control signals.
- `src/dynamics`: integrates intensity into velocity and distance with inertia.
- `src/world`: maps the fall state into a Three.js scene.

## Next experiment

Replace `DemoIntensitySignal` with an analyser-backed RMS/intensity signal while preserving the `IntensitySignal` interface.
