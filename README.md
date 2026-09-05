# Faltone

A music-reactive passage of light built with TypeScript, Three.js, and the Web Audio API. Pink and violet contours move through plum depth among colored, faceted fragments. Tempo controls descent speed. Spectrum, stereo position, and detected attacks shape the surrounding light and space.

This checkout was cloned from [haidmoham/voidpulsev2](https://github.com/haidmoham/voidpulsev2) into `~/Desktop/projects/faltone`. The reimagining started on the local branch `codex/faltone-reimagined`. The package name is `faltone`.

## Run

```bash
npm install
npm run dev
```

Open the URL printed by Vite. No account or audio configuration is required.

```bash
npm test
npm run lint
npm run build
npm run preview
```

The final command serves the production build. Building locally does not deploy it.

## Listen

Open an audio file with the file button, press `o`, or drop a file onto the page. Faltone plays it through the browser and analyzes it locally. The track bar supports seeking. Ending or releasing the file returns the scene to its ambient state. Supported codecs depend on the browser.

For audio from another tab, open the source chooser and select **tab audio**. Choose the playing tab in the browser picker. Enable **Share audio**. Faltone analyzes the selected stream without recording, uploading, or replaying it. Pause in Faltone does not pause the external player.

The initial **ambient** source and **visual demo** produce control signals. They do not produce sound. The visual demo alternates a deterministic response with silence for comparison.

| Key | Action |
| --- | --- |
| `space` | Pause or resume the scene and audio played by Faltone |
| `o` | Open an audio file |
| `h` | Toggle focus mode |
| `f` | Toggle fullscreen |
| `m` | Toggle spatial motion |
| `Escape` | Leave focus mode or close an open panel |

Still mode freezes spatial movement while audio and light response continue. The operating system's reduced-motion preference selects still mode at startup.

## Architecture and TypeScript

```text
audio source → MusicAnalyzer → MusicFrame
            → fall and reactivity models → WorldFrame → FallWorld → GLSL
```

- `src/audio` owns source selection, playback, capture, and feature analysis. Local files use browser object URLs. Releasing a file revokes its URL, disconnects audio nodes, and closes its audio context.
- `src/core` owns pure fall and reactivity calculations. `src/runtime` owns frame timing and passes complete frames to the renderer.
- `src/world` owns Three.js geometry, materials, and shader uniforms. Contour strips and sparse particles supply depth cues. Detected attacks leave local traces in the passage.
- `src/presentation` owns DOM controls. `src/main.ts` connects controls, sources, and the controller. `src/spotify` retains optional account authorization.

`MusicFrame`, `WorldFrame`, and interfaces describe values during TypeScript checking. TypeScript removes these declarations and `import type` statements from the JavaScript output. They do not validate runtime data.

Classes such as `LocalAudioSignal` and `FallWorld` become JavaScript that runs in the browser. Their methods call browser APIs such as `AudioContext` and Three.js APIs such as `ShaderMaterial`. The GLSL strings in `descentShaders.ts` are compiled for the GPU by WebGL. TypeScript checks the surrounding JavaScript interfaces, not GLSL syntax or the rendered result.

## Optional configuration

A site owner can set `VITE_DEMO_AUDIO_URL` in `.env.local` to a direct, licensed `http(s)` audio URL. The server must allow cross-origin Web Audio analysis. The sample option appears only when configured. It loops after an explicit playback action. Optional metadata fields are `VITE_DEMO_AUDIO_TITLE`, `VITE_DEMO_AUDIO_ATTRIBUTION`, `VITE_DEMO_AUDIO_LICENSE`, and `VITE_DEMO_AUDIO_LICENSE_URL`. Supply only factual metadata.

Spotify authorization is optional. Set `VITE_SPOTIFY_CLIENT_ID` and configure the matching `/callback` redirect URI in the Spotify application. The existing PKCE implementation uses no client secret. It stores tokens in browser storage. Account authorization does not supply audio, poll playback, or drive the scene.

## Design and evidence

Read [the reimagining record](docs/reimagining.md) for design adaptations and verification limits. Read [falling through music](docs/falling-through-music.md) for public references and proposed perceptual comparisons.

The earlier renderer, its mapping tables, and its QA notes remain in Git history. Those observations do not verify this renderer. Automated checks cover program behavior; browser playback, visual quality, and the sense of falling require separate observation.
