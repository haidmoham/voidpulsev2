# Reimagining Faltone

Local implementation record · 2026-09-05

The source is `haidmoham/voidpulsev2`. This checkout uses the directory and package name `faltone`. The work started on `codex/faltone-reimagined`. A local branch does not establish a deployment or change domain ownership.

## Direction

The new world uses a passage of luminous contours, faceted fragments, sparse particles, and a dark center. Plum, fruit pink, and violet restore the earlier renderer's color roles. Gold, sage, and ivory interrupt the field. The interface keeps source selection and playback controls at the edge of the scene. Explanations belong in these documents. The listening surface keeps brief action labels and status feedback.

The design vocabulary contributed two broad ideas. Stable control positions keep actions easy to find as the scene moves. Local event responses give a musical attack a bounded spatial consequence. These ideas were adapted to Faltone. No private reference text or assets are included.

[Falling through music](falling-through-music.md) records the public precedents, their limits, and proposed perceptual comparisons. Its claims about interpretation remain hypotheses until listeners test them.

## Implementation

`FallWorld` supplies semantic values to Three.js shader uniforms. `descentGeometry.ts` creates 64 contour strips, particles, and 156 seeded fragments spread across 180 depth units. `descentShaders.ts` maps those attributes into moving depth on the GPU. The fragments have separate bass, mid, and high voices. Some contract while others expand. Their phase and rotation differ. Four draw calls render the scene. Eight stored wake positions let detected attacks leave local traces along the passage. These traces reflect recent input; they do not predict future notes.

The audio adapters retain the pure `MusicAnalyzer` and the core fall and reactivity models. Local files add playback, seeking, pause, and resource cleanup. Display capture remains analysis only. The renderer never receives raw audio buffers.

Pause stops the controller and pauses audio that Faltone plays. Still mode freezes spatial time, travel, and camera movement while audio and light response continue. The operating system's reduced-motion preference selects still mode at startup. Focus mode hides controls and removes them from keyboard navigation.

Unused polygon, pigment, palette, and old geometry modules were removed after an import search found no runtime consumers. Their tests were removed with them. The motion-preference helper and its tests remain. Git history retains the earlier renderer, mapping tables, and historical QA notes.

## Verification

Run from the repository root:

```bash
npm test
npm run lint
npm run build
```

The tests cover analyzer behavior, core motion, source routing, motion preferences, and audio lifecycle races. They do not establish shader appearance, browser codec support, tab-capture compatibility, or listener comfort. Browser observations must be recorded separately with the tested source and conditions. Earlier renderer QA is not evidence for this renderer.

### Observed browser checks

The Codex browser rendered the new contour world without reported console errors. A generated 32-second stereo WAV exercised the actual file picker, HTML audio playback, Web Audio analysis, and renderer path. The signal meter reached 0.3. The progress control advanced to 0:06, held there while paused, and moved to 0:16 after a seek and resume. File completion returned the source label to ambient.

The final interface removes the editorial introduction and keeps functional controls only. The browser accessibility tree confirmed the glyph, settings, fullscreen, source selector, file, pause, and focus controls.

After the browser reconnected, the final layout passed visual checks at 1440 × 900, 390 × 844, and 844 × 390. The desktop document had no horizontal overflow. The portrait dock stayed inside the viewport. The landscape source chooser and loaded-track progress controls also fit.

On mobile, the source changed from ambient to visual demo, then to the generated local WAV. The demo meter reached 1. The local WAV reached 0.4 with progress at 0:06. Pause produced identical screenshot bytes across two separated captures. Focus hid the header and dock, made the dock inert, and kept the exit control accessible. Both Escape and the exit button restored the controls. Motion-off kept the contour positions fixed across separated screenshots while the controller continued running. Reload restored ambient with motion enabled.

The tab-audio control reached the browser capture boundary. Cancellation closed the chooser and displayed the specific cancellation message. No private source was shared. Live stream capture and optional Spotify/sample configuration were not exercised end to end. Adapter tests cover capture ownership races and sample/local pause behavior. These limits do not imply validation of every browser, codec, or permission configuration.

After the color revision, separated browser captures showed fixed contour and fragment positions in still mode while the visual demo continued to change light response. The renderer reported no shader errors. Final checks: 41 tests in eight files passed; lint, TypeScript, and the production build passed. Vite reported a roughly 527 kB JavaScript chunk (135 kB gzip). The local preview returned HTTP 200. These observations were recorded before landing and deployment.
