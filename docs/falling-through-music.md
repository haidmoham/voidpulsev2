# Falling through music

Research note · 2026-09-05 · scope: visual direction for Faltone

**Recommendation:** use luminous contours as the material of a passage. Give that passage a musical memory and a clear moment of crossing. A repeating tunnel establishes motion, but repetition alone does not establish movement through a song.

Confidence: **high** in the source observations below. **Medium** in the design recommendation. These sources establish precedents and constraints. They do not prove that the current prototype communicates falling or feels comfortable. That requires a moving, audible comparison.

## Eight source records

| Source | Verified observation | Relevance and limit for Faltone |
| --- | --- | --- |
| **1. Jean-Claude Risset, interviewed by Laurent Lefèvre, CAES du CNRS, 2016.** [Jean-Claude Risset, chercheur de sons](https://mag.caes.cnrs.fr/jean-claude-risset-chercheur-de-sons/) | Risset describes extending Shepard's endless pitch motion. He explicitly identifies an infinite descent in *La Chute*, part of *Computer Suite for Little Boy*. He distinguishes perceived motion from changes in physical sound parameters. | This is a direct musical precedent for endless falling. It concerns an auditory illusion, not a tested visual tunnel. **Inference:** continuity can be more convincing than literal acceleration or a visible destination. |
| **2. Stephen Malinowski, creator of the Music Animation Machine.** [Scrolling studies](https://www.musanim.com/Scrolling/) | Malinowski compares a moving present marker with a fixed present marker and scrolling music. His perspective variant projects the score onto a curved surface that compresses toward a horizon. He also compares views that reveal different spans of musical time. | This provides the strongest temporal-space reference. The present has a stable location; depth can carry timing. **Limit:** a score supplies future events. Live audio does not. Faltone must not suggest that arbitrary distant rings predict an upcoming note. |
| **3. Dylan Fitterer's Audiosurf, developer product description.** [Audiosurf on Steam](https://store.steampowered.com/app/12900/AudioSurf/) | The chosen song determines the ride's shape, speed, and mood. The game accepts the player's music collection. | This distinguishes travel through music from a generic environment with reactive brightness. **Inference:** two different songs should produce meaningfully different journeys. A fixed tunnel with interchangeable pulses only partly meets that promise. The source does not specify an analysis algorithm. |
| **4. Tetsuya Mizuguchi, creator account, 2016.** [Rez Infinite: Enter Area X](https://blog.playstation.com/?p=182498) | Mizuguchi describes a focused, replayable audiovisual experience. He says the team discarded much of the original formula and tested aesthetics and gameplay through iteration. Simple shooting mechanics supported the sensory experience. | The useful precedent is a coherent relationship between action, sound, and visual consequence. The article does not establish that particles, neon, or a tunnel are necessary. Treat its use of “synesthesia” as creative intent, not a clinical outcome to promise. |
| **5. Marc Flury, Drool co-founder, 2016.** [Thumper is Unleashing Rhythm Hell](https://blog.playstation.com/2016/03/09/thumper-is-unleashing-rhythm-hell-on-playstation-vr/) | Flury links simple controls to an extreme sense of speed and physicality. The route develops from one lane to multiple lanes of rhythmic cues and obstacles. | The passage has events that the player reaches. **Inference:** a contour should approach, cross, and leave, rather than simply expand in place. Thumper deliberately pursues intensity; its violent motion is a counterexample for a calm listening experience. |
| **6. Jordan Belson film notes, Center for Visual Music.** [Film notes](https://www.centerforvisualmusic.org/BelsonFilmNotes.html) | The archive documents centric, meditative imagery in *Mandala*. Belson describes *Allures* as a progression from sensual material toward a nonmaterial ending. Its imagery developed from his Vortex work. | Organic light and a centered composition have a substantial visual-music lineage. Belson also supplies an argument for transformation across an entire work. **Limit:** atmospheric abstraction is not evidence that the viewer perceives literal descent. |
| **7. W3C WAI, WCAG 2.2 explanatory guidance.** [Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) | The guidance identifies vestibular reactions to motion. It recommends respecting motion preferences and providing a way to disable nonessential animation. It distinguishes animation caused by interaction from animation that starts automatically. | Faltone needs direct control over motion. A slower moving tunnel still moves. This source is accessibility guidance, not a finding that a particular speed, field of view, or frame rate is comfortable. |
| **8. Center for Visual Music, authorized Belson archive.** [Belson research and preservation site](https://www.centerforvisualmusic.org/Belson/) | The archive says Belson opposed replacing his soundtracks. It states his wishes about full films online and its authorization to restore and distribute his work. | Use the work as a reference for composition and pacing. The research links do not authorize copying films, textures, stills, or soundtracks into Faltone. |

## Test the contour direction

The contour tunnel is a reasonable candidate. Its repeated boundaries can establish a passage and its center can provide a stable point of attention. This is a design inference. It remains unverified in the prototype.

Three failure modes could undermine it:

- **A flat rosette:** concentric outlines expand together, but no object appears to pass the viewer. Test independent depth, near-field clipping, and a few small persistent landmarks. Keep some contours quiet so the viewer can compare their motion.
- **A flight corridor:** radial expansion can read as forward flight. A camera axis named “down” does not communicate gravity on its own. Compare a restrained downward drift with a purely axial view. Ask which feels like falling before adding explanatory copy.
- **A moving wallpaper:** every chorus, pause, and ending produces the same loop with different brightness. Retain musical changes long enough to alter the experience of a later moment. Do not make every band change every property.

Organic contours are one material, not a commitment to constant organic deformation. A stable irregular shape that the viewer passes may communicate space better than many outlines that continually morph.

## Give musical time a spatial role

Use three distinct time scales. These are implementation proposals, not findings from the cited works.

| Musical time | Proposed spatial role | Acceptance observation |
| --- | --- | --- |
| Immediate attack and release | A local contour response at the viewer's present location. Avoid a simultaneous full-scene flash. | A listener can identify the visual event associated with a particular audible attack. |
| Several seconds | A gradual change in corridor width, material density, or contour spacing. Retain some history instead of erasing every change at the next frame. | A quiet passage and a dense passage feel spatially different after matching their overall brightness. |
| Whole piece or session | An arrival, development, and release. Let recurring material return with recognizable traits. | The end feels like an ending when the source actually supplies an ending. An unknown live stream does not show invented completion. |

For an authored demo, schedule a few structural transitions against its known musical phrases. A small composed journey is a stronger demonstration than a full-response/silence diagnostic. For a local file, playback position and duration can support honest progress. Further analysis may support advance preparation of the route. Treat phrase labels as unknown until they are actually supplied or inferred with evidence.

For live capture, use a causal response. Current and recent features may shape the immediate passage. Keep the distance ahead atmospheric unless the system has an explicit prediction model. Do not label it as the song's future. A live stream also does not supply a reliable song boundary merely because its current volume falls.

Keep tempo-related travel smooth. Let spectral changes affect specific materials. Let a sustained musical change alter the surrounding space. This separates the feeling of continuing to fall from the fact that the music is changing.

## Motion control and source boundaries

Provide a visible pause control and a still mode. Respect the operating system's reduced-motion setting at entry. In still mode, disable locomotion, camera roll, lateral drift, and field-of-view pulses. Permit gentle material changes only if the user retains control. These are Faltone design proposals informed by W3C guidance; they are not a claim of formal WCAG conformance. [W3C motion guidance](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)

Keep a stable viewing direction by default. Compare any drift or rotation against that baseline. Do not assume that reducing all movement by one scale factor resolves discomfort. Test the actual animation on both desktop and mobile.

The sources are research references. No media from them was downloaded or added to the application for this note. Create Faltone's geometry and demo audio independently. Keep attribution and license evidence with any externally supplied asset. In particular, do not replace Belson's soundtrack or extract his imagery for a new loop. [CVM's statement of Belson's wishes](https://www.centerforvisualmusic.org/Belson/)

## Focused evaluation

Compare the current contour treatment with a version that has less deformation, clearer crossings, and two or three persistent musical transformations. Use the same audio and entry time.

1. Watch briefly without sound. Record whether the motion reads as falling, forward flight, or a flat pattern.
2. Listen to a quiet passage, a dense passage, and a transition. Record whether the spatial differences follow those passages or merely the instantaneous level.
3. Repeat the same audio with deliberately delayed visual responses. The synchronized version should be recognizably more coherent. This is an exploratory comparison, not a validated timing threshold.
4. Pause and resume. Confirm that the world does not jump. Enter still mode. Confirm that the camera and depth translation actually stop.
5. Watch through a known ending. Confirm that the experience releases or resolves instead of immediately recycling into an unrelated beginning.

Record the listener's interpretation before explaining the intended metaphor. If the scene only reads as falling after the explanation, revise the scene or narrow the product claim.
